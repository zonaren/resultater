import { kasterNavn } from '../utils/kaster.js'
import {
  formaterPoeng,
  hentRegler,
  hentStevnerOgResultater,
  byggSingelListe,
  byggLagListe,
} from '../utils/norgescup.js'
import { formaterDato, arOptions } from '../utils/shared.js'

const FOERSTE_AR = 2007
const FOERSTE_AR_MULTI_CUP = 2024

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

// ── Data-henting ──────────────────────────────────────────────────────────────

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

// ── HTML-byggjarar ────────────────────────────────────────────────────────────

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
        <select id="nc-ar" class="tl-select">${arOptions(ar, FOERSTE_AR)}</select>
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
        const lagListe = byggLagListe(cache.resultater, cache.stevner, regler)
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
        const singelListe = byggSingelListe(cache.resultater, cache.stevner, regler, cupType, klasse)
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
