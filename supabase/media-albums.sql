create extension if not exists pgcrypto;

alter table public.media_items
  add column if not exists taken_date text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists edit_password_hash text;

create table if not exists public.media_item_assets (
  id uuid primary key default gen_random_uuid(),
  media_item_id uuid not null references public.media_items(id) on delete cascade,
  file_url text not null,
  cover_url text,
  asset_type text not null check (asset_type in ('image', 'video')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists media_item_assets_media_item_id_idx on public.media_item_assets(media_item_id, sort_order, created_at);

alter table public.media_item_assets enable row level security;

drop policy if exists "public read public media assets" on public.media_item_assets;
create policy "public read public media assets" on public.media_item_assets
for select using (
  exists (
    select 1
    from public.media_items media
    where media.id = media_item_id
      and (media.is_public = true or public.has_permission('media.manage'))
  )
);

drop policy if exists "public upload media assets" on public.media_item_assets;
create policy "public upload media assets" on public.media_item_assets
for insert with check (
  exists (
    select 1
    from public.media_items media
    where media.id = media_item_id
      and media.is_public = true
      and media.edit_password_hash is null
  )
);

drop policy if exists "admins manage media assets" on public.media_item_assets;
create policy "admins manage media assets" on public.media_item_assets
for all using (public.has_permission('media.manage'))
with check (public.has_permission('media.manage'));

insert into public.media_item_assets (media_item_id, file_url, cover_url, asset_type, sort_order)
select
  media.id,
  media.file_url,
  media.cover_url,
  media.type,
  0
from public.media_items media
where not exists (
  select 1
  from public.media_item_assets asset
  where asset.media_item_id = media.id
)
and coalesce(media.file_url, '') <> '';

update public.media_items
set edit_password_hash = encode(extensions.digest('ylx', 'sha256'), 'hex'),
    updated_at = now()
where edit_password_hash is null;

create or replace function public.hash_media_password(plain_password text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(plain_password, 'sha256'), 'hex');
$$;

create or replace function public.verify_media_edit_password(media_id uuid, plain_password text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.media_items media
    where media.id = media_id
      and (
        media.edit_password_hash is null
        or media.edit_password_hash = public.hash_media_password(plain_password)
      )
  );
$$;

create or replace function public.set_media_edit_password(
  media_id uuid,
  plain_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.media_items
  set edit_password_hash = public.hash_media_password(plain_password),
      updated_at = now()
  where id = media_id
    and is_public = true
    and edit_password_hash is null;

  return found;
end;
$$;

create or replace function public.add_media_asset_with_password(
  media_id uuid,
  plain_password text,
  next_file_url text,
  next_cover_url text,
  next_asset_type text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  next_order integer;
begin
  if not public.verify_media_edit_password(media_id, plain_password) then
    return false;
  end if;

  select coalesce(max(sort_order), -1) + 1
  into next_order
  from public.media_item_assets
  where media_item_id = media_id;

  insert into public.media_item_assets (media_item_id, file_url, cover_url, asset_type, sort_order)
  values (media_id, next_file_url, next_cover_url, next_asset_type, next_order);

  return true;
end;
$$;

create or replace function public.update_media_with_password(
  media_id uuid,
  plain_password text,
  next_title text,
  next_generation_id uuid,
  next_activity_name text,
  next_taken_date text,
  next_is_public boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.verify_media_edit_password(media_id, plain_password) then
    return false;
  end if;

  update public.media_items
  set title = next_title,
      generation_id = next_generation_id,
      activity_name = next_activity_name,
      taken_date = next_taken_date,
      year = case when coalesce(next_taken_date, '') <> '' then nullif(split_part(next_taken_date, '-', 1), '')::integer else null end,
      tags = case when coalesce(next_taken_date, '') <> '' then array[next_taken_date] else '{}'::text[] end,
      is_public = next_is_public,
      updated_at = now()
  where id = media_id;

  return found;
end;
$$;

create or replace function public.change_media_edit_password_with_password(
  media_id uuid,
  old_password text,
  new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.verify_media_edit_password(media_id, old_password) then
    return false;
  end if;

  update public.media_items
  set edit_password_hash = public.hash_media_password(new_password),
      updated_at = now()
  where id = media_id;

  return found;
end;
$$;

create or replace function public.admin_update_media_edit_password(
  media_id uuid,
  new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.has_permission('media.manage') then
    return false;
  end if;

  update public.media_items
  set edit_password_hash = public.hash_media_password(new_password),
      updated_at = now()
  where id = media_id;

  return found;
end;
$$;

create or replace function public.delete_media_asset_with_password(
  media_id uuid,
  asset_id uuid,
  plain_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  remaining_count integer;
begin
  if not public.verify_media_edit_password(media_id, plain_password) then
    return false;
  end if;

  select count(*)
  into remaining_count
  from public.media_item_assets
  where media_item_id = media_id;

  if remaining_count <= 1 then
    return false;
  end if;

  delete from public.media_item_assets
  where id = asset_id
    and media_item_id = media_id;

  update public.media_item_assets
  set sort_order = ordered.new_order
  from (
    select id, row_number() over (order by sort_order, created_at) - 1 as new_order
    from public.media_item_assets
    where media_item_id = media_id
  ) ordered
  where public.media_item_assets.id = ordered.id;

  update public.media_items
  set file_url = asset.file_url,
      cover_url = coalesce(asset.cover_url, asset.file_url),
      updated_at = now()
  from (
    select file_url, cover_url
    from public.media_item_assets
    where media_item_id = media_id
    order by sort_order, created_at
    limit 1
  ) asset
  where public.media_items.id = media_id;

  return true;
end;
$$;

create or replace function public.set_media_primary_asset_with_password(
  media_id uuid,
  asset_id uuid,
  plain_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.verify_media_edit_password(media_id, plain_password) then
    return false;
  end if;

  update public.media_item_assets
  set sort_order = sort_order + 1
  where media_item_id = media_id
    and id <> asset_id;

  update public.media_item_assets
  set sort_order = 0
  where media_item_id = media_id
    and id = asset_id;

  update public.media_item_assets
  set sort_order = ordered.new_order
  from (
    select id, row_number() over (order by sort_order, created_at) - 1 as new_order
    from public.media_item_assets
    where media_item_id = media_id
  ) ordered
  where public.media_item_assets.id = ordered.id;

  update public.media_items
  set file_url = asset.file_url,
      cover_url = coalesce(asset.cover_url, asset.file_url),
      updated_at = now()
  from (
    select file_url, cover_url
    from public.media_item_assets
    where media_item_id = media_id
      and id = asset_id
    limit 1
  ) asset
  where public.media_items.id = media_id;

  return true;
end;
$$;
