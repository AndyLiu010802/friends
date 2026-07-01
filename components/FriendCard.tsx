'use client'
import type { CSSProperties } from 'react'
import type { Friend } from '@/lib/types'
import Link from 'next/link'
import { getGrowthStage } from '@/lib/growthStage'
import { calculateFriendEnergy } from '@/lib/friendEnergy'
import { generateConversationHint } from '@/lib/conversationHint'
import { getBirthdayStatus } from '@/lib/birthdayStatus'
import { calculateProfileCompletion } from '@/lib/profileCompletion'
import { getFriends } from '@/lib/store'
import { getSharedTags } from '@/lib/sharedTags'
import { isLonelyStar } from '@/lib/lonelyStar'

interface Props {
  friend: Friend
  style?: CSSProperties
  pinned?: boolean
  onClose?: () => void
}

export default function FriendCard({ friend, style, pinned, onClose }: Props) {
  const growth = getGrowthStage(friend)
  const energy = calculateFriendEnergy(friend)
  const hint = generateConversationHint(friend)
  const birthday = getBirthdayStatus(friend.birthday)
  const completion = calculateProfileCompletion(friend)
  const lonely = isLonelyStar(friend)
  const latestMemory = [...friend.memories].sort((a, b) => b.date.localeCompare(a.date))[0]
  const firstRelationship = friend.relationships[0]
  const relatedFriend = firstRelationship
    ? getFriends().find(f => f.id === firstRelationship.friendId)
    : undefined
  const sharedTags = relatedFriend ? getSharedTags(friend, relatedFriend) : []

  const meta = [friend.mbti, friend.zodiac, growth.label].filter(Boolean).join(' · ')
  const energyPercent = Math.round(Math.min(energy.score / 15, 1) * 100)

  return (
    <div style={{
      position:'fixed', zIndex:20, minWidth:220, maxWidth:260,
      background:'rgba(4,7,20,0.94)', border:'1px solid rgba(226,185,111,0.3)',
      borderRadius:12, padding:'16px 20px',
      backdropFilter:'blur(12px)', pointerEvents:'auto',
      ...style,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div style={{ color:'#e2b96f', fontSize:16 }}>{friend.name}</div>
        {pinned && (
          <button type="button" onClick={onClose} style={{
            background:'none', border:'none', color:'rgba(226,185,111,0.5)',
            cursor:'pointer', fontSize:14, lineHeight:1, padding:0,
          }}>✕</button>
        )}
      </div>

      {meta && <div style={{ color:'rgba(155,142,196,0.75)', fontSize:10, marginTop:4 }}>{meta}</div>}

      {(friend.important || birthday.label) && (
        <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
          {friend.important && <span style={{ color:'#e2b96f', fontSize:10 }}>✦ 重要</span>}
          {birthday.label && <span style={{ color:'#e2b96f', fontSize:10 }}>{birthday.label}</span>}
        </div>
      )}

      <div style={{ marginTop:10, fontSize:11, color:'#e2e8f0', lineHeight:1.8 }}>
        <div>关系温度：{energy.level}（{energyPercent}%）</div>
        <div style={{ color:'rgba(155,142,196,0.7)' }}>{energy.lastActivityText}</div>
      </div>

      {latestMemory && (
        <div style={{ marginTop:8, fontSize:11, color:'#e2e8f0', lineHeight:1.6 }}>
          最近回忆：{latestMemory.title} · {latestMemory.date}
        </div>
      )}

      <div style={{ marginTop:8, fontSize:11, color:'rgba(226,185,111,0.85)', lineHeight:1.6 }}>
        下次可以聊：{hint}
      </div>

      {completion.percent < 100 && (
        <div style={{ marginTop:8, fontSize:10, color:'rgba(155,142,196,0.6)', lineHeight:1.6 }}>
          档案完整度：{completion.percent}%<br/>
          建议补充：{completion.missing.join('、')}
        </div>
      )}

      {friend.relationships.length > 0 && (
        <div style={{ marginTop:8, fontSize:10, color:'rgba(155,142,196,0.6)' }}>
          已连接 {friend.relationships.length} 位朋友
        </div>
      )}

      {sharedTags.length > 0 && (
        <div style={{ marginTop:4, fontSize:10, color:'rgba(155,142,196,0.6)' }}>
          共同标签：{sharedTags.join('、')}
        </div>
      )}

      {lonely && (
        <div style={{ marginTop:8, fontSize:10, color:'rgba(226,185,111,0.6)', lineHeight:1.6 }}>
          这还是一颗孤星。<br/>建议：添加一条回忆，或者连接一个共同朋友。
        </div>
      )}

      <div style={{ marginTop:12, display:'flex', gap:8 }}>
        <Link href={`/friend/${friend.id}`}
          style={{ color:'#e2b96f', fontSize:10, letterSpacing:1, textDecoration:'none',
            border:'1px solid rgba(226,185,111,0.3)', borderRadius:10, padding:'4px 10px' }}>
          编辑
        </Link>
        <Link href={`/atlas/${friend.id}`}
          style={{ color:'rgba(155,142,196,0.8)', fontSize:10, letterSpacing:1, textDecoration:'none',
            border:'1px solid rgba(155,142,196,0.3)', borderRadius:10, padding:'4px 10px' }}>
          {friend.atlasId ? '图鉴' : '生成图鉴'}
        </Link>
      </div>
    </div>
  )
}
