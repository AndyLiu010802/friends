import { createClient } from '@supabase/supabase-js'
import type { Friend, Atlas } from './types'
import { saveFriend, saveAtlas } from './store'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function pushFriend(friend: Friend): Promise<void> {
  await supabase.from('friends').upsert({
    id: friend.id,
    data: friend,
    updated_at: new Date().toISOString(),
  })
}

export async function pushAtlas(atlas: Atlas): Promise<void> {
  await supabase.from('atlas').upsert({
    id: atlas.id,
    friend_id: atlas.friendId,
    data: atlas,
  })
}

export async function pullAll(): Promise<void> {
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
  const path = `friends/${friendId}/${folder}/${Date.now()}-${file.name}`
  await supabase.storage.from('friend-media').upload(path, file)
  const { data } = supabase.storage.from('friend-media').getPublicUrl(path)
  return { url: data.publicUrl, thumbnailUrl: data.publicUrl }
}

export { supabase }
