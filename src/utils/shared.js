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

// ── Excel-eksport ─────────────────────────────────────────────────────────────

export function lastNedExcel(rader, filnamn, arknamn = 'Data') {
  if (!window.XLSX) { alert('SheetJS ikkje lasta'); return }
  const ark = XLSX.utils.json_to_sheet(rader)
  const bok = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(bok, ark, arknamn)
  XLSX.writeFile(bok, filnamn)
}

// ── År-dropdown ───────────────────────────────────────────────────────────────

export function arOptions(valgt, fra, til = new Date().getFullYear()) {
  let html = ''
  for (let ar = til; ar >= fra; ar--) {
    html += `<option value="${ar}"${ar === valgt ? ' selected' : ''}>${ar}</option>`
  }
  return html
}
