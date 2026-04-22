-- Fjern ubrukte kolonnar frå pamelding-tabellen.
-- Avmelding skjer ved sletting av rad (ikkje status-endring).

ALTER TABLE public.pamelding
  DROP COLUMN IF EXISTS klasse_id,
  DROP COLUMN IF EXISTS gruppe_id,
  DROP COLUMN IF EXISTS merknad,
  DROP COLUMN IF EXISTS status;
