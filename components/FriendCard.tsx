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
import { fs, text, gold, purple, border, surface, radius } from '@/lib/ui/tokens'

interface Props {
  friend: Friend
  style?: CSSProperties
  pinned?: boolean
  onClose?: () => void
  variant?: 'floating' | 'sheet'
}

export default function FriendCard({ friend, style, pinned, onClose, variant = 'floating' }: Props) {
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

  const sheet = variant === 'sheet'
  return (
    <div data-testid="friend-card" style={{
      position:'fixed', zIndex:20,
      background: surface.card, border:`1px solid ${border.gold}`,
      backdropFilter:'blur(12px)', pointerEvents:'auto',
      ...(sheet
        ? {
            left:0, right:0, bottom:0,
            borderRadius:`${radius.lg}px ${radius.lg}px 0 0`,
            maxHeight:'60vh', overflowY:'auto',
            padding:'20px 24px',
            paddingBottom:'calc(20px + env(safe-area-inset-bottom))',
            animation:'youji-sheet-in .25s ease-out',
          }
        : {
            minWidth:220, maxWidth:260,
            borderRadius: radius.md, padding:'16px 20px',
            ...style,
          }),
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
        <div style={{ color: gold.base, fontSize: fs.title }}>{friend.name}</div>
        {pinned && (
          <button type="button" onClick={onClose} style={{
            background:'none', border:'none', color: gold.muted,
            cursor:'pointer', fontSize: fs.body, lineHeight:1, padding:0,
          }}>✕</button>
        )}
      </div>

      {meta && <div style={{ color: purple.muted, fontSize: fs.meta, marginTop:4 }}>{meta}</div>}

      {(friend.important || birthday.label) && (
        <div style={{ display:'flex', gap:8, marginTop:6, flexWrap:'wrap' }}>
          {friend.important && <span style={{ color: gold.base, fontSize: fs.meta }}>✦ 重要</span>}
          {birthday.label && <span style={{ color: gold.base, fontSize: fs.meta }}>{birthday.label}</span>}
        </div>
      )}

      <div style={{ marginTop:10, fontSize: fs.sub, color: text.primary, lineHeight:1.8 }}>
        <div>关系温度：{energy.level}（{energyPercent}%）</div>
        <div style={{ color: purple.muted }}>{energy.lastActivityText}</div>
      </div>

      {latestMemory && (
        <div style={{ marginTop:8, fontSize: fs.sub, color: text.primary, lineHeight:1.6 }}>
          最近回忆：{latestMemory.title} · {latestMemory.date}
        </div>
      )}

      <div style={{ marginTop:8, fontSize: fs.sub, color: gold.base, lineHeight:1.6 }}>
        下次可以聊：{hint}
      </div>

      {completion.percent < 100 && (
        <div style={{ marginTop:8, fontSize: fs.meta, color: purple.muted, lineHeight:1.6 }}>
          档案完整度：{completion.percent}%<br/>
          建议补充：{completion.missing.join('、')}
        </div>
      )}

      {friend.relationships.length > 0 && (
        <div style={{ marginTop:8, fontSize: fs.meta, color: purple.muted }}>
          已连接 {friend.relationships.length} 位朋友
        </div>
      )}

      {sharedTags.length > 0 && (
        <div style={{ marginTop:4, fontSize: fs.meta, color: purple.muted }}>
          共同标签：{sharedTags.join('、')}
        </div>
      )}

      {lonely && (
        <div style={{ marginTop:8, fontSize: fs.meta, color: gold.muted, lineHeight:1.6 }}>
          这还是一颗孤星。<br/>建议：添加一条回忆，或者连接一个共同朋友。
        </div>
      )}

      <div style={{ marginTop:12, display:'flex', gap:8 }}>
        <Link href={`/friend/${friend.id}`}
          style={{ color: gold.base, fontSize: sheet ? fs.sub : fs.meta, letterSpacing:1, textDecoration:'none',
            border:`1px solid ${border.gold}`, borderRadius: radius.sm,
            padding: sheet ? '10px 18px' : '4px 10px' }}>
          编辑
        </Link>
        <Link href={`/atlas/${friend.id}`}
          style={{ color: purple.base, fontSize: sheet ? fs.sub : fs.meta, letterSpacing:1, textDecoration:'none',
            border:`1px solid ${border.purple}`, borderRadius: radius.sm,
            padding: sheet ? '10px 18px' : '4px 10px' }}>
          {friend.atlasId ? '图鉴' : '生成图鉴'}
        </Link>
      </div>
    </div>
  )
}
