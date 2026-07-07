-- 友记 Supabase schema —— 可重复执行（对已有库安全）。
-- 安全模型：单用户私有应用。所有表与媒体桶仅 authenticated 角色可读写。
-- 必做的人工步骤：
--   1. Authentication → Sign In / Up → 关闭 "Allow new users to sign up"
--   2. Authentication → Users → Add user 手动创建唯一账号

create table if not exists friends (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists atlas (
  id           text primary key,
  friend_id    text not null references friends(id) on delete cascade,
  data         jsonb not null,
  generated_at timestamptz not null default now()
);

create table if not exists friend_backups (
  id text primary key,
  backup_name text not null,
  friends jsonb not null,
  atlas_list jsonb not null default '[]'::jsonb,
  ai_chats jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists atlas_chats (
  id text primary key,
  friend_id text not null references friends(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 媒体桶：私有（已存在的公开桶会被改为私有）
insert into storage.buckets (id, name, public)
values ('friend-media', 'friend-media', false)
on conflict (id) do update set public = false;

alter table friends        enable row level security;
alter table atlas          enable row level security;
alter table friend_backups enable row level security;
alter table atlas_chats    enable row level security;

-- 移除旧的 allow-all 策略
drop policy if exists "allow all" on friends;
drop policy if exists "allow all" on atlas;
drop policy if exists "allow all friend_backups" on friend_backups;
drop policy if exists "allow all atlas_chats" on atlas_chats;

-- 仅 authenticated 可读写
drop policy if exists "authenticated all friends" on friends;
create policy "authenticated all friends" on friends
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all atlas" on atlas;
create policy "authenticated all atlas" on atlas
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all friend_backups" on friend_backups;
create policy "authenticated all friend_backups" on friend_backups
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated all atlas_chats" on atlas_chats;
create policy "authenticated all atlas_chats" on atlas_chats
  for all to authenticated using (true) with check (true);

-- Storage 对象策略：仅 authenticated 可操作 friend-media 桶
drop policy if exists "authenticated media all" on storage.objects;
create policy "authenticated media all" on storage.objects
  for all to authenticated
  using (bucket_id = 'friend-media')
  with check (bucket_id = 'friend-media');
