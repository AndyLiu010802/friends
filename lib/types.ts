export type MediaType = 'photo' | 'video'

export interface Media {
  id: string
  type: MediaType
  url: string
  thumbnailUrl: string
  caption?: string
  duration?: number   // seconds, video only
  takenAt?: string
  size: number        // bytes
}

export interface Memory {
  id: string
  date: string        // YYYY-MM-DD
  title: string
  content: string
  tags: string[]
  media: Media[]
}

export type Closeness = 1 | 2 | 3

export interface Relationship {
  friendId: string
  label: string
  closeness: Closeness
}

export type StarKind = 'radiant' | 'nebula' | 'blossom' | 'giant' | 'pulsar' | 'twin'

export interface StarConfig {
  kind: StarKind
  coreColor: string    // hex
  glowColor: string    // hex
  size: number         // 0.5–1.5
  twinkleSpeed: number // seconds per cycle
  position: [number, number, number]
}

export interface Friend {
  id: string
  name: string
  nickname?: string
  birthday?: string
  zodiac?: string
  mbti?: string
  important: boolean
  likes: string[]
  dislikes: string[]
  hobbies: string[]
  portraits: Media[]
  memories: Memory[]
  relationships: Relationship[]
  notes?: string
  starConfig: StarConfig
  atlasId?: string
  createdAt: string
  updatedAt: string
}

export interface AtlasEvidence {
  type: 'memory' | 'like' | 'dislike' | 'hobby' | 'note' | 'relationship'
  id?: string
  date?: string
  text: string
}

export interface Atlas {
  id: string
  friendId: string
  generatedAt: string
  model: string

  recordStats: {
    memoryCount: number
    relationshipCount: number
    likesCount: number
    dislikesCount: number
    hobbiesCount: number
    noteLength: number
    confidence: 'low' | 'medium' | 'high'
  }

  summary: string
  roleInMyLife: string
  keyDetailsToRemember: string[]
  recentInteractionInsight: string
  conversationTopics: string[]
  giftIdeas: string[]
  warnings: string[]
  suitableActivities: string[]
  relationshipTrend: string

  evidence: AtlasEvidence[]
  rawInput: Partial<Friend>
}

export interface AtlasChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  evidence?: AtlasEvidence[]
}

export interface AtlasChat {
  id: string
  friendId: string
  messages: AtlasChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface CloudBackupPayload {
  id: string
  backupName: string
  friends: Friend[]
  atlasList: Atlas[]
  aiChats: AtlasChat[]
  createdAt: string
  updatedAt: string
}

export interface CloudBackupSummary {
  id: string
  backupName: string
  friendCount: number
  atlasCount: number
  chatCount: number
  createdAt: string
  updatedAt: string
}
