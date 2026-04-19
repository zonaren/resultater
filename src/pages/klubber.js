import { supabase } from '../supabase.js'
import { kasterNavn, lagKasterSlug, lagKlubbSlug } from '../utils/kaster.js'

// ── Konstanter ────────────────────────────────────────────────────────────────

const PLACEHOLDER_LOGO = 'https://placehold.co/200x200/444/888?text=?'

// ── Modul-tilstand ────────────────────────────────────────────────────────────

const filtreListe = { sokeTekst: '' }
const filtreDetalj = { sokeTekst: '' }

let klubbCache = null
let aktivKasterCache = null
let detaljCache = new Map()

// ── Data-henting ──────────────────────────────────────────────────────────────

async function hentKlubbar() {
  if (klubbCache) return klubbCache
  const { data, error } = await supabase
    .from('klubb')
    .select('id, navn, logourl')
    .order('navn')
  klubbCache = { data: data ?? [], error }
  return klubbCache
}

async function hentAktiveKastere() {
  if (aktivKasterCache) return aktivKasterCache
  const { data } = await supabase
    .from('kaster')
    .select('id, fornavn, etternavn, klubb:klubbid(id)')
    .eq('eraktiv', true)
  aktivKasterCache = data ?? []
  return aktivKasterCache
}

async function hentMedlemmar(klubbId) {
  if (detaljCache.has(klubbId)) return detaljCache.get(klubbId)
  const { data, error } = await supabase
    .from('kaster')
    .select('id, fornavn, etternavn, avatarurl, medlemsnummer, klasse:klasseid(id, navn)')
    .eq('klubbid', klubbId)
    .eq('eraktiv', true)
    .order('etternavn')
    .order('fornavn')
  const entry = { data: data ?? [], error }
  detaljCache.set(klubbId, entry)
  return entry
}

// ── HTML-byggjarar: Liste ─────────────────────────────────────────────────────

function klubbKortHtml(k) {
  const href = `#/klubber/${lagKlubbSlug(k)}`
  const src = k.logourl || PLACEHOLDER_LOGO
  return `
    <a href="${href}" class="kaster-kort">
      <img src="${src}" alt="${k.navn}" loading="lazy">
      <div class="kaster-namn">${k.navn}</div>
    </a>`
}

function listeSkelettHtml() {
  return `
    <div class="nc-side">
      <div class="kaster-liste-kontroller">
        <div class="nc-filter-rad">
          <input id="klubb-sok" type="text" class="tl-select" placeholder="Søk på klubbnavn eller utøver" value="">
          <button id="klubb-sok-knapp" class="btn btn-secondary btn-sm">Søk</button>
        </div>
      </div>
      <div id="klubb-grid" class="kaster-grid"></div>
    </div>`
}

// ── HTML-byggjarar: Detalj ────────────────────────────────────────────────────

function detaljSkelettHtml(klubb, antall) {
  return `
    <div class="nc-side">
      <div style="margin-bottom:12px">
        <a href="#/klubber" class="btn btn-sm btn-outline-secondary">← Tilbake</a>
      </div>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
        <img src="${klubb.logourl || PLACEHOLDER_LOGO}" alt="${klubb.navn}"
          style="width:80px;height:80px;object-fit:contain;background:#ddd;border-radius:4px">
        <h1 style="font-size:1.8rem;font-weight:bold;margin:0">${klubb.navn}</h1>
      </div>
      <h3 style="margin-bottom:8px">Aktive utøvere (${antall})</h3>
      <div class="nc-filter-rad" style="margin-bottom:12px">
        <input id="klubb-detalj-sok" type="text" class="tl-select" placeholder="Søk på utøver" value="">
        <button id="klubb-detalj-sok-knapp" class="btn btn-secondary btn-sm">Søk</button>
      </div>
      <div id="klubb-detalj-liste"></div>
    </div>`
}

function medlemTabellHtml(medlemmar, sokeTekst) {
  const sok = sokeTekst.trim().toLowerCase()
  const filtrert = sok
    ? medlemmar.filter(k => kasterNavn(k).toLowerCase().includes(sok))
    : medlemmar

  if (!filtrert.length) return '<p class="nc-ingen">Ingen aktive utøvere funnet.</p>'

  const rader = filtrert.map((k, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><a href="#/kastere/${lagKasterSlug(k)}" class="tl-lenkje">${kasterNavn(k)}</a></td>
      <td>${k.klasse?.navn ?? '–'}</td>
      <td>${k.medlemsnummer ?? '–'}</td>
    </tr>`).join('')

  return `
    <div style="overflow-x:auto">
      <table class="nc-tabell">
        <thead class="nc-thead">
          <tr><th>#</th><th>Utøver</th><th>Klasse</th><th>Nr.</th></tr>
        </thead>
        <tbody>${rader}</tbody>
      </table>
    </div>`
}

// ── Render: Liste ─────────────────────────────────────────────────────────────

async function renderListe(container) {
  container.innerHTML = '<p class="laster">Laster klubbar...</p>'

  const [{ data: alleKlubbar, error }, alleKastere] = await Promise.all([
    hentKlubbar(),
    hentAktiveKastere(),
  ])

  if (error) {
    container.innerHTML = '<p class="feil">Kunne ikkje laste klubbar.</p>'
    return
  }

  const kasterPerKlubb = new Map()
  for (const k of alleKastere) {
    if (!k.klubb?.id) continue
    if (!kasterPerKlubb.has(k.klubb.id)) kasterPerKlubb.set(k.klubb.id, [])
    kasterPerKlubb.get(k.klubb.id).push(kasterNavn(k).toLowerCase())
  }

  container.innerHTML = listeSkelettHtml()

  function filtrerOgVis() {
    const sok = filtreListe.sokeTekst.trim().toLowerCase()
    const filtrert = sok
      ? alleKlubbar.filter(k =>
          k.navn.toLowerCase().includes(sok) ||
          (kasterPerKlubb.get(k.id) ?? []).some(n => n.includes(sok))
        )
      : alleKlubbar

    container.querySelector('#klubb-grid').innerHTML = filtrert.length
      ? filtrert.map(klubbKortHtml).join('')
      : '<p class="nc-ingen">Ingen klubbar funnet.</p>'
  }

  filtrerOgVis()

  container.querySelector('#klubb-sok').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      filtreListe.sokeTekst = e.target.value
      filtrerOgVis()
    }
  })

  container.querySelector('#klubb-sok-knapp').addEventListener('click', () => {
    filtreListe.sokeTekst = container.querySelector('#klubb-sok').value
    filtrerOgVis()
  })
}

// ── Render: Detalj ────────────────────────────────────────────────────────────

async function renderDetalj(container, id) {
  filtreDetalj.sokeTekst = ''

  container.innerHTML = '<p class="laster">Laster klubb...</p>'

  const [klubbRes, medlemRes] = await Promise.all([
    supabase.from('klubb').select('id, navn, logourl').eq('id', id).single(),
    hentMedlemmar(id),
  ])

  if (klubbRes.error || !klubbRes.data) {
    container.innerHTML = '<p class="feil">Kunne ikkje laste klubb.</p>'
    return
  }

  const klubb = klubbRes.data
  const { data: medlemmar } = medlemRes

  container.innerHTML = detaljSkelettHtml(klubb, medlemmar.length)

  function oppdaterListe() {
    container.querySelector('#klubb-detalj-liste').innerHTML =
      medlemTabellHtml(medlemmar, filtreDetalj.sokeTekst)
  }

  oppdaterListe()

  container.querySelector('#klubb-detalj-sok').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      filtreDetalj.sokeTekst = e.target.value
      oppdaterListe()
    }
  })

  container.querySelector('#klubb-detalj-sok-knapp').addEventListener('click', () => {
    filtreDetalj.sokeTekst = container.querySelector('#klubb-detalj-sok').value
    oppdaterListe()
  })
}

// ── Hovudfunksjon ─────────────────────────────────────────────────────────────

export async function render(container, params = {}) {
  if (params.id) {
    await renderDetalj(container, Number(params.id))
  } else {
    await renderListe(container)
  }
}
