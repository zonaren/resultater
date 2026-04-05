import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://urtvpewjlevhlevtnvkf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVydHZwZXdqbGV2aGxldnRudmtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTA2NDgsImV4cCI6MjA5MDk4NjY0OH0.0kCozO-eFJKZ19uU8F2HOHRcUsJD7HAVpVBl6sKoVbU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
