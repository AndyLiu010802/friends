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
7. memories 里的 valence 表示该次互动的情绪效价（positive/neutral/negative），initiator 表示发起方（me=用户主动，friend=好友主动，both=共同/自然发生）。
   - relationshipTrend 必须参考 valence 的正负分布和 initiator 的平衡（长期只有一方发起是重要信号）。
   - warnings 优先基于 valence 为 negative 的记录。
8. 如果 friend.relationshipGoal 存在（maintain=维持现状，deepen=更进一步，repair=修复关系），
   conversationTopics、suitableActivities、warnings 都要围绕这个目标给建议；repair 时优先温和的修复性建议。
9. 区分"记录"与"推断"：凡不是用户记录里直接出现、而是你推断出来的内容，必须在句末标注"（推测）"。
10. missingInfoQuestions：给出恰好 3 个问题——补充哪些观察最能提高这份图鉴的准确度。
    问题要具体到下次相处时可以直接留意（例如"TA 聊到工作时情绪如何"），不要问抽象问题。
11. 用中文输出。

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
  "missingInfoQuestions": ["最能提高图鉴准确度的问题1", "问题2", "问题3"],
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

export function buildExtractMemoryPrompt(input: { text: string; friendName: string }): string {
  return `你是好友记录助手。用户随手记了一条与好友「${input.friendName}」的互动,请提取结构化信息。

记录原文:
${input.text}

只输出 JSON,不要任何其他文字,格式:
{"title":"...","tags":["..."],"valence":"...","initiator":"..."}

规则:
- title:12 字以内的中文短语,概括这次互动的事件本身,不含日期与好友名字。
- tags:0-3 个中文短词(如 火锅、爬山、工作),没有合适的就给空数组。
- valence:这次互动的情绪效价,positive/neutral/negative;只有原文能明确判断时才输出该字段。
- initiator:发起方,me(用户主动)/friend(好友主动)/both(共同或自然发生);只有原文明确时才输出。
- valence 与 initiator 宁可省略,不要猜。`
}
