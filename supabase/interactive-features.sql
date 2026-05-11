create table if not exists public.message_likes (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  client_id text not null,
  created_at timestamptz not null default now(),
  unique(message_id, client_id)
);

create table if not exists public.message_comments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.message_likes enable row level security;
alter table public.message_comments enable row level security;

alter table public.messages alter column status set default 'approved';

drop policy if exists "public create pending messages" on public.messages;
drop policy if exists "public create approved messages" on public.messages;
create policy "public create approved messages" on public.messages for insert with check (status = 'approved');

create policy "public read message likes" on public.message_likes for select using (true);
create policy "public create message likes" on public.message_likes for insert with check (true);
create policy "admins manage message likes" on public.message_likes for all using (public.has_permission('message.manage')) with check (public.has_permission('message.manage'));

create policy "public read message comments" on public.message_comments for select using (true);
create policy "public create message comments" on public.message_comments for insert with check (true);
create policy "admins manage message comments" on public.message_comments for all using (public.has_permission('message.manage')) with check (public.has_permission('message.manage'));

drop policy if exists "public upload media items" on public.media_items;
create policy "public upload media items" on public.media_items for insert with check (is_public = true);

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public read media bucket" on storage.objects;
drop policy if exists "public upload media bucket" on storage.objects;
drop policy if exists "admins manage media bucket" on storage.objects;

create policy "public read media bucket" on storage.objects for select using (bucket_id = 'media');
create policy "public upload media bucket" on storage.objects for insert with check (bucket_id = 'media');
create policy "admins manage media bucket" on storage.objects for all using (bucket_id = 'media' and public.has_permission('media.manage')) with check (bucket_id = 'media' and public.has_permission('media.manage'));
