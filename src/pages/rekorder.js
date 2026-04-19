import { supabase } from '../supabase.js'
import { lagKasterSlug } from '../utils/kaster.js'

// ── Konstanter ────────────────────────────────────────────────────────────────

const METODAR = [
  { verdi: 'kongelag',  label: 'Kongelag',  maxPoeng: 200 },
  { verdi: 'minimatch', label: 'Minimatch', maxPoeng: 200 },
  { verdi: 'halvmatch', label: 'Halvmatch', maxPoeng: 200 },
  { verdi: 'heilmatch', label: 'Heilmatch', maxPoeng: 200 },
]

// ── Modul-tilstand ────────────────────────────────────────────────────────────

const filtre = { metode: 'kongelag', kjønn: 'alle', sokeTekst: '' }

let cache = null

// ── Hjelpefunksjonar ──────────────────────────────────────────────────────────

function erDame(item) {
  return (item.kjonn_navn ?? '').toLowerCase().includes('dame')
}

function kasterNamn(item) {
  return [item.fornavn, item.etternavn].filter(Boolean).join(' ')
}

function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

// ── Data-henting ──────────────────────────────────────────────────────────────

async function hentData() {
  if (cache) return cache
  const { data, error } = await supabase
    .from('kaster_rekorder')
    .select('*')
  cache = { data: data ?? [], error }
  return cache
}

// ── Rekord-algoritme ──────────────────────────────────────────────────────────

function byggOgFiltrerListe(alleData) {
  const sok = filtre.sokeTekst.trim().toLowerCase()

  const liste = alleData.filter(item => {
    if (item.metode !== filtre.metode) return false
    if (filtre.kjønn === 'damer' && !erDame(item)) return false
    if (filtre.kjønn === 'herrer' && erDame(item)) return false
    if (sok) {
      const namn = kasterNamn(item).toLowerCase()
      const klubb = (item.klubb_namn ?? item.klubb_navn ?? '').toLowerCase()
      if (!namn.includes(sok) && !klubb.includes(sok)) return false
    }
    return true
  })

  liste.sort((a, b) => b.poeng - a.poeng)

  let pl = 1
  for (let i = 0; i < liste.length; i++) {
    if (i > 0 && liste[i].poeng < liste[i - 1].poeng) pl = i + 1
    liste[i].plassering = pl
  }

  return liste
}

// ── HTML-byggjarar ────────────────────────────────────────────────────────────

function tabellHtml(liste) {
  if (!liste.length) return '<p class="nc-ingen">Ingen rekorder funnet.</p>'

  const rader = liste.map(item => {
    const kaster = { id: item.kasterid, fornavn: item.fornavn, etternavn: item.etternavn }
    const slug = lagKasterSlug(kaster)
    const dameCls = erDame(item) ? ' class="rek-dame-rad"' : ''
    const klubbNamn = item.klubb_namn ?? item.klubb_navn ?? '–'
    const poengHtml = item.stevne_id
      ? `<span class="rek-poeng-celle" title="${escAttr(item.stevne_namn ?? item.stevne_navn)}" data-stevneid="${item.stevne_id}">${item.poeng}</span>`
      : item.poeng
    return `
      <tr${dameCls}>
        <td>${item.plassering}</td>
        <td><a href="#/kastere/${slug}" class="tl-lenkje">${kasterNamn(item)}</a></td>
        <td>${klubbNamn}</td>
        <td>${poengHtml}</td>
        <td>${item.ar ?? '–'}</td>
      </tr>`
  }).join('')

  return `
    <div style="overflow-x:auto">
      <table class="nc-tabell">
        <thead class="nc-thead">
          <tr>
            <th style="width:40px">Pl.</th>
            <th>Navn</th>
            <th>Klubb</th>
            <th style="width:80px">Poeng</th>
            <th style="width:55px">År</th>
          </tr>
        </thead>
        <tbody>${rader}</tbody>
      </table>
    </div>`
}

function sideSkelettHtml() {
  const metodeOptions = METODAR.map(m =>
    `<option value="${m.verdi}"${m.verdi === filtre.metode ? ' selected' : ''}>${m.label}</option>`
  ).join('')

  return `
    <div class="nc-side">
      <h1 style="text-align:center;font-size:1.4rem;font-weight:bold;margin-bottom:4px">Rekorder</h1>
      <p id="rek-maks-tekst" style="text-align:center;font-size:0.85rem;color:#555;margin-bottom:14px"></p>
      <div class="nc-filter-rad">
        <select id="rek-metode" class="tl-select">${metodeOptions}</select>
        <select id="rek-kjønn" class="tl-select">
          <option value="alle">Alle</option>
          <option value="herrer">Herrer</option>
          <option value="damer">Damer</option>
        </select>
        <input id="rek-sok" type="text" class="tl-select" placeholder="Søk på etternavn/klubb" value="">
      </div>
      <div id="rek-tabell-container"></div>
    </div>`
}

// ── Hovudfunksjon ─────────────────────────────────────────────────────────────

export async function render(container) {
  filtre.metode = 'kongelag'
  filtre.kjønn = 'alle'
  filtre.sokeTekst = ''

  container.innerHTML = '<p class="laster">Laster rekorder...</p>'

  const { data, error } = await hentData()
  if (error) {
    container.innerHTML = '<p class="feil">Kunne ikkje laste rekorder.</p>'
    return
  }

  container.innerHTML = sideSkelettHtml()

  function oppdaterMaksTekst() {
    const metode = METODAR.find(m => m.verdi === filtre.metode)
    container.querySelector('#rek-maks-tekst').textContent = `(Maks poengsum: ${metode.maxPoeng})`
  }

  function oppdaterTabell() {
    const liste = byggOgFiltrerListe(data)
    container.querySelector('#rek-tabell-container').innerHTML = tabellHtml(liste)
  }

  oppdaterMaksTekst()
  oppdaterTabell()

  container.querySelector('#rek-metode').addEventListener('change', e => {
    filtre.metode = e.target.value
    oppdaterMaksTekst()
    oppdaterTabell()
  })

  container.querySelector('#rek-kjønn').addEventListener('change', e => {
    filtre.kjønn = e.target.value
    oppdaterTabell()
  })

  container.querySelector('#rek-sok').addEventListener('input', e => {
    filtre.sokeTekst = e.target.value
    oppdaterTabell()
  })

  container.addEventListener('click', e => {
    const celle = e.target.closest('.rek-poeng-celle')
    if (celle?.dataset.stevneid) {
      location.hash = `#/resultat/${celle.dataset.stevneid}`
    }
  })
}
