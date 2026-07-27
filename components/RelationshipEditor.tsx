'use client'
import { useState } from 'react'
import { getFriends } from '@/lib/store'
import { fs, text, gold, purple, border, surface, radius, font } from '@/lib/ui/tokens'
import type { Relationship } from '@/lib/types'

// Relationships are stored one-directionally on the friend being edited (not mirrored
// onto the other friend's record). constellationLines.ts dedups by unordered id pair
// when drawing the star map, so editing this list on friend A won't show up when
// editing friend B's own relationships unless it's added there too — by design, not a bug.
interface Props {
  currentFriendId: string
  relationships: Relationship[]
  onChange: (r: Relationship[]) => void
}

export default function RelationshipEditor({ currentFriendId, relationships, onChange }: Props) {
  const allFriends = getFriends().filter(f => f.id !== currentFriendId)
  const [sel, setSel]   = useState('')
  const [label, setLabel] = useState('')
  const [close, setClose] = useState<1|2|3>(2)

  function add() {
    if (!sel || !label) return
    const rel: Relationship = { friendId: sel, label, closeness: close }
    onChange([...relationships.filter(r=>r.friendId!==sel), rel])
    setSel(''); setLabel(''); setClose(2)
  }

  const inp: React.CSSProperties = { background: surface.input, border:`1px solid ${border.goldFaint}`,
    borderRadius: radius.sm, padding:'8px 12px', color: text.primary, fontSize: fs.sub, fontFamily: font.serif }

  return (
    <div>
      <div style={{ color: gold.muted, fontSize: fs.meta, letterSpacing:2, marginBottom:12 }}>共同好友关系</div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
        <select value={sel} onChange={e=>setSel(e.target.value)} style={inp}>
          <option value="">选择好友</option>
          {allFriends.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <input placeholder="关系描述" value={label} onChange={e=>setLabel(e.target.value)} style={{...inp,flex:1}}/>
        <select value={close} onChange={e=>setClose(Number(e.target.value) as 1|2|3)} style={inp}>
          <option value={1}>普通认识</option>
          <option value={2}>比较熟</option>
          <option value={3}>很亲近</option>
        </select>
        <button type="button" onClick={add} style={{...inp,cursor:'pointer',color: gold.base}}>添加</button>
      </div>
      {relationships.map(r => {
        const f = allFriends.find(f=>f.id===r.friendId)
        return (
          <div key={r.friendId} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'6px 12px', marginBottom:6, background: surface.raise,
            border:`1px solid ${border.goldFaint}`, borderRadius: radius.sm }}>
            <span style={{ color: text.primary, fontSize: fs.sub }}>{f?.name} · {r.label}</span>
            <button type="button" onClick={()=>onChange(relationships.filter(x=>x.friendId!==r.friendId))}
              style={{ background:'none', border:'none', color: purple.muted, cursor:'pointer', fontSize: fs.sub }}>✕</button>
          </div>
        )
      })}
    </div>
  )
}
