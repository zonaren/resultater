-- Køyr i Supabase SQL Editor.
-- Gjev klubbadmin tilgang til å melde på utøvarar frå sine klubbar.
-- (Admin er allereie dekt av pm_admin_alt.)

CREATE POLICY "pm_insert_klubbadmin"
  ON public.pamelding FOR INSERT
  WITH CHECK (
    public.min_rolle() = 'klubbadmin'
    AND EXISTS (
      SELECT 1 FROM public.kaster k
      JOIN public.klubbadmin_klubber kk ON kk.klubbid = k.klubbid
      WHERE k.id = kasterid AND kk.bruker_id = auth.uid()
    )
  );
