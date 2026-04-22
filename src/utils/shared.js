// ── Dato-formatering ──────────────────────────────────────────────────────────

const datoFmtKort = new Intl.DateTimeFormat('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
const datoFmtLang = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export function formaterDato(datoStr) {
  if (!datoStr) return ''
  return datoFmtKort.format(new Date(datoStr))
}

export function formaterDatoLang(datoStr) {
  if (!datoStr) return ''
  return datoFmtLang.format(new Date(datoStr))
}

// ── År-dropdown ───────────────────────────────────────────────────────────────

export function arOptions(valgt, fra, til = new Date().getFullYear()) {
  let html = ''
  for (let ar = til; ar >= fra; ar--) {
    html += `<option value="${ar}"${ar === valgt ? ' selected' : ''}>${ar}</option>`
  }
  return html
}
