import { render as renderHome } from './pages/home.js'
import { render as renderResultat } from './pages/resultat.js'
import { render as renderTerminliste } from './pages/terminliste.js'
import { render as renderNorgescupen } from './pages/norgescupen.js'
import { render as renderNorgesranking } from './pages/norgesranking.js'
import { render as renderKastere } from './pages/kastere.js'

const container = document.getElementById('app')

const ruter = [
  { mønster: /^\/resultat\/(\d+)$/, side: renderResultat, params: m => ({ id: m[1] }) },
  { mønster: /^\/terminliste$/, side: renderTerminliste, params: () => ({}) },
  { mønster: /^\/norgescupen$/, side: renderNorgescupen, params: () => ({}) },
  { mønster: /^\/norgesranking$/, side: renderNorgesranking, params: () => ({}) },
  { mønster: /^\/kastere\/(\d+)(-[^/]*)?$/, side: renderKastere, params: m => ({ id: m[1] }) },
  { mønster: /^\/kastere$/, side: renderKastere, params: () => ({}) },
  { mønster: /^\/?$/, side: renderHome, params: () => ({}) },
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

window.addEventListener('hashchange', naviger)
document.addEventListener('DOMContentLoaded', naviger)
