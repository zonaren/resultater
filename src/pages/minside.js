import { supabase } from '../supabase.js'
import { getUser } from '../utils/auth.js'

const rolleLabel = { admin: 'Administrator', klubbadmin: 'Klubbadministrator', bruker: 'Brukar' }

export async function render(container) {
  container.innerHTML = '<p class="laster" style="text-align:center;margin-top:40px;">Laster…</p>'

  const auth = await getUser()
  if (!auth) { location.hash = '#/logginn'; return }

  const { profil, user } = auth

  let html = `
    <div class="container py-4" style="max-width:640px">
      <h2 class="mb-1">Min side</h2>
      <p class="text-muted mb-4">${user.email} · <span class="badge bg-secondary">${rolleLabel[profil?.rolle] ?? 'Ukjent'}</span></p>`

  // --- Kobling-seksjon ---
  const status = profil?.kobling_status ?? 'ingen'

  if (status === 'ingen' || status === 'avvist') {
    if (status === 'avvist') {
      html += `<div class="alert alert-warning">Koblingforespørselen din vart avvist. Du kan sende ein ny.</div>`
    }
    html += `
      <div class="card mb-4">
        <div class="card-body">
          <h5 class="card-title">Koble til utøvarprofil</h5>
          <p class="card-text text-muted">Søk etter deg sjølv i registeret og send ein forespørsel. Etter godkjenning kan du melde deg på stevner.</p>
          <input type="search" id="kaster-sok" class="form-control mb-2" placeholder="Søk på namn…">
          <div id="kaster-treff" class="list-group mb-2"></div>
          <div id="kasting-feil" class="alert alert-danger d-none"></div>
        </div>
      </div>`
  } else if (status === 'venter') {
    html += `<div class="alert alert-info mb-4">Koblingforespørselen din ventar på godkjenning frå ein administrator.</div>`
  } else if (status === 'godkjent' && profil?.kasterid) {
    html += await _lenkaTilKaster(profil.kasterid)
    html += await _minePameldingar(user.id)
  }

  html += '</div>'
  container.innerHTML = html

  if (status === 'ingen' || status === 'avvist') {
    _bindKasterSok(container, user.id)
  }
}

async function _lenkaTilKaster(kasterid) {
  const { data } = await supabase
    .from('kaster')
    .select('id, fornavn, etternavn, klubb:klubbid(navn)')
    .eq('id', kasterid)
    .single()
  if (!data) return ''
  const namn = `${data.fornavn} ${data.etternavn}`
  return `
    <div class="card mb-4">
      <div class="card-body">
        <h5 class="card-title">Kobla til utøvarprofil</h5>
        <p class="mb-1"><strong>${namn}</strong> · ${data.klubb?.navn ?? ''}</p>
        <a href="#/kastere/${data.id}" class="btn btn-sm btn-outline-primary mt-1">Sjå profil</a>
      </div>
    </div>`
}

async function _minePameldingar(brukerId) {
  const { data } = await supabase
    .from('pamelding')
    .select('id, stevne:stevneid(id, navn, dato)')
    .eq('bruker_id', brukerId)
    .order('stevneid', { ascending: true })
    .limit(50)
  if (!data?.length) return '<p class="text-muted">Ingen påmeldingar enno.</p>'

  // Sorter på stevnedato stigande (neste stevne først)
  const sortert = [...data].sort((a, b) => {
    const da = a.stevne?.dato ? new Date(a.stevne.dato) : 0
    const db = b.stevne?.dato ? new Date(b.stevne.dato) : 0
    return da - db
  })

  const rader = sortert.map(p => {
    const dato = p.stevne?.dato ? new Date(p.stevne.dato).toLocaleDateString('nb-NO') : ''
    return `<tr>
      <td><a href="#/stevne/${p.stevne?.id}/pamelding">${p.stevne?.navn ?? ''}</a></td>
      <td>${dato}</td>
      <td><a href="#/stevne/${p.stevne?.id}/pamelding" class="btn btn-sm btn-outline-danger">Meld av</a></td>
    </tr>`
  }).join('')

  return `
    <div class="card mb-4">
      <div class="card-body">
        <h5 class="card-title">Påmeldingar</h5>
        <table class="table table-sm"><thead><tr><th>Stevne</th><th>Dato</th><th></th></tr></thead>
        <tbody>${rader}</tbody></table>
      </div>
    </div>`
}

function _bindKasterSok(container, brukerId) {
  let timer = null
  container.querySelector('#kaster-sok').addEventListener('input', e => {
    clearTimeout(timer)
    const q = e.target.value.trim()
    const treffDiv = container.querySelector('#kaster-treff')
    if (q.length < 2) { treffDiv.innerHTML = ''; return }
    timer = setTimeout(async () => {
      const { data } = await supabase
        .from('kaster')
        .select('id, fornavn, etternavn, klubb:klubbid(navn)')
        .or(`fornavn.ilike.%${q}%,etternavn.ilike.%${q}%`)
        .limit(8)
      if (!data?.length) { treffDiv.innerHTML = '<p class="text-muted small">Ingen treff.</p>'; return }
      treffDiv.innerHTML = data.map(k =>
        `<button class="list-group-item list-group-item-action" data-id="${k.id}">
          ${k.fornavn} ${k.etternavn} <span class="text-muted small">· ${k.klubb?.navn ?? ''}</span>
        </button>`
      ).join('')
    }, 300)
  })

  container.querySelector('#kaster-treff').addEventListener('click', async e => {
    const knapp = e.target.closest('[data-id]')
    if (!knapp) return
    const feil = container.querySelector('#kasting-feil')
    feil.classList.add('d-none')

    const { error } = await supabase
      .from('bruker_profil')
      .update({ kobling_kasterid: Number(knapp.dataset.id), kobling_status: 'venter' })
      .eq('id', brukerId)

    if (error) {
      feil.textContent = 'Kunne ikkje sende forespørsel: ' + error.message
      feil.classList.remove('d-none')
      return
    }
    location.reload()
  })
}
