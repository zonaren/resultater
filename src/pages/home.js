import { supabase } from '../supabase.js'

const datoFormat = new Intl.DateTimeFormat('nb-NO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formaterDato(datoStr) {
  if (!datoStr) return ''
  return datoFormat.format(new Date(datoStr))
}

export async function render(container) {
  container.innerHTML = `
    <div class="siste-resultater">
      <h1>Siste resultater</h1>
      <p class="laster">Laster...</p>
    </div>
  `

  const { data, error } = await supabase
    .from('stevne')
    .select('id, stevnenavn, stevnedato')
    .order('stevnedato', { ascending: false })
    .limit(5)

  console.log('Supabase svar:', { data, error })

  const liste = container.querySelector('.siste-resultater')

  if (error) {
    liste.innerHTML = `<h1>Siste resultater</h1><p class="feil">Kunne ikke laste stevner.</p>`
    console.error(error)
    return
  }

  const kortHtml = data.map(s => `
    <div class="stevne-kort">
      <p class="stevne-dato">${formaterDato(s.stevnedato)}</p>
      <p class="stevne-navn">${s.stevnenavn}</p>
      <a class="stevne-lenke" href="#/resultat/${s.id}">Vis resultat</a>
    </div>
  `).join('')

  liste.innerHTML = `<h1>Siste resultater</h1><div class="stevne-liste">${kortHtml}</div>`
}
