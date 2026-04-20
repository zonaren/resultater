export function lagFormRadHtml(label, inputHtml) {
  return `<div class="mb-3"><label class="form-label fw-semibold">${label}</label>${inputHtml}</div>`
}

export function visLagreFeil(container, melding) {
  let el = container.querySelector('.admin-feil')
  if (!el) {
    el = document.createElement('div')
    el.className = 'alert alert-danger admin-feil mt-3'
    container.querySelector('form')?.append(el)
  }
  el.textContent = melding
  el.style.display = ''
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

export function visSuksess(container, melding) {
  let el = container.querySelector('.admin-suksess')
  if (!el) {
    el = document.createElement('div')
    el.className = 'alert alert-success admin-suksess mt-3'
    container.querySelector('form')?.append(el)
  }
  el.textContent = melding
  el.style.display = ''
  setTimeout(() => { el.style.display = 'none' }, 4000)
}
