import { supabase } from '../supabase.js'
import { getUser } from '../utils/auth.js'

export async function render(container) {
  const auth = await getUser()
  if (auth) {
    container.innerHTML = `
      <div class="container py-4" style="max-width:480px">
        <p>Du er allereie innlogga som <strong>${auth.user.email}</strong>.</p>
        <a href="#/minside" class="btn btn-primary">Gå til Min side</a>
      </div>`
    return
  }

  container.innerHTML = `
    <div class="container py-4" style="max-width:480px">
      <h2 class="mb-4">Konto</h2>
      <ul class="nav nav-tabs mb-3" id="logginn-faner">
        <li class="nav-item">
          <button class="nav-link active" data-fane="logginn">Logg inn</button>
        </li>
        <li class="nav-item">
          <button class="nav-link" data-fane="registrer">Registrer ny konto</button>
        </li>
      </ul>

      <!-- Logg inn -->
      <div id="fane-logginn">
        <form id="logginn-skjema">
          <div class="mb-3">
            <label class="form-label">E-post</label>
            <input type="email" class="form-control" id="li-epost" required autocomplete="email">
          </div>
          <div class="mb-3">
            <label class="form-label">Passord</label>
            <input type="password" class="form-control" id="li-passord" required autocomplete="current-password">
          </div>
          <div id="li-feil" class="alert alert-danger d-none"></div>
          <button type="submit" class="btn btn-primary w-100">Logg inn</button>
        </form>
      </div>

      <!-- Registrer -->
      <div id="fane-registrer" style="display:none">
        <form id="registrer-skjema">
          <div class="mb-3">
            <label class="form-label">E-post</label>
            <input type="email" class="form-control" id="reg-epost" required autocomplete="email">
          </div>
          <div class="mb-3">
            <label class="form-label">Passord</label>
            <input type="password" class="form-control" id="reg-passord" required autocomplete="new-password" minlength="8">
          </div>
          <div class="mb-3">
            <label class="form-label">Gjenta passord</label>
            <input type="password" class="form-control" id="reg-passord2" required autocomplete="new-password" minlength="8">
          </div>
          <div id="reg-feil" class="alert alert-danger d-none"></div>
          <div id="reg-suksess" class="alert alert-success d-none">
            Konto oppretta! Du kan no logge inn.
          </div>
          <button type="submit" class="btn btn-success w-100">Opprett konto</button>
        </form>
      </div>
    </div>`

  // Fane-toggle
  container.querySelectorAll('[data-fane]').forEach(knapp => {
    knapp.addEventListener('click', () => {
      container.querySelectorAll('[data-fane]').forEach(k => k.classList.remove('active'))
      knapp.classList.add('active')
      container.querySelector('#fane-logginn').style.display   = knapp.dataset.fane === 'logginn'   ? '' : 'none'
      container.querySelector('#fane-registrer').style.display = knapp.dataset.fane === 'registrer' ? '' : 'none'
    })
  })

  // Logg inn
  container.querySelector('#logginn-skjema').addEventListener('submit', async e => {
    e.preventDefault()
    const feil = container.querySelector('#li-feil')
    feil.classList.add('d-none')
    const knapp = e.target.querySelector('[type=submit]')
    knapp.disabled = true

    const { error } = await supabase.auth.signInWithPassword({
      email:    container.querySelector('#li-epost').value.trim(),
      password: container.querySelector('#li-passord').value,
    })

    if (error) {
      feil.textContent = error.message === 'Invalid login credentials'
        ? 'Feil e-post eller passord.'
        : error.message
      feil.classList.remove('d-none')
      knapp.disabled = false
      return
    }

    const redirect = new URLSearchParams(location.hash.split('?')[1] ?? '').get('redirect')
    location.hash = redirect ? `#${redirect}` : '#/'
  })

  // Registrer
  container.querySelector('#registrer-skjema').addEventListener('submit', async e => {
    e.preventDefault()
    const feil    = container.querySelector('#reg-feil')
    const suksess = container.querySelector('#reg-suksess')
    feil.classList.add('d-none')
    suksess.classList.add('d-none')

    const passord  = container.querySelector('#reg-passord').value
    const passord2 = container.querySelector('#reg-passord2').value
    if (passord !== passord2) {
      feil.textContent = 'Passorda er ikkje like.'
      feil.classList.remove('d-none')
      return
    }

    const knapp = e.target.querySelector('[type=submit]')
    knapp.disabled = true

    const { error } = await supabase.auth.signUp({
      email:    container.querySelector('#reg-epost').value.trim(),
      password: passord,
    })

    if (error) {
      feil.textContent = error.message
      feil.classList.remove('d-none')
      knapp.disabled = false
      return
    }

    suksess.classList.remove('d-none')
    e.target.reset()
    knapp.disabled = false
  })
}
