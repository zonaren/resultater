import { render as renderHome }          from './pages/home.js'
import { render as renderResultat }       from './pages/resultat.js'
import { render as renderTerminliste }    from './pages/terminliste.js'
import { render as renderNorgescupen }    from './pages/norgescupen.js'
import { render as renderNorgesranking }  from './pages/norgesranking.js'
import { render as renderKastere }        from './pages/kastere.js'
import { render as renderKlubber }        from './pages/klubber.js'
import { render as renderRekorder }       from './pages/rekorder.js'
import { render as renderNMVinnere }      from './pages/nmvinnere.js'
import { render as renderLogginn }        from './pages/logginn.js'
import { render as renderMinSide }        from './pages/minside.js'
import { render as renderAdmin }          from './pages/admin.js'
import { render as renderStevneAdmin }    from './pages/stevneadmin.js'
import { render as renderKasterAdmin }    from './pages/kasteradmin.js'
import { render as renderKlubbAdminSide } from './pages/klubbadmin-side.js'
import { render as renderPamelding }      from './pages/pamelding.js'
import { getUser, erAdmin, erKlubbadmin, loggUt } from './utils/auth.js'

const container = document.getElementById('app')

function authGuard(minRolle, renderFn) {
  return async (cont, params) => {
    const auth = await getUser()
    if (!auth) {
      location.hash = '#/logginn'
      return
    }
    if (minRolle === 'admin' && !(await erAdmin())) {
      cont.innerHTML = '<p class="feil" style="text-align:center;margin-top:40px;">Ingen tilgang.</p>'
      return
    }
    if (minRolle === 'klubbadmin' && !(await erAdmin()) && !(await erKlubbadmin())) {
      cont.innerHTML = '<p class="feil" style="text-align:center;margin-top:40px;">Ingen tilgang.</p>'
      return
    }
    await renderFn(cont, params)
  }
}

const ruter = [
  // Auth-ruter (spesifikke før generiske)
  { mønster: /^\/logginn$/,                   side: renderLogginn,                                params: () => ({}) },
  { mønster: /^\/minside$/,                   side: authGuard('bruker', renderMinSide),            params: () => ({}) },
  { mønster: /^\/admin$/,                     side: authGuard('admin', renderAdmin),               params: () => ({}) },
  { mønster: /^\/stevne\/ny$/,                side: authGuard('klubbadmin', renderStevneAdmin),     params: () => ({}) },
  { mønster: /^\/stevne\/(\d+)\/admin$/,      side: authGuard('klubbadmin', renderStevneAdmin),     params: m => ({ id: m[1] }) },
  { mønster: /^\/stevne\/(\d+)\/pamelding$/,  side: renderPamelding,                               params: m => ({ id: m[1] }) },
  { mønster: /^\/kaster\/ny$/,                side: authGuard('klubbadmin', renderKasterAdmin),     params: () => ({}) },
  { mønster: /^\/kaster\/(\d+)\/admin$/,      side: authGuard('klubbadmin', renderKasterAdmin),     params: m => ({ id: m[1] }) },
  { mønster: /^\/klubber\/(\d+)\/admin$/,     side: authGuard('klubbadmin', renderKlubbAdminSide),  params: m => ({ id: m[1] }) },
  // Eksisterande ruter
  { mønster: /^\/resultat\/(\d+)$/,           side: renderResultat,     params: m => ({ id: m[1] }) },
  { mønster: /^\/terminliste$/,               side: renderTerminliste,  params: () => ({}) },
  { mønster: /^\/norgescupen$/,               side: renderNorgescupen,  params: () => ({}) },
  { mønster: /^\/norgesranking$/,             side: renderNorgesranking, params: () => ({}) },
  { mønster: /^\/rekorder$/,                  side: renderRekorder,     params: () => ({}) },
  { mønster: /^\/nmvinnere$/,                 side: renderNMVinnere,    params: () => ({}) },
  { mønster: /^\/kastere\/(\d+)(-[^/]*)?$/,   side: renderKastere,      params: m => ({ id: m[1] }) },
  { mønster: /^\/kastere$/,                   side: renderKastere,      params: () => ({}) },
  { mønster: /^\/klubber\/(\d+)(-[^/]*)?$/,   side: renderKlubber,      params: m => ({ id: m[1] }) },
  { mønster: /^\/klubber$/,                   side: renderKlubber,      params: () => ({}) },
  { mønster: /^\/?$/,                         side: renderHome,          params: () => ({}) },
]

function naviger() {
  const hash = location.hash.replace(/^#/, '') || '/'

  for (const rute of ruter) {
    const treff = hash.match(rute.mønster)
    if (treff) {
      rute.side(container, rute.params(treff))
      return
    }
  }

  container.innerHTML = '<p style="text-align:center;margin-top:40px;color:#666;">Side ikke funnet.</p>'
}

async function oppdaterAuthMeny() {
  const auth = await getUser()
  const logginnItem  = document.getElementById('meny-logginn-item')
  const minsideItem  = document.getElementById('meny-minside-item')
  const adminItem    = document.getElementById('meny-admin-item')
  const loggutItem   = document.getElementById('meny-loggut-item')

  if (auth) {
    logginnItem.style.display  = 'none'
    minsideItem.style.display  = ''
    adminItem.style.display    = auth.profil?.rolle === 'admin' ? '' : 'none'
    loggutItem.style.display   = ''
  } else {
    logginnItem.style.display  = ''
    minsideItem.style.display  = 'none'
    adminItem.style.display    = 'none'
    loggutItem.style.display   = 'none'
  }
}

window.addEventListener('hashchange', naviger)

document.addEventListener('DOMContentLoaded', () => {
  // Knytt logg-ut-knapp
  document.getElementById('menyLoggUtKnapp').addEventListener('click', async () => {
    await loggUt()
    location.hash = '#/'
  })

  oppdaterAuthMeny()
  naviger()
})

// Oppdater menyen når auth-status endrar seg
document.addEventListener('authStateChanged', () => {
  oppdaterAuthMeny()
})
