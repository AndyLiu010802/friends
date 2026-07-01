import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Friend, Atlas, AtlasChat, CloudBackupPayload, CloudBackupSummary } from './types'
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

export async function backupToCloud(payload: CloudBackupPayload): Promise<void> {
  if (!supabase) return
  await supabase.from('friend_backups').upsert({
    id: payload.id,
    backup_name: payload.backupName,
    friends: payload.friends,
    atlas_list: payload.atlasList,
    ai_chats: payload.aiChats,
    updated_at: new Date().toISOString(),
  })
}

export async function listCloudBackups(): Promise<CloudBackupSummary[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('friend_backups')
    .select('id, backup_name, friends, atlas_list, ai_chats, created_at, updated_at')
    .order('created_at', { ascending: false })
  return (data ?? []).map(row => ({
    id: row.id,
    backupName: row.backup_name,
    friendCount: Array.isArray(row.friends) ? row.friends.length : 0,
    atlasCount: Array.isArray(row.atlas_list) ? row.atlas_list.length : 0,
    chatCount: Array.isArray(row.ai_chats) ? row.ai_chats.length : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function restoreFromCloud(backupId: string): Promise<CloudBackupPayload | null> {
  if (!supabase) return null
  const { data } = await supabase.from('friend_backups').select('*').eq('id', backupId).single()
  if (!data) return null
  return {
    id: data.id,
    backupName: data.backup_name,
    friends: data.friends as Friend[],
    atlasList: data.atlas_list as Atlas[],
    aiChats: data.ai_chats as AtlasChat[],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function saveAtlasChatRemote(chat: AtlasChat): Promise<void> {
  if (!supabase) return
  await supabase.from('atlas_chats').upsert({
    id: chat.id,
    friend_id: chat.friendId,
    messages: chat.messages,
    updated_at: new Date().toISOString(),
  })
}

export async function getAtlasChatRemote(friendId: string): Promise<AtlasChat | null> {
  if (!supabase) return null
  const { data } = await supabase.from('atlas_chats').select('*').eq('friend_id', friendId).maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    friendId: data.friend_id,
    messages: data.messages,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export { supabase }
