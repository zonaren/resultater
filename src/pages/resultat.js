import { supabase } from '../supabase.js'
import { getUser } from '../utils/auth.js'
import { formaterDatoLang as formaterDato } from '../utils/shared.js'

async function hentStevne(id) {
  const { data, error } = await supabase
    .from('stevne')
    .select(`
      id, navn, sted, dato, erfullfort, resultaturl, juryleder,
      stevnetype:stevnetypeid(navn),
      kategori:kategoriid(navn),
      kontakt:kontaktkasterid(fornavn, etternavn),
      innledende:innledendekastemetodeid(navn),
      avsluttende:avsluttendekastemetodeid(navn)
    `)
    .eq('id', id)
    .single()
  return { data, error }
}

async function hentResultater(stevneId) {
  const { data, error } = await supabase
    .from('resultat')
    .select(`
      plassering, norgescuppoeng,
      kaster:kasterid(fornavn, etternavn),
      klubb:klubbid(navn),
      klasse:klasseid(navn),
      gruppe:gruppeid(navn)
    `)
    .eq('stevneid', stevneId)
    .order('plassering')
  return { data, error }
}

function grupperResultater(resultater, erFoer2026) {
  const grupper = new Map()

  for (const r of resultater) {
    const gruppeNavn = r.gruppe?.navn ?? '–'
    const klasseNavn = r.klasse?.navn

    const nokkel = erFoer2026
      ? `${klasseNavn ?? ''}|${gruppeNavn}`
      : gruppeNavn

    const label = erFoer2026
      ? `${klasseNavn ? klasseNavn + ' ' : ''}${gruppeNavn}`
      : gruppeNavn

    if (!grupper.has(nokkel)) {
      grupper.set(nokkel, { label, rader: [] })
    }
    grupper.get(nokkel).rader.push(r)
  }

  // Sorter nøkler alfabetisk
  return [...grupper.values()].sort((a, b) => a.label.localeCompare(b.label, 'nb'))
}

function formaterKastemetode(innledende, avsluttende) {
  const deler = [innledende?.navn, avsluttende?.navn].filter(Boolean)
  return deler.join(' \\ ')
}

function kasternavn(kaster) {
  if (!kaster) return '–'
  return `${kaster.fornavn ?? ''} ${kaster.etternavn ?? ''}`.trim()
}

// ── Mobilvisning ─────────────────────────────────────────────────────────────

function mobilGruppeHtml(gruppe) {
  const rader = gruppe.rader.map(r => `
    <div class="res-rad">
      <span class="res-pl">${r.plassering ?? '–'}.</span>
      <div class="res-info">
        <span class="res-navn">${kasternavn(r.kaster)}</span>
        <span class="res-klubb">${r.klubb?.navn ?? '–'}</span>
      </div>
    </div>
  `).join('')

  return `
    <div class="res-gruppe">
      <h2 class="res-gruppe-tittel">${gruppe.label}</h2>
      <div class="res-gruppe-rader">${rader}</div>
    </div>
  `
}

// ── Desktopvisning ────────────────────────────────────────────────────────────

function desktopGruppeHtml(gruppe) {
  const rader = gruppe.rader.map(r => `
    <tr>
      <td class="res-td-pl">${r.plassering ?? '–'}</td>
      <td class="res-td-navn"><a href="#" class="res-kaster-lenke">${kasternavn(r.kaster)}</a></td>
      <td class="res-td-klubb">${r.klubb?.navn ?? '–'}</td>
      <td class="res-td-nc">${r.norgescuppoeng != null ? r.norgescuppoeng : ''}</td>
    </tr>
  `).join('')

  return `
    <div class="res-tabell-seksjon">
      <table class="res-tabell">
        <thead>
          <tr class="res-thead-gruppe">
            <td colspan="4" class="res-td-gruppe-header">${gruppe.label}</td>
          </tr>
          <tr class="res-thead-kolonner">
            <th class="res-td-pl">Pl</th>
            <th class="res-td-navn">NAVN</th>
            <th class="res-td-klubb">KLUBB</th>
            <th class="res-td-nc">NC</th>
          </tr>
        </thead>
        <tbody>${rader}</tbody>
      </table>
    </div>
  `
}

// ── Render ────────────────────────────────────────────────────────────────────

export async function render(container, params) {
  const id = params?.id ?? ''
  container.innerHTML = `<p class="laster">Laster resultat...</p>`

  const [{ data: stevne, error: stevneFeil }, { data: resultater, error: resultatFeil }] =
    await Promise.all([hentStevne(id), hentResultater(id)])

  if (stevneFeil || !stevne) {
    container.innerHTML = `<p class="feil">Kunne ikke laste stevne.</p>`
    return
  }

  if (resultatFeil) {
    container.innerHTML = `<p class="feil">Kunne ikke laste resultater.</p>`
    return
  }

  const aar = stevne.dato ? new Date(stevne.dato).getFullYear() : 9999
  const erFoer2026 = aar < 2026
  const grupper = grupperResultater(resultater ?? [], erFoer2026)
  const antallDeltakere = (resultater ?? []).length

  const kontaktperson = stevne.kontakt
    ? kasternavn(stevne.kontakt)
    : null

  const pdfLenke = stevne.resultaturl
    ? `<a class="res-pdf-lenke" href="${stevne.resultaturl}" target="_blank" rel="noopener">Resultat som pdf 📄</a>`
    : ''

  const kastemetode = formaterKastemetode(stevne.innledende, stevne.avsluttende)
  const kategori = [stevne.stevnetype?.navn, stevne.kategori?.navn].filter(Boolean).join(' ')

  // Mobil-header
  const mobilInfoHtml = `
    <div class="res-mobil-info">
      <h1 class="res-tittel">${stevne.navn}</h1>
      <p class="res-dato-sted">${formaterDato(stevne.dato)}${stevne.sted ? ', ' + stevne.sted : ''}</p>
      ${kastemetode ? `<p class="res-klassifisering">${kastemetode}</p>` : ''}
      ${kategori ? `<p class="res-klassifisering">${kategori}</p>` : ''}
      ${kontaktperson ? `<p class="res-klassifisering">Kontaktperson: ${kontaktperson}</p>` : ''}
    </div>
  `

  // Desktop-infotabell
  const desktopInfoHtml = `
    <table class="res-info-tabell">
      <tbody>
        <tr>
          <td class="res-info-label">Stevne</td>
          <td class="res-info-verdi">${stevne.navn}</td>
          <td class="res-info-label">Sted</td>
          <td class="res-info-verdi res-sted-verdi">${stevne.sted ?? ''}</td>
          <td class="res-info-label">Dato</td>
          <td class="res-info-verdi">${formaterDato(stevne.dato)}</td>
        </tr>
        <tr>
          <td class="res-info-label">Kastemetode</td>
          <td class="res-info-verdi">${kastemetode}</td>
          <td class="res-info-label">Type/Kategori</td>
          <td class="res-info-verdi">${kategori}</td>
          <td class="res-info-label">Kontaktperson</td>
          <td class="res-info-verdi">${kontaktperson ?? ''}</td>
        </tr>
        ${stevne.juryleder ? `
        <tr>
          <td class="res-info-label"></td><td></td><td></td><td></td>
          <td class="res-info-label">Juryleder</td>
          <td class="res-info-verdi">${stevne.juryleder}</td>
        </tr>` : ''}
      </tbody>
    </table>
  `

  const mobilGrupperHtml = grupper.map(mobilGruppeHtml).join('')
  const desktopGrupperHtml = grupper.map(desktopGruppeHtml).join('')

  container.innerHTML = `
    <div class="res-side">

      <!-- Mobil-header (skjult på desktop) -->
      <div class="res-mobil-blokk">
        ${mobilInfoHtml}
      </div>

      <!-- Desktop-infotabell (skjult på mobil) -->
      <div class="res-desktop-blokk">
        ${desktopInfoHtml}
      </div>

      <!-- Felles: PDF-lenke og antall -->
      <div class="res-felles">
        ${pdfLenke}
        <p class="res-antall"><strong>Antall deltakere: ${antallDeltakere}</strong></p>
      </div>

      <!-- Mobil-resultater -->
      <div class="res-mobil-blokk">
        ${mobilGrupperHtml}
      </div>

      <!-- Desktop-resultater -->
      <div class="res-desktop-blokk">
        ${desktopGrupperHtml}
      </div>

    </div>
  `

  getUser().then(auth => {
    if (!auth?.profil) return
    const felles = container.querySelector('.res-felles')
    if (!felles) return
    const kanRedigere = auth.profil.rolle === 'admin' ||
      (auth.profil.rolle === 'klubbadmin' && auth.klubber.includes(stevne.klubbid))
    if (kanRedigere) {
      const bar = document.createElement('div')
      bar.className = 'mb-2 d-flex gap-2 flex-wrap'
      bar.innerHTML = `
        <a href="#/stevne/${id}/admin" class="btn btn-sm btn-warning">Rediger stevne</a>
        <a href="#/stevne/${id}/pamelding" class="btn btn-sm btn-outline-info">Påmeldingar</a>`
      felles.prepend(bar)
    } else if (auth.profil.kobling_status === 'godkjent' && !stevne.erfullfort) {
      const link = document.createElement('div')
      link.className = 'mb-2'
      link.innerHTML = `<a href="#/stevne/${id}/pamelding" class="btn btn-sm btn-primary">Meld meg på</a>`
      felles.prepend(link)
    }
  })
}
