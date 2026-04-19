import { supabase } from '../supabase.js'

// ── Konstanter ────────────────────────────────────────────────────────────────

const SIDER_STORLEIK = 15
const PLACEHOLDER_AVATAR = 'https://placehold.co/200x200/444/888?text=?'
const FOERSTE_RING_AR = 2017

const MAX_RING = { kongelag: 40, minimatch: 60, halvmatch: 100, heilmatch: 200 }

// ── Modul-tilstand ────────────────────────────────────────────────────────────

const filtreListe = { visAlle: false, sokeTekst: '', side: 1 }

const filtreDetalj = {
  aktiv: 'resultater',
  ar: 'alle',
  stevnetype: 'alle',
  grafMetrikk: 'plassering',
  grafMetode: 'kongelag',
  grafFra: null,
  grafTil: null,
}

let kasterCache = null
let detaljCache = new Map()
let aktivChart = null

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

function kasterNavn(k) {
  return [k?.fornavn, k?.etternavn].filter(Boolean).join(' ')
}

function lagSlug(k) {
  return `${k.id}-` + `${k.etternavn ?? ''}-${k.fornavn ?? ''}`
    .toLowerCase()
    .replace(/[æä]/g, 'ae').replace(/[øö]/g, 'o').replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function hentAr(datoStr) {
  return datoStr ? parseInt(datoStr.substring(0, 4)) : null
}

function snitt(tal) {
  if (!tal.length) return null
  return Math.round(tal.reduce((s, t) => s + t, 0) / tal.length)
}

function ødeleggChart() {
  if (aktivChart) {
    aktivChart.destroy()
    aktivChart = null
  }
}

// ── Data-henting ──────────────────────────────────────────────────────────────

async function hentKastere() {
  if (kasterCache) return kasterCache
  const { data, error } = await supabase
    .from('kaster')
    .select('id, fornavn, etternavn, eraktiv, avatarurl, klubb:klubbid(id, navn)')
    .order('etternavn')
    .order('fornavn')
  kasterCache = { data: data ?? [], error }
  return kasterCache
}

async function hentDetalj(id) {
  if (detaljCache.has(id)) return detaljCache.get(id)

  const [kasterRes, resultatRes] = await Promise.all([
    supabase
      .from('kaster')
      .select('id, fornavn, etternavn, eraktiv, avatarurl, medlemsnummer, klubb:klubbid(id, navn), klasse:klasseid(id, navn)')
      .eq('id', id)
      .single(),
    supabase
      .from('resultat')
      .select(`
        id, plassering,
        poengkongelag, poengminimatch, poengxhalvmatch, poengxheilmatch,
        antallringkongelag, antallringminimatch, antallringhalvmatch, antallringheilmatch,
        klubb:klubbid(id, navn),
        stevne:stevneid(id, navn, dato, stevnetype:stevnetypeid(id, navn), kategori:kategoriid(id, navn))
      `)
      .eq('kasterid', id),
  ])

  const kaster = kasterRes.data
  const resultater = (resultatRes.data ?? [])
    .filter(r => r.stevne?.dato)
    .sort((a, b) => b.stevne.dato.localeCompare(a.stevne.dato))

  const entry = { kaster, resultater, error: kasterRes.error || resultatRes.error }
  detaljCache.set(id, entry)
  return entry
}

// ── Statistikk-reknereglar ────────────────────────────────────────────────────

function beregnStatistikk(resultater) {
  const kategoriar = [
    { label: 'Kongelag',  poengFelt: 'poengkongelag',   ringFelt: 'antallringkongelag',  maxRing: MAX_RING.kongelag },
    { label: 'Minimatch', poengFelt: 'poengminimatch',   ringFelt: 'antallringminimatch', maxRing: MAX_RING.minimatch },
    { label: 'Halvmatch', poengFelt: 'poengxhalvmatch',  ringFelt: 'antallringhalvmatch', maxRing: MAX_RING.halvmatch },
    { label: 'Heilmatch', poengFelt: 'poengxheilmatch',  ringFelt: 'antallringheilmatch', maxRing: MAX_RING.heilmatch },
  ]

  return kategoriar.map(({ label, poengFelt, ringFelt, maxRing }) => {
    const medPoeng = resultater.filter(r => r[poengFelt] != null)
    const rekord = medPoeng.length ? Math.max(...medPoeng.map(r => r[poengFelt])) : null
    const snittPoeng = snitt(medPoeng.map(r => r[poengFelt]))

    const ringFra2017 = resultater.filter(
      r => r[ringFelt] != null && hentAr(r.stevne?.dato) >= FOERSTE_RING_AR
    )
    const snittProsent = ringFra2017.length
      ? Math.round(ringFra2017.reduce((s, r) => s + r[ringFelt] / maxRing * 100, 0) / ringFra2017.length * 100) / 100
      : null

    return { label, rekord, snittPoeng, snittProsent }
  })
}

function hentTidlegareKlubbar(resultater, noverandeKlubbId) {
  const sett = new Map()
  for (const r of resultater) {
    if (r.klubb?.id && r.klubb.id !== noverandeKlubbId) {
      sett.set(r.klubb.id, r.klubb.navn)
    }
  }
  return [...sett.values()]
}

// ── Graf-databygging ──────────────────────────────────────────────────────────

function beregnGrafVerdi(r, metrikk, metode) {
  if (metrikk === 'plassering') return r.plassering ?? null
  const map = {
    kongelag:  { felt: 'antallringkongelag',  max: MAX_RING.kongelag },
    minimatch: { felt: 'antallringminimatch',  max: MAX_RING.minimatch },
    halvmatch: { felt: 'antallringhalvmatch',  max: MAX_RING.halvmatch },
    heilmatch: { felt: 'antallringheilmatch',  max: MAX_RING.heilmatch },
  }
  const { felt, max } = map[metode] ?? map.kongelag
  return r[felt] != null ? Math.round(r[felt] / max * 10000) / 100 : null
}

function byggGrafData(resultater, metrikk, metode, fra, til) {
  const filtrert = [...resultater]
    .filter(r => {
      const ar = hentAr(r.stevne?.dato)
      if (fra && ar < fra) return false
      if (til && ar > til) return false
      return beregnGrafVerdi(r, metrikk, metode) != null
    })
    .sort((a, b) => a.stevne.dato.localeCompare(b.stevne.dato))

  return {
    labels: filtrert.map(r => formaterDato(r.stevne.dato)),
    stevneNamn: filtrert.map(r => r.stevne.navn),
    verdiar: filtrert.map(r => beregnGrafVerdi(r, metrikk, metode)),
  }
}

// ── HTML-byggjarar: Liste ─────────────────────────────────────────────────────

function kasterKortHtml(k) {
  const href = `#/kastere/${lagSlug(k)}`
  const src = k.avatarurl || PLACEHOLDER_AVATAR
  const namn = kasterNavn(k)
  return `
    <a href="${href}" class="kaster-kort">
      <img src="${src}" alt="${namn}" loading="lazy">
      <div class="kaster-namn">${namn}</div>
      <div class="kaster-klubb">${k.klubb?.navn ?? '–'}</div>
    </a>`
}

function listeSkelettHtml() {
  return `
    <div class="nc-side">
      <div class="kaster-liste-kontroller">
        <div class="nc-filter-rad">
          <input id="kaster-sok" type="text" class="tl-select" placeholder="Søk på navn/klubb" value="">
          <button id="kaster-sok-knapp" class="btn btn-secondary btn-sm">Søk</button>
        </div>
        <div style="margin-top:8px">
          <label class="kaster-checkbox-label">
            <input type="checkbox" id="kaster-berre-aktive" checked>
            Vis bare aktive utøvere
          </label>
        </div>
      </div>
      <div id="kaster-sideinfo" style="margin:8px 0"></div>
      <div id="kaster-paginering-topp"></div>
      <div id="kaster-grid" class="kaster-grid"></div>
      <div id="kaster-paginering-botn"></div>
    </div>`
}

function pagineringHtml(side, totaltSider) {
  if (totaltSider <= 1) return ''
  const knapp = (tekst, s, deaktivert) =>
    `<button class="btn btn-sm ${s === side ? 'btn-primary' : 'btn-outline-secondary'} pag-knapp"
      data-side="${s}" ${deaktivert ? 'disabled' : ''}>${tekst}</button>`
  return `
    <div class="kaster-paginering">
      ${knapp('«', 1, side === 1)}
      ${knapp('‹', side - 1, side === 1)}
      <span class="pag-info">side ${side} av ${totaltSider}</span>
      ${knapp('›', side + 1, side === totaltSider)}
      ${knapp('»', totaltSider, side === totaltSider)}
    </div>`
}

// ── HTML-byggjarar: Detalj ────────────────────────────────────────────────────

function detaljSkelettHtml(kaster, resultater) {
  const namn = kasterNavn(kaster)
  const nr = kaster.medlemsnummer ? ` ${kaster.medlemsnummer}` : ''
  const ar = [...new Set(resultater.map(r => hentAr(r.stevne?.dato)).filter(Boolean))].sort((a, b) => b - a)
  const typar = [...new Map(
    resultater.map(r => r.stevne?.stevnetype).filter(Boolean).map(t => [t.id, t.navn])
  ).entries()].sort((a, b) => a[1].localeCompare(b[1]))

  return `
    <div class="nc-side">
      <div style="margin-bottom:12px">
        <a href="#/kastere" class="btn btn-sm btn-outline-secondary">← Tilbake</a>
      </div>
      <h1 class="nc-hovudtittel" style="margin-bottom:2px">${namn}${nr}</h1>
      <p style="color:#aaa;margin-bottom:12px">${kaster.klubb?.navn ?? '–'}</p>

      <div class="kaster-tab-rad">
        <button class="btn btn-sm kaster-tab-knapp${filtreDetalj.aktiv === 'resultater' ? ' active' : ''}" data-tab="resultater">Resultater</button>
        <button class="btn btn-sm kaster-tab-knapp${filtreDetalj.aktiv === 'statistikk' ? ' active' : ''}" data-tab="statistikk">Statistikk</button>
        <button class="btn btn-sm kaster-tab-knapp${filtreDetalj.aktiv === 'graf' ? ' active' : ''}" data-tab="graf">Vis graf</button>
      </div>
      <hr>

      <div id="kd-tab-resultater" class="kd-tab${filtreDetalj.aktiv === 'resultater' ? '' : ' kd-skjult'}">
        <div class="nc-filter-rad" style="margin-bottom:10px">
          <select id="kd-ar" class="tl-select">
            <option value="alle">Velg årstall</option>
            ${ar.map(a => `<option value="${a}"${filtreDetalj.ar == a ? ' selected' : ''}>${a}</option>`).join('')}
          </select>
          <select id="kd-type" class="tl-select">
            <option value="alle">Alle stevnetyper</option>
            ${typar.map(([id, n]) => `<option value="${id}">${n}</option>`).join('')}
          </select>
        </div>
        <div id="kd-resultat-tabell"></div>
      </div>

      <div id="kd-tab-statistikk" class="kd-tab${filtreDetalj.aktiv === 'statistikk' ? '' : ' kd-skjult'}">
        <div id="kd-stat-innhald"></div>
      </div>

      <div id="kd-tab-graf" class="kd-tab${filtreDetalj.aktiv === 'graf' ? '' : ' kd-skjult'}">
        <div class="nc-filter-rad" style="margin-bottom:10px;flex-wrap:wrap;gap:8px">
          <select id="kd-graf-metrikk" class="tl-select">
            <option value="plassering"${filtreDetalj.grafMetrikk === 'plassering' ? ' selected' : ''}>Plassering</option>
            <option value="prosent"${filtreDetalj.grafMetrikk === 'prosent' ? ' selected' : ''}>% Ring (fra 2017)</option>
          </select>
          <select id="kd-graf-metode" class="tl-select"${filtreDetalj.grafMetrikk !== 'prosent' ? ' style="display:none"' : ''}>
            <option value="kongelag"${filtreDetalj.grafMetode === 'kongelag' ? ' selected' : ''}>Kongelag</option>
            <option value="minimatch"${filtreDetalj.grafMetode === 'minimatch' ? ' selected' : ''}>Minimatch</option>
            <option value="halvmatch"${filtreDetalj.grafMetode === 'halvmatch' ? ' selected' : ''}>Halvmatch</option>
            <option value="heilmatch"${filtreDetalj.grafMetode === 'heilmatch' ? ' selected' : ''}>Heilmatch</option>
          </select>
          <select id="kd-graf-fra" class="tl-select">
            <option value="">Fra år</option>
            ${ar.map(a => `<option value="${a}"${filtreDetalj.grafFra == a ? ' selected' : ''}>${a}</option>`).join('')}
          </select>
          <select id="kd-graf-til" class="tl-select">
            <option value="">Til år</option>
            ${ar.map(a => `<option value="${a}"${filtreDetalj.grafTil == a ? ' selected' : ''}>${a}</option>`).join('')}
          </select>
        </div>
        <div style="position:relative;height:320px">
          <canvas id="kd-graf-canvas"></canvas>
        </div>
      </div>
    </div>`
}

function resultatTabellHtml(resultater, arFilter, typeFilter) {
  let filtrert = resultater
  if (arFilter !== 'alle') filtrert = filtrert.filter(r => hentAr(r.stevne?.dato) == arFilter)
  if (typeFilter !== 'alle') filtrert = filtrert.filter(r => String(r.stevne?.stevnetype?.id) === String(typeFilter))

  const ant = filtrert.length
  const infoHtml = `
    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
      <span>Antall: <strong>${ant}</strong></span>
      <span style="color:#aaa;font-size:0.85em">Antall ringer i parentes (fra ${FOERSTE_RING_AR})</span>
    </div>`

  if (!ant) return infoHtml + '<p class="nc-ingen">Ingen resultater funnet.</p>'

  const ringTekst = (poeng, ring) => {
    if (poeng == null) return ''
    return ring != null ? `${poeng} (${ring})` : `${poeng}`
  }

  const rader = filtrert.map(r => {
    const s = r.stevne
    const stevneHtml = s?.id
      ? `<a href="#/resultat/${s.id}" class="tl-lenkje">${s.navn}</a>`
      : (s?.navn ?? '–')
    return `
      <tr>
        <td style="white-space:nowrap">${formaterDato(s?.dato)}</td>
        <td>${stevneHtml}</td>
        <td>${s?.stevnetype?.navn ?? '–'}</td>
        <td>${r.klubb?.navn ?? '–'}</td>
        <td style="text-align:center;font-weight:bold">${r.plassering ?? '–'}</td>
        <td style="text-align:center">${ringTekst(r.poengkongelag, r.antallringkongelag)}</td>
        <td style="text-align:center">${ringTekst(r.poengminimatch, r.antallringminimatch)}</td>
        <td style="text-align:center">${ringTekst(r.poengxhalvmatch, r.antallringhalvmatch)}</td>
        <td style="text-align:center">${ringTekst(r.poengxheilmatch, r.antallringheilmatch)}</td>
      </tr>`
  }).join('')

  return infoHtml + `
    <div style="overflow-x:auto">
      <table class="nc-tabell">
        <thead class="nc-thead">
          <tr>
            <th>Dato</th><th>Stevne</th><th>Type</th><th>Klubb</th>
            <th>Pl.</th><th>Konge</th><th>X-mini</th><th>X-halv</th><th>X-heil</th>
          </tr>
        </thead>
        <tbody>${rader}</tbody>
      </table>
    </div>`
}

function statistikkHtml(resultater, kaster) {
  const stats = beregnStatistikk(resultater)
  const tidlegare = hentTidlegareKlubbar(resultater, kaster.klubb?.id)

  const statsRader = stats.map(({ label, rekord, snittPoeng, snittProsent }) => `
    <tr>
      <td>${label}</td>
      <td style="text-align:center">${rekord ?? '–'}</td>
      <td style="text-align:center">${snittPoeng ?? '–'}</td>
      <td style="text-align:center">${snittProsent != null ? formaterProsent(snittProsent) : '–'}</td>
    </tr>`).join('')

  const tidlegareHtml = tidlegare.length
    ? `<div style="margin-top:20px">
        <h4 style="color:#6ba4d4">Tidligere klubber</h4>
        <ul style="list-style:none;padding:0;margin:0">${tidlegare.map(n => `<li>${n}</li>`).join('')}</ul>
      </div>`
    : ''

  return `
    <div style="display:flex;flex-wrap:wrap;gap:32px;align-items:flex-start">
      <div>
        <h4>Statistikk</h4>
        <table class="nc-tabell">
          <thead class="nc-thead">
            <tr>
              <th></th><th>Rekord</th><th>Snitt Poeng</th><th>% Ring (fra ${FOERSTE_RING_AR})</th>
            </tr>
          </thead>
          <tbody>${statsRader}</tbody>
        </table>
      </div>
      ${tidlegareHtml}
    </div>`
}

// ── Graf-rendering ────────────────────────────────────────────────────────────

function teiknGraf(canvas, resultater) {
  ødeleggChart()

  const { labels, stevneNamn, verdiar } = byggGrafData(
    resultater,
    filtreDetalj.grafMetrikk,
    filtreDetalj.grafMetode,
    filtreDetalj.grafFra ? Number(filtreDetalj.grafFra) : null,
    filtreDetalj.grafTil ? Number(filtreDetalj.grafTil) : null,
  )

  if (!verdiar.length) {
    canvas.parentElement.innerHTML = '<p class="nc-ingen" style="padding-top:20px">Ingen data for valt filter.</p>'
    return
  }

  const erPlassering = filtreDetalj.grafMetrikk === 'plassering'
  const yLabel = erPlassering ? 'Plassering' : '% Ring'

  aktivChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: yLabel,
        data: verdiar,
        borderColor: '#4e8fc7',
        backgroundColor: 'rgba(78,143,199,0.15)',
        pointBackgroundColor: '#4e8fc7',
        pointRadius: 4,
        tension: 0.1,
        fill: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { maxTicksLimit: 14, maxRotation: 45, color: '#ccc' },
          grid: { color: 'rgba(255,255,255,0.08)' },
        },
        y: {
          reverse: erPlassering,
          ticks: { color: '#ccc' },
          grid: { color: 'rgba(255,255,255,0.08)' },
          title: { display: true, text: yLabel, color: '#ccc' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => stevneNamn[items[0].dataIndex] ?? labels[items[0].dataIndex],
            label: items => `${yLabel}: ${items.raw}`,
          },
        },
      },
    },
  })
}

// ── Render: Liste ─────────────────────────────────────────────────────────────

async function renderListe(container) {
  filtreListe.side = 1

  container.innerHTML = '<p class="laster">Laster utøvere...</p>'
  const { data: alleKastere, error } = await hentKastere()
  if (error) {
    container.innerHTML = '<p class="feil">Kunne ikkje laste utøvere.</p>'
    return
  }

  container.innerHTML = listeSkelettHtml()

  function filtrerOgVis() {
    const sok = filtreListe.sokeTekst.trim().toLowerCase()
    let filtrert = alleKastere
    if (!filtreListe.visAlle) filtrert = filtrert.filter(k => k.eraktiv)
    if (sok) filtrert = filtrert.filter(k =>
      kasterNavn(k).toLowerCase().includes(sok) ||
      (k.klubb?.navn ?? '').toLowerCase().includes(sok)
    )

    const totalt = filtrert.length
    const totaltSider = Math.max(1, Math.ceil(totalt / SIDER_STORLEIK))
    if (filtreListe.side > totaltSider) filtreListe.side = 1

    const start = (filtreListe.side - 1) * SIDER_STORLEIK
    const side = filtrert.slice(start, start + SIDER_STORLEIK)

    container.querySelector('#kaster-sideinfo').innerHTML =
      `side ${filtreListe.side} av ${totaltSider}`

    const pagHtml = pagineringHtml(filtreListe.side, totaltSider)
    container.querySelector('#kaster-paginering-topp').innerHTML = pagHtml
    container.querySelector('#kaster-paginering-botn').innerHTML = pagHtml
    container.querySelector('#kaster-grid').innerHTML = side.map(kasterKortHtml).join('')
  }

  filtrerOgVis()

  container.querySelector('#kaster-sok').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      filtreListe.sokeTekst = e.target.value
      filtreListe.side = 1
      filtrerOgVis()
    }
  })

  container.querySelector('#kaster-sok-knapp').addEventListener('click', () => {
    filtreListe.sokeTekst = container.querySelector('#kaster-sok').value
    filtreListe.side = 1
    filtrerOgVis()
  })

  container.querySelector('#kaster-berre-aktive').addEventListener('change', e => {
    filtreListe.visAlle = !e.target.checked
    filtreListe.side = 1
    filtrerOgVis()
  })

  container.addEventListener('click', e => {
    const knapp = e.target.closest('.pag-knapp')
    if (!knapp || knapp.disabled) return
    filtreListe.side = Number(knapp.dataset.side)
    filtrerOgVis()
    container.querySelector('.nc-side').scrollIntoView({ behavior: 'smooth' })
  })
}

// ── Render: Detalj ────────────────────────────────────────────────────────────

async function renderDetalj(container, id) {
  filtreDetalj.aktiv = 'resultater'
  filtreDetalj.ar = 'alle'
  filtreDetalj.stevnetype = 'alle'
  filtreDetalj.grafMetrikk = 'plassering'
  filtreDetalj.grafMetode = 'kongelag'
  filtreDetalj.grafFra = null
  filtreDetalj.grafTil = null
  ødeleggChart()

  container.innerHTML = '<p class="laster">Laster utøver...</p>'
  const { kaster, resultater, error } = await hentDetalj(id)
  if (error || !kaster) {
    container.innerHTML = '<p class="feil">Kunne ikkje laste utøver.</p>'
    return
  }

  container.innerHTML = detaljSkelettHtml(kaster, resultater)

  function oppdaterResultater() {
    container.querySelector('#kd-resultat-tabell').innerHTML =
      resultatTabellHtml(resultater, filtreDetalj.ar, filtreDetalj.stevnetype)
  }

  function oppdaterStatistikk() {
    container.querySelector('#kd-stat-innhald').innerHTML =
      statistikkHtml(resultater, kaster)
  }

  function oppdaterGraf() {
    const canvas = container.querySelector('#kd-graf-canvas')
    if (!canvas) return
    teiknGraf(canvas, resultater)
  }

  function byttTab(tab) {
    filtreDetalj.aktiv = tab
    container.querySelectorAll('.kaster-tab-knapp').forEach(k => {
      k.classList.toggle('active', k.dataset.tab === tab)
    })
    container.querySelectorAll('.kd-tab').forEach(el => {
      el.classList.toggle('kd-skjult', el.id !== `kd-tab-${tab}`)
    })
    if (tab === 'statistikk') oppdaterStatistikk()
    if (tab === 'graf') oppdaterGraf()
  }

  oppdaterResultater()

  container.querySelector('#kd-ar').addEventListener('change', e => {
    filtreDetalj.ar = e.target.value
    oppdaterResultater()
  })

  container.querySelector('#kd-type').addEventListener('change', e => {
    filtreDetalj.stevnetype = e.target.value
    oppdaterResultater()
  })

  container.querySelectorAll('.kaster-tab-knapp').forEach(k => {
    k.addEventListener('click', () => byttTab(k.dataset.tab))
  })

  container.querySelector('#kd-graf-metrikk').addEventListener('change', e => {
    filtreDetalj.grafMetrikk = e.target.value
    const metodeEl = container.querySelector('#kd-graf-metode')
    metodeEl.style.display = e.target.value === 'prosent' ? '' : 'none'
    oppdaterGraf()
  })

  container.querySelector('#kd-graf-metode').addEventListener('change', e => {
    filtreDetalj.grafMetode = e.target.value
    oppdaterGraf()
  })

  container.querySelector('#kd-graf-fra').addEventListener('change', e => {
    filtreDetalj.grafFra = e.target.value || null
    oppdaterGraf()
  })

  container.querySelector('#kd-graf-til').addEventListener('change', e => {
    filtreDetalj.grafTil = e.target.value || null
    oppdaterGraf()
  })
}

// ── Hovudfunksjon ─────────────────────────────────────────────────────────────

export async function render(container, params = {}) {
  ødeleggChart()
  if (params.id) {
    await renderDetalj(container, Number(params.id))
  } else {
    await renderListe(container)
  }
}
