---
name: verify
description: How to build, launch, and drive 友记 end-to-end to verify a change at the real UI surface (headless Edge + mock AI upstream, no Supabase/OpenAI keys needed)
---

# Verifying 友记 changes end-to-end

## Build & launch

```bash
npm run build
# Local mode (no Supabase env) = no login gate; middleware and API auth both pass.
# OpenAI SDK honors OPENAI_BASE_URL, so AI routes can run against a local mock:
OPENAI_API_KEY=mock-key OPENAI_BASE_URL=http://127.0.0.1:3199/v1 npx next start -p 3100
```

Mock AI: a plain `node http` server on 3199 answering any POST with an OpenAI
chat-completion envelope whose `message.content` is the atlas/answer JSON string.
This exercises the real route (parsing, evidence validation, storage) without a key.

## Driving the UI

No Playwright in the repo. Install `playwright-core` in the scratchpad (not the repo —
`node_modules` may be a shared junction) and launch the system browser:
`chromium.launch({ channel: 'msedge', headless: true })` — no browser download needed.

Data lives in `localStorage` (`yj_friends` / `yj_atlas` / `yj_atlas_chats`), so:
- Every fresh browser context starts empty. Create the friend through `/friend/new`
  or seed `yj_friends` directly (shape must satisfy `normalizeFriend` in `lib/store.ts`).
- Assertions about persistence = read localStorage via `page.evaluate` after reload.

## Gotchas

- The friend detail page (`/friend/[id]`) embeds FriendForm, so `button:has-text("保存")`
  matches BOTH "✦ 保存好友" and the memory form's "保存" — use exact match
  `page.locator('button', { hasText: /^保存$/ })`.
- `/friend/new` starts in 快速添加 mode; click 完整档案 first to reach
  MBTI/likes/relationshipGoal fields.
- Atlas generation buttons may show a `confirm()` cost dialog — register
  `page.on('dialog', d => d.accept())` up front.
- Port 3000 may be taken by a dev server from another session; use 3100+.

## Flows worth driving

1. 完整档案 create friend → localStorage round-trip (normalizeFriend strips unknown fields —
   a new Friend field MUST be added there or it silently disappears on next read).
2. Friend page → add memory (date/title required) → reload → check persisted fields.
3. `/atlas/[id]` → 生成图鉴 (against mock AI) → sections render; stored atlas in `yj_atlas`.
4. Legacy-data probe: delete a new optional field from stored JSON, reload page, must not crash.
