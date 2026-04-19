import { supabase } from '../supabase.js'
import { lagKasterSlug } from '../utils/kaster.js'

// ── Konstanter ────────────────────────────────────────────────────────────────

const KATEGORIAR = [
  { id: 1,  namn: 'Singel',       kjonnFilter: 'historisk', fraaAr: 1985, aapentFraAr: 2013, merknad: '(åpen klasse fra 2013)' },
  { id: 2,  namn: 'Par',          kjonnFilter: 'historisk', fraaAr: 1987, aapentFraAr: 2009, merknad: '(åpen klasse fra 2009)' },
  { id: 3,  namn: 'Mix',          kjonnFilter: false,        fraaAr: 1986, merknad: '(NM Mix 2011 ble ikke arrangert)' },
  { id: 4,  namn: 'Lag',          kjonnFilter: false,        fraaAr: 2016 },
  { id: 7,  namn: 'X-kast',       kjonnFilter: 'historisk', fraaAr: 2009, aapentFraAr: 2013, merknad: '(åpen klasse fra 2013)' },
  { id: 9,  namn: 'Hesteskogolf', kjonnFilter: 'alltid',    fraaAr: 2006 },
  { id: 10, namn: 'Kongelag',     kjonnFilter: false,        fraaAr: 2023 },
]

const ALLE_GYLDIGE_KLASSAR = [1, 3, 4, 13, 16, 21, 23, 24, 27, 29, 32]

// ── Modul-tilstand ────────────────────────────────────────────────────────────

const filtre = { kategoriId: 1, kjonn: 'open' }
let dataCache = new Map()
let kjonnCache = null

// ── Hjelpefunksjonar ──────────────────────────────────────────────────────────

function hentAr(datoStr) {
  return datoStr ? parseInt(datoStr.substring(0, 4)) : null
}

function kasterLenkjeHtml(k) {
  const namn = [k?.fornavn, k?.etternavn].filter(Boolean).join(' ')
  return `<a href="#/kastere/${lagKasterSlug(k)}" class="tl-lenkje">${namn}</a>`
}

function defaultKjonn(kjonnFilter) {
  return kjonnFilter === 'alltid' ? 'alle' : 'open'
}

function subtittelTekst(kategorinavn, kjonn) {
  if (kjonn === 'herrer') return `${kategorinavn} Herrer`
  if (kjonn === 'damer')  return `${kategorinavn} Damer`
  return kategorinavn
}

// ── Data-henting ──────────────────────────────────────────────────────────────

async function hentKjonnIder() {
  if (kjonnCache) return kjonnCache
  const { data } = await supabase.from('kjonn').select('id, navn')
  kjonnCache = data ?? []
  return kjonnCache
}

function finnKjonnId(kjonnListe, kjonn) {
  const needle = kjonn === 'damer' ? 'dame' : 'herre'
  return kjonnListe.find(k => k.navn.toLowerCase().includes(needle))?.id
}

async function hentData(kategori, kjonn) {
  const cacheKey = `${kategori.id}-${kjonn}`
  if (dataCache.has(cacheKey)) return dataCache.get(cacheKey)

  let stevneQuery = supabase
    .from('stevne')
    .select('id, dato')
    .eq('ernm', true)
    .eq('kategoriid', kategori.id)

  if (kategori.kjonnFilter === 'historisk') {
    if (kjonn === 'open') {
      stevneQuery = stevneQuery.gte('dato', `${kategori.aapentFraAr}-01-01`)
    } else {
      stevneQuery = stevneQuery.lt('dato', `${kategori.aapentFraAr}-01-01`)
    }
  }

  const { data: stevner, error: e1 } = await stevneQuery
  if (e1) return { data: [], error: e1 }

  const ids = (stevner ?? []).map(s => s.id)
  if (!ids.length) {
    const empty = { data: [], error: null }
    dataCache.set(cacheKey, empty)
    return empty
  }

  const filtrertPaaKjonn = (kategori.kjonnFilter === 'historisk' && kjonn !== 'open') ||
                           (kategori.kjonnFilter === 'alltid' && kjonn !== 'alle')

  const kasterJoin = filtrertPaaKjonn
    ? 'kaster:kasterid!inner(id, fornavn, etternavn)'
    : 'kaster:kasterid(id, fornavn, etternavn)'

  let resultatQuery = supabase
    .from('resultat')
    .select(`
      id, klasseid,
      ${kasterJoin},
      klubb:klubbid(id, navn),
      stevne:stevneid(id, dato)
    `)
    .eq('plassering', 1)
    .in('stevneid', ids)
    .in('klasseid', ALLE_GYLDIGE_KLASSAR)
    .or('gruppeid.is.null,gruppeid.neq.2')

  if (filtrertPaaKjonn) {
    const kjonnListe = await hentKjonnIder()
    const kjonnId = finnKjonnId(kjonnListe, kjonn)
    if (kjonnId) resultatQuery = resultatQuery.eq('kaster.kjonnid', kjonnId)
  }

  if (kategori.kjonnFilter === 'historisk' && kjonn === 'open') {
    resultatQuery = resultatQuery.eq('klasseid', 1)
  }

  const { data: rader, error: e2 } = await resultatQuery

  const entry = { data: rader ?? [], error: e2 }
  if (!e2) dataCache.set(cacheKey, entry)
  return entry
}

// ── Filtrering og gruppering ──────────────────────────────────────────────────

function byggListe(alleData) {
  const gruppeMap = new Map()
  for (const r of alleData) {
    const nokkel = `${r.stevne?.id}-${r.klasseid}`
    if (!gruppeMap.has(nokkel)) {
      gruppeMap.set(nokkel, { ar: hentAr(r.stevne?.dato), stevneId: r.stevne?.id, kastere: [], klubb: r.klubb })
    }
    if (r.kaster) gruppeMap.get(nokkel).kastere.push(r.kaster)
  }

  return [...gruppeMap.values()].sort((a, b) => (b.ar ?? 0) - (a.ar ?? 0))
}

// ── HTML-byggjarar ────────────────────────────────────────────────────────────

function tabellHtml(liste) {
  if (!liste.length) return '<p class="nc-ingen">Ingen vinnere funnet.</p>'

  const rader = liste.map(({ ar, stevneId, kastere, klubb }) => {
    const namnHtml = kastere.map(kasterLenkjeHtml).join(' og ') || '–'
    const arHtml = stevneId
      ? `<a href="#/resultat/${stevneId}" class="tl-lenkje">${ar ?? '–'}</a>`
      : (ar ?? '–')
    return `
      <tr>
        <td style="width:60px">${arHtml}</td>
        <td>${namnHtml}</td>
        <td>${klubb?.navn ?? '–'}</td>
      </tr>`
  }).join('')

  return `
    <div style="overflow-x:auto">
      <table class="nc-tabell">
        <thead class="nc-thead">
          <tr>
            <th>År</th>
            <th>Navn</th>
            <th>Klubb</th>
          </tr>
        </thead>
        <tbody>${rader}</tbody>
      </table>
    </div>`
}

function sideSkelettHtml(kategori, maxAr) {
  const tittel = `Norgesmestere ${kategori.fraaAr} - ${maxAr}`

  const katOptions = KATEGORIAR.map(k =>
    `<option value="${k.id}"${k.id === filtre.kategoriId ? ' selected' : ''}>${k.namn}</option>`
  ).join('')

  let kjonnHtml = ''
  if (kategori.kjonnFilter === 'historisk') {
    kjonnHtml = `
      <select id="nm-kjonn" class="tl-select">
        <option value="open"${filtre.kjonn === 'open' ? ' selected' : ''}>Åpen klasse</option>
        <option value="herrer"${filtre.kjonn === 'herrer' ? ' selected' : ''}>Herrer</option>
        <option value="damer"${filtre.kjonn === 'damer' ? ' selected' : ''}>Damer</option>
      </select>`
  } else if (kategori.kjonnFilter === 'alltid') {
    kjonnHtml = `
      <select id="nm-kjonn" class="tl-select">
        <option value="alle"${filtre.kjonn === 'alle' ? ' selected' : ''}>Alle</option>
        <option value="herrer"${filtre.kjonn === 'herrer' ? ' selected' : ''}>Herrer</option>
        <option value="damer"${filtre.kjonn === 'damer' ? ' selected' : ''}>Damer</option>
      </select>`
  }

  const merknadHtml = kategori.merknad
    ? `<p style="text-align:center;font-size:0.85rem;color:#aaa;margin-bottom:12px">${kategori.merknad}</p>`
    : '<div style="margin-bottom:12px"></div>'

  return `
    <div class="nc-side">
      <div class="nc-filter-rad">
        <select id="nm-kategori" class="tl-select">${katOptions}</select>
        ${kjonnHtml}
      </div>
      <h1 style="text-align:center;font-size:1.6rem;font-weight:bold;margin:16px 0 4px">${tittel}</h1>
      <h2 id="nm-undertittel" style="text-align:center;font-size:1.1rem;font-weight:600;margin-bottom:2px">${subtittelTekst(kategori.namn, filtre.kjonn)}</h2>
      ${merknadHtml}
      <div id="nm-tabell-container"></div>
    </div>`
}

// ── Render ────────────────────────────────────────────────────────────────────

async function renderKategori(container) {
  container.innerHTML = '<p class="laster">Laster NM-vinnere...</p>'

  const kategori = KATEGORIAR.find(k => k.id === filtre.kategoriId)
  const { data, error } = await hentData(kategori, filtre.kjonn)

  if (error) {
    container.innerHTML = '<p class="feil">Kunne ikkje laste NM-vinnere.</p>'
    return
  }

  const maxAr = data.reduce((m, r) => Math.max(m, hentAr(r.stevne?.dato) ?? 0), 0) || new Date().getFullYear()

  container.innerHTML = sideSkelettHtml(kategori, maxAr)
  container.querySelector('#nm-tabell-container').innerHTML = tabellHtml(byggListe(data))

  container.querySelector('#nm-kategori').addEventListener('change', async e => {
    filtre.kategoriId = Number(e.target.value)
    const nyKat = KATEGORIAR.find(k => k.id === filtre.kategoriId)
    filtre.kjonn = defaultKjonn(nyKat?.kjonnFilter)
    await renderKategori(container)
  })

  const kjonnEl = container.querySelector('#nm-kjonn')
  if (kjonnEl) {
    kjonnEl.addEventListener('change', async e => {
      filtre.kjonn = e.target.value
      await renderKategori(container)
    })
  }
}

export async function render(container) {
  filtre.kategoriId = 1
  filtre.kjonn = defaultKjonn(KATEGORIAR[0].kjonnFilter)
  await renderKategori(container)
}
