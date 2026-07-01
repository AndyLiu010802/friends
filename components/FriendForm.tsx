'use client'
import { useState } from 'react'
import type { Friend } from '@/lib/types'
import { getZodiac } from '@/lib/zodiac'
import { generateStarConfig } from '@/lib/starGen'
import { findSafePosition } from '@/lib/poissonDisk'
import { saveFriend, getFriends } from '@/lib/store'
import { pushFriend } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const MBTI_OPTIONS = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP']

interface Props { initial?: Friend }

export default function FriendForm({ initial }: Props) {
  const router = useRouter()
  const [name,    setName]    = useState(initial?.name ?? '')
  const [nick,    setNick]    = useState(initial?.nickname ?? '')
  const [bday,    setBday]    = useState(initial?.birthday ?? '')
  const [mbti,    setMbti]    = useState(initial?.mbti ?? '')
  const [likes,   setLikes]   = useState(initial?.likes.join(', ') ?? '')
  const [dislikes,setDislikes]= useState(initial?.dislikes.join(', ') ?? '')
  const [hobbies, setHobbies] = useState(initial?.hobbies.join(', ') ?? '')
  const [notes,   setNotes]   = useState(initial?.notes ?? '')
  const [saving,  setSaving]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !bday || !mbti) return
    setSaving(true)

    const zodiac  = getZodiac(bday)
    const existing = getFriends()
    const positions = existing
      .filter(f => f.id !== initial?.id)
      .map(f => f.starConfig.position as [number,number,number])
    const position  = initial?.starConfig.position ?? findSafePosition(positions)
    const starConfig = generateStarConfig(mbti, zodiac, hobbies.split(',').map(h=>h.trim()), position)

    const friend: Friend = {
      id:        initial?.id ?? crypto.randomUUID(),
      name, nickname: nick || undefined,
      birthday: bday, zodiac, mbti,
      likes:    likes.split(',').map(s=>s.trim()).filter(Boolean),
      dislikes: dislikes.split(',').map(s=>s.trim()).filter(Boolean),
      hobbies:  hobbies.split(',').map(s=>s.trim()).filter(Boolean),
      portraits: initial?.portraits ?? [],
      memories:  initial?.memories  ?? [],
      relationships: initial?.relationships ?? [],
      notes:    notes || undefined,
      starConfig,
      atlasId:  initial?.atlasId,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    saveFriend(friend)
    await pushFriend(friend).catch(console.error)
    router.push('/')
  }

  const field = (label: string, el: React.ReactNode) => (
    <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <span style={{ color:'rgba(226,185,111,0.7)', fontSize:11, letterSpacing:2 }}>{label}</span>
      {el}
    </label>
  )

  const inputStyle: React.CSSProperties = {
    background:'rgba(255,255,255,0.04)', border:'1px solid rgba(226,185,111,0.2)',
    borderRadius:8, padding:'10px 14px', color:'#e2e8f0', fontSize:13,
    outline:'none', fontFamily:'Noto Serif SC, serif',
  }

  return (
    <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {field('名字 *', <input value={name} onChange={e=>setName(e.target.value)} required style={inputStyle}/>)}
      {field('昵称', <input value={nick} onChange={e=>setNick(e.target.value)} style={inputStyle}/>)}
      {field('生日 *', <input type="date" value={bday} onChange={e=>setBday(e.target.value)} required style={inputStyle}/>)}
      {field('MBTI *',
        <select value={mbti} onChange={e=>setMbti(e.target.value)} required style={inputStyle}>
          <option value="">选择 MBTI</option>
          {MBTI_OPTIONS.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
      )}
      {field('喜欢的东西（逗号分隔）', <input value={likes} onChange={e=>setLikes(e.target.value)} style={inputStyle}/>)}
      {field('讨厌的东西（逗号分隔）', <input value={dislikes} onChange={e=>setDislikes(e.target.value)} style={inputStyle}/>)}
      {field('兴趣爱好（逗号分隔）', <input value={hobbies} onChange={e=>setHobbies(e.target.value)} style={inputStyle}/>)}
      {field('备注', <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} style={{...inputStyle,resize:'vertical'}}/>)}

      <button type="submit" disabled={saving} style={{
        marginTop:8, padding:'12px 0', background:'rgba(226,185,111,0.12)',
        border:'1px solid rgba(226,185,111,0.4)', borderRadius:12,
        color:'#e2b96f', fontSize:13, letterSpacing:2, cursor:'pointer',
      }}>
        {saving ? '保存中...' : '✦ 保存好友'}
      </button>
    </form>
  )
}
