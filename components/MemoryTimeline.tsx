// components/MemoryTimeline.tsx
'use client'
import { useState } from 'react'
import type { Memory, Media, MemoryValence, MemoryInitiator } from '@/lib/types'
import MediaUpload from './MediaUpload'
import MediaItem from './MediaItem'
import { fs, text, gold, purple, danger, border, surface, radius, font } from '@/lib/ui/tokens'
import { extractMemory, buildQuickMemory, sortMemoriesDesc } from '@/lib/quickMemory'

interface Props { friendId: string; friendName: string; memories: Memory[]; onChange: (m: Memory[]) => void }

type Draft = Omit<Partial<Memory>, 'tags'> & { tags?: string }

const VALENCE_OPTIONS: { value: MemoryValence; label: string }[] = [
  { value: 'positive', label: '😊 开心/顺利' },
  { value: 'neutral',  label: '😐 平常' },
  { value: 'negative', label: '😣 别扭/不愉快' },
]

const INITIATOR_OPTIONS: { value: MemoryInitiator; label: string }[] = [
  { value: 'me',     label: '我发起' },
  { value: 'friend', label: 'TA 发起' },
  { value: 'both',   label: '一起/自然发生' },
]

const VALENCE_EMOJI: Record<MemoryValence, string> = {
  positive: '😊', neutral: '😐', negative: '😣',
}

const QUICK_HINTS = [
  '发生了什么?随手一记,AI 会整理好标题、标签和心情',
  'TA 今天说了什么让你在意的话?',
  '记下 TA 的原话和具体反应,比『他人很好』更有用',
]

export default function MemoryTimeline({ friendId, friendName, memories, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [quickText, setQuickText] = useState('')
  const [saving, setSaving] = useState(false)
  const [hintIndex, setHintIndex] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>({})

  async function saveQuick() {
    const text = quickText.trim()
    if (!text || saving) return
    setSaving(true)
    const extract = await extractMemory(text, friendName)
    onChange(sortMemoriesDesc([...memories, buildQuickMemory(text, extract, new Date())]))
    setQuickText(''); setSaving(false); setAdding(false)
  }

  function addMedia(memId: string, media: Media) {
    onChange(memories.map(m => m.id===memId ? {...m, media:[...m.media, media]} : m))
  }

  function startEdit(m: Memory) {
    setEditingId(m.id)
    setEditDraft({ date: m.date, time: m.time, title: m.title, content: m.content, tags: m.tags.join(', '),
      valence: m.valence, initiator: m.initiator })
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
      time:    editDraft.time,
      title:   editDraft.title!,
      content: editDraft.content ?? '',
      tags:    (editDraft.tags ?? '').split(',').map(t=>t.trim()).filter(Boolean),
      valence:   editDraft.valence,
      initiator: editDraft.initiator,
    } : m)
    onChange(sortMemoriesDesc(updated))
    cancelEdit()
  }

  function deleteMemory(id: string) {
    if (!window.confirm('确定要删除这条回忆吗？这个操作无法撤销。')) return
    onChange(memories.filter(m => m.id !== id))
  }

  const inp: React.CSSProperties = { background: surface.input, border:`1px solid ${border.goldFaint}`,
    borderRadius: radius.sm, padding:'8px 12px', color: text.primary, fontSize: fs.sub, width:'100%', fontFamily: font.serif }

  const actionBtn: React.CSSProperties = { background:'none', border:'none', cursor:'pointer',
    fontSize: fs.meta, letterSpacing:1, padding:'2px 6px' }

  const pill = (active: boolean): React.CSSProperties => ({
    padding:'4px 12px', borderRadius: radius.pill, cursor:'pointer', fontSize: fs.meta,
    border: active ? `1px solid ${gold.base}` : `1px solid ${border.goldFaint}`,
    background: active ? surface.chip : 'transparent',
    color: active ? gold.base : purple.muted,
  })

  function valenceInitiatorPicker(d: Draft, set: (next: Draft) => void) {
    return (
      <>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ color: purple.muted, fontSize: fs.meta }}>这次互动感觉：</span>
          {VALENCE_OPTIONS.map(o => (
            <button key={o.value} type="button" style={pill(d.valence === o.value)}
              onClick={() => set({ ...d, valence: d.valence === o.value ? undefined : o.value })}>
              {o.label}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ color: purple.muted, fontSize: fs.meta }}>谁发起的：</span>
          {INITIATOR_OPTIONS.map(o => (
            <button key={o.value} type="button" style={pill(d.initiator === o.value)}
              onClick={() => set({ ...d, initiator: d.initiator === o.value ? undefined : o.value })}>
              {o.label}
            </button>
          ))}
        </div>
      </>
    )
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <span style={{ color: gold.muted, fontSize: fs.meta, letterSpacing:2 }}>行动记录</span>
        <button type="button" onClick={() => { setAdding(true); setHintIndex(i => (i + 1) % QUICK_HINTS.length) }} style={{ ...inp, width:'auto', padding:'4px 12px', cursor:'pointer' }}>+ 记录一颗星尘</button>
      </div>

      {adding && (
        <div style={{ background: surface.raise, border:`1px solid ${border.goldFaint}`,
          borderRadius: radius.md, padding:16, marginBottom:16, display:'flex', flexDirection:'column', gap:10 }}>
          <textarea placeholder={QUICK_HINTS[hintIndex]} rows={3} value={quickText}
            onChange={e=>setQuickText(e.target.value)} style={{...inp,resize:'vertical'}}/>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button type="button" onClick={saveQuick} disabled={!quickText.trim() || saving}
              style={{...inp,width:'auto',cursor: saving?'wait':'pointer',color: gold.base,
                opacity: !quickText.trim()||saving ? 0.6 : 1}}>
              {saving ? 'AI 整理中…' : '保存'}
            </button>
            <span style={{ color: purple.muted, fontSize: fs.meta }}>日期时间自动记录,标题标签交给 AI</span>
          </div>
        </div>
      )}

      {memories.length === 0 && !adding && (
        <div style={{ color: purple.muted, fontSize: fs.sub, lineHeight:1.8, padding:'8px 0' }}>
          这里还没有回忆。<br/>记录一次见面、一句话、一个小细节，都会让这颗星星更亮。
        </div>
      )}

      {memories.map(m => (
        <div key={m.id} style={{ borderLeft:`2px solid ${border.goldFaint}`, paddingLeft:16, marginBottom:20 }}>
          {editingId === m.id ? (
            <div style={{ background: surface.raise, border:`1px solid ${border.goldFaint}`,
              borderRadius: radius.md, padding:16, display:'flex', flexDirection:'column', gap:10 }}>
              <input type="date" value={editDraft.date??''} onChange={e=>setEditDraft({...editDraft,date:e.target.value})} style={inp}/>
              <input type="time" value={editDraft.time??''} onChange={e=>setEditDraft({...editDraft,time:e.target.value})} style={inp}/>
              <input placeholder="标题" value={editDraft.title??''} onChange={e=>setEditDraft({...editDraft,title:e.target.value})} style={inp}/>
              <textarea placeholder="描述" rows={3} value={editDraft.content??''} onChange={e=>setEditDraft({...editDraft,content:e.target.value})} style={{...inp,resize:'vertical'}}/>
              <input placeholder="标签（逗号分隔）" value={editDraft.tags??''} onChange={e=>setEditDraft({...editDraft,tags:e.target.value})} style={inp}/>
              {valenceInitiatorPicker(editDraft, setEditDraft)}
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" onClick={saveEdit} style={{...inp,width:'auto',cursor:'pointer',color: gold.base}}>保存</button>
                <button type="button" onClick={cancelEdit} style={{...inp,width:'auto',cursor:'pointer',color: gold.muted}}>取消</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ color: gold.muted, fontSize: fs.meta }}>
                  {m.date}{m.time ? ` ${m.time}` : ''}{m.valence && <span style={{ marginLeft:6 }}>{VALENCE_EMOJI[m.valence]}</span>}
                </div>
                <div style={{ display:'flex', gap:4 }}>
                  <button type="button" onClick={()=>startEdit(m)} style={{...actionBtn, color: gold.muted}}>编辑</button>
                  <button type="button" onClick={()=>deleteMemory(m.id)} style={{...actionBtn, color: danger.text}}>删除</button>
                </div>
              </div>
              <div style={{ color: text.primary, fontSize: fs.body, margin:'4px 0' }}>{m.title}</div>
              {m.content && <div style={{ color: purple.muted, fontSize: fs.sub, lineHeight:1.6 }}>{m.content}</div>}
              {m.tags.length > 0 && (
                <div style={{ color: purple.muted, fontSize: fs.meta, marginTop:4 }}>{m.tags.join(' · ')}</div>
              )}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
                {m.media.map(md => (
                  <div key={md.id} style={{ width:60, height:60, borderRadius: radius.sm, overflow:'hidden', background:'rgba(255,255,255,0.05)' }}>
                    <MediaItem media={md} />
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
