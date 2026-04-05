export async function render(container, params) {
  const id = params?.id ?? ''
  container.innerHTML = `<p style="text-align:center;margin-top:40px;color:#666;">Resultatside for stevne #${id} – kommer snart.</p>`
}
