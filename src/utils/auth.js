import { supabase } from '../supabase.js'

// Cache per sesjon. Tømt ved SIGNED_OUT / ny innlogging.
let _cache = null

async function _hentCache() {
  if (_cache) return _cache

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: profil } = await supabase
    .from('bruker_profil')
    .select('rolle, kasterid, kobling_status, kobling_kasterid')
    .eq('id', session.user.id)
    .single()

  let klubber = []
  if (profil?.rolle === 'klubbadmin') {
    const { data } = await supabase
      .from('klubbadmin_klubber')
      .select('klubbid')
      .eq('bruker_id', session.user.id)
    klubber = (data ?? []).map(r => r.klubbid)
  }

  _cache = { user: session.user, profil: profil ?? null, klubber }
  return _cache
}

export async function getUser() {
  return _hentCache()
}

export async function getRolle() {
  const auth = await _hentCache()
  return auth?.profil?.rolle ?? null
}

export async function erInnlogget() {
  return (await _hentCache()) !== null
}

export async function erAdmin() {
  return (await getRolle()) === 'admin'
}

export async function erKlubbadmin(klubbId = null) {
  const auth = await _hentCache()
  if (!auth || auth.profil?.rolle !== 'klubbadmin') return false
  if (klubbId === null) return true
  return auth.klubber.includes(Number(klubbId))
}

export async function loggUt() {
  _cache = null
  await supabase.auth.signOut()
}

// Abonner på auth-endringar. Tømer cache og sender DOM-event.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    _cache = null
  } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    _cache = null // tving re-henting med ny sesjon
  }
  document.dispatchEvent(new CustomEvent('authStateChanged', { detail: event }))
})
