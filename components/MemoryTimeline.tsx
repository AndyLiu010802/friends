'use client'
import { useState } from 'react'
import type { Memory, Media } from '@/lib/types'
import MediaUpload from './MediaUpload'

interface Props { friendId: string; memories: Memory[]; onChange: (m: Memory[]) => void }

export default function MemoryTimeline({ friendId, memories, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Omit<Partial<Memory>, 'tags'> & { tags?: string }>({})

  function saveMemory() {
    if (!draft.title || !draft.date) return
    const mem: Memory = {
      id: crypto.randomUUID(),
      date:    draft.date!,
      title:   draft.title!,
      content: draft.content ?? '',
      tags:    (draft.tags ?? '').split(',').map(t=>t.trim()).filter(Boolean),
      media:   [],
    }
    onChange([...memories, mem].sort((a,b)=>b.date.localeCompare(a.date)))
    setDraft({}); setAdding(false)
  }

  function addMedia(memId: string, media: Media) {
    onChange(memories.map(m => m.id===memId ? {...m, media:[...m.media, media]} : m))
  }

  const inp: React.CSSProperties = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(226,185,111,0.15)',
    borderRadius:6, padding:'8px 12px', color:'#e2e8f0', fontSize:12, width:'100%', fontFamily:'Noto Serif SC, serif' }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <span style={{ color:'rgba(226,185,111,0.7)', fontSize:11, letterSpacing:2 }}>行动记录</span>
        <button type="button" onClick={()=>setAdding(true)} style={{ ...inp, width:'auto', padding:'4px 12px', cursor:'pointer' }}>+ 新记录</button>
      </div>

      {adding && (
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(226,185,111,0.15)',
          borderRadius:10, padding:16, marginBottom:16, display:'flex', flexDirection:'column', gap:10 }}>
          <input placeholder="日期" type="date" value={draft.date??''} onChange={e=>setDraft({...draft,date:e.target.value})} style={inp}/>
          <input placeholder="标题" value={draft.title??''} onChange={e=>setDraft({...draft,title:e.target.value})} style={inp}/>
          <textarea placeholder="描述" rows={3} value={draft.content??''} onChange={e=>setDraft({...draft,content:e.target.value})} style={{...inp,resize:'vertical'}}/>
          <input placeholder="标签（逗号分隔）" value={draft.tags??''} onChange={e=>setDraft({...draft,tags:e.target.value})} style={inp}/>
          <button type="button" onClick={saveMemory} style={{...inp,width:'auto',cursor:'pointer',color:'#e2b96f'}}>保存</button>
        </div>
      )}

      {memories.map(m => (
        <div key={m.id} style={{ borderLeft:'2px solid rgba(226,185,111,0.2)', paddingLeft:16, marginBottom:20 }}>
          <div style={{ color:'rgba(226,185,111,0.5)', fontSize:10 }}>{m.date}</div>
          <div style={{ color:'#e2e8f0', fontSize:13, margin:'4px 0' }}>{m.title}</div>
          {m.content && <div style={{ color:'rgba(155,142,196,0.7)', fontSize:11, lineHeight:1.6 }}>{m.content}</div>}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
            {m.media.map(md => (
              <div key={md.id} style={{ width:60, height:60, borderRadius:6, overflow:'hidden', background:'rgba(255,255,255,0.05)' }}>
                {md.type==='photo'
                  ? <img src={md.thumbnailUrl} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt={md.caption}/>
                  : <video src={md.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted/>}
              </div>
            ))}
            <MediaUpload friendId={friendId} folder={`memories/${m.id}`} onUploaded={md=>addMedia(m.id,md)}/>
          </div>
        </div>
      ))}
    </div>
  )
}
