insert into public.roles (name, description) values
  ('超级管理员', '拥有全站管理、权限配置和敏感信息查看权限'),
  ('管理员 / 核心干部', '负责成员资料、媒体内容和留言审核'),
  ('普通成员', '可查看公开内容并提交留言、图片资料')
on conflict (name) do nothing;

insert into public.permissions (code, name, description) values
  ('admin.access', '进入后台', '允许访问后台管理系统'),
  ('member.manage', '成员管理', '允许管理届次、成员、学院、班级、专业和身份标签'),
  ('phone.view', '查看手机号', '允许查看和导出手机号'),
  ('media.manage', '媒体管理', '允许管理图片和视频资料'),
  ('message.manage', '留言管理', '允许审核与删除留言'),
  ('excel.manage', '导入导出', '允许 Excel 导入导出成员资料'),
  ('video.manage', '视频管理', '允许开启和管理视频模块')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name = '超级管理员'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code in ('admin.access', 'member.manage', 'phone.view', 'media.manage', 'message.manage', 'excel.manage')
where r.name = '管理员 / 核心干部'
on conflict do nothing;

insert into public.generations (name, year, description, cover_image, slogan) values
  ('第三届', 2022, '以纪律、荣誉与传承为核心，完成多项升旗与大型活动保障任务。', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80', '步履铿锵，青春向国旗致敬'),
  ('第四届', 2023, '持续完善训练制度与仪仗规范，留下属于这一届的集体记忆。', 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80', '守护晨光，也守护彼此的热爱'),
  ('第五届', 2024, '面向新成员建设数字化纪念平台，让照片、视频和留言长期留存。', 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80', '让每一次正步都有回响');

insert into public.colleges (name) values ('计算机学院'), ('管理学院'), ('机械工程学院') on conflict do nothing;

insert into public.identity_tags (name, description) values
  ('队长', '负责队伍整体训练、纪律与活动统筹'),
  ('副队', '协助队长推进日常管理'),
  ('护旗手', '承担护旗与仪仗展示任务'),
  ('教官', '负责训练指导与动作规范'),
  ('宣传', '负责影像记录与宣传资料整理'),
  ('学员', '参与日常训练与活动保障')
on conflict do nothing;

insert into public.messages (content, author_name, status, created_at) values
  ('愿每一届队员都记得第一次穿上制服时的庄重与骄傲。', '往届队员', 'approved', '2025-05-04'),
  ('把训练场上的坚持，带到以后更远的路上。', '指导老师', 'approved', '2025-06-01');

insert into public.system_settings (key, value) values
  ('image_upload_enabled', 'true'),
  ('video_upload_enabled', 'false'),
  ('message_enabled', 'true')
on conflict (key) do update set value = excluded.value;
