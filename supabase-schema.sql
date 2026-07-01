create table friends (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create table atlas (
  id          text primary key,
  friend_id   text not null references friends(id) on delete cascade,
  data        jsonb not null,
  generated_at timestamptz not null default now()
);

-- Storage bucket for media
insert into storage.buckets (id, name, public)
values ('friend-media', 'friend-media', true);

-- RLS: allow all for now (single-user, no auth)
alter table friends enable row level security;
alter table atlas   enable row level security;
create policy "allow all" on friends for all using (true) with check (true);
create policy "allow all" on atlas   for all using (true) with check (true);

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
  friend_id text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table friend_backups enable row level security;
alter table atlas_chats enable row level security;

drop policy if exists "allow all friend_backups" on friend_backups;
drop policy if exists "allow all atlas_chats" on atlas_chats;

create policy "allow all friend_backups" on friend_backups for all using (true) with check (true);
create policy "allow all atlas_chats" on atlas_chats for all using (true) with check (true);
