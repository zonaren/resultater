-- ============================================================
-- Auth-migrasjon: brukar_profil, klubbadmin_klubber, pamelding
-- + RLS-politikkar, trigger og hjelpefunksjonar
-- ============================================================
-- VIKTIG: Køyr dette i Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- TABELL: bruker_profil
-- 1:1 med auth.users. Auto-oppretta av trigger ved registrering.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bruker_profil (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rolle            text NOT NULL DEFAULT 'bruker'
                     CHECK (rolle IN ('admin', 'klubbadmin', 'bruker')),
  kasterid         integer REFERENCES public.kaster(id) ON DELETE SET NULL,
  kobling_status   text NOT NULL DEFAULT 'ingen'
                     CHECK (kobling_status IN ('ingen', 'venter', 'godkjent', 'avvist')),
  kobling_kasterid integer REFERENCES public.kaster(id) ON DELETE SET NULL,
  opprettet_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABELL: klubbadmin_klubber
-- Kva klubbar ein klubbadmin har skrivetilgang til.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.klubbadmin_klubber (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bruker_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  klubbid     integer NOT NULL REFERENCES public.klubb(id) ON DELETE CASCADE,
  tildelt_av  uuid REFERENCES auth.users(id),
  tildelt_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bruker_id, klubbid)
);

-- ============================================================
-- TABELL: pamelding
-- Påmelding til stevner frå innlogga, linka brukare.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pamelding (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stevneid     integer NOT NULL REFERENCES public.stevne(id) ON DELETE CASCADE,
  kasterid     integer NOT NULL REFERENCES public.kaster(id) ON DELETE CASCADE,
  bruker_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  klasse_id    integer REFERENCES public.klasse(id),
  gruppe_id    integer REFERENCES public.gruppe(id),
  merknad      text,
  status       text NOT NULL DEFAULT 'pameldt'
                 CHECK (status IN ('pameldt', 'avmeldt', 'bekreftet')),
  opprettet_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stevneid, kasterid)
);

-- ============================================================
-- HJELPEFUNKSJON: unngår uendeleg rekursjon i RLS-politikkar
-- Må opprettast etter bruker_profil-tabellen.
-- ============================================================
CREATE OR REPLACE FUNCTION public.min_rolle()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rolle FROM public.bruker_profil WHERE id = auth.uid();
$$;

-- ============================================================
-- RLS: bruker_profil
-- ============================================================
ALTER TABLE public.bruker_profil ENABLE ROW LEVEL SECURITY;

-- Brukar ser berre sin eigen profil
CREATE POLICY "bp_les_eigen"
  ON public.bruker_profil FOR SELECT
  USING (auth.uid() = id);

-- Admin ser alle profiler (brukar min_rolle() for å unngå rekursjon)
CREATE POLICY "bp_les_admin"
  ON public.bruker_profil FOR SELECT
  USING (public.min_rolle() = 'admin');

-- Brukar kan oppdatere eiga kobling (ikkje endre rolla si)
CREATE POLICY "bp_oppdater_eigen"
  ON public.bruker_profil FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND rolle = (SELECT rolle FROM public.bruker_profil WHERE id = auth.uid())
  );

-- Admin kan oppdatere alle profiler
CREATE POLICY "bp_oppdater_admin"
  ON public.bruker_profil FOR UPDATE
  USING (public.min_rolle() = 'admin');

-- ============================================================
-- RLS: klubbadmin_klubber
-- ============================================================
ALTER TABLE public.klubbadmin_klubber ENABLE ROW LEVEL SECURITY;

-- Klubbadmin ser eigne rader
CREATE POLICY "kk_les_eigen"
  ON public.klubbadmin_klubber FOR SELECT
  USING (bruker_id = auth.uid());

-- Admin full tilgang
CREATE POLICY "kk_admin_alt"
  ON public.klubbadmin_klubber FOR ALL
  USING (public.min_rolle() = 'admin');

-- ============================================================
-- RLS: pamelding
-- ============================================================
ALTER TABLE public.pamelding ENABLE ROW LEVEL SECURITY;

-- Alle kan lese (påmeldingslister er offentlege)
CREATE POLICY "pm_les_alle"
  ON public.pamelding FOR SELECT
  USING (true);

-- Innlogga, godkjent-linka brukar kan melde seg på
CREATE POLICY "pm_insert_brukar"
  ON public.pamelding FOR INSERT
  WITH CHECK (
    auth.uid() = bruker_id
    AND kasterid = (
      SELECT kasterid FROM public.bruker_profil
      WHERE id = auth.uid() AND kobling_status = 'godkjent'
    )
  );

-- Brukar kan oppdatere eiga påmelding
CREATE POLICY "pm_oppdater_eigen"
  ON public.pamelding FOR UPDATE
  USING (auth.uid() = bruker_id);

-- Brukar kan melde seg av (slette) eiga påmelding
CREATE POLICY "pm_slett_eigen"
  ON public.pamelding FOR DELETE
  USING (auth.uid() = bruker_id);

-- Admin full tilgang
CREATE POLICY "pm_admin_alt"
  ON public.pamelding FOR ALL
  USING (public.min_rolle() = 'admin');

-- Klubbadmin kan handtere påmeldingar for stevner arrangert av sine klubbar
CREATE POLICY "pm_klubbadmin_sine_stevner"
  ON public.pamelding FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.stevne s
      JOIN public.klubbadmin_klubber kk ON kk.klubbid = s.klubbid
      WHERE s.id = pamelding.stevneid AND kk.bruker_id = auth.uid()
    )
  );

-- ============================================================
-- RLS: skrivetilgang på eksisterande tabellar
-- Eksisterande anon read-tilgang er uendra.
-- ============================================================

-- stevne: admin og klubbadmin for sine klubbar
CREATE POLICY "stevne_insert_admin"
  ON public.stevne FOR INSERT
  WITH CHECK (public.min_rolle() = 'admin');

CREATE POLICY "stevne_update_admin"
  ON public.stevne FOR UPDATE
  USING (public.min_rolle() = 'admin');

CREATE POLICY "stevne_delete_admin"
  ON public.stevne FOR DELETE
  USING (public.min_rolle() = 'admin');

CREATE POLICY "stevne_update_klubbadmin"
  ON public.stevne FOR UPDATE
  USING (
    public.min_rolle() = 'klubbadmin'
    AND EXISTS (
      SELECT 1 FROM public.klubbadmin_klubber kk
      WHERE kk.bruker_id = auth.uid() AND kk.klubbid = stevne.klubbid
    )
  );

CREATE POLICY "stevne_insert_klubbadmin"
  ON public.stevne FOR INSERT
  WITH CHECK (
    public.min_rolle() = 'klubbadmin'
    AND EXISTS (
      SELECT 1 FROM public.klubbadmin_klubber kk
      WHERE kk.bruker_id = auth.uid() AND kk.klubbid = klubbid
    )
  );

-- kaster: admin full, klubbadmin for sine klubbar
CREATE POLICY "kaster_insert_admin"
  ON public.kaster FOR INSERT
  WITH CHECK (public.min_rolle() = 'admin');

CREATE POLICY "kaster_update_admin"
  ON public.kaster FOR UPDATE
  USING (public.min_rolle() = 'admin');

CREATE POLICY "kaster_delete_admin"
  ON public.kaster FOR DELETE
  USING (public.min_rolle() = 'admin');

CREATE POLICY "kaster_insert_klubbadmin"
  ON public.kaster FOR INSERT
  WITH CHECK (
    public.min_rolle() = 'klubbadmin'
    AND EXISTS (
      SELECT 1 FROM public.klubbadmin_klubber kk
      WHERE kk.bruker_id = auth.uid() AND kk.klubbid = klubbid
    )
  );

CREATE POLICY "kaster_update_klubbadmin"
  ON public.kaster FOR UPDATE
  USING (
    public.min_rolle() = 'klubbadmin'
    AND EXISTS (
      SELECT 1 FROM public.klubbadmin_klubber kk
      WHERE kk.bruker_id = auth.uid() AND kk.klubbid = kaster.klubbid
    )
  );

-- klubb: admin full, klubbadmin kan oppdatere sine
CREATE POLICY "klubb_insert_admin"
  ON public.klubb FOR INSERT
  WITH CHECK (public.min_rolle() = 'admin');

CREATE POLICY "klubb_update_admin"
  ON public.klubb FOR UPDATE
  USING (public.min_rolle() = 'admin');

CREATE POLICY "klubb_delete_admin"
  ON public.klubb FOR DELETE
  USING (public.min_rolle() = 'admin');

CREATE POLICY "klubb_update_klubbadmin"
  ON public.klubb FOR UPDATE
  USING (
    public.min_rolle() = 'klubbadmin'
    AND EXISTS (
      SELECT 1 FROM public.klubbadmin_klubber kk
      WHERE kk.bruker_id = auth.uid() AND kk.klubbid = klubb.id
    )
  );

-- ============================================================
-- TRIGGER: auto-opprett brukar_profil ved registrering
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.bruker_profil (id, rolle)
  VALUES (NEW.id, 'bruker')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNKSJON: hent e-post frå auth.users (berre tilgjengeleg for admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.hent_bruker_epost(bruker_ids uuid[])
RETURNS TABLE(id uuid, epost text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT au.id, au.email
  FROM auth.users au
  WHERE au.id = ANY(bruker_ids)
    AND public.min_rolle() = 'admin';
$$;

-- ============================================================
-- BACKFILL: legg inn eksisterande auth-brukarar som manglar profil
-- ============================================================
INSERT INTO public.bruker_profil (id, rolle)
SELECT id, 'bruker'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.bruker_profil)
ON CONFLICT (id) DO NOTHING;
