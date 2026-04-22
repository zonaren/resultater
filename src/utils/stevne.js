import { supabase } from '../supabase.js'

export async function hentStevner(ar) {
  return supabase
    .from('stevne')
    .select(`
      id, navn, sted, dato, ernm, erfullfort, innbydelseurl, resultaturl,
      klubb:klubbid(id, navn),
      stevnetype:stevnetypeid(id, navn),
      innledende:kastemetode!innledendekastemetodeid(id, navn),
      avsluttende:kastemetode!avsluttendekastemetodeid(id, navn),
      kategori:kategoriid(id, navn)
    `)
    .gte('dato', `${ar}-01-01`)
    .lte('dato', `${ar}-12-31`)
    .order('dato')
}

export async function hentFiltervalg() {
  const [stevnetyper, kastemetoder, klubber, kategorier] = await Promise.all([
    supabase.from('stevnetype').select('id, navn').order('navn'),
    supabase.from('kastemetode').select('id, navn').order('navn'),
    supabase.from('klubb').select('id, navn').order('navn'),
    supabase.from('kategori').select('id, navn').order('navn'),
  ])
  return {
    stevnetyper: stevnetyper.data ?? [],
    kastemetoder: kastemetoder.data ?? [],
    klubber: klubber.data ?? [],
    kategorier: kategorier.data ?? [],
  }
}

export async function hentPameldte(userId) {
  const { data } = await supabase
    .from('pamelding')
    .select('stevneid')
    .eq('bruker_id', userId)
  return new Set((data ?? []).map(r => r.stevneid))
}
