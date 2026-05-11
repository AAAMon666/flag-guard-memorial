insert into public.roles (name, description)
select 'super_admin', 'Full site administration'
where not exists (select 1 from public.roles where name = 'super_admin');

insert into public.roles (name, description)
select 'manager', 'Manage members, media and messages'
where not exists (select 1 from public.roles where name = 'manager');

insert into public.roles (name, description)
select 'member', 'Regular member'
where not exists (select 1 from public.roles where name = 'member');

insert into public.permissions (code, name, description) values
  ('admin.access', 'Admin access', 'Access admin dashboard'),
  ('member.manage', 'Member manage', 'Manage generations, members and tags'),
  ('phone.view', 'Phone view', 'View and export phone numbers'),
  ('media.manage', 'Media manage', 'Manage images and videos'),
  ('message.manage', 'Message manage', 'Review and delete messages'),
  ('excel.manage', 'Excel manage', 'Import and export member data'),
  ('video.manage', 'Video manage', 'Manage video module')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = 'super_admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('admin.access', 'member.manage', 'phone.view', 'media.manage', 'message.manage', 'excel.manage')
where r.name = 'manager'
on conflict do nothing;

insert into public.generations (name, year, description, cover_image, slogan)
select 'Generation 3', 2022, 'Discipline, honor and memory.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80', 'Guard the flag and remember youth'
where not exists (select 1 from public.generations where name = 'Generation 3');

insert into public.generations (name, year, description, cover_image, slogan)
select 'Generation 4', 2023, 'Training, ceremony and shared history.', 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80', 'Keep the morning light and honor'
where not exists (select 1 from public.generations where name = 'Generation 4');

insert into public.generations (name, year, description, cover_image, slogan)
select 'Generation 5', 2024, 'A digital memorial for members, media and messages.', 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80', 'Every step has an echo'
where not exists (select 1 from public.generations where name = 'Generation 5');

insert into public.colleges (name) values
  ('Computer College'),
  ('Management College'),
  ('Mechanical Engineering College')
on conflict do nothing;

insert into public.identity_tags (name, description) values
  ('Captain', 'Lead team training and management'),
  ('Vice Captain', 'Assist daily team management'),
  ('Flag Guard', 'Guard flag ceremony duties'),
  ('Trainer', 'Training and movement guidance'),
  ('Media', 'Photo and video archive'),
  ('Trainee', 'Daily training member')
on conflict do nothing;

insert into public.messages (content, author_name, status, created_at)
select 'May every member remember the pride of wearing the uniform for the first time.', 'Alumni', 'approved', '2025-05-04'
where not exists (select 1 from public.messages where content = 'May every member remember the pride of wearing the uniform for the first time.');

insert into public.messages (content, author_name, status, created_at)
select 'Bring the persistence from the training ground into the future.', 'Teacher', 'approved', '2025-06-01'
where not exists (select 1 from public.messages where content = 'Bring the persistence from the training ground into the future.');

insert into public.system_settings (key, value) values
  ('image_upload_enabled', 'true'),
  ('video_upload_enabled', 'false'),
  ('message_enabled', 'true')
on conflict (key) do update set value = excluded.value;
