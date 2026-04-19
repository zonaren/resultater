export function kasterNavn(k) {
  return [k?.fornavn, k?.etternavn].filter(Boolean).join(' ')
}

function lagSlugStr(str) {
  return (str ?? '')
    .toLowerCase()
    .replace(/[æä]/g, 'ae').replace(/[øö]/g, 'o').replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function lagKasterSlug(k) {
  return `${k.id}-` + lagSlugStr(`${k.etternavn ?? ''}-${k.fornavn ?? ''}`)
}

export function lagKlubbSlug(k) {
  return `${k.id}-` + lagSlugStr(k.navn ?? '')
}
