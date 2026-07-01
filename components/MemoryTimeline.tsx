// components/MemoryTimeline.tsx
'use client'
import { useState } from 'react'
import type { Memory, Media } from '@/lib/types'
import MediaUpload from './MediaUpload'

interface Props { friendId: string; memories: Memory[]; onChange: (m: Memory[]) => void }

type Draft = Omit<Partial<Memory>, 'tags'> & { tags?: string }

export default function MemoryTimeline({ friendId, memories, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>({})

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

  function startEdit(m: Memory) {
    setEditingId(m.id)
    setEditDraft({ date: m.date, title: m.title, content: m.content, tags: m.tags.join(', ') })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
  }

  function saveEdit() {
    if (!editingId || !editDraft.title || !editDraft.date) return
    const updated = memories.map(m => m.id === editingId ? {
      ...m,
      date:    editDraft.date!,
      title:   editDraft.title!,
      content: editDraft.content ?? '',
      tags:    (editDraft.tags ?? '').split(',').map(t=>t.trim()).filter(Boolean),
    } : m)
    onChange(updated.sort((a,b)=>b.date.localeCompare(a.date)))
    cancelEdit()
  }

  function deleteMemory(id: string) {
    if (!window.confirm('确定要删除这条回忆吗？这个操作无法撤销。')) return
    onChange(memories.filter(m => m.id !== id))
  }

  const inp: React.CSSProperties = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(226,185,111,0.15)',
    borderRadius:6, padding:'8px 12px', color:'#e2e8f0', fontSize:12, width:'100%', fontFamily:'Noto Serif SC, serif' }

  const actionBtn: React.CSSProperties = { background:'none', border:'none', cursor:'pointer',
    fontSize:11, letterSpacing:1, padding:'2px 6px' }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <span style={{ color:'rgba(226,185,111,0.7)', fontSize:11, letterSpacing:2 }}>行动记录</span>
        <button type="button" onClick={()=>setAdding(true)} style={{ ...inp, width:'auto', padding:'4px 12px', cursor:'pointer' }}>+ 记录一颗星尘</button>
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

      {memories.length === 0 && !adding && (
        <div style={{ color:'rgba(155,142,196,0.6)', fontSize:12, lineHeight:1.8, padding:'8px 0' }}>
          这里还没有回忆。<br/>记录一次见面、一句话、一个小细节，都会让这颗星星更亮。
        </div>
      )}

      {memories.map(m => (
        <div key={m.id} style={{ borderLeft:'2px solid rgba(226,185,111,0.2)', paddingLeft:16, marginBottom:20 }}>
          {editingId === m.id ? (
            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(226,185,111,0.15)',
              borderRadius:10, padding:16, display:'flex', flexDirection:'column', gap:10 }}>
              <input type="date" value={editDraft.date??''} onChange={e=>setEditDraft({...editDraft,date:e.target.value})} style={inp}/>
              <input placeholder="标题" value={editDraft.title??''} onChange={e=>setEditDraft({...editDraft,title:e.target.value})} style={inp}/>
              <textarea placeholder="描述" rows={3} value={editDraft.content??''} onChange={e=>setEditDraft({...editDraft,content:e.target.value})} style={{...inp,resize:'vertical'}}/>
              <input placeholder="标签（逗号分隔）" value={editDraft.tags??''} onChange={e=>setEditDraft({...editDraft,tags:e.target.value})} style={inp}/>
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" onClick={saveEdit} style={{...inp,width:'auto',cursor:'pointer',color:'#e2b96f'}}>保存</button>
                <button type="button" onClick={cancelEdit} style={{...inp,width:'auto',cursor:'pointer',color:'rgba(226,185,111,0.5)'}}>取消</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ color:'rgba(226,185,111,0.5)', fontSize:10 }}>{m.date}</div>
                <div style={{ display:'flex', gap:4 }}>
                  <button type="button" onClick={()=>startEdit(m)} style={{...actionBtn, color:'rgba(226,185,111,0.7)'}}>编辑</button>
                  <button type="button" onClick={()=>deleteMemory(m.id)} style={{...actionBtn, color:'rgba(252,165,165,0.7)'}}>删除</button>
                </div>
              </div>
              <div style={{ color:'#e2e8f0', fontSize:13, margin:'4px 0' }}>{m.title}</div>
              {m.content && <div style={{ color:'rgba(155,142,196,0.7)', fontSize:11, lineHeight:1.6 }}>{m.content}</div>}
              {m.tags.length > 0 && (
                <div style={{ color:'rgba(155,142,196,0.5)', fontSize:10, marginTop:4 }}>{m.tags.join(' · ')}</div>
              )}
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
            </>
          )}
        </div>
      ))}
    </div>
  )
}
