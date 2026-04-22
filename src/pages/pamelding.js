import { supabase } from '../supabase.js'
import { getUser } from '../utils/auth.js'

const datoFmt = new Intl.DateTimeFormat('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })

export async function render(container, { id } = {}) {
  if (!id) { container.innerHTML = '<p class="feil" style="text-align:center;margin-top:40px;">Manglande stevne-ID.</p>'; return }

  container.innerHTML = '<p class="laster" style="text-align:center;margin-top:40px;">Laster…</p>'

  const auth = await getUser()
  const erAdminRolle      = auth?.profil?.rolle === 'admin'
  const erKlubbadminRolle = auth?.profil?.rolle === 'klubbadmin'
  const erPrivilegert     = erAdminRolle || erKlubbadminRolle

  const { data: stevne } = await supabase
    .from('stevne')
    .select('id, navn, dato, sted, erfullfort, klubbid')
    .eq('id', id)
    .single()

  if (!stevne) {
    container.innerHTML = '<p class="feil" style="text-align:center;margin-top:40px;">Stevnet finst ikkje.</p>'
    return
  }

  const relaterteFraDato = stevne.dato ? new Date(new Date(stevne.dato).getTime() - 2 * 864e5) : null
  const relaterteTimDato = stevne.dato ? new Date(new Date(stevne.dato).getTime() + 2 * 864e5) : null

  const hentingar = [
    supabase.from('pamelding')
      .select('id, kasterid, kaster:kasterid(id, fornavn, etternavn, klubb:klubbid(navn))')
      .eq('stevneid', id)
      .order('id'),
  ]

  if (stevne.klubbid && relaterteFraDato) {
    hentingar.push(
      supabase.from('stevne')
        .select('id, navn, dato')
        .eq('klubbid', stevne.klubbid)
        .eq('erfullfort', false)
        .neq('id', id)
        .gte('dato', relaterteFraDato.toISOString())
        .lte('dato', relaterteTimDato.toISOString())
        .order('dato')
    )
  }

  if (erPrivilegert) {
    if (erAdminRolle) {
      hentingar.push(supabase.from('kaster').select('id, fornavn, etternavn, klubb:klubbid(navn)').eq('eraktiv', true).order('etternavn'))
    } else if (auth.klubber.length) {
      hentingar.push(supabase.from('kaster').select('id, fornavn, etternavn, klubb:klubbid(navn)').in('klubbid', auth.klubber).eq('eraktiv', true).order('etternavn'))
    }
  }

  const resultat = await Promise.all(hentingar)

  const pameldingar = resultat[0].data ?? []
  let relaterte     = []
  let klubbKastere  = []

  let idx = 1
  if (stevne.klubbid && relaterteFraDato) { relaterte    = resultat[idx++]?.data ?? [] }
  if (erPrivilegert)                       { klubbKastere = resultat[idx]?.data   ?? [] }

  const dato      = stevne.dato ? datoFmt.format(new Date(stevne.dato)) : ''
  const erKobla   = auth?.profil?.kobling_status === 'godkjent'
  const kasterid  = auth?.profil?.kasterid
  const erPameldt = pameldingar.some(p => p.kasterid === kasterid)

  // ── Eige påmeldingsskjema ────────────────────────────────────────────────────
  let skjemaHtml = ''
  if (!auth) {
    skjemaHtml = `<div class="alert alert-info">
      <a href="#/logginn?redirect=/stevne/${id}/pamelding">Logg inn</a> for å melde deg på.
    </div>`
  } else if (!erKobla && !erPrivilegert) {
    skjemaHtml = `<div class="alert alert-warning">
      Du må <a href="#/minside">koble kontoen din til ein utøvarprofil</a> for å melde deg på.
    </div>`
  } else if (stevne.erfullfort) {
    skjemaHtml = `<div class="alert alert-secondary">Dette stevnet er fullført. Påmelding er stengt.</div>`
  } else if (erKobla && erPameldt) {
    skjemaHtml = `
      <div class="alert alert-success d-flex justify-content-between align-items-center">
        <span>Du er påmeldt</span>
        <button id="avmeld-knapp" class="btn btn-sm btn-outline-danger">Meld av</button>
      </div>`
  } else if (erKobla && !stevne.erfullfort) {
    skjemaHtml = `
      <form id="pamelding-skjema" class="card p-3 mb-3">
        <h5 class="mb-3">Meld deg på</h5>
        <div id="pm-feil" class="alert alert-danger d-none"></div>
        <button type="submit" class="btn btn-primary">Meld på</button>
      </form>`
  }

  // ── Admin/klubbadmin: meld på andre ─────────────────────────────────────────
  let adminSkjemaHtml = ''
  if (erPrivilegert && !stevne.erfullfort) {
    const allereie     = new Set(pameldingar.map(p => p.kasterid))
    const tilgjengelige = klubbKastere.filter(k => !allereie.has(k.id))
    const kasterOpt    = tilgjengelige.map(k =>
      `<option value="${k.id}">${k.etternavn}, ${k.fornavn} — ${k.klubb?.navn ?? ''}</option>`
    ).join('')

    adminSkjemaHtml = `
      <form id="admin-pamelding-skjema" class="card p-3 mb-3 border-warning">
        <h5 class="mb-3">Meld på klubbmedlem</h5>
        <div class="mb-3">
          <label class="form-label">Utøvar</label>
          <select class="form-select" name="admin_kasterid" required>
            <option value="">— vel utøvar —</option>${kasterOpt}
          </select>
        </div>
        <div id="admin-pm-feil" class="alert alert-danger d-none"></div>
        <button type="submit" class="btn btn-warning">Meld på</button>
      </form>`
  }

  // ── Relaterte stevner ────────────────────────────────────────────────────────
  const relaterteHtml = relaterte.length ? `
    <div class="mt-4 mb-3">
      <h5>Andre stevner same helg (same arrangør)</h5>
      <ul class="list-unstyled">
        ${relaterte.map(s => {
          const d = s.dato ? datoFmt.format(new Date(s.dato)) : ''
          return `<li><a href="#/stevne/${s.id}/pamelding">${s.navn} — ${d}</a></li>`
        }).join('')}
      </ul>
    </div>` : ''

  // ── Påmeldingsliste ──────────────────────────────────────────────────────────
  const listHtml = pameldingar.length
    ? `<table class="table table-sm">
        <thead><tr><th>Namn</th><th>Klubb</th>${erPrivilegert ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${pameldingar.map(p => `<tr>
            <td>${p.kaster ? `<a href="#/kastere/${p.kaster.id}">${p.kaster.fornavn} ${p.kaster.etternavn}</a>` : '—'}</td>
            <td>${p.kaster?.klubb?.navn ?? ''}</td>
            ${erPrivilegert ? `<td><button class="btn btn-sm btn-outline-danger fjern-pm" data-id="${p.id}">Fjern</button></td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>`
    : '<p class="text-muted">Ingen påmeldingar enno.</p>'

  container.innerHTML = `
    <div class="container py-4" style="max-width:720px">
      <h2 class="mb-1">${stevne.navn}</h2>
      <p class="text-muted mb-4">${dato}${stevne.sted ? ' · ' + stevne.sted : ''}</p>
      ${skjemaHtml}
      ${adminSkjemaHtml}
      ${relaterteHtml}
      <h5 class="mt-4 mb-2">Påmeldingar (${pameldingar.length})</h5>
      ${listHtml}
    </div>`

  container.querySelector('#pamelding-skjema')?.addEventListener('submit', async e => {
    e.preventDefault()
    const feil = container.querySelector('#pm-feil')
    feil.classList.add('d-none')
    const { error } = await supabase.from('pamelding').insert({
      stevneid:  Number(id),
      kasterid,
      bruker_id: auth.user.id,
    })
    if (error) { feil.textContent = error.message; feil.classList.remove('d-none'); return }
    render(container, { id })
  })

  container.querySelector('#admin-pamelding-skjema')?.addEventListener('submit', async e => {
    e.preventDefault()
    const fd            = new FormData(e.target)
    const feil          = container.querySelector('#admin-pm-feil')
    feil.classList.add('d-none')
    const velgtKasterid = Number(fd.get('admin_kasterid'))
    if (!velgtKasterid) { feil.textContent = 'Vel ein utøvar.'; feil.classList.remove('d-none'); return }
    const { error } = await supabase.from('pamelding').insert({
      stevneid:  Number(id),
      kasterid:  velgtKasterid,
      bruker_id: auth.user.id,
    })
    if (error) { feil.textContent = error.message; feil.classList.remove('d-none'); return }
    render(container, { id })
  })

  container.querySelector('#avmeld-knapp')?.addEventListener('click', async () => {
    const min = pameldingar.find(p => p.kasterid === kasterid)
    if (!min || !confirm('Vil du melde deg av?')) return
    await supabase.from('pamelding').delete().eq('id', min.id)
    render(container, { id })
  })

  container.querySelectorAll('.fjern-pm').forEach(knapp => {
    knapp.addEventListener('click', async () => {
      if (!confirm('Fjern påmelding?')) return
      await supabase.from('pamelding').delete().eq('id', Number(knapp.dataset.id))
      render(container, { id })
    })
  })
}
