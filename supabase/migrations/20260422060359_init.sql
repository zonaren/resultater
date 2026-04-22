-- Baseline-migrasjon. Representerer tilstanden til databasen ved oppstart av migrasjonshistorikk.
-- Markert som applied utan å køyrast -- tabellane eksisterer allereie.

CREATE TABLE public.antallTellendeNc (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  year integer UNIQUE,
  max_nc_total integer NOT NULL DEFAULT 3,
  max_dnc_total integer NOT NULL DEFAULT 10,
  max_snc_total integer NOT NULL DEFAULT 3,
  maxtotal integer NOT NULL DEFAULT 10,
  max_snc integer NOT NULL DEFAULT 3,
  max_dnc integer NOT NULL DEFAULT 6,
  CONSTRAINT antallTellendeNc_pkey PRIMARY KEY (id)
);

CREATE TABLE public.kjonn (
  id integer NOT NULL DEFAULT nextval('kjonn_id_seq'::regclass),
  navn text NOT NULL,
  kortform text NOT NULL,
  CONSTRAINT kjonn_pkey PRIMARY KEY (id)
);

CREATE TABLE public.klubb (
  id integer NOT NULL DEFAULT nextval('klubb_id_seq'::regclass),
  navn text NOT NULL,
  kortnavn text NOT NULL DEFAULT ''::text,
  eraktiv boolean NOT NULL DEFAULT true,
  logourl text,
  CONSTRAINT klubb_pkey PRIMARY KEY (id)
);

CREATE TABLE public.klasse (
  id integer NOT NULL DEFAULT nextval('klasse_id_seq'::regclass),
  navn text NOT NULL,
  eraktiv boolean NOT NULL DEFAULT true,
  har_nm_vinnere boolean NOT NULL DEFAULT false,
  CONSTRAINT klasse_pkey PRIMARY KEY (id)
);

CREATE TABLE public.gruppe (
  id integer NOT NULL DEFAULT nextval('gruppe_id_seq'::regclass),
  navn text NOT NULL,
  eraktiv boolean NOT NULL DEFAULT true,
  CONSTRAINT gruppe_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stevnetype (
  id integer NOT NULL DEFAULT nextval('stevnetype_id_seq'::regclass),
  navn text NOT NULL,
  eraktiv boolean NOT NULL DEFAULT true,
  beskrivelse text,
  CONSTRAINT stevnetype_pkey PRIMARY KEY (id)
);

CREATE TABLE public.kastemetode (
  id integer NOT NULL DEFAULT nextval('kastemetode_id_seq'::regclass),
  navn text NOT NULL,
  beskrivelse text,
  eraktiv boolean NOT NULL DEFAULT true,
  ernorgesranking boolean NOT NULL DEFAULT false,
  CONSTRAINT kastemetode_pkey PRIMARY KEY (id)
);

CREATE TABLE public.kategori (
  id integer NOT NULL DEFAULT nextval('kategori_id_seq'::regclass),
  navn text NOT NULL,
  erlagbasert boolean NOT NULL DEFAULT false,
  ernm boolean NOT NULL DEFAULT true,
  CONSTRAINT kategori_pkey PRIMARY KEY (id)
);

CREATE TABLE public.norgescuppoeng (
  id integer NOT NULL DEFAULT nextval('norgescuppoeng_id_seq'::regclass),
  plassering integer NOT NULL,
  poengnc integer NOT NULL,
  poengdnc integer NOT NULL,
  gjelderfraaar integer NOT NULL,
  gjeldertilaar integer,
  CONSTRAINT norgescuppoeng_pkey PRIMARY KEY (id)
);

CREATE TABLE public.kaster (
  id integer NOT NULL DEFAULT nextval('kaster_id_seq'::regclass),
  medlemsnummer integer,
  fornavn text NOT NULL,
  etternavn text NOT NULL,
  telefon text,
  epost text,
  kjonnid integer NOT NULL,
  klubbid integer,
  klasseid integer,
  eraktiv boolean NOT NULL DEFAULT true,
  avatarurl text,
  CONSTRAINT kaster_pkey PRIMARY KEY (id),
  CONSTRAINT kaster_kjonnid_fkey FOREIGN KEY (kjonnid) REFERENCES public.kjonn(id),
  CONSTRAINT kaster_klubbid_fkey FOREIGN KEY (klubbid) REFERENCES public.klubb(id),
  CONSTRAINT kaster_klasseid_fkey FOREIGN KEY (klasseid) REFERENCES public.klasse(id)
);

CREATE TABLE public.stevne (
  id integer NOT NULL DEFAULT nextval('stevne_id_seq'::regclass),
  navn text NOT NULL,
  sted text,
  dato timestamp with time zone,
  klubbid integer,
  stevnetypeid integer,
  innledendekastemetodeid integer,
  avsluttendekastemetodeid integer,
  kategoriid integer,
  kontaktkasterid integer,
  juryleder text,
  ernm boolean NOT NULL DEFAULT false,
  ernorgesranking boolean NOT NULL DEFAULT false,
  erfullfort boolean NOT NULL DEFAULT false,
  erekskludertfrarekorder boolean NOT NULL DEFAULT false,
  innbydelseurl text,
  resultaturl text,
  CONSTRAINT stevne_pkey PRIMARY KEY (id),
  CONSTRAINT stevne_klubbid_fkey FOREIGN KEY (klubbid) REFERENCES public.klubb(id),
  CONSTRAINT stevne_stevnetypeid_fkey FOREIGN KEY (stevnetypeid) REFERENCES public.stevnetype(id),
  CONSTRAINT stevne_innledendekastemetodeid_fkey FOREIGN KEY (innledendekastemetodeid) REFERENCES public.kastemetode(id),
  CONSTRAINT stevne_avsluttendekastemetodeid_fkey FOREIGN KEY (avsluttendekastemetodeid) REFERENCES public.kastemetode(id),
  CONSTRAINT stevne_kategoriid_fkey FOREIGN KEY (kategoriid) REFERENCES public.kategori(id),
  CONSTRAINT stevne_kontaktkasterid_fkey FOREIGN KEY (kontaktkasterid) REFERENCES public.kaster(id)
);

CREATE TABLE public.resultat (
  id integer NOT NULL DEFAULT nextval('resultat_id_seq'::regclass),
  stevneid integer,
  gruppeid integer,
  kasterid integer,
  klubbid integer,
  klasseid integer,
  plassering integer,
  erpremie boolean,
  norgescuppoeng real,
  kamppoeng real,
  skarinnledende integer,
  poengminimatch integer,
  poengxhalvmatch integer,
  poengxheilmatch integer,
  poengkongelag integer,
  poenggolf integer,
  antallringminimatch integer,
  antallringhalvmatch integer,
  antallringheilmatch integer,
  antallringkongelag integer,
  CONSTRAINT resultat_pkey PRIMARY KEY (id),
  CONSTRAINT resultat_stevneid_fkey FOREIGN KEY (stevneid) REFERENCES public.stevne(id),
  CONSTRAINT resultat_gruppeid_fkey FOREIGN KEY (gruppeid) REFERENCES public.gruppe(id),
  CONSTRAINT resultat_kasterid_fkey FOREIGN KEY (kasterid) REFERENCES public.kaster(id),
  CONSTRAINT resultat_klubbid_fkey FOREIGN KEY (klubbid) REFERENCES public.klubb(id),
  CONSTRAINT resultat_klasseid_fkey FOREIGN KEY (klasseid) REFERENCES public.klasse(id)
);

CREATE TABLE public.bruker_profil (
  id uuid NOT NULL,
  rolle text NOT NULL DEFAULT 'bruker'::text CHECK (rolle = ANY (ARRAY['admin'::text, 'klubbadmin'::text, 'bruker'::text])),
  kasterid integer,
  kobling_status text NOT NULL DEFAULT 'ingen'::text CHECK (kobling_status = ANY (ARRAY['ingen'::text, 'venter'::text, 'godkjent'::text, 'avvist'::text])),
  kobling_kasterid integer,
  opprettet_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bruker_profil_pkey PRIMARY KEY (id),
  CONSTRAINT bruker_profil_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT bruker_profil_kasterid_fkey FOREIGN KEY (kasterid) REFERENCES public.kaster(id),
  CONSTRAINT bruker_profil_kobling_kasterid_fkey FOREIGN KEY (kobling_kasterid) REFERENCES public.kaster(id)
);

CREATE TABLE public.klubbadmin_klubber (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  bruker_id uuid NOT NULL,
  klubbid integer NOT NULL,
  tildelt_av uuid,
  tildelt_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT klubbadmin_klubber_pkey PRIMARY KEY (id),
  CONSTRAINT klubbadmin_klubber_bruker_id_fkey FOREIGN KEY (bruker_id) REFERENCES auth.users(id),
  CONSTRAINT klubbadmin_klubber_klubbid_fkey FOREIGN KEY (klubbid) REFERENCES public.klubb(id),
  CONSTRAINT klubbadmin_klubber_tildelt_av_fkey FOREIGN KEY (tildelt_av) REFERENCES auth.users(id)
);

CREATE TABLE public.pamelding (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  stevneid integer NOT NULL,
  kasterid integer NOT NULL,
  bruker_id uuid NOT NULL,
  opprettet_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pamelding_pkey PRIMARY KEY (id),
  CONSTRAINT pamelding_stevneid_fkey FOREIGN KEY (stevneid) REFERENCES public.stevne(id),
  CONSTRAINT pamelding_kasterid_fkey FOREIGN KEY (kasterid) REFERENCES public.kaster(id),
  CONSTRAINT pamelding_bruker_id_fkey FOREIGN KEY (bruker_id) REFERENCES auth.users(id)
);

-- ── Hjelpefunksjon ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.min_rolle()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rolle FROM public.bruker_profil WHERE id = auth.uid();
$$;

-- ── RLS: bruker_profil ───────────────────────────────────────────────────────
ALTER TABLE public.bruker_profil ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bp_les_eigen"    ON public.bruker_profil FOR SELECT USING (auth.uid() = id);
CREATE POLICY "bp_les_admin"    ON public.bruker_profil FOR SELECT USING (public.min_rolle() = 'admin');
CREATE POLICY "bp_oppdater_eigen" ON public.bruker_profil FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND rolle = (SELECT rolle FROM public.bruker_profil WHERE id = auth.uid()));
CREATE POLICY "bp_oppdater_admin" ON public.bruker_profil FOR UPDATE USING (public.min_rolle() = 'admin');

-- ── RLS: klubbadmin_klubber ──────────────────────────────────────────────────
ALTER TABLE public.klubbadmin_klubber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kk_les_eigen" ON public.klubbadmin_klubber FOR SELECT USING (bruker_id = auth.uid());
CREATE POLICY "kk_admin_alt" ON public.klubbadmin_klubber FOR ALL   USING (public.min_rolle() = 'admin');

-- ── RLS: pamelding ───────────────────────────────────────────────────────────
ALTER TABLE public.pamelding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm_les_alle"    ON public.pamelding FOR SELECT USING (true);
CREATE POLICY "pm_insert_brukar" ON public.pamelding FOR INSERT
  WITH CHECK (auth.uid() = bruker_id AND kasterid = (SELECT kasterid FROM public.bruker_profil WHERE id = auth.uid() AND kobling_status = 'godkjent'));
CREATE POLICY "pm_oppdater_eigen" ON public.pamelding FOR UPDATE USING (auth.uid() = bruker_id);
CREATE POLICY "pm_slett_eigen"    ON public.pamelding FOR DELETE USING (auth.uid() = bruker_id);
CREATE POLICY "pm_admin_alt"      ON public.pamelding FOR ALL   USING (public.min_rolle() = 'admin');
CREATE POLICY "pm_klubbadmin_sine_stevner" ON public.pamelding FOR ALL
  USING (EXISTS (SELECT 1 FROM public.stevne s JOIN public.klubbadmin_klubber kk ON kk.klubbid = s.klubbid WHERE s.id = pamelding.stevneid AND kk.bruker_id = auth.uid()));
CREATE POLICY "pm_insert_klubbadmin" ON public.pamelding FOR INSERT
  WITH CHECK (public.min_rolle() = 'klubbadmin' AND EXISTS (SELECT 1 FROM public.kaster k JOIN public.klubbadmin_klubber kk ON kk.klubbid = k.klubbid WHERE k.id = kasterid AND kk.bruker_id = auth.uid()));

-- ── RLS: stevne ─────────────────────────────────────────────────────────────
CREATE POLICY "stevne_insert_admin"     ON public.stevne FOR INSERT WITH CHECK (public.min_rolle() = 'admin');
CREATE POLICY "stevne_update_admin"     ON public.stevne FOR UPDATE USING (public.min_rolle() = 'admin');
CREATE POLICY "stevne_delete_admin"     ON public.stevne FOR DELETE USING (public.min_rolle() = 'admin');
CREATE POLICY "stevne_update_klubbadmin" ON public.stevne FOR UPDATE
  USING (public.min_rolle() = 'klubbadmin' AND EXISTS (SELECT 1 FROM public.klubbadmin_klubber kk WHERE kk.bruker_id = auth.uid() AND kk.klubbid = stevne.klubbid));
CREATE POLICY "stevne_insert_klubbadmin" ON public.stevne FOR INSERT
  WITH CHECK (public.min_rolle() = 'klubbadmin' AND EXISTS (SELECT 1 FROM public.klubbadmin_klubber kk WHERE kk.bruker_id = auth.uid() AND kk.klubbid = klubbid));

-- ── RLS: kaster ─────────────────────────────────────────────────────────────
CREATE POLICY "kaster_insert_admin"      ON public.kaster FOR INSERT WITH CHECK (public.min_rolle() = 'admin');
CREATE POLICY "kaster_update_admin"      ON public.kaster FOR UPDATE USING (public.min_rolle() = 'admin');
CREATE POLICY "kaster_delete_admin"      ON public.kaster FOR DELETE USING (public.min_rolle() = 'admin');
CREATE POLICY "kaster_insert_klubbadmin" ON public.kaster FOR INSERT
  WITH CHECK (public.min_rolle() = 'klubbadmin' AND EXISTS (SELECT 1 FROM public.klubbadmin_klubber kk WHERE kk.bruker_id = auth.uid() AND kk.klubbid = klubbid));
CREATE POLICY "kaster_update_klubbadmin" ON public.kaster FOR UPDATE
  USING (public.min_rolle() = 'klubbadmin' AND EXISTS (SELECT 1 FROM public.klubbadmin_klubber kk WHERE kk.bruker_id = auth.uid() AND kk.klubbid = kaster.klubbid));

-- ── RLS: klubb ──────────────────────────────────────────────────────────────
CREATE POLICY "klubb_insert_admin"      ON public.klubb FOR INSERT WITH CHECK (public.min_rolle() = 'admin');
CREATE POLICY "klubb_update_admin"      ON public.klubb FOR UPDATE USING (public.min_rolle() = 'admin');
CREATE POLICY "klubb_delete_admin"      ON public.klubb FOR DELETE USING (public.min_rolle() = 'admin');
CREATE POLICY "klubb_update_klubbadmin" ON public.klubb FOR UPDATE
  USING (public.min_rolle() = 'klubbadmin' AND EXISTS (SELECT 1 FROM public.klubbadmin_klubber kk WHERE kk.bruker_id = auth.uid() AND kk.klubbid = klubb.id));

-- ── Trigger: auto-opprett bruker_profil ved registrering ────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.bruker_profil (id, rolle) VALUES (NEW.id, 'bruker') ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Funksjon: hent e-post (berre admin) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hent_bruker_epost(bruker_ids uuid[])
RETURNS TABLE(id uuid, epost text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT au.id, au.email FROM auth.users au WHERE au.id = ANY(bruker_ids) AND public.min_rolle() = 'admin';
$$;

-- ── View: kaster_rekorder ────────────────────────────────────────────────────
CREATE OR REPLACE VIEW kaster_rekorder AS
SELECT 'kongelag' AS metode, r.poengkongelag AS poeng,
  k.id AS kasterid, k.fornavn, k.etternavn,
  kj.id AS kjonn_id, kj.navn AS kjonn_navn,
  kb.id AS klubb_id, kb.navn AS klubb_navn,
  s.id AS stevne_id, s.navn AS stevne_navn,
  EXTRACT(YEAR FROM s.dato)::int AS ar
FROM (SELECT DISTINCT ON (kasterid) kasterid, poengkongelag, klubbid, stevneid FROM resultat WHERE poengkongelag IS NOT NULL ORDER BY kasterid, poengkongelag DESC) r
JOIN kaster k ON k.id = r.kasterid LEFT JOIN kjonn kj ON kj.id = k.kjonnid LEFT JOIN klubb kb ON kb.id = r.klubbid LEFT JOIN stevne s ON s.id = r.stevneid
UNION ALL
SELECT 'minimatch', r.poengminimatch, k.id, k.fornavn, k.etternavn, kj.id, kj.navn, kb.id, kb.navn, s.id, s.navn, EXTRACT(YEAR FROM s.dato)::int
FROM (SELECT DISTINCT ON (kasterid) kasterid, poengminimatch, klubbid, stevneid FROM resultat WHERE poengminimatch IS NOT NULL ORDER BY kasterid, poengminimatch DESC) r
JOIN kaster k ON k.id = r.kasterid LEFT JOIN kjonn kj ON kj.id = k.kjonnid LEFT JOIN klubb kb ON kb.id = r.klubbid LEFT JOIN stevne s ON s.id = r.stevneid
UNION ALL
SELECT 'halvmatch', r.poengxhalvmatch, k.id, k.fornavn, k.etternavn, kj.id, kj.navn, kb.id, kb.navn, s.id, s.navn, EXTRACT(YEAR FROM s.dato)::int
FROM (SELECT DISTINCT ON (kasterid) kasterid, poengxhalvmatch, klubbid, stevneid FROM resultat WHERE poengxhalvmatch IS NOT NULL ORDER BY kasterid, poengxhalvmatch DESC) r
JOIN kaster k ON k.id = r.kasterid LEFT JOIN kjonn kj ON kj.id = k.kjonnid LEFT JOIN klubb kb ON kb.id = r.klubbid LEFT JOIN stevne s ON s.id = r.stevneid
UNION ALL
SELECT 'heilmatch', r.poengxheilmatch, k.id, k.fornavn, k.etternavn, kj.id, kj.navn, kb.id, kb.navn, s.id, s.navn, EXTRACT(YEAR FROM s.dato)::int
FROM (SELECT DISTINCT ON (kasterid) kasterid, poengxheilmatch, klubbid, stevneid FROM resultat WHERE poengxheilmatch IS NOT NULL ORDER BY kasterid, poengxheilmatch DESC) r
JOIN kaster k ON k.id = r.kasterid LEFT JOIN kjonn kj ON kj.id = k.kjonnid LEFT JOIN klubb kb ON kb.id = r.klubbid LEFT JOIN stevne s ON s.id = r.stevneid;
