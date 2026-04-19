import { supabase } from '../supabase.js'

const FOERSTE_AR = 2018
const MIN_STEVNER = 5

const filtre = {
  ar: new Date().getFullYear(),
  sokeTekst: '',
  infoSynleg: true,
}

let cache = {
  ar: null,
  stevner: [],
  resultater: [],
}

// ── Hjelpefunksjonar ──────────────────────────────────────────────────────────

const datoFmt = new Intl.DateTimeFormat('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
const prosentFmt = new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function formaterDato(datoStr) {
  if (!datoStr) return '–'
  return datoFmt.format(new Date(datoStr))
}

function formaterProsent(p) {
  if (p == null) return '–'
  return prosentFmt.format(p) + ' %'
}

function kasterNavn(kaster) {
  return [kaster?.fornavn, kaster?.etternavn].filter(Boolean).join(' ')
}

function regnUtProsent(r) {
  if (r.antallringminimatch != null)
    return { prosent: r.antallringminimatch / 60 * 100, metodeNavn: 'X-kast minimatch', antallRing: r.antallringminimatch }
  if (r.antallringhalvmatch != null)
    return { prosent: r.antallringhalvmatch, metodeNavn: 'X-kast halvmatch', antallRing: r.antallringhalvmatch }
  if (r.antallringheilmatch != null)
    return { prosent: r.antallringheilmatch / 200 * 100, metodeNavn: 'X-kast heilmatch', antallRing: r.antallringheilmatch }
  if (r.antallringkongelag != null)
    return { prosent: r.antallringkongelag / 40 * 100, metodeNavn: 'Kongelag', antallRing: r.antallringkongelag }
  return null
}

// ── Data-henting ──────────────────────────────────────────────────────────────

async function hentStevnerOgResultater(ar) {
  const { data: allStevner, error: e1 } = await supabase
    .from('stevne')
    .select('id, navn, dato, stevnetype:stevnetypeid(id, navn)')
    .eq('ernorgesranking', true)
    .gte('dato', `${ar}-01-01`)
    .lte('dato', `${ar}-12-31`)

  if (e1) return { stevner: [], resultater: [], error: e1 }

  const stevner = allStevner ?? []
  const ids = stevner.map(s => s.id)

  if (ids.length === 0) return { stevner, resultater: [], error: null }

  const { data: rader, error: e2 } = await supabase
    .from('resultat')
    .select(`
      id, kasterid, klubbid, stevneid,
      antallringminimatch, antallringhalvmatch, antallringheilmatch, antallringkongelag,
      kaster:kasterid(id, fornavn, etternavn),
      klubb:klubbid(id, navn)
    `)
    .in('stevneid', ids)

  if (e2) return { stevner, resultater: [], error: e2 }

  const resultater = (rader ?? []).filter(r =>
    r.antallringminimatch != null ||
    r.antallringhalvmatch != null ||
    r.antallringheilmatch != null ||
    r.antallringkongelag != null
  )

  return { stevner, resultater, error: null }
}

async function hentOgBufferData(ar) {
  if (cache.ar === ar) return null

  const { stevner, resultater, error } = await hentStevnerOgResultater(ar)
  if (error) return error

  cache.ar = ar
  cache.stevner = stevner
  cache.resultater = resultater
  return null
}

// ── Ranking-algoritme ─────────────────────────────────────────────────────────

function lagStevnerMap() {
  const m = new Map()
  for (const s of cache.stevner) {
    m.set(s.id, { navn: s.navn, dato: s.dato, typeNavn: s.stevnetype?.navn ?? '' })
  }
  return m
}

function tildelPlassering(liste) {
  let pl = 1
  for (let i = 0; i < liste.length; i++) {
    if (i > 0 && liste[i].snittProsent < liste[i - 1].snittProsent) pl = i + 1
    liste[i].plassering = pl
  }
}

function byggRankingListe(resultater, stevnerMap) {
  const kasterMap = new Map()

  for (const r of resultater) {
    const ringInfo = regnUtProsent(r)
    if (!ringInfo) continue
    if (!kasterMap.has(r.kasterid)) {
      kasterMap.set(r.kasterid, { kaster: r.kaster, klubb: r.klubb, rader: [] })
    }
    kasterMap.get(r.kasterid).rader.push({
      ...ringInfo,
      stevneid: r.stevneid,
      _stevne: stevnerMap.get(r.stevneid),
    })
  }

  const gyldig = []
  const ugyldig = []

  for (const [, entry] of kasterMap) {
    const { rader } = entry
    const sorted = [...rader].sort((a, b) => b.prosent - a.prosent)
    const top5 = sorted.slice(0, MIN_STEVNER)
    const snittProsent = top5.reduce((s, r) => s + r.prosent, 0) / top5.length
    const antallStevner = rader.length
    const erGyldig = antallStevner >= MIN_STEVNER

    const item = {
      navn: kasterNavn(entry.kaster),
      klubb: entry.klubb?.navn ?? '–',
      antallStevner,
      snittProsent,
      erGyldig,
      detaljRader: sorted,
    }

    if (erGyldig) gyldig.push(item)
    else ugyldig.push(item)
  }

  gyldig.sort((a, b) => b.snittProsent - a.snittProsent || a.navn.localeCompare(b.navn))
  ugyldig.sort((a, b) => b.snittProsent - a.snittProsent || a.navn.localeCompare(b.navn))
  tildelPlassering(gyldig)

  return [...gyldig, ...ugyldig]
}

// ── HTML-byggjarar ────────────────────────────────────────────────────────────

function arOptions(valgt) {
  const gjeldende = new Date().getFullYear()
  let html = ''
  for (let ar = gjeldende; ar >= FOERSTE_AR; ar--) {
    html += `<option value="${ar}"${ar === valgt ? ' selected' : ''}>${ar}</option>`
  }
  return html
}

function infoHtml(synleg) {
  return `
    <div id="nr-info-seksjon"${synleg ? '' : ' style="display:none"'}>
      <p style="text-align:center;margin-bottom:4px">
        Norgesranking er ein konkurranse som pågår innanfor eit kalenderår, dvs. 1. januar – 31. desember.
        <strong>Dei ${MIN_STEVNER} beste prosentane er teljande.</strong>
      </p>
      <p style="text-align:center;margin-bottom:4px">
        For å få eit gyldig årsresultat skal kasteren minst ha vore gjennom ${MIN_STEVNER} rankingrunder.
      </p>
      <p style="text-align:center;color:#dc3545;margin-bottom:0">
        Resultater merket med rødt er ikkje gyldig (mindre enn ${MIN_STEVNER} runder).
      </p>
    </div>`
}

function rankingTabellHtml(liste, sokeTekst) {
  const sok = sokeTekst.trim().toLowerCase()
  const filtrert = sok
    ? liste.filter(k => k.navn.toLowerCase().includes(sok) || k.klubb.toLowerCase().includes(sok))
    : liste

  if (filtrert.length === 0) return '<p class="nc-ingen">Ingen resultater funnet.</p>'

  const rader = filtrert.map((k, i) => {
    const detaljer = k.detaljRader.map(r => `
      <tr>
        <td>${formaterDato(r._stevne?.dato)}</td>
        <td>${r._stevne?.typeNavn ?? '–'}</td>
        <td>${r._stevne?.navn ?? '–'}</td>
        <td>${r.metodeNavn}</td>
        <td>${r.antallRing}</td>
        <td>${formaterProsent(r.prosent)}</td>
      </tr>`).join('')

    const ugyldigStyle = k.erGyldig ? '' : ' style="color:#dc3545"'

    return `
      <tr class="nc-singel-rad"${ugyldigStyle}>
        <td class="nc-td-pl">${k.erGyldig ? k.plassering : '–'}</td>
        <td>${k.navn}</td>
        <td>${k.klubb}</td>
        <td style="text-align:center">${k.antallStevner}</td>
        <td class="nc-td-poeng nc-poeng-celle" data-idx="${i}">${formaterProsent(k.snittProsent)}<span class="nc-chevron"> ▼</span></td>
      </tr>
      <tr class="nc-detalj-rad" data-idx="${i}" style="display:none">
        <td colspan="5">
          <table class="nc-detalj-tabell">
            <thead><tr><th>Dato</th><th>Type</th><th>Stevne</th><th>Metode</th><th>Ring</th><th>%Ring</th></tr></thead>
            <tbody>${detaljer}</tbody>
          </table>
        </td>
      </tr>`
  }).join('')

  return `
    <table class="nc-tabell">
      <thead class="nc-thead">
        <tr>
          <th class="nc-td-pl">Pl.</th>
          <th>Navn</th>
          <th>Klubb</th>
          <th style="text-align:center">Stevner</th>
          <th class="nc-td-poeng">%Snitt</th>
        </tr>
      </thead>
      <tbody>${rader}</tbody>
    </table>`
}

function sideSkelettHtml(ar) {
  return `
    <div class="nc-side">
      <h1 class="nc-hovudtittel">Norgesranking ${ar}</h1>
      <div style="text-align:center;margin-bottom:8px">
        <button id="nr-info-knapp" class="btn btn-sm btn-outline-secondary">Skjul info</button>
      </div>
      <hr>
      ${infoHtml(true)}
      <hr>
      <div class="nc-filter-rad" style="margin-bottom:12px">
        <select id="nr-ar" class="tl-select">${arOptions(ar)}</select>
        <input id="nr-sok" type="text" class="tl-select" placeholder="Søk på navn/klubb..." value="">
      </div>
      <div style="text-align:right;margin-bottom:4px">
        <span class="nc-klikk-hint">Klikk prosent for å vise detaljer</span>
      </div>
      <div id="nr-tabell-container"></div>
    </div>`
}

// ── Hovudfunksjon ─────────────────────────────────────────────────────────────

export async function render(container) {
  filtre.ar = new Date().getFullYear()
  filtre.sokeTekst = ''
  filtre.infoSynleg = true
  cache = { ar: null, stevner: [], resultater: [] }

  container.innerHTML = '<p class="laster">Laster Norgesranking...</p>'

  const feil = await hentOgBufferData(filtre.ar)
  if (feil) {
    container.innerHTML = '<p class="feil">Kunne ikkje laste data for Norgesranking.</p>'
    return
  }

  container.innerHTML = sideSkelettHtml(filtre.ar)

  function oppdaterTabell() {
    const stevnerMap = lagStevnerMap()
    const liste = byggRankingListe(cache.resultater, stevnerMap)
    const tabellEl = container.querySelector('#nr-tabell-container')
    tabellEl.innerHTML = `<div id="nr-tabell-inner">${rankingTabellHtml(liste, filtre.sokeTekst)}</div>`
    const inner = tabellEl.querySelector('#nr-tabell-inner')
    inner.addEventListener('click', e => {
      const celle = e.target.closest('.nc-poeng-celle')
      if (!celle) return
      const idx = celle.dataset.idx
      const detalj = inner.querySelector(`.nc-detalj-rad[data-idx="${idx}"]`)
      if (!detalj) return
      const skjult = detalj.style.display === 'none'
      detalj.style.display = skjult ? '' : 'none'
      celle.querySelector('.nc-chevron').textContent = skjult ? ' ▲' : ' ▼'
    })
  }

  oppdaterTabell()

  container.querySelector('#nr-ar').addEventListener('change', async e => {
    filtre.ar = Number(e.target.value)
    filtre.sokeTekst = ''
    container.querySelector('#nr-sok').value = ''
    container.querySelector('.nc-hovudtittel').textContent = `Norgesranking ${filtre.ar}`
    container.querySelector('#nr-tabell-container').innerHTML = '<p class="laster">Laster...</p>'
    const feil = await hentOgBufferData(filtre.ar)
    if (feil) {
      container.querySelector('#nr-tabell-container').innerHTML = '<p class="feil">Feil ved henting av data.</p>'
      return
    }
    oppdaterTabell()
  })

  container.querySelector('#nr-sok').addEventListener('input', e => {
    filtre.sokeTekst = e.target.value
    oppdaterTabell()
  })

  container.querySelector('#nr-info-knapp').addEventListener('click', () => {
    filtre.infoSynleg = !filtre.infoSynleg
    container.querySelector('#nr-info-seksjon').style.display = filtre.infoSynleg ? '' : 'none'
    container.querySelector('#nr-info-knapp').textContent = filtre.infoSynleg ? 'Skjul info' : 'Vis info'
  })
}
