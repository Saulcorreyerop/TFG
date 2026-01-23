import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://stryumcmeavlvjaamcaw.supabase.co'
const supabaseKey = 'sb_publishable_2VNxDOShmzwkZNdPP774og_hp3TUb8g'

export const supabase = createClient(supabaseUrl, supabaseKey)
