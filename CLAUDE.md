# CLAUDE.md

## 项目概览

这是“国旗护卫队纪念网站”项目，基于 Vite + React + TypeScript + Supabase + GitHub Pages 构建。

项目目标：为国旗护卫队提供一个可公开访问的纪念展示网站，包含前台展示、届次档案、成员查询、媒体资料、留言纪念，以及后台管理功能。

默认使用中文回复和中文界面文案。后续修改应保持外科手术式修改：只改完成当前请求必需的代码，不做无关重构。

## 线上信息

- GitHub 仓库：`AAAMon666/flag-guard-memorial`
- 公开访问地址：`https://aaamon666.github.io/flag-guard-memorial/`
- 后台登录地址：`https://aaamon666.github.io/flag-guard-memorial/#/login`
- 默认管理员邮箱：`486302424@qq.com`
- 不要在代码、文档或提交信息里记录管理员密码。

## 技术栈

- React 19
- TypeScript
- Vite
- React Router，使用 `createHashRouter` 适配 GitHub Pages
- Supabase Auth，用于真实管理员登录
- Supabase PostgreSQL，用于业务数据
- Supabase Storage，`media` bucket 用于图片、视频和届次封面上传
- GitHub Actions + GitHub Pages 自动部署
- `xlsx` 用于 Excel 导出相关功能

## 本地常用命令

```bash
npm install
npm run dev
npm run build
```

构建命令是主要验证方式：

```bash
npm run build
```

Vite 可能提示 chunk 大于 500kB，这是警告，不代表构建失败。

## 环境变量

本地 `.env` 或 GitHub Actions Secrets 需要：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

注意：Supabase URL 只能填项目根地址，例如 `https://xxxx.supabase.co`，不要带 `/rest/v1/`。

## GitHub Pages 部署

部署通过 `.github/workflows/deploy.yml` 自动完成。

每次推送到 `main` 分支后，GitHub Actions 会执行：

1. `npm ci`
2. `npm run build`
3. 发布 `dist` 到 GitHub Pages

之前普通 `git push` 偶尔会因网络或代理失败。如果失败，可以重试；历史上也曾使用 `gh api` 上传文件绕过网络问题。

## Supabase 初始化脚本

Supabase SQL 文件位于 `supabase/`：

- `schema.sql`：主表、RLS 策略、权限函数
- `seed-safe.sql`：安全初始化角色、权限和示例数据，优先使用此文件，避免中文 SQL 乱码
- `admin-profile.sql`：把 Supabase Auth 用户绑定为超级管理员
- `interactive-features.sql`：留言点赞、评论、公开上传相关策略和 Storage bucket
- `linkage-features.sql`：前后台联动、系统设置默认值和公开读取策略
- `relation-fields.sql`：新增字段

`relation-fields.sql` 内容：

```sql
alter table public.members add column if not exists gender text not null default '';
alter table public.media_items add column if not exists taken_date text;
```

用户已在 Supabase SQL Editor 中执行过该字段补充 SQL。

## 数据库核心表

主要业务表：

- `roles`
- `permissions`
- `role_permissions`
- `profiles`
- `generations`
- `colleges`
- `majors`
- `classes`
- `members`
- `member_generations`
- `identity_tags`
- `member_generation_tags`
- `media_items`
- `messages`
- `message_likes`
- `message_comments`
- `system_settings`

关键新增字段：

- `members.gender`：成员性别
- `media_items.taken_date`：媒体日期

## 权限模型

Supabase 中使用 `public.has_permission(permission_code text)` 判断权限。

主要权限码：

- `admin.access`
- `member.manage`
- `phone.view`
- `media.manage`
- `message.manage`
- `excel.manage`
- `video.manage`

默认超级管理员角色名是：`super_admin`。

## 添加新管理员

步骤：

1. 在 Supabase 控制台进入 Authentication。
2. 创建新用户，填写邮箱和密码。
3. 在 SQL Editor 执行管理员绑定 SQL，把邮箱替换为新管理员邮箱：

```sql
with selected_user as (
  select id, email
  from auth.users
  where email = 'new-admin@example.com'
), selected_role as (
  select id
  from public.roles
  where name = 'super_admin'
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
```

4. 新管理员访问后台登录地址，用邮箱密码登录。

## 前台功能

前台页面位于 `src/pages/public/`。

主要页面：

- 首页：展示统计、届次、成员、媒体、留言入口
- 届次档案：展示全部届次
- 届次详情：展示对应届次成员、媒体资料和留言
- 成员查询：按学院、班级、姓名查询成员
- 成员详情：展示成员资料、所属届次、身份标签和相关媒体
- 媒体资料：展示并上传图片/视频
- 留言纪念：提交留言、点赞和评论
- 后台登录：管理员登录

前台真实数据通过 `src/lib/publicData.ts` 读取 Supabase。

## 后台功能

后台页面位于 `src/pages/admin/AdminPages.tsx`。

主要模块：

- 控制台：展示真实统计数据
- 届次管理：新增、编辑、删除届次，支持上传封面照片
- 成员管理：新增、删除成员，填写性别，可关联届次、身份标签和届次备注
- 学院/专业/班级管理：新增和删除
- 身份标签：新增和删除身份标签
- 媒体管理：查看和删除媒体资料
- 留言管理：查看和删除留言
- 权限管理：展示权限结构
- 导入导出：Excel 相关功能
- 系统设置：控制图片上传、视频上传、留言功能开关

后台路由通过 `ProtectedRoute` 保护，未登录会跳转 `/login`。

## 前后台联动规则

- 后台新增或删除届次后，前台届次列表和首页统计应同步变化。
- 后台新增成员时，如果选择了“所属届次”，会写入 `member_generations`，前台对应届次详情页会显示该成员。
- 后台新增成员时，如果选择了身份标签，会写入 `member_generation_tags`，成员卡片和详情页会显示标签。
- 前台上传照片/视频时，如果选择届次，会写入 `media_items.generation_id`，对应届次详情页会显示该媒体。
- 前台留言纪念选择届次后，会写入 `messages.generation_id`，留言会同时显示在留言纪念页和对应届次详情页。
- 媒体上传表单中，“上传者姓名”存入 `media_items.activity_name`，“日期”存入 `media_items.taken_date`。

## 上传限制

- 图片最多 10MB
- 视频最多 100MB
- 上传文件使用 Supabase Storage 的 `media` bucket
- 届次封面也上传到 `media` bucket，并把 public URL 写入 `generations.cover_image`

## 重要文件

- `src/App.tsx`：路由和后台保护
- `src/components/Layout.tsx`：前台布局和导航
- `src/components/AdminLayout.tsx`：后台布局和退出登录
- `src/lib/supabase.ts`：Supabase client
- `src/lib/AuthContext.tsx`：登录状态和 Auth 操作
- `src/lib/publicData.ts`：前台公开数据读取
- `src/lib/auth.ts`：权限辅助和手机号脱敏
- `src/pages/public/*`：前台页面
- `src/pages/admin/AdminPages.tsx`：后台页面
- `src/index.css`：全站样式
- `supabase/*.sql`：数据库初始化和后续补充脚本

## 代码维护注意事项

- 保持用户可见文案为中文。
- 不要把密码、token、anon key 等秘密写入文档或代码。
- 不要把 Supabase URL 写成带 `/rest/v1/` 的形式。
- GitHub Pages 路由必须保持 hash 路由，避免刷新 404。
- 修改数据库字段后，需要提醒用户在 Supabase SQL Editor 执行对应 SQL。
- 做前台/后台联动相关修改后，优先运行 `npm run build` 验证。
- UI 改动上线后，应让用户强制刷新浏览器再测试。

## 最近已完成的重要改动

- 实现 Supabase 真实登录。
- 实现后台路由保护。
- 实现届次管理真实增删改查。
- 修复 GitHub Pages 路由和白屏问题。
- 实现前台留言提交、点赞、评论。
- 实现前台图片/视频上传。
- 实现后台学院、专业、班级、身份标签、成员、媒体、留言和系统设置功能。
- 将前台首页、届次、成员、媒体、留言等页面改为读取 Supabase 真实数据。
- 媒体上传字段改为“上传者姓名”和“日期”。
- 后台成员管理“头像 URL”改为“性别”。
- 后台届次封面改为上传照片。
- 新增成员、媒体、留言与届次详情页联动。
- 新增媒体库空间统计：按 `media` bucket 实际占用显示“已用 / 总量 / 剩余”，前台媒体页和后台控制台都会展示。
- 后台系统设置新增 `mediaStorageQuotaBytes` 对应的“媒体库总量（GB）”配置项，保存后会同步影响前后台剩余空间显示。
- `supabase/linkage-features.sql` 现已包含 `public.get_media_storage_status()` 统计函数和 `mediaStorageQuotaBytes` 默认值；如新环境初始化或现网缺失，需要在 Supabase SQL Editor 执行该 SQL。
- 前台上传前会按媒体库剩余空间做校验，但后台删除媒体当前仍只删除 `media_items` 记录，不删除 Storage 实体文件，空间统计可能包含孤儿文件。
- 本次相关代码已推送到 `main`，GitHub Pages 会自动部署；上线后如看不到新效果，应先强制刷新浏览器缓存再测试。
- 最新提交已推送到 `main`，GitHub Pages 部署成功。
