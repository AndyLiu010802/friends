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

export interface Atlas {
  id: string
  friendId: string
  generatedAt: string
  summary: string
  personality: string
  predictions: string
  giftIdeas: string[]
  warnings: string[]
  rawInput: Partial<Friend>
}
