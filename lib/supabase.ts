import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Friend, Atlas } from './types'
import { saveFriend, saveAtlas } from './store'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Cloud sync is optional — the app is fully usable on localStorage alone. Without
// NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (e.g. a fresh clone with no .env.local yet), skip
// client creation instead of throwing, so `npm run build`/`npm run dev` still work.
const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

export async function pushFriend(friend: Friend): Promise<void> {
  if (!supabase) return
  await supabase.from('friends').upsert({
    id: friend.id,
    data: friend,
    updated_at: new Date().toISOString(),
  })
}

export async function deleteFriendRemote(id: string): Promise<void> {
  if (!supabase) return
  await supabase.from('friends').delete().eq('id', id)
}

export async function pushAtlas(atlas: Atlas): Promise<void> {
  if (!supabase) return
  await supabase.from('atlas').upsert({
    id: atlas.id,
    friend_id: atlas.friendId,
    data: atlas,
  })
}

export async function pullAll(): Promise<void> {
  if (!supabase) return
  const [{ data: fRows }, { data: aRows }] = await Promise.all([
    supabase.from('friends').select('data'),
    supabase.from('atlas').select('data'),
  ])
  fRows?.forEach(r => saveFriend(r.data as Friend))
  aRows?.forEach(r => saveAtlas(r.data as Atlas))
}

export async function uploadMedia(
  friendId: string,
  folder: string,
  file: File
): Promise<{ url: string; thumbnailUrl: string }> {
  if (!supabase) throw new Error('Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  const path = `friends/${friendId}/${folder}/${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from('friend-media').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('friend-media').getPublicUrl(path)
  return { url: data.publicUrl, thumbnailUrl: data.publicUrl }
}

export { supabase }
