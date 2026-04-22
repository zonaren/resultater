import { supabase } from '../supabase.js'
import { formaterPoeng, hentRegler, hentStevnerOgResultater, byggSingelListe } from '../utils/norgescup.js'
import { formaterDatoLang as formaterDato } from '../utils/shared.js'

function dagsdato() {
  return new Date().toISOString().slice(0, 10)
}

async function hentSisteResultater() {
  const { data, error } = await supabase
    .from('stevne')
    .select('id, navn, dato')
    .lt('dato', dagsdato())
    .order('dato', { ascending: false })
    .limit(5)
  return { data: data ?? [], error }
}

async function hentKommendeStevner() {
  const { data, error } = await supabase
    .from('stevne')
    .select('id, navn, dato, innbydelseurl')
    .gte('dato', dagsdato())
    .order('dato', { ascending: true })
    .limit(5)
  return { data: data ?? [], error }
}

function ncTopp20Html(liste) {
  if (liste.length === 0) return '<p class="nc-ingen">Ingen data.</p>'
  const rader = liste.slice(0, 20).map(k => `
    <tr>
      <td class="nc-td-pl">${k.plassering}</td>
      <td>${k.navn}</td>
      <td>${k.klubb}</td>
      <td class="nc-td-poeng">${formaterPoeng(k.totalPoeng)}</td>
    </tr>`).join('')
  return `
    <table class="nc-tabell">
      <thead class="nc-thead">
        <tr>
          <th class="nc-td-pl">Pl.</th>
          <th>Navn</th>
          <th>Klubb</th>
          <th class="nc-td-poeng">Poeng</th>
        </tr>
      </thead>
      <tbody>${rader}</tbody>
    </table>`
}

function resultatKortHtml(s) {
  return `
    <div class="stevne-kort">
      <p class="stevne-dato">${formaterDato(s.dato)}</p>
      <p class="stevne-navn">${s.navn}</p>
      <a class="stevne-lenke" href="#/resultat/${s.id}">Vis resultat</a>
    </div>`
}

function kommendeKortHtml(s) {
  const innbydelse = s.innbydelseurl
    ? `<a class="stevne-lenke" href="${s.innbydelseurl}" target="_blank" rel="noopener">Innbydelse &#128196;</a>`
    : `<span class="stevne-lenke-inaktiv">Innbydelse er ikke klar</span>`
  return `
    <div class="stevne-kort">
      <p class="stevne-dato">${formaterDato(s.dato)}</p>
      <p class="stevne-navn">${s.navn}</p>
      ${innbydelse}
    </div>`
}

export async function render(container) {
  const ar = new Date().getFullYear()
  container.innerHTML = '<p class="laster">Laster...</p>'

  const [
    { data: resultater, error: e1 },
    { data: kommende, error: e2 },
    { data: regler, error: e3 },
    { stevner, resultater: ncResultater, error: e4 },
  ] = await Promise.all([
    hentSisteResultater(),
    hentKommendeStevner(),
    hentRegler(ar),
    hentStevnerOgResultater(ar),
  ])

  if (e1 || e2 || e3 || e4) {
    container.innerHTML = '<p class="feil">Kunne ikkje laste framsida.</p>'
    return
  }

  const ncListe = regler ? byggSingelListe(ncResultater, stevner, regler, 'NC', 1) : []

  container.innerHTML = `
    <div class="heimeside">
      <h1 class="heimeside-tittel">Resultatservice</h1>
      <div class="heimeside-grid">
        <section class="heimeside-nc">
          <h2 class="heimeside-seksjon-tittel">Norgescupen Klasse 1 - Topp 20</h2>
          ${ncTopp20Html(ncListe)}
          <a class="heimeside-meir-lenke" href="#/norgescupen">Til detaljert liste</a>
        </section>
        <section class="heimeside-resultater">
          <h2 class="heimeside-seksjon-tittel">Siste resultater</h2>
          <div class="stevne-liste">${resultater.map(resultatKortHtml).join('')}</div>
          <a class="heimeside-meir-lenke" href="#/terminliste">Vis terminliste</a>
        </section>
        <section class="heimeside-kommende">
          <h2 class="heimeside-seksjon-tittel">Kommende konkurranser</h2>
          <div class="stevne-liste">${kommende.map(kommendeKortHtml).join('')}</div>
          <a class="heimeside-meir-lenke" href="#/terminliste">Vis terminliste</a>
        </section>
      </div>
    </div>`
}
