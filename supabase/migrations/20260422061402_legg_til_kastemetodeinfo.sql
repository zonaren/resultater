ALTER TABLE public.kastemetode
  ADD COLUMN er_innledende boolean NOT NULL DEFAULT false,
  ADD COLUMN er_avsluttende boolean NOT NULL DEFAULT false;

-- Angre: npx supabase migration new angre_kastemetodeinfo, legg inn:
-- ALTER TABLE public.kastemetode DROP COLUMN er_innledende, DROP COLUMN er_avsluttende;
