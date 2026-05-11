-- Replace this email with the administrator account created in Supabase Authentication.
with selected_user as (
  select id, email
  from auth.users
  where email = 'admin@example.com'
), selected_role as (
  select id
  from public.roles
  where name in ('super_admin', '超级管理员')
  order by case when name = 'super_admin' then 0 else 1 end
  limit 1
)
insert into public.profiles (id, username, display_name, role_id)
select selected_user.id, selected_user.email, selected_user.email, selected_role.id
from selected_user, selected_role
on conflict (id) do update set
  username = excluded.username,
  display_name = excluded.display_name,
  role_id = excluded.role_id,
  updated_at = now();
