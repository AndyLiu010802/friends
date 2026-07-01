import type { Friend } from './types'

export function generateConversationHint(friend: Friend): string {
  const latestMemory = [...friend.memories].sort((a, b) => b.date.localeCompare(a.date))[0]
  if (latestMemory) {
    return `下次可以问问 TA 最近的『${latestMemory.title}』`
  }
  if (friend.hobbies.length > 0) {
    return `可以聊聊 TA 的兴趣爱好：${friend.hobbies[0]}`
  }
  if (friend.likes.length > 0) {
    return `可以聊聊 TA 喜欢的：${friend.likes[0]}`
  }
  return '还不了解 TA，下次可以多问问喜好'
}
