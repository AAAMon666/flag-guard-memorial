create extension if not exists pgcrypto;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default ''
);

create table public.role_permissions (
  role_id uuid references public.roles(id) on delete cascade,
  permission_id uuid references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  role_id uuid references public.roles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year integer not null,
  description text not null default '',
  cover_image text,
  slogan text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.majors (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  name text not null
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  major_id uuid references public.majors(id) on delete set null,
  name text not null
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  college_id uuid references public.colleges(id) on delete set null,
  major_id uuid references public.majors(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  phone text,
  retired_status boolean not null default false,
  avatar text,
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.member_generations (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  generation_id uuid not null references public.generations(id) on delete cascade,
  remark text not null default '',
  created_at timestamptz not null default now(),
  unique(member_id, generation_id)
);

create table public.identity_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.member_generation_tags (
  member_generation_id uuid references public.member_generations(id) on delete cascade,
  identity_tag_id uuid references public.identity_tags(id) on delete cascade,
  primary key (member_generation_id, identity_tag_id)
);

create table public.media_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('image', 'video')),
  title text not null,
  file_url text not null,
  cover_url text,
  generation_id uuid references public.generations(id) on delete set null,
  member_id uuid references public.members(id) on delete set null,
  activity_name text,
  year integer,
  tags text[] not null default '{}',
  uploader_id uuid references public.profiles(id) on delete set null,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  author_name text not null,
  member_id uuid references public.members(id) on delete set null,
  generation_id uuid references public.generations(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    join public.permissions perm on perm.id = rp.permission_id
    where p.id = auth.uid() and perm.code = permission_code
  );
$$;

create or replace view public.public_members as
select
  id,
  name,
  college_id,
  major_id,
  class_id,
  case when public.has_permission('phone.view') then phone else null end as phone,
  retired_status,
  avatar,
  bio,
  created_at,
  updated_at
from public.members;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.generations enable row level security;
alter table public.colleges enable row level security;
alter table public.majors enable row level security;
alter table public.classes enable row level security;
alter table public.members enable row level security;
alter table public.member_generations enable row level security;
alter table public.identity_tags enable row level security;
alter table public.member_generation_tags enable row level security;
alter table public.media_items enable row level security;
alter table public.messages enable row level security;
alter table public.system_settings enable row level security;

create policy "public read generations" on public.generations for select using (true);
create policy "public read taxonomy" on public.colleges for select using (true);
create policy "public read majors" on public.majors for select using (true);
create policy "public read classes" on public.classes for select using (true);
create policy "public read member links" on public.member_generations for select using (true);
create policy "public read tags" on public.identity_tags for select using (true);
create policy "public read member tags" on public.member_generation_tags for select using (true);
create policy "public read public media" on public.media_items for select using (is_public = true or public.has_permission('media.manage'));
create policy "public read approved messages" on public.messages for select using (status = 'approved' or public.has_permission('message.manage'));
create policy "public create pending messages" on public.messages for insert with check (status = 'pending');

create policy "member public read without direct phone" on public.members for select using (public.has_permission('phone.view'));
create policy "admin manage roles" on public.roles for all using (public.has_permission('admin.access')) with check (public.has_permission('admin.access'));
create policy "admin manage permissions" on public.permissions for all using (public.has_permission('admin.access')) with check (public.has_permission('admin.access'));
create policy "admin manage role permissions" on public.role_permissions for all using (public.has_permission('admin.access')) with check (public.has_permission('admin.access'));
create policy "profiles self or admin" on public.profiles for select using (id = auth.uid() or public.has_permission('admin.access'));
create policy "admins manage content generations" on public.generations for all using (public.has_permission('member.manage')) with check (public.has_permission('member.manage'));
create policy "admins manage colleges" on public.colleges for all using (public.has_permission('member.manage')) with check (public.has_permission('member.manage'));
create policy "admins manage majors" on public.majors for all using (public.has_permission('member.manage')) with check (public.has_permission('member.manage'));
create policy "admins manage classes" on public.classes for all using (public.has_permission('member.manage')) with check (public.has_permission('member.manage'));
create policy "admins manage members" on public.members for all using (public.has_permission('member.manage')) with check (public.has_permission('member.manage'));
create policy "admins manage member links" on public.member_generations for all using (public.has_permission('member.manage')) with check (public.has_permission('member.manage'));
create policy "admins manage tags" on public.identity_tags for all using (public.has_permission('member.manage')) with check (public.has_permission('member.manage'));
create policy "admins manage member tags" on public.member_generation_tags for all using (public.has_permission('member.manage')) with check (public.has_permission('member.manage'));
create policy "admins manage media" on public.media_items for all using (public.has_permission('media.manage')) with check (public.has_permission('media.manage'));
create policy "admins manage messages" on public.messages for all using (public.has_permission('message.manage')) with check (public.has_permission('message.manage'));
create policy "admins manage settings" on public.system_settings for all using (public.has_permission('admin.access')) with check (public.has_permission('admin.access'));
