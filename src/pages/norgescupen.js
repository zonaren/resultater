import { supabase } from '../supabase.js'

const FOERSTE_AR = 2007
const FOERSTE_AR_MULTI_CUP = 2024
const NC_TYPER = ['NC', 'SNC', 'DNC']

const filtre = {
  ar: new Date().getFullYear(),
  cupType: 'NC',
  klasse: 1,
  visning: 'singel', // 'singel' | 'lag'
}

let cache = {
  ar: null,
  regler: null,
  stevner: [],
  resultater: [],
}

// ── Hjelpefunksjonar ──────────────────────────────────────────────────────────

const datoFmt = new Intl.DateTimeFormat('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })

function formaterDato(datoStr) {
  if (!datoStr) return '–'
  return datoFmt.format(new Date(datoStr))
}

function formaterPoeng(p) {
  if (p == null) return '–'
  const n = Number(p)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function kasterNavn(kaster) {
  return [kaster?.fornavn, kaster?.etternavn].filter(Boolean).join(' ')
}

// ── Data-henting ──────────────────────────────────────────────────────────────

async function hentRegler(ar) {
  const { data, error } = await supabase
    .from('antallTellendeNc')
    .select('*')
    .eq('year', ar)
    .maybeSingle()
  return { data, error }
}

async function hentStevnerOgResultater(ar) {
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

async function hentOgBufferData(ar) {
  if (cache.ar === ar) return null

  const [{ data: regler, error: e1 }, { stevner, resultater, error: e2 }] = await Promise.all([
    hentRegler(ar),
    hentStevnerOgResultater(ar),
  ])

  if (e1 || e2) return e1 || e2

  cache.ar = ar
  cache.regler = regler
  cache.stevner = stevner
  cache.resultater = resultater
  return null
}

// ── Teljealgoritmar ───────────────────────────────────────────────────────────

function lagStevnerMap() {
  const m = new Map()
  for (const s of cache.stevner) {
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

function velgBeregnFunksjon(cupType) {
  if (cupType === 'SNC') return beregnSncPoeng
  if (cupType === 'DNC') return beregnDncPoeng
  return beregnNcPoeng
}

// ── Standingberegning ─────────────────────────────────────────────────────────

function tildelPlassering(liste, poengFelt) {
  let pl = 1
  for (let i = 0; i < liste.length; i++) {
    if (i > 0 && liste[i][poengFelt] < liste[i - 1][poengFelt]) pl = i + 1
    liste[i].plassering = pl
  }
}

function byggSingelListe(resultater, regler, cupType, klasse) {
  const stevnerMap = lagStevnerMap()
  const beregn = velgBeregnFunksjon(cupType)
  const klasseNavn = klasse === 1 ? 'Klasse 1' : 'Klasse 2'

  const filtrert = resultater.filter(r => r.klasse?.navn === klasseNavn)

  const kasterMap = new Map()
  for (const r of filtrert) {
    if (!kasterMap.has(r.kasterid)) {
      kasterMap.set(r.kasterid, { kaster: r.kaster, rader: [] })
    }
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

function byggLagListe(resultater, regler) {
  const stevnerMap = lagStevnerMap()
  const filtrert = resultater.filter(r => r.klasse?.navn === 'Klasse 1')

  const kasterMap = new Map()
  for (const r of filtrert) {
    if (!kasterMap.has(r.kasterid)) {
      kasterMap.set(r.kasterid, { kaster: r.kaster, rader: [] })
    }
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
    if (!klubbMap.has(b.klubbId)) {
      klubbMap.set(b.klubbId, { klubb: klubbInfoMap.get(b.klubbId), bidragsytere: [] })
    }
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

// ── HTML-byggjarar ────────────────────────────────────────────────────────────

function arOptions(valgt) {
  const gjeldende = new Date().getFullYear()
  let html = ''
  for (let ar = gjeldende; ar >= FOERSTE_AR; ar--) {
    html += `<option value="${ar}"${ar === valgt ? ' selected' : ''}>${ar}</option>`
  }
  return html
}

function beskrivelsesTekst(regler, cupType) {
  if (!regler) return ''
  if (cupType === 'SNC') return `Dei ${regler.max_snc} beste SNC-stevna er teljande`
  if (cupType === 'DNC') return `Dei ${regler.max_dnc} beste DNC-stevna er teljande`
  return `Dei ${regler.maxtotal} beste stevna, herav maks ${regler.max_nc_total} NC-stevner og ${regler.max_snc_total} SNC-stevner er teljande`
}

function visningTabsHtml(valgtVisning) {
  return `
    <div class="nc-klasse-tabs" style="margin-bottom:12px">
      <button class="nc-klasse-tab${valgtVisning === 'singel' ? ' aktiv' : ''}" data-visning="singel">Singel</button>
      <button class="nc-klasse-tab${valgtVisning === 'lag' ? ' aktiv' : ''}" data-visning="lag">Lag</button>
    </div>`
}

function klasseTabsHtml(valgtKlasse, ar) {
  return `
    <div class="nc-klasse-tabs-wrapper">
      <div class="nc-klasse-tabs">
        <button class="nc-klasse-tab${valgtKlasse === 1 ? ' aktiv' : ''}" data-klasse="1">Klasse 1</button>
        ${ar <= 2025 ? `<button class="nc-klasse-tab${valgtKlasse === 2 ? ' aktiv' : ''}" data-klasse="2">Klasse 2</button>` : ''}
      </div>
      <span class="nc-klikk-hint">Klikk poengsum for å vise detaljer</span>
    </div>`
}

function singelTabellHtml(liste) {
  if (liste.length === 0) return '<p class="nc-ingen">Ingen resultater funnet.</p>'

  const rader = liste.map((k, i) => {
    const detaljer = k.detaljRader.map(r => `
      <tr>
        <td>${formaterDato(r._stevne?.dato)}</td>
        <td>${r._stevne?.typeNavn ?? '–'}</td>
        <td>${r._stevne?.navn ?? '–'}</td>
        <td>${r.plassering ?? '–'}</td>
        <td>${formaterPoeng(r.norgescuppoeng)}</td>
      </tr>`).join('')

    return `
      <tr class="nc-singel-rad">
        <td class="nc-td-pl">${k.plassering}</td>
        <td>${k.navn}</td>
        <td>${k.klubb}</td>
        <td class="nc-td-poeng nc-poeng-celle" data-idx="${i}">${formaterPoeng(k.totalPoeng)}<span class="nc-chevron"> ▼</span></td>
      </tr>
      <tr class="nc-detalj-rad" data-idx="${i}" style="display:none">
        <td colspan="4">
          <table class="nc-detalj-tabell">
            <thead><tr><th>Dato</th><th>Type</th><th>Stevne</th><th>Pl.</th><th>Poeng</th></tr></thead>
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
          <th class="nc-td-poeng">Poeng</th>
        </tr>
      </thead>
      <tbody>${rader}</tbody>
    </table>`
}

function lagTabellHtml(lagListe) {
  if (lagListe.length === 0) return '<p class="nc-ingen">Ingen lag funnet.</p>'

  const rader = lagListe.map((lag, i) => {
    const bidrag = lag.bidragsytere.map(b =>
      `<tr><td>${kasterNavn(b.kaster)}</td><td class="nc-td-poeng">${formaterPoeng(b.sum)}</td></tr>`
    ).join('')

    return `
      <tr class="nc-lag-rad">
        <td class="nc-td-pl">${lag.plassering}</td>
        <td>${lag.klubb?.navn ?? '–'}</td>
        <td class="nc-td-poeng nc-lag-poeng-celle" data-lag-idx="${i}">${formaterPoeng(lag.lagTotal)}<span class="nc-chevron"> ▼</span></td>
      </tr>
      <tr class="nc-lag-detalj-rad" data-lag-idx="${i}" style="display:none">
        <td colspan="3">
          <table class="nc-detalj-tabell">
            <tbody>${bidrag}</tbody>
          </table>
        </td>
      </tr>`
  }).join('')

  return `
    <table class="nc-tabell">
      <thead class="nc-thead">
        <tr>
          <th class="nc-td-pl">Pl.</th>
          <th>Klubb</th>
          <th class="nc-td-poeng">Poeng</th>
        </tr>
      </thead>
      <tbody>${rader}</tbody>
    </table>`
}

function sideSkelettHtml(ar, cupType) {
  return `
    <div class="nc-side">
      <h1 class="nc-hovudtittel">Norgescupen ${ar}</h1>
      <div class="nc-filter-rad">
        <select id="nc-ar" class="tl-select">${arOptions(ar)}</select>
        <select id="nc-cuptype" class="tl-select"${ar < FOERSTE_AR_MULTI_CUP ? ' style="display:none"' : ''}>
          <option value="NC"${cupType === 'NC' ? ' selected' : ''}>NC</option>
          <option value="SNC"${cupType === 'SNC' ? ' selected' : ''}>SNC</option>
          <option value="DNC"${cupType === 'DNC' ? ' selected' : ''}>DNC (Uoffisiell)</option>
        </select>
      </div>
      <div id="nc-visning-tabs-container"></div>
      <div id="nc-content"></div>
    </div>`
}

// ── Hovudfunksjon ─────────────────────────────────────────────────────────────

export async function render(container) {
  filtre.ar = new Date().getFullYear()
  filtre.cupType = 'NC'
  filtre.klasse = 1
  filtre.visning = 'singel'
  cache = { ar: null, regler: null, stevner: [], resultater: [] }

  container.innerHTML = '<p class="laster">Laster Norgescupen...</p>'

  const feil = await hentOgBufferData(filtre.ar)
  if (feil) {
    container.innerHTML = '<p class="feil">Kunne ikkje laste data for Norgescupen.</p>'
    return
  }

  container.innerHTML = sideSkelettHtml(filtre.ar, filtre.cupType)

  function oppdaterVisning() {
    const { ar, cupType, klasse, visning } = filtre
    const { regler } = cache
    const content = container.querySelector('#nc-content')

    container.querySelector('.nc-hovudtittel').textContent = `Norgescupen ${ar}`
    container.querySelector('#nc-cuptype').style.display = ar >= FOERSTE_AR_MULTI_CUP ? '' : 'none'

    // Singel/Lag tabs — only when NC cup is selected
    container.querySelector('#nc-visning-tabs-container').innerHTML =
      cupType === 'NC' ? visningTabsHtml(visning) : ''

    if (visning === 'lag' && cupType === 'NC') {
      content.innerHTML = `
        <section>
          <h2 class="nc-seksjon-tittel">NC Lag ${ar} (Kun klasse 1)</h2>
          <p class="nc-beskriving">Dei 4 beste poengsummene frå kvar klubb.</p>
          <div class="nc-klikk-hint" style="text-align:right;margin-bottom:4px">Klikk poengsum for å vise detaljar</div>
          <div id="nc-lag-tabell-container"></div>
        </section>`

      if (!regler) {
        content.querySelector('#nc-lag-tabell-container').innerHTML = '<p class="nc-ingen">Ingen data.</p>'
      } else {
        const lagListe = byggLagListe(cache.resultater, regler)
        content.querySelector('#nc-lag-tabell-container').innerHTML = lagTabellHtml(lagListe)
        content.querySelector('#nc-lag-tabell-container').addEventListener('click', e => {
          const celle = e.target.closest('.nc-lag-poeng-celle')
          if (!celle) return
          const idx = celle.dataset.lagIdx
          const detalj = content.querySelector(`.nc-lag-detalj-rad[data-lag-idx="${idx}"]`)
          if (!detalj) return
          const skjult = detalj.style.display === 'none'
          detalj.style.display = skjult ? '' : 'none'
          celle.querySelector('.nc-chevron').textContent = skjult ? ' ▲' : ' ▼'
        })
      }
    } else {
      content.innerHTML = `
        <section id="nc-singel-seksjon">
          <h2 class="nc-seksjon-tittel">${cupType} Singel ${ar} - Klasse ${klasse}</h2>
          <p class="nc-beskriving">${regler ? beskrivelsesTekst(regler, cupType) : `Ingen telleregel funnet for ${ar}`}</p>
          <div id="nc-klasse-tabs-container">${klasseTabsHtml(klasse, ar)}</div>
          <div id="nc-singel-tabell-container"></div>
        </section>`

      if (!regler) {
        content.querySelector('#nc-singel-tabell-container').innerHTML = '<p class="nc-ingen">Ingen data.</p>'
      } else {
        const singelListe = byggSingelListe(cache.resultater, regler, cupType, klasse)
        content.querySelector('#nc-singel-tabell-container').innerHTML = singelTabellHtml(singelListe)
        content.querySelector('#nc-singel-tabell-container').addEventListener('click', e => {
          const celle = e.target.closest('.nc-poeng-celle')
          if (!celle) return
          const idx = celle.dataset.idx
          const detalj = content.querySelector(`.nc-detalj-rad[data-idx="${idx}"]`)
          if (!detalj) return
          const skjult = detalj.style.display === 'none'
          detalj.style.display = skjult ? '' : 'none'
          celle.querySelector('.nc-chevron').textContent = skjult ? ' ▲' : ' ▼'
        })
      }

      content.querySelector('#nc-singel-seksjon').addEventListener('click', e => {
        const tab = e.target.closest('[data-klasse]')
        if (!tab) return
        filtre.klasse = Number(tab.dataset.klasse)
        oppdaterVisning()
      })
    }
  }

  oppdaterVisning()

  container.querySelector('#nc-ar').addEventListener('change', async e => {
    filtre.ar = Number(e.target.value)
    filtre.klasse = 1
    if (filtre.ar < FOERSTE_AR_MULTI_CUP) {
      filtre.cupType = 'NC'
      filtre.visning = 'singel'
      container.querySelector('#nc-cuptype').value = 'NC'
    }
    container.querySelector('#nc-content').innerHTML = '<p class="laster">Laster...</p>'
    const feil = await hentOgBufferData(filtre.ar)
    if (feil) {
      container.querySelector('#nc-content').innerHTML = '<p class="feil">Feil ved henting av data.</p>'
      return
    }
    oppdaterVisning()
  })

  container.querySelector('#nc-cuptype').addEventListener('change', e => {
    filtre.cupType = e.target.value
    filtre.klasse = 1
    if (filtre.cupType !== 'NC') filtre.visning = 'singel'
    oppdaterVisning()
  })

  container.querySelector('#nc-visning-tabs-container').addEventListener('click', e => {
    const tab = e.target.closest('[data-visning]')
    if (!tab) return
    filtre.visning = tab.dataset.visning
    oppdaterVisning()
  })
}
