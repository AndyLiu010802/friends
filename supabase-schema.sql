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
