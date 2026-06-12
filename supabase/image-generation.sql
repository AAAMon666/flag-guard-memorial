create table if not exists public.image_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  official_url text,
  api_root_url text,
  api_v1_url text not null,
  model text not null default 'gpt-image-2',
  notes text not null default '',
  api_key_ciphertext text,
  api_key_iv text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_gallery_items (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  prompt text not null default '',
  mode text not null check (mode in ('text-to-image', 'image-to-image')),
  quality text not null default 'medium',
  resolution text not null default '1K',
  free_size text not null default '',
  provider_name text not null default '',
  model text not null default '',
  image_url text not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.image_providers enable row level security;
alter table public.generated_gallery_items enable row level security;

drop policy if exists "admins manage image providers" on public.image_providers;
create policy "admins manage image providers"
on public.image_providers
for all
using (public.has_permission('admin.access'))
with check (public.has_permission('admin.access'));

drop policy if exists "public read generated gallery items" on public.generated_gallery_items;
create policy "public read generated gallery items"
on public.generated_gallery_items
for select
using (is_public = true or public.has_permission('admin.access'));

drop policy if exists "admins manage generated gallery items" on public.generated_gallery_items;
create policy "admins manage generated gallery items"
on public.generated_gallery_items
for all
using (public.has_permission('admin.access'))
with check (public.has_permission('admin.access'));

create index if not exists image_providers_active_idx
on public.image_providers (is_active, updated_at desc);

create index if not exists generated_gallery_items_public_created_idx
on public.generated_gallery_items (is_public, created_at desc);
