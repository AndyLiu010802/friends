'use client'
import { useState, useEffect } from 'react'
import { getFriends, getAtlasList, getAtlasChats, replaceFriends, replaceAtlasList, replaceAtlasChats } from '@/lib/store'
import { backupToCloud, listCloudBackups, restoreFromCloud } from '@/lib/supabase'
import type { CloudBackupSummary } from '@/lib/types'

const btnStyle: React.CSSProperties = {
  padding: '8px 20px', background: 'rgba(226,185,111,0.1)',
  border: '1px solid rgba(226,185,111,0.4)', borderRadius: 10,
  color: '#e2b96f', fontSize: 12, letterSpacing: 1, cursor: 'pointer',
}

export default function BackupPanel() {
  const [friendCount, setFriendCount] = useState(0)
  const [atlasCount, setAtlasCount] = useState(0)
  const [chatCount, setChatCount] = useState(0)
  const [backups, setBackups] = useState<CloudBackupSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setFriendCount(getFriends().length)
    setAtlasCount(getAtlasList().length)
    setChatCount(getAtlasChats().length)
  }, [])

  async function handleBackup() {
    if (!confirm('这会把当前本地数据备份到 Supabase。不会删除本地数据，也不会自动合并云端数据。')) return
    setBusy(true)
    setMessage(null)
    try {
      const friends = getFriends()
      const atlasList = getAtlasList()
      const aiChats = getAtlasChats()
      await backupToCloud({
        id: crypto.randomUUID(),
        backupName: `友记备份 ${new Date().toLocaleString()}`,
        friends, atlasList, aiChats,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      setMessage(`备份完成：已保存 ${friends.length} 位朋友、${atlasList.length} 份图鉴、${aiChats.length} 条问答记录。`)
    } catch {
      setMessage('备份失败，请检查网络或 Supabase 配置。')
    } finally {
      setBusy(false)
    }
  }

  async function handleListBackups() {
    setBusy(true)
    setMessage(null)
    try {
      setBackups(await listCloudBackups())
    } catch {
      setMessage('获取云端备份列表失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore(backupId: string) {
    if (!confirm('这会用云端备份覆盖当前本地数据。当前 localStorage 中的数据会被替换。建议你先备份当前本地数据。')) return
    setBusy(true)
    setMessage(null)
    try {
      const payload = await restoreFromCloud(backupId)
      if (!payload) {
        setMessage('恢复失败：未找到该备份。')
        return
      }
      replaceFriends(payload.friends)
      replaceAtlasList(payload.atlasList)
      replaceAtlasChats(payload.aiChats)
      setFriendCount(payload.friends.length)
      setAtlasCount(payload.atlasList.length)
      setChatCount(payload.aiChats.length)
      setMessage('恢复完成，刷新页面查看最新数据。')
    } catch {
      setMessage('恢复失败，请检查网络或 Supabase 配置。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 2 }}>
        本地好友数量：{friendCount}　本地图鉴数量：{atlasCount}　本地问答数量：{chatCount}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={handleBackup} disabled={busy} style={btnStyle}>备份到云端</button>
        <button onClick={handleListBackups} disabled={busy} style={btnStyle}>查看云端备份</button>
      </div>
      {message && <div style={{ color: '#e2b96f', fontSize: 12 }}>{message}</div>}
      {backups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {backups.map(b => (
            <div key={b.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              border: '1px solid rgba(226,185,111,0.15)', borderRadius: 10, padding: '10px 14px',
            }}>
              <div style={{ color: '#e2e8f0', fontSize: 12 }}>
                {b.backupName}（{b.friendCount} 位朋友 · {b.atlasCount} 份图鉴 · {b.chatCount} 条问答）
              </div>
              <button onClick={() => handleRestore(b.id)} disabled={busy} style={btnStyle}>从此备份恢复</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
