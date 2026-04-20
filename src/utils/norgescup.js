import { supabase } from '../supabase.js'
import { kasterNavn } from './kaster.js'

const NC_TYPER = ['NC', 'SNC', 'DNC']

export function formaterPoeng(p) {
  if (p == null) return '–'
  const n = Number(p)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export async function hentRegler(ar) {
  const { data, error } = await supabase
    .from('antallTellendeNc')
    .select('*')
    .eq('year', ar)
    .maybeSingle()
  return { data, error }
}

export async function hentStevnerOgResultater(ar) {
  const { data: allStevner, error: e1 } = await supabase
    .from('stevne')
    .select('id, navn, dato, stevnetype:stevnetypeid(id, navn)')
    .gte('dato', `${ar}-01-01`)
    .lte('dato', `${ar}-12-31`)

  if (e1) return { stevner: [], resultater: [], error: e1 }

  const ncStevner = (allStevner ?? []).filter(s => NC_TYPER.includes(s.stevnetype?.navn))
  const ids = ncStevner.map(s => s.id)

  if (ids.length === 0) return { stevner: ncStevner, resultater: [], error: null }

  const { data: resultater, error: e2 } = await supabase
    .from('resultat')
    .select(`
      id, norgescuppoeng, plassering, kasterid, klubbid, klasseid, stevneid,
      kaster:kasterid(id, fornavn, etternavn),
      klubb:klubbid(id, navn),
      klasse:klasseid(id, navn)
    `)
    .in('stevneid', ids)
    .not('norgescuppoeng', 'is', null)
    .gt('norgescuppoeng', 0)

  return { stevner: ncStevner, resultater: resultater ?? [], error: e2 }
}

function lagStevnerMap(stevner) {
  const m = new Map()
  for (const s of stevner) {
    m.set(s.id, { navn: s.navn, dato: s.dato, typeNavn: s.stevnetype?.navn ?? '' })
  }
  return m
}

function sorterDesc(arr) {
  return [...arr].sort((a, b) => b.norgescuppoeng - a.norgescuppoeng)
}

function beregnNcPoeng(rader, regler, stevnerMap) {
  const nc = [], snc = [], dnc = []
  for (const r of rader) {
    const t = stevnerMap.get(r.stevneid)?.typeNavn ?? ''
    if (t === 'NC') nc.push(r)
    else if (t === 'SNC') snc.push(r)
    else if (t === 'DNC') dnc.push(r)
  }
  const tellNc = sorterDesc(nc).slice(0, regler.max_nc_total)
  const tellSnc = sorterDesc(snc).slice(0, regler.max_snc_total)
  const maxDnc = regler.max_dnc_total > 0 ? regler.max_dnc_total : Infinity
  const tellDnc = sorterDesc(dnc).slice(0, maxDnc)
  return sorterDesc([...tellNc, ...tellSnc, ...tellDnc]).slice(0, regler.maxtotal)
}

function beregnSncPoeng(rader, regler, stevnerMap) {
  const snc = rader.filter(r => stevnerMap.get(r.stevneid)?.typeNavn === 'SNC')
  return sorterDesc(snc).slice(0, regler.max_snc)
}

function beregnDncPoeng(rader, regler, stevnerMap) {
  const dnc = rader.filter(r => stevnerMap.get(r.stevneid)?.typeNavn === 'DNC')
  return sorterDesc(dnc).slice(0, regler.max_dnc)
}

export function velgBeregnFunksjon(cupType) {
  if (cupType === 'SNC') return beregnSncPoeng
  if (cupType === 'DNC') return beregnDncPoeng
  return beregnNcPoeng
}

function tildelPlassering(liste, poengFelt) {
  let pl = 1
  for (let i = 0; i < liste.length; i++) {
    if (i > 0 && liste[i][poengFelt] < liste[i - 1][poengFelt]) pl = i + 1
    liste[i].plassering = pl
  }
}

export function byggSingelListe(resultater, stevner, regler, cupType, klasse) {
  const stevnerMap = lagStevnerMap(stevner)
  const beregn = velgBeregnFunksjon(cupType)
  const klasseNavn = klasse === 1 ? 'Klasse 1' : 'Klasse 2'

  const filtrert = resultater.filter(r => r.klasse?.navn === klasseNavn)

  const kasterMap = new Map()
  for (const r of filtrert) {
    if (!kasterMap.has(r.kasterid)) kasterMap.set(r.kasterid, { kaster: r.kaster, rader: [] })
    kasterMap.get(r.kasterid).rader.push(r)
  }

  const liste = []
  for (const [, entry] of kasterMap) {
    const tellendeRader = beregn(entry.rader, regler, stevnerMap)
    const totalPoeng = tellendeRader.reduce((s, r) => s + r.norgescuppoeng, 0)
    const klubber = [...new Set(tellendeRader.map(r => r.klubb?.navn).filter(Boolean))]
    const detaljRader = tellendeRader
      .map(r => ({ ...r, _stevne: stevnerMap.get(r.stevneid) }))
      .sort((a, b) => (a._stevne?.dato ?? '').localeCompare(b._stevne?.dato ?? ''))
    liste.push({ navn: kasterNavn(entry.kaster), klubb: klubber.join(' / '), totalPoeng, detaljRader })
  }

  liste.sort((a, b) => b.totalPoeng - a.totalPoeng || a.navn.localeCompare(b.navn))
  tildelPlassering(liste, 'totalPoeng')
  return liste
}

export function byggLagListe(resultater, stevner, regler) {
  const stevnerMap = lagStevnerMap(stevner)
  const filtrert = resultater.filter(r => r.klasse?.navn === 'Klasse 1')

  const kasterMap = new Map()
  for (const r of filtrert) {
    if (!kasterMap.has(r.kasterid)) kasterMap.set(r.kasterid, { kaster: r.kaster, rader: [] })
    kasterMap.get(r.kasterid).rader.push(r)
  }

  const bidragMap = new Map()
  const klubbInfoMap = new Map()

  for (const [, entry] of kasterMap) {
    const tellendeRader = beregnNcPoeng(entry.rader, regler, stevnerMap)
    const perKlubb = new Map()
    for (const r of tellendeRader) {
      if (r.klubb && !klubbInfoMap.has(r.klubbid)) klubbInfoMap.set(r.klubbid, r.klubb)
      perKlubb.set(r.klubbid, (perKlubb.get(r.klubbid) ?? 0) + r.norgescuppoeng)
    }
    for (const [klubbId, sum] of perKlubb) {
      bidragMap.set(`${entry.kaster.id}_${klubbId}`, { kaster: entry.kaster, klubbId, sum })
    }
  }

  const klubbMap = new Map()
  for (const [, b] of bidragMap) {
    if (!klubbMap.has(b.klubbId)) klubbMap.set(b.klubbId, { klubb: klubbInfoMap.get(b.klubbId), bidragsytere: [] })
    klubbMap.get(b.klubbId).bidragsytere.push(b)
  }

  const lagListe = []
  for (const [, entry] of klubbMap) {
    entry.bidragsytere.sort((a, b) => b.sum - a.sum)
    const topp4 = entry.bidragsytere.slice(0, 4)
    lagListe.push({ klubb: entry.klubb, lagTotal: topp4.reduce((s, b) => s + b.sum, 0), bidragsytere: topp4 })
  }

  lagListe.sort((a, b) => b.lagTotal - a.lagTotal)
  tildelPlassering(lagListe, 'lagTotal')
  return lagListe
}
