'use client'
import { useState } from 'react'
import type { Friend, Relationship } from '@/lib/types'
import { getZodiac } from '@/lib/zodiac'
import { generateStarConfig } from '@/lib/starGen'
import { findSafePosition } from '@/lib/poissonDisk'
import { saveFriend, getFriends } from '@/lib/store'
import { pushFriend } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import RelationshipEditor from './RelationshipEditor'

const MBTI_OPTIONS = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP']

interface Props { initial?: Friend }

export default function FriendForm({ initial }: Props) {
  const router = useRouter()
  const [mode,    setMode]    = useState<'quick' | 'full'>(initial ? 'full' : 'quick')
  const [name,    setName]    = useState(initial?.name ?? '')
  const [nick,    setNick]    = useState(initial?.nickname ?? '')
  const [bday,    setBday]    = useState(initial?.birthday ?? '')
  const [mbti,    setMbti]    = useState(initial?.mbti ?? '')
  const [likes,   setLikes]   = useState(initial?.likes.join(', ') ?? '')
  const [dislikes,setDislikes]= useState(initial?.dislikes.join(', ') ?? '')
  const [hobbies, setHobbies] = useState(initial?.hobbies.join(', ') ?? '')
  const [notes,   setNotes]   = useState(initial?.notes ?? '')
  const [important, setImportant] = useState(initial?.important ?? false)
  const [rels,    setRels]    = useState<Relationship[]>(initial?.relationships ?? [])
  const [saving,  setSaving]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const zodiac  = bday ? getZodiac(bday) : undefined
    const existing = getFriends()
    const positions = existing
      .filter(f => f.id !== initial?.id)
      .map(f => f.starConfig.position as [number,number,number])
    const position  = initial?.starConfig.position ?? findSafePosition(positions)
    const starConfig = generateStarConfig(mbti || undefined, zodiac, hobbies.split(',').map(h=>h.trim()), position)

    const friend: Friend = {
      id:        initial?.id ?? crypto.randomUUID(),
      name, nickname: nick || undefined,
      birthday: bday || undefined, zodiac, mbti: mbti || undefined,
      important,
      likes:    likes.split(',').map(s=>s.trim()).filter(Boolean),
      dislikes: dislikes.split(',').map(s=>s.trim()).filter(Boolean),
      hobbies:  hobbies.split(',').map(s=>s.trim()).filter(Boolean),
      portraits: initial?.portraits ?? [],
      memories:  initial?.memories  ?? [],
      relationships: rels,
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

  const section = (title: string, children: React.ReactNode) => (
    <div style={{ border:'1px solid rgba(226,185,111,0.15)', borderRadius:12, padding:'16px 18px',
      display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ color:'#e2b96f', fontSize:12, letterSpacing:2 }}>{title}</div>
      {children}
    </div>
  )

  const modeButtonStyle = (active: boolean): React.CSSProperties => ({
    padding:'6px 16px', borderRadius:20, cursor:'pointer', fontSize:11, letterSpacing:1,
    border: active ? '1px solid #e2b96f' : '1px solid rgba(226,185,111,0.25)',
    background: active ? 'rgba(226,185,111,0.15)' : 'transparent',
    color: active ? '#e2b96f' : 'rgba(226,185,111,0.5)',
  })

  const importanceButtonStyle = (active: boolean): React.CSSProperties => ({
    padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:12,
    border: active ? '1px solid #e2b96f' : '1px solid rgba(226,185,111,0.25)',
    background: active ? 'rgba(226,185,111,0.12)' : 'transparent',
    color: active ? '#e2b96f' : '#cbd5e1',
  })

  const importantToggle = (
    <div style={{ display:'flex', gap:8 }}>
      <button type="button" onClick={()=>setImportant(false)} style={importanceButtonStyle(!important)}>普通</button>
      <button type="button" onClick={()=>setImportant(true)} style={importanceButtonStyle(important)}>重要 ✦</button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', gap:8 }}>
        <button type="button" onClick={()=>setMode('quick')} style={modeButtonStyle(mode==='quick')}>快速添加</button>
        <button type="button" onClick={()=>setMode('full')} style={modeButtonStyle(mode==='full')}>完整档案</button>
      </div>

      {mode === 'quick' ? (
        <>
          {field('名字 *', <input value={name} onChange={e=>setName(e.target.value)} required style={inputStyle}/>)}
          {field('一句话备注', <input value={notes} onChange={e=>setNotes(e.target.value)} style={inputStyle}/>)}
          {field('重要程度', importantToggle)}
        </>
      ) : (
        <>
          {section('基本信息', <>
            {field('名字 *', <input value={name} onChange={e=>setName(e.target.value)} required style={inputStyle}/>)}
            {field('昵称', <input value={nick} onChange={e=>setNick(e.target.value)} style={inputStyle}/>)}
            {field('生日', <input type="date" value={bday} onChange={e=>setBday(e.target.value)} style={inputStyle}/>)}
            {field('重要程度', importantToggle)}
          </>)}
          {section('性格与喜好（选填）', <>
            {field('MBTI',
              <select value={mbti} onChange={e=>setMbti(e.target.value)} style={inputStyle}>
                <option value="">不填写</option>
                {MBTI_OPTIONS.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            )}
            {field('喜欢的东西（逗号分隔）', <input value={likes} onChange={e=>setLikes(e.target.value)} style={inputStyle}/>)}
            {field('讨厌的东西（逗号分隔）', <input value={dislikes} onChange={e=>setDislikes(e.target.value)} style={inputStyle}/>)}
            {field('兴趣爱好（逗号分隔）', <input value={hobbies} onChange={e=>setHobbies(e.target.value)} style={inputStyle}/>)}
          </>)}
          {section('关系与备注', <>
            {initial && field('共同好友',
              <RelationshipEditor
                currentFriendId={initial.id}
                relationships={rels}
                onChange={setRels}
              />
            )}
            {field('备注', <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} style={{...inputStyle,resize:'vertical'}}/>)}
          </>)}
        </>
      )}

      <button type="submit" disabled={saving || !name.trim()} style={{
        marginTop:8, padding:'12px 0', background:'rgba(226,185,111,0.12)',
        border:'1px solid rgba(226,185,111,0.4)', borderRadius:12,
        color:'#e2b96f', fontSize:13, letterSpacing:2, cursor:'pointer',
      }}>
        {saving ? '保存中...' : '✦ 保存好友'}
      </button>
    </form>
  )
}
