# 友记 (Friend Star Map)

A personal friend-book web app: each friend is rendered as a unique glowing star in an
explorable 3D star map. Star appearance is derived deterministically from MBTI + zodiac.
Data is stored locally in the browser (`localStorage`) as the source of truth, with
optional best-effort sync to Supabase for cloud backup across devices.

Built with Next.js (App Router), TypeScript, Three.js, GSAP, Tailwind CSS, and Vitest.
See `docs/superpowers/specs/2026-06-30-friend-star-map-design.md` and
`docs/superpowers/plans/2026-06-30-friend-star-map.md` for the original design/plan.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the app works fully offline on
`localStorage` alone, no setup required beyond `npm install`.

## Optional: Supabase cloud sync

Cloud sync (cross-device backup of friends/atlas data + media uploads) is optional.
Without it configured, the app silently falls back to localStorage-only and everything
still works — friend creation, editing, memories, relationships, and the atlas stub.

To enable it:

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `supabase-schema.sql` into the Supabase SQL editor and run it — this creates the
   `friends`/`atlas` tables, the private `friend-media` storage bucket, and
   authenticated-only RLS policies.
3. Create `.env.local` (gitignored, never commit this) with your project's URL and
   publishable/anon key from Project Settings → API:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

4. Enable auth: in the Supabase dashboard go to Authentication → Sign In / Up and
   turn **off** "Allow new users to sign up", then under Authentication → Users use
   **Add user** to create your single personal account (email + password).
5. Re-run `supabase-schema.sql` any time you pull schema changes — it is idempotent
   and will tighten existing databases (private media bucket, authenticated-only RLS).

With Supabase configured, the app requires signing in at `/login`; without it, the
app stays in local-only mode with no login. Media files live in a private bucket and
are served through short-lived signed URLs.

## Tests

```bash
npm test
```
