import { supabase } from '../supabase.js'
import { getUser } from '../utils/auth.js'

const datoFmt = new Intl.DateTimeFormat('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })

export async function render(container, { id } = {}) {
  if (!id) { container.innerHTML = '<p class="feil" style="text-align:center;margin-top:40px;">Manglande stevne-ID.</p>'; return }

  container.innerHTML = '<p class="laster" style="text-align:center;margin-top:40px;">Laster…</p>'

  const [authRes, stevneRes, pameldingRes, klasserRes, grupperRes] = await Promise.all([
    getUser(),
    supabase.from('stevne').select('id, navn, dato, sted, erfullfort').eq('id', id).single(),
    supabase.from('pamelding')
      .select('id, status, kaster:kasterid(id, fornavn, etternavn, klubb:klubbid(navn))')
      .eq('stevneid', id)
      .order('id'),
    supabase.from('klasse').select('id, navn').order('navn'),
    supabase.from('gruppe').select('id, navn').order('navn'),
  ])

  const auth   = authRes
  const stevne = stevneRes.data
  const pameldingar = pameldingRes.data ?? []
  const klassar     = klasserRes.data ?? []
  const grupper     = grupperRes.data ?? []

  if (!stevne) {
    container.innerHTML = '<p class="feil" style="text-align:center;margin-top:40px;">Stevnet finst ikkje.</p>'
    return
  }

  const dato = stevne.dato ? datoFmt.format(new Date(stevne.dato)) : ''

  // Sjekk om innlogga brukar er kobla og ikkje allereie påmeldt
  const erKobla    = auth?.profil?.kobling_status === 'godkjent'
  const kasterid   = auth?.profil?.kasterid
  const erPameldt  = pameldingar.some(p => p.kaster?.id === kasterid)
  const erAdmin    = auth?.profil?.rolle === 'admin' || auth?.profil?.rolle === 'klubbadmin'

  let skjemaHtml = ''
  if (!auth) {
    skjemaHtml = `<div class="alert alert-info">
      <a href="#/logginn?redirect=/stevne/${id}/pamelding">Logg inn</a> for å melde deg på.
    </div>`
  } else if (!erKobla) {
    skjemaHtml = `<div class="alert alert-warning">
      Du må <a href="#/minside">koble kontoen din til ein utøvarprofil</a> for å melde deg på.
    </div>`
  } else if (stevne.erfullfort) {
    skjemaHtml = `<div class="alert alert-secondary">Dette stevnet er fullført. Påmelding er stengt.</div>`
  } else if (erPameldt) {
    const min = pameldingar.find(p => p.kaster?.id === kasterid)
    skjemaHtml = `
      <div class="alert alert-success d-flex justify-content-between align-items-center">
        <span>Du er påmeldt (status: <strong>${min?.status}</strong>)</span>
        <button id="avmeld-knapp" class="btn btn-sm btn-outline-danger">Meld av</button>
      </div>`
  } else {
    const klasseOpt = klassar.map(k => `<option value="${k.id}">${k.navn}</option>`).join('')
    const gruppeOpt = grupper.map(g => `<option value="${g.id}">${g.navn}</option>`).join('')
    skjemaHtml = `
      <form id="pamelding-skjema" class="card p-3 mb-4">
        <h5 class="mb-3">Meld deg på</h5>
        <div class="mb-3">
          <label class="form-label">Klasse</label>
          <select class="form-select" name="klasse_id">
            <option value="">— vel (valfritt) —</option>${klasseOpt}
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label">Gruppe</label>
          <select class="form-select" name="gruppe_id">
            <option value="">— vel (valfritt) —</option>${gruppeOpt}
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label">Merknad</label>
          <input type="text" class="form-control" name="merknad" placeholder="Valfri merknad">
        </div>
        <div id="pm-feil" class="alert alert-danger d-none"></div>
        <button type="submit" class="btn btn-primary">Meld på</button>
      </form>`
  }

  const listHtml = pameldingar.length
    ? `<table class="table table-sm">
        <thead><tr><th>Namn</th><th>Klubb</th><th>Status</th>${erAdmin ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${pameldingar.map(p => `<tr>
            <td>${p.kaster ? `<a href="#/kastere/${p.kaster.id}">${p.kaster.fornavn} ${p.kaster.etternavn}</a>` : '—'}</td>
            <td>${p.kaster?.klubb?.navn ?? ''}</td>
            <td><span class="badge bg-${p.status === 'bekreftet' ? 'success' : p.status === 'avmeldt' ? 'secondary' : 'primary'}">${p.status}</span></td>
            ${erAdmin ? `<td><button class="btn btn-xs btn-outline-danger btn-sm fjern-pm" data-id="${p.id}">Fjern</button></td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>`
    : '<p class="text-muted">Ingen påmeldingar enno.</p>'

  container.innerHTML = `
    <div class="container py-4" style="max-width:720px">
      <h2 class="mb-1">${stevne.navn}</h2>
      <p class="text-muted mb-4">${dato}${stevne.sted ? ' · ' + stevne.sted : ''}</p>
      ${skjemaHtml}
      <h5 class="mt-4 mb-2">Påmeldingar (${pameldingar.length})</h5>
      ${listHtml}
    </div>`

  // Påmelding-skjema
  container.querySelector('#pamelding-skjema')?.addEventListener('submit', async e => {
    e.preventDefault()
    const fd   = new FormData(e.target)
    const feil = container.querySelector('#pm-feil')
    feil.classList.add('d-none')

    const { error } = await supabase.from('pamelding').insert({
      stevneid:  Number(id),
      kasterid,
      bruker_id: auth.user.id,
      klasse_id: fd.get('klasse_id') ? Number(fd.get('klasse_id')) : null,
      gruppe_id: fd.get('gruppe_id') ? Number(fd.get('gruppe_id')) : null,
      merknad:   fd.get('merknad').trim() || null,
    })

    if (error) { feil.textContent = error.message; feil.classList.remove('d-none'); return }
    render(container, { id })
  })

  // Avmelding
  container.querySelector('#avmeld-knapp')?.addEventListener('click', async () => {
    const min = pameldingar.find(p => p.kaster?.id === kasterid)
    if (!min || !confirm('Vil du melde deg av?')) return
    await supabase.from('pamelding').delete().eq('id', min.id)
    render(container, { id })
  })

  // Admin: fjern vilkårleg påmelding
  container.querySelectorAll('.fjern-pm').forEach(knapp => {
    knapp.addEventListener('click', async () => {
      if (!confirm('Fjern påmelding?')) return
      await supabase.from('pamelding').delete().eq('id', Number(knapp.dataset.id))
      render(container, { id })
    })
  })
}
