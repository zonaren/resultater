import { supabase } from '../supabase.js'

const FANER = ['kobling', 'brukarar', 'klubbadmin']
const FANE_LABEL = { kobling: 'Koblingforespørslar', brukarar: 'Brukarar', klubbadmin: 'Klubbadmin-tilgang' }

export async function render(container) {
  container.innerHTML = `
    <div class="container py-4" style="max-width:860px">
      <h2 class="mb-3">Administrasjon</h2>
      <ul class="nav nav-tabs mb-4" id="admin-faner">
        ${FANER.map((f, i) => `<li class="nav-item">
          <button class="nav-link${i === 0 ? ' active' : ''}" data-fane="${f}">${FANE_LABEL[f]}</button>
        </li>`).join('')}
      </ul>
      <div id="admin-innhald"></div>
    </div>`

  const innhald = container.querySelector('#admin-innhald')
  let aktivFane = 'kobling'

  async function visFane(fane) {
    aktivFane = fane
    container.querySelectorAll('[data-fane]').forEach(k => {
      k.classList.toggle('active', k.dataset.fane === fane)
    })
    innhald.innerHTML = '<p class="laster">Laster…</p>'
    if (fane === 'kobling')     await _visKobling(innhald)
    if (fane === 'brukarar')    await _visBrukarar(innhald)
    if (fane === 'klubbadmin')  await _visKlubbadmin(innhald)
  }

  container.querySelector('#admin-faner').addEventListener('click', e => {
    const knapp = e.target.closest('[data-fane]')
    if (knapp) visFane(knapp.dataset.fane)
  })

  visFane('kobling')
}

// ── Koblingforespørslar ──────────────────────────────────────
async function _visKobling(el) {
  const { data, error } = await supabase
    .from('bruker_profil')
    .select('id, kobling_kasterid, kaster:kobling_kasterid(id, fornavn, etternavn, klubb:klubbid(navn))')
    .eq('kobling_status', 'venter')

  if (error) { el.innerHTML = `<div class="alert alert-danger">${error.message}</div>`; return }
  if (!data?.length) { el.innerHTML = '<p class="text-muted">Ingen ventande forespørslar.</p>'; return }

  const ids = data.map(r => r.id)
  const { data: epostar } = await supabase.rpc('hent_bruker_epost', { bruker_ids: ids })
  const epostMap = Object.fromEntries((epostar ?? []).map(r => [r.id, r.epost]))

  el.innerHTML = `<table class="table table-hover">
    <thead><tr><th>E-post</th><th>Vil koblast til</th><th>Handling</th></tr></thead>
    <tbody>
      ${data.map(r => {
        const k = r.kaster
        const kastNamn = k ? `${k.fornavn} ${k.etternavn} (${k.klubb?.navn ?? ''})` : '—'
        return `<tr data-id="${r.id}" data-kasterid="${r.kobling_kasterid}">
          <td>${epostMap[r.id] ?? r.id}</td>
          <td>${kastNamn}</td>
          <td>
            <button class="btn btn-sm btn-success me-1 godkjenn-knapp">Godkjenn</button>
            <button class="btn btn-sm btn-outline-danger avvis-knapp">Avvis</button>
          </td>
        </tr>`
      }).join('')}
    </tbody>
  </table>`

  el.querySelectorAll('.godkjenn-knapp').forEach(knapp => {
    knapp.addEventListener('click', async () => {
      const rad = knapp.closest('tr')
      await _oppdaterKobling(rad.dataset.id, rad.dataset.kasterid, 'godkjent')
      _visKobling(el)
    })
  })
  el.querySelectorAll('.avvis-knapp').forEach(knapp => {
    knapp.addEventListener('click', async () => {
      const rad = knapp.closest('tr')
      await _oppdaterKobling(rad.dataset.id, null, 'avvist')
      _visKobling(el)
    })
  })
}

async function _oppdaterKobling(brukerId, kasterid, status) {
  await supabase
    .from('bruker_profil')
    .update({ kobling_status: status, kasterid: kasterid ? Number(kasterid) : null })
    .eq('id', brukerId)
}

// ── Brukarar ────────────────────────────────────────────────
async function _visBrukarar(el) {
  const { data, error } = await supabase
    .from('bruker_profil')
    .select('id, rolle, kobling_status')
    .order('opprettet_at', { ascending: false })

  if (error) { el.innerHTML = `<div class="alert alert-danger">${error.message}</div>`; return }
  if (!data?.length) { el.innerHTML = '<p class="text-muted">Ingen brukarar.</p>'; return }

  const ids = data.map(r => r.id)
  const { data: epostar } = await supabase.rpc('hent_bruker_epost', { bruker_ids: ids })
  const epostMap = Object.fromEntries((epostar ?? []).map(r => [r.id, r.epost]))

  const rolleOptions = ['bruker', 'klubbadmin', 'admin']
    .map(r => `<option value="${r}">${r}</option>`).join('')

  el.innerHTML = `
    <div id="brukar-feil" class="alert alert-danger d-none"></div>
    <table class="table table-hover">
      <thead><tr><th>E-post</th><th>Rolle</th><th>Kobling</th><th></th></tr></thead>
      <tbody>
        ${data.map(r => `<tr data-id="${r.id}">
          <td>${epostMap[r.id] ?? r.id}</td>
          <td>
            <select class="form-select form-select-sm rolle-vel" style="width:auto">
              ${rolleOptions}
            </select>
          </td>
          <td><span class="badge bg-secondary">${r.kobling_status}</span></td>
          <td><button class="btn btn-sm btn-primary lagre-rolle">Lagre</button></td>
        </tr>`).join('')}
      </tbody>
    </table>`

  // Set noverande verdiar
  data.forEach(r => {
    const rad = el.querySelector(`tr[data-id="${r.id}"]`)
    if (rad) rad.querySelector('.rolle-vel').value = r.rolle
  })

  el.querySelectorAll('.lagre-rolle').forEach(knapp => {
    knapp.addEventListener('click', async () => {
      const rad     = knapp.closest('tr')
      const nyRolle = rad.querySelector('.rolle-vel').value
      const feil    = el.querySelector('#brukar-feil')
      feil.classList.add('d-none')
      const { error } = await supabase
        .from('bruker_profil')
        .update({ rolle: nyRolle })
        .eq('id', rad.dataset.id)
      if (error) {
        feil.textContent = error.message
        feil.classList.remove('d-none')
      } else {
        knapp.textContent = '✓'
        setTimeout(() => { knapp.textContent = 'Lagre' }, 2000)
      }
    })
  })
}

// ── Klubbadmin-tilgang ───────────────────────────────────────
async function _visKlubbadmin(el) {
  const [{ data: brukarar }, { data: klubbar }, { data: tildelte }] = await Promise.all([
    supabase.from('bruker_profil').select('id').eq('rolle', 'klubbadmin'),
    supabase.from('klubb').select('id, navn').eq('eraktiv', true).order('navn'),
    supabase.from('klubbadmin_klubber').select('bruker_id, klubbid'),
  ])

  if (!brukarar?.length) { el.innerHTML = '<p class="text-muted">Ingen brukarar med rolle "klubbadmin".</p>'; return }

  const ids = brukarar.map(r => r.id)
  const { data: epostar } = await supabase.rpc('hent_bruker_epost', { bruker_ids: ids })
  const epostMap = Object.fromEntries((epostar ?? []).map(r => [r.id, r.epost]))

  const tildelteMap = {}
  tildelte?.forEach(r => {
    if (!tildelteMap[r.bruker_id]) tildelteMap[r.bruker_id] = new Set()
    tildelteMap[r.bruker_id].add(r.klubbid)
  })

  const klubbOptions = (klubbar ?? []).map(k =>
    `<option value="${k.id}">${k.navn}</option>`
  ).join('')

  el.innerHTML = `
    <div id="ka-feil" class="alert alert-danger d-none"></div>
    ${brukarar.map(b => {
      const mine = [...(tildelteMap[b.id] ?? [])]
      const merkteKlubbar = mine.map(kid => {
        const k = (klubbar ?? []).find(x => x.id === kid)
        return k ? `<span class="badge bg-primary me-1" data-kid="${kid}">${k.navn} <button class="btn-close btn-close-white btn-sm fjern-klubb" style="font-size:.6rem"></button></span>` : ''
      }).join('')
      return `<div class="card mb-3" data-bruker="${b.id}">
        <div class="card-body">
          <h6 class="card-title mb-2">${epostMap[b.id] ?? b.id}</h6>
          <div class="ka-klubbar mb-2">${merkteKlubbar || '<span class="text-muted small">Ingen klubbar tildelt</span>'}</div>
          <div class="d-flex gap-2">
            <select class="form-select form-select-sm legg-til-vel" style="width:auto">
              <option value="">Legg til klubb…</option>
              ${klubbOptions}
            </select>
            <button class="btn btn-sm btn-success legg-til-knapp">Legg til</button>
          </div>
        </div>
      </div>`
    }).join('')}`

  el.querySelectorAll('.legg-til-knapp').forEach(knapp => {
    knapp.addEventListener('click', async () => {
      const kort    = knapp.closest('[data-bruker]')
      const velg    = kort.querySelector('.legg-til-vel')
      const klubbid = Number(velg.value)
      if (!klubbid) return
      const feil = el.querySelector('#ka-feil')
      feil.classList.add('d-none')
      const { error } = await supabase.from('klubbadmin_klubber').insert({
        bruker_id: kort.dataset.bruker,
        klubbid,
      })
      if (error) { feil.textContent = error.message; feil.classList.remove('d-none'); return }
      _visKlubbadmin(el)
    })
  })

  el.querySelectorAll('.fjern-klubb').forEach(knapp => {
    knapp.addEventListener('click', async e => {
      e.stopPropagation()
      const badge  = knapp.closest('[data-kid]')
      const kort   = knapp.closest('[data-bruker]')
      const feil   = el.querySelector('#ka-feil')
      feil.classList.add('d-none')
      const { error } = await supabase
        .from('klubbadmin_klubber')
        .delete()
        .eq('bruker_id', kort.dataset.bruker)
        .eq('klubbid', Number(badge.dataset.kid))
      if (error) { feil.textContent = error.message; feil.classList.remove('d-none'); return }
      _visKlubbadmin(el)
    })
  })
}
