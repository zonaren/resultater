import { supabase } from '../supabase.js'
import { getUser } from '../utils/auth.js'

// ── Dato-formatering ──────────────────────────────────────────────────────────

const datoFormat = new Intl.DateTimeFormat('nb-NO', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})

function formaterDato(datoStr) {
  if (!datoStr) return ''
  return datoFormat.format(new Date(datoStr))
}

// ── Filterobjekt ──────────────────────────────────────────────────────────────

const filtre = {
  ar: new Date().getFullYear(),
  tekst: '',
  stevnetypeId: '',
  kastemetodeId: '',
  klubbId: '',
  kategoriId: '',
}

// Mellomlagret fullstendig datasett fra Supabase (for klient-side filtrering)
let allData = []
let _auth = null
let _pameldteIds = new Set()

// ── Supabase-henting ──────────────────────────────────────────────────────────

async function hentStevner() {
  const { data, error } = await supabase
    .from('stevne')
    .select(`
      id, navn, sted, dato, ernm, erfullfort, innbydelseurl, resultaturl,
      klubb:klubbid(id, navn),
      stevnetype:stevnetypeid(id, navn),
      innledende:kastemetode!innledendekastemetodeid(id, navn),
      avsluttende:kastemetode!avsluttendekastemetodeid(id, navn),
      kategori:kategoriid(id, navn)
    `)
    .gte('dato', `${filtre.ar}-01-01`)
    .lte('dato', `${filtre.ar}-12-31`)
    .order('dato')

  console.log('Terminliste Supabase svar:', { data, error })
  return { data, error }
}

async function hentFiltervalg() {
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

// ── Klient-side filtrering ────────────────────────────────────────────────────

function filtrerData(data) {
  return data.filter(s => {
    if (filtre.tekst) {
      const soketekst = filtre.tekst.toLowerCase()
      const treffer = [
        s.navn, s.sted,
        s.klubb?.navn,
        s.stevnetype?.navn,
        s.kategori?.navn,
        s.innledende?.navn,
        s.avsluttende?.navn,
      ].some(felt => felt?.toLowerCase().includes(soketekst))
      if (!treffer) return false
    }

    if (filtre.stevnetypeId && String(s.stevnetype?.id) !== filtre.stevnetypeId) return false

    if (filtre.kastemetodeId) {
      const id = filtre.kastemetodeId
      const treff = String(s.innledende?.id) === id || String(s.avsluttende?.id) === id
      if (!treff) return false
    }

    if (filtre.klubbId && String(s.klubb?.id) !== filtre.klubbId) return false
    if (filtre.kategoriId && String(s.kategori?.id) !== filtre.kategoriId) return false

    return true
  })
}

// ── Excel-eksport ─────────────────────────────────────────────────────────────

function lastNedExcel(filtrert) {
  if (!window.XLSX) { alert('SheetJS ikke lastet'); return }

  const rader = filtrert.map(s => ({
    'Dato': s.dato ? new Date(s.dato).toLocaleDateString('nb-NO') : '',
    'Navn': s.navn ?? '',
    'Sted': s.sted ?? '',
    'Arrangør': s.klubb?.navn ?? '',
    'Stevnetype': s.stevnetype?.navn ?? '',
    'Kastemetode (innledende)': s.innledende?.navn ?? '',
    'Kastemetode (avsluttende)': s.avsluttende?.navn ?? '',
    'Kategori': s.kategori?.navn ?? '',
    'NM': s.ernm ? 'Ja' : 'Nei',
    'InnbydelseUrl': s.innbydelseurl ?? '',
  }))

  const ark = XLSX.utils.json_to_sheet(rader)
  const bok = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(bok, ark, 'Terminliste')
  XLSX.writeFile(bok, `terminliste-${filtre.ar}.xlsx`)
}

// ── HTML-bygging ──────────────────────────────────────────────────────────────

function arOptions() {
  const gjeldende = new Date().getFullYear()
  const fra = 1983
  let html = ''
  for (let ar = gjeldende + 1; ar >= fra; ar--) {
    html += `<option value="${ar}" ${ar === filtre.ar ? 'selected' : ''}>${ar}</option>`
  }
  return html
}

function dropdownOptions(liste, valgtId, tomLabel) {
  let html = `<option value="">${tomLabel}</option>`
  for (const item of liste) {
    html += `<option value="${item.id}" ${String(item.id) === String(valgtId) ? 'selected' : ''}>${item.navn ?? item.klubbnavn}</option>`
  }
  return html
}

function kortHtml(s) {
  const dato = formaterDato(s.dato)
  const sted = s.sted ? `<p class="tl-detalj">Sted: ${s.sted}</p>` : ''
  const arrangør = s.klubb ? `<p class="tl-detalj">Arrangør: ${s.klubb.navn}</p>` : ''
  const type = s.stevnetype ? `<p class="tl-detalj">Type: ${s.stevnetype.navn}</p>` : ''
  const nm = s.ernm ? '<span class="tl-nm-merke">NM</span>' : ''
  const innbydelse = s.innbydelseurl
    ? `<a class="tl-innbydelse-lenke" href="${s.innbydelseurl}" target="_blank" rel="noopener">Innbydelse 📄</a>`
    : ''
  const resultat = s.resultaturl
    ? `<a class="stevne-lenke" href="#/resultat/${s.id}">Vis resultat</a>`
    : ''

  const erKomande = s.dato && new Date(s.dato) > new Date()
  const rolle = _auth?.profil?.rolle
  const harTilgang = _auth?.profil?.kobling_status === 'godkjent' || rolle === 'admin' || rolle === 'klubbadmin'
  const erPameldt = _pameldteIds.has(s.id)
  const pameldingLenke = !harTilgang ? ''
    : erPameldt
      ? `<a class="stevne-lenke" href="#/stevne/${s.id}/pamelding">Påmeldt ✓</a>`
      : erKomande && !s.erfullfort
        ? `<a class="stevne-lenke" href="#/stevne/${s.id}/pamelding">Meld meg på</a>`
        : ''

  return `
    <div class="stevne-kort tl-kort">
      <a class="tl-navn tl-navn-lenke" href="#/resultat/${s.id}">${nm}${s.navn}</a>
      <p class="stevne-dato">${dato}</p>
      ${sted}${arrangør}${type}
      ${innbydelse}${resultat}${pameldingLenke}
    </div>
  `
}

function byggListe(filtrert) {
  if (filtrert.length === 0) {
    return '<p class="laster">Ingen stevner funnet med valgte filtre.</p>'
  }
  return `<div class="stevne-liste">${filtrert.map(kortHtml).join('')}</div>`
}

// ── Render ────────────────────────────────────────────────────────────────────

export async function render(container) {
  container.innerHTML = `<p class="laster">Laster terminliste...</p>`

  const [{ data, error }, filtervalg, auth] = await Promise.all([hentStevner(), hentFiltervalg(), getUser()])
  _auth = auth
  _pameldteIds = new Set()
  if (auth?.user) {
    const { data: pm } = await supabase.from('pamelding').select('stevneid').eq('bruker_id', auth.user.id)
    _pameldteIds = new Set((pm ?? []).map(r => r.stevneid))
  }

  if (error) {
    container.innerHTML = `<p class="feil">Kunne ikke laste terminliste.</p>`
    return
  }

  allData = data ?? []

  function oppdaterListe() {
    const filtrert = filtrerData(allData)
    container.querySelector('.tl-liste-container').innerHTML = byggListe(filtrert)
    const antall = container.querySelector('.tl-antall')
    if (antall) antall.textContent = `${filtrert.length} stevner`
    return filtrert
  }

  container.innerHTML = `
    <div class="terminliste">
      <h1 class="tl-tittel">Terminliste ${filtre.ar}</h1>

      <!-- Desktop-filterrad -->
      <div class="tl-filter-rad">
        <select class="tl-select" id="tl-ar">${arOptions()}</select>
        <input class="tl-input" id="tl-tekst" type="search" placeholder="Søk..." value="${filtre.tekst}">
        <select class="tl-select" id="tl-stevnetype">${dropdownOptions(filtervalg.stevnetyper, filtre.stevnetypeId, 'Alle typer')}</select>
        <select class="tl-select" id="tl-kastemetode">${dropdownOptions(filtervalg.kastemetoder, filtre.kastemetodeId, 'Alle metoder')}</select>
        <select class="tl-select" id="tl-arrangorklubb">${dropdownOptions(filtervalg.klubber, filtre.klubbId, 'Alle arrangører')}</select>
        <select class="tl-select" id="tl-kategori">${dropdownOptions(filtervalg.kategorier, filtre.kategoriId, 'Alle kategorier')}</select>
        <button class="tl-excel-knapp" id="tl-excel-desktop">⬇ Excel</button>
      </div>

      <!-- Mobil-rad -->
      <div class="tl-mobil-rad">
        <input class="tl-input" id="tl-tekst-mobil" type="search" placeholder="Søk..." value="${filtre.tekst}">
        <button class="tl-filter-knapp" id="tl-filter-aapne">Filter ≡</button>
        <button class="tl-excel-knapp" id="tl-excel-mobil">⬇ Excel</button>
      </div>

      <p class="tl-antall"></p>

      <div class="tl-liste-container"></div>
    </div>

    <!-- Bunnark for mobilfiltre -->
    <div class="tl-bunnark-bakgrunn" id="tl-bakgrunn"></div>
    <div class="tl-bunnark" id="tl-bunnark">
      <div class="tl-bunnark-innhold">
        <h2 class="tl-bunnark-tittel">Filtre</h2>
        <label class="tl-label">År
          <select class="tl-select" id="tl-ar-mobil">${arOptions()}</select>
        </label>
        <label class="tl-label">Stevnetype
          <select class="tl-select" id="tl-stevnetype-mobil">${dropdownOptions(filtervalg.stevnetyper, filtre.stevnetypeId, 'Alle typer')}</select>
        </label>
        <label class="tl-label">Kastemetode
          <select class="tl-select" id="tl-kastemetode-mobil">${dropdownOptions(filtervalg.kastemetoder, filtre.kastemetodeId, 'Alle metoder')}</select>
        </label>
        <label class="tl-label">Arrangør
          <select class="tl-select" id="tl-arrangorklubb-mobil">${dropdownOptions(filtervalg.klubber, filtre.klubbId, 'Alle arrangører')}</select>
        </label>
        <label class="tl-label">Kategori
          <select class="tl-select" id="tl-kategori-mobil">${dropdownOptions(filtervalg.kategorier, filtre.kategoriId, 'Alle kategorier')}</select>
        </label>
        <div class="tl-bunnark-knapper">
          <button class="tl-tilbakestill-knapp" id="tl-tilbakestill">Tilbakestill</button>
          <button class="tl-bruk-knapp" id="tl-bruk">Bruk filter</button>
        </div>
      </div>
    </div>
  `

  oppdaterListe()

  getUser().then(auth => {
    if (!auth?.profil || (auth.profil.rolle !== 'admin' && auth.profil.rolle !== 'klubbadmin')) return
    const bar = document.createElement('div')
    bar.className = 'mb-3 px-2 d-flex gap-2'
    bar.innerHTML = `<a href="#/stevne/ny" class="btn btn-sm btn-success">+ Nytt stevne</a>`
    container.querySelector('.terminliste')?.prepend(bar)
  })

  // ── Event-lyttere ──

  // År (desktop) – nytt DB-kall
  container.querySelector('#tl-ar').addEventListener('change', async e => {
    filtre.ar = Number(e.target.value)
    container.querySelector('.tl-tittel').textContent = `Terminliste ${filtre.ar}`
    container.querySelector('.tl-liste-container').innerHTML = '<p class="laster">Laster...</p>'
    const { data: nyData, error: nyFeil } = await hentStevner()
    if (nyFeil) { container.querySelector('.tl-liste-container').innerHTML = '<p class="feil">Feil ved henting.</p>'; return }
    allData = nyData ?? []
    oppdaterListe()
  })

  // Fritekst (desktop)
  container.querySelector('#tl-tekst').addEventListener('input', e => {
    filtre.tekst = e.target.value
    oppdaterListe()
  })

  // Fritekst (mobil) – synkronisert med desktop-input
  container.querySelector('#tl-tekst-mobil').addEventListener('input', e => {
    filtre.tekst = e.target.value
    const desktop = container.querySelector('#tl-tekst')
    if (desktop) desktop.value = e.target.value
    oppdaterListe()
  })

  // Dropdown-filtre (desktop – direkte)
  container.querySelector('#tl-stevnetype').addEventListener('change', e => { filtre.stevnetypeId = e.target.value; oppdaterListe() })
  container.querySelector('#tl-kastemetode').addEventListener('change', e => { filtre.kastemetodeId = e.target.value; oppdaterListe() })
  container.querySelector('#tl-arrangorklubb').addEventListener('change', e => { filtre.klubbId = e.target.value; oppdaterListe() })
  container.querySelector('#tl-kategori').addEventListener('change', e => { filtre.kategoriId = e.target.value; oppdaterListe() })

  // Excel-eksport
  const excelHandler = () => lastNedExcel(filtrerData(allData))
  container.querySelector('#tl-excel-desktop').addEventListener('click', excelHandler)
  document.querySelector('#tl-excel-mobil').addEventListener('click', excelHandler)

  // Bunnark – åpne/lukke
  const bunnark = document.querySelector('#tl-bunnark')
  const bakgrunn = document.querySelector('#tl-bakgrunn')

  function apneBunnark() { bunnark.classList.add('aktiv'); bakgrunn.classList.add('aktiv') }
  function lukkBunnark() { bunnark.classList.remove('aktiv'); bakgrunn.classList.remove('aktiv') }

  document.querySelector('#tl-filter-aapne').addEventListener('click', apneBunnark)
  bakgrunn.addEventListener('click', lukkBunnark)

  // Tilbakestill (mobil)
  document.querySelector('#tl-tilbakestill').addEventListener('click', () => {
    filtre.tekst = ''
    filtre.stevnetypeId = ''
    filtre.kastemetodeId = ''
    filtre.klubbId = ''
    filtre.kategoriId = ''
    ;['#tl-stevnetype-mobil','#tl-kastemetode-mobil','#tl-arrangorklubb-mobil','#tl-kategori-mobil'].forEach(id => {
      const el = document.querySelector(id)
      if (el) el.value = ''
    })
    document.querySelector('#tl-tekst-mobil').value = ''
    const desktop = container.querySelector('#tl-tekst')
    if (desktop) desktop.value = ''
    oppdaterListe()
  })

  // Bruk filter (mobil) – hent verdier fra bunnark og lukk
  document.querySelector('#tl-bruk').addEventListener('click', async () => {
    const nyttAr = Number(document.querySelector('#tl-ar-mobil').value)
    const arEndret = nyttAr !== filtre.ar
    filtre.ar = nyttAr
    filtre.stevnetypeId = document.querySelector('#tl-stevnetype-mobil').value
    filtre.kastemetodeId = document.querySelector('#tl-kastemetode-mobil').value
    filtre.klubbId = document.querySelector('#tl-arrangorklubb-mobil').value
    filtre.kategoriId = document.querySelector('#tl-kategori-mobil').value
    lukkBunnark()

    if (arEndret) {
      container.querySelector('.tl-tittel').textContent = `Terminliste ${filtre.ar}`
      container.querySelector('.tl-liste-container').innerHTML = '<p class="laster">Laster...</p>'
      const { data: nyData, error: nyFeil } = await hentStevner()
      if (nyFeil) { container.querySelector('.tl-liste-container').innerHTML = '<p class="feil">Feil ved henting.</p>'; return }
      allData = nyData ?? []
    }
    oppdaterListe()
  })
}
