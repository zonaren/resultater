import { supabase } from '../supabase.js'
import { kasterNavn, lagKasterSlug } from '../utils/kaster.js'

// ── Konstanter ────────────────────────────────────────────────────────────────

const METODAR = [
  { verdi: 'kongelag',  label: 'Kongelag',  felt: 'poengkongelag',  maxPoeng: 200 },
  { verdi: 'minimatch', label: 'Minimatch', felt: 'poengminimatch',  maxPoeng: 200 },
  { verdi: 'halvmatch', label: 'Halvmatch', felt: 'poengxhalvmatch', maxPoeng: 200 },
  { verdi: 'heilmatch', label: 'Heilmatch', felt: 'poengxheilmatch', maxPoeng: 200 },
]

// ── Modul-tilstand ────────────────────────────────────────────────────────────

const filtre = { metode: 'kongelag', kjønn: 'alle', sokeTekst: '' }

let cache = null

// ── Hjelpefunksjonar ──────────────────────────────────────────────────────────

function erDame(kaster) {
  return (kaster?.kjonn?.navn ?? '').toLowerCase().includes('dame')
}

function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

// ── Data-henting ──────────────────────────────────────────────────────────────

async function hentData() {
  if (cache) return cache

  const BATCH = 1000
  let alleData = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('resultat')
      .select(`
        id,
        kasterid,
        poengkongelag, poengminimatch, poengxhalvmatch, poengxheilmatch,
        kaster:kasterid(id, fornavn, etternavn, kjonn:kjonnid(id, navn)),
        klubb:klubbid(id, navn),
        stevne:stevneid(id, navn, dato)
      `)
      .range(from, from + BATCH - 1)

    if (error) {
      cache = { data: alleData, error }
      return cache
    }

    alleData = alleData.concat(data ?? [])
    if ((data?.length ?? 0) < BATCH) break
    from += BATCH
  }

  cache = { data: alleData, error: null }
  return cache
}

// ── Rekord-algoritme ──────────────────────────────────────────────────────────

function byggOgFiltrerListe(alleData, metodeFelt) {
  const kasterMap = new Map()
  for (const r of alleData) {
    const poeng = r[metodeFelt]
    if (poeng == null) continue
    const existing = kasterMap.get(r.kasterid)
    if (!existing || poeng > existing.poeng) {
      kasterMap.set(r.kasterid, {
        kaster: r.kaster,
        klubb: r.klubb,
        poeng,
        stevneid: r.stevne?.id,
        stevneNamn: r.stevne?.navn ?? '–',
        ar: r.stevne?.dato ? r.stevne.dato.substring(0, 4) : '–',
      })
    }
  }

  const sok = filtre.sokeTekst.trim().toLowerCase()
  const liste = [...kasterMap.values()].filter(item => {
    const dame = erDame(item.kaster)
    if (filtre.kjønn === 'damer' && !dame) return false
    if (filtre.kjønn === 'herrer' && dame) return false
    if (sok) {
      const namn = kasterNavn(item.kaster).toLowerCase()
      const klubb = (item.klubb?.navn ?? '').toLowerCase()
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
    const slug = lagKasterSlug(item.kaster)
    const dameCls = erDame(item.kaster) ? ' class="rek-dame-rad"' : ''
    const poengHtml = item.stevneid
      ? `<span class="rek-poeng-celle" title="${escAttr(item.stevneNamn)}" data-stevneid="${item.stevneid}">${item.poeng}</span>`
      : item.poeng
    return `
      <tr${dameCls}>
        <td>${item.plassering}</td>
        <td><a href="#/kastere/${slug}" class="tl-lenkje">${kasterNavn(item.kaster)}</a></td>
        <td>${item.klubb?.navn ?? '–'}</td>
        <td>${poengHtml}</td>
        <td>${item.ar}</td>
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
    const metode = METODAR.find(m => m.verdi === filtre.metode)
    const liste = byggOgFiltrerListe(data, metode.felt)
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
