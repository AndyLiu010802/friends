import type { Atlas, AtlasChatMessage } from '../types'
import type { FriendAtlasContext } from './contextBuilder'

export function buildAtlasPrompt(context: FriendAtlasContext): string {
  const overflowNote = context.stats.memoryCount > 30
    ? `\n该好友共有 ${context.stats.memoryCount} 条 memories，本次选取了最有代表性的 30 条。\n`
    : ''

  return `你是一个私人朋友关系图鉴分析助手。
你的任务不是做星座玄学，也不是根据 MBTI 编故事。
你的任务是根据用户真实记录，帮助用户更好地记住这个朋友、理解相处方式、准备下次聊天和礼物建议。

重要规则：
1. 优先使用 memories、notes、likes、dislikes、hobbies、relationships。
2. MBTI 和 zodiac 只能作为辅助，不可以作为主要依据。
3. 如果资料不足（见下方 context.stats.confidence），必须明确说不确定。
   - confidence 为 low 时，不要输出过度肯定的判断。
   - confidence 为 high 时，可以给出更具体的模式总结。
4. 不要编造用户没有记录过的事实。
5. 输出必须是 JSON，不要输出 Markdown 代码块以外的文字。
6. 所有建议都要温和、具体、可执行。
7. 用中文输出。

FriendAtlasContext：
${JSON.stringify(context, null, 2)}
${overflowNote}
请严格输出以下 JSON 结构：
{
  "summary": "一句话总结这个朋友",
  "roleInMyLife": "这个朋友在用户生活中的位置",
  "keyDetailsToRemember": ["最应该记住的细节1", "细节2", "细节3"],
  "recentInteractionInsight": "根据最近记录判断最近互动状态",
  "conversationTopics": ["下次可以聊的话题1", "话题2", "话题3"],
  "giftIdeas": ["礼物建议1", "礼物建议2", "礼物建议3"],
  "warnings": ["相处注意1", "相处注意2"],
  "suitableActivities": ["适合一起做的活动1", "活动2"],
  "relationshipTrend": "根据记录判断关系趋势。如果资料不足，请说明不确定。",
  "evidence": [
    { "type": "memory", "id": "memory id if available", "date": "YYYY-MM-DD if available", "text": "依据说明" }
  ]
}`
}

export function buildAtlasQuestionPrompt(input: {
  context: FriendAtlasContext
  atlas?: Atlas
  recentMessages: AtlasChatMessage[]
  question: string
}): string {
  return `你是用户的私人朋友图鉴问答助手。

你只能根据提供的好友资料、回忆记录、关系记录、图鉴内容来回答。
不要编造没有记录的事实。
如果资料不足，请说"目前记录还不够确定"，并告诉用户可以补充什么记录来提高准确度。
回答要具体、温和、像私人笔记助手，不要像心理医生，不要过度诊断。

好友资料：
${JSON.stringify(input.context, null, 2)}

已有图鉴：
${input.atlas ? JSON.stringify(input.atlas, null, 2) : '（暂无）'}

最近问答：
${JSON.stringify(input.recentMessages, null, 2)}

用户问题：
${input.question}

请输出 JSON：
{
  "answer": "你的回答，中文，不要太长，尽量具体",
  "evidence": [
    { "type": "memory", "id": "相关 memory id", "date": "YYYY-MM-DD", "text": "这条回答依据了什么记录" }
  ],
  "suggestedFollowUps": ["后续问题建议1", "后续问题建议2"]
}`
}
