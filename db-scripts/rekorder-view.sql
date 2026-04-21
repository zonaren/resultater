CREATE OR REPLACE VIEW kaster_rekorder AS

SELECT 'kongelag' AS metode, r.poengkongelag AS poeng,
  k.id AS kasterid, k.fornavn, k.etternavn,
  kj.id AS kjonn_id, kj.navn AS kjonn_navn,
  kb.id AS klubb_id, kb.navn AS klubb_navn,
  s.id AS stevne_id, s.navn AS stevne_navn,
  EXTRACT(YEAR FROM s.dato)::int AS ar
FROM (
  SELECT DISTINCT ON (kasterid) kasterid, poengkongelag, klubbid, stevneid
  FROM resultat WHERE poengkongelag IS NOT NULL
  ORDER BY kasterid, poengkongelag DESC
) r
JOIN kaster k ON k.id = r.kasterid
LEFT JOIN kjonn kj ON kj.id = k.kjonnid
LEFT JOIN klubb kb ON kb.id = r.klubbid
LEFT JOIN stevne s ON s.id = r.stevneid

UNION ALL

SELECT 'minimatch', r.poengminimatch,
  k.id, k.fornavn, k.etternavn,
  kj.id, kj.navn, kb.id, kb.navn,
  s.id, s.navn, EXTRACT(YEAR FROM s.dato)::int
FROM (
  SELECT DISTINCT ON (kasterid) kasterid, poengminimatch, klubbid, stevneid
  FROM resultat WHERE poengminimatch IS NOT NULL
  ORDER BY kasterid, poengminimatch DESC
) r
JOIN kaster k ON k.id = r.kasterid
LEFT JOIN kjonn kj ON kj.id = k.kjonnid
LEFT JOIN klubb kb ON kb.id = r.klubbid
LEFT JOIN stevne s ON s.id = r.stevneid

UNION ALL

SELECT 'halvmatch', r.poengxhalvmatch,
  k.id, k.fornavn, k.etternavn,
  kj.id, kj.navn, kb.id, kb.navn,
  s.id, s.navn, EXTRACT(YEAR FROM s.dato)::int
FROM (
  SELECT DISTINCT ON (kasterid) kasterid, poengxhalvmatch, klubbid, stevneid
  FROM resultat WHERE poengxhalvmatch IS NOT NULL
  ORDER BY kasterid, poengxhalvmatch DESC
) r
JOIN kaster k ON k.id = r.kasterid
LEFT JOIN kjonn kj ON kj.id = k.kjonnid
LEFT JOIN klubb kb ON kb.id = r.klubbid
LEFT JOIN stevne s ON s.id = r.stevneid

UNION ALL

SELECT 'heilmatch', r.poengxheilmatch,
  k.id, k.fornavn, k.etternavn,
  kj.id, kj.navn, kb.id, kb.navn,
  s.id, s.navn, EXTRACT(YEAR FROM s.dato)::int
FROM (
  SELECT DISTINCT ON (kasterid) kasterid, poengxheilmatch, klubbid, stevneid
  FROM resultat WHERE poengxheilmatch IS NOT NULL
  ORDER BY kasterid, poengxheilmatch DESC
) r
JOIN kaster k ON k.id = r.kasterid
LEFT JOIN kjonn kj ON kj.id = k.kjonnid
LEFT JOIN klubb kb ON kb.id = r.klubbid
LEFT JOIN stevne s ON s.id = r.stevneid;
