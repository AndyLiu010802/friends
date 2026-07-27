'use client'
import { useState } from 'react'
import type { Friend, Relationship, RelationshipGoal } from '@/lib/types'
import { getZodiac } from '@/lib/zodiac'
import { generateStarConfig } from '@/lib/starGen'
import { findSafePosition } from '@/lib/poissonDisk'
import { saveFriend, getFriends } from '@/lib/store'
import { pushFriend } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import RelationshipEditor from './RelationshipEditor'
import { fs, text, gold, border, surface, radius, font } from '@/lib/ui/tokens'

const MBTI_OPTIONS = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP']

const GOAL_OPTIONS: { value: RelationshipGoal; label: string }[] = [
  { value: 'maintain', label: '维持现状' },
  { value: 'deepen',   label: '更进一步' },
  { value: 'repair',   label: '修复关系' },
]

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
  const [goal,    setGoal]    = useState<RelationshipGoal | ''>(initial?.relationshipGoal ?? '')
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
      relationshipGoal: goal || undefined,
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
      <span style={{ color: gold.muted, fontSize: fs.meta, letterSpacing:2 }}>{label}</span>
      {el}
    </label>
  )

  const inputStyle: React.CSSProperties = {
    background: surface.input, border:`1px solid ${border.goldFaint}`,
    borderRadius: radius.sm, padding:'10px 14px', color: text.primary, fontSize: fs.body,
    outline:'none', fontFamily: font.serif,
  }

  const section = (title: string, children: React.ReactNode) => (
    <div style={{ border:`1px solid ${border.goldFaint}`, borderRadius: radius.lg, padding:'16px 18px',
      display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ color: gold.base, fontSize: fs.meta, letterSpacing:2 }}>{title}</div>
      {children}
    </div>
  )

  const modeButtonStyle = (active: boolean): React.CSSProperties => ({
    padding:'6px 16px', borderRadius: radius.pill, cursor:'pointer', fontSize: fs.meta, letterSpacing:1,
    border: active ? `1px solid ${gold.base}` : `1px solid ${border.gold}`,
    background: active ? surface.chip : 'transparent',
    color: active ? gold.base : gold.muted,
  })

  const importanceButtonStyle = (active: boolean): React.CSSProperties => ({
    padding:'6px 14px', borderRadius: radius.sm, cursor:'pointer', fontSize: fs.sub,
    border: active ? `1px solid ${gold.base}` : `1px solid ${border.gold}`,
    background: active ? surface.chip : 'transparent',
    color: active ? gold.base : text.dim,
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
            {field('我对这段关系的期待（只有你可见，会影响图鉴建议的方向）',
              <div style={{ display:'flex', gap:8 }}>
                {GOAL_OPTIONS.map(o => (
                  <button key={o.value} type="button"
                    onClick={() => setGoal(goal === o.value ? '' : o.value)}
                    style={importanceButtonStyle(goal === o.value)}>{o.label}</button>
                ))}
              </div>
            )}
            {field('备注', <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} style={{...inputStyle,resize:'vertical'}}/>)}
          </>)}
        </>
      )}

      <button type="submit" disabled={saving || !name.trim()} style={{
        marginTop:8, padding:'12px 0', background: surface.chip,
        border:`1px solid ${border.goldStrong}`, borderRadius: radius.md,
        color: gold.base, fontSize: fs.sub, letterSpacing:2, cursor:'pointer',
      }}>
        {saving ? '保存中...' : '✦ 保存好友'}
      </button>
    </form>
  )
}
