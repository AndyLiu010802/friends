'use client'
import { useState } from 'react'
import { getFriends } from '@/lib/store'
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

  const inp: React.CSSProperties = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(226,185,111,0.15)',
    borderRadius:6, padding:'8px 12px', color:'#e2e8f0', fontSize:12, fontFamily:'Noto Serif SC, serif' }

  return (
    <div>
      <div style={{ color:'rgba(226,185,111,0.7)', fontSize:11, letterSpacing:2, marginBottom:12 }}>共同好友关系</div>
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
        <button type="button" onClick={add} style={{...inp,cursor:'pointer',color:'#e2b96f'}}>添加</button>
      </div>
      {relationships.map(r => {
        const f = allFriends.find(f=>f.id===r.friendId)
        return (
          <div key={r.friendId} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'6px 12px', marginBottom:6, background:'rgba(255,255,255,0.03)',
            border:'1px solid rgba(226,185,111,0.1)', borderRadius:8 }}>
            <span style={{ color:'#e2e8f0', fontSize:12 }}>{f?.name} · {r.label}</span>
            <button type="button" onClick={()=>onChange(relationships.filter(x=>x.friendId!==r.friendId))}
              style={{ background:'none', border:'none', color:'rgba(155,142,196,0.5)', cursor:'pointer', fontSize:12 }}>✕</button>
          </div>
        )
      })}
    </div>
  )
}
