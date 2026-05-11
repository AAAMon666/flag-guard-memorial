# 国旗护卫队纪念网站

基于 GitHub Pages + Supabase 的全栈纪念网站 MVP，包含前台展示、成员查询、媒体资料、留言墙、后台管理、权限模型、Excel 导入导出与 Supabase 数据库脚本。

## 本地运行

```bash
npm install
cp .env.example .env
npm run dev
```

`.env` 中填写 Supabase 项目配置：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

未填写 Supabase 配置时，页面会使用内置示例数据展示。

## Supabase 初始化

1. 新建 Supabase 项目。
2. 在 SQL Editor 中执行 `supabase/schema.sql`。
3. 再执行 `supabase/seed.sql` 导入示例角色、权限、届次、标签和留言。
4. 在 Storage 中创建媒体 bucket，用于后续图片/视频上传。
5. 在 Authentication 中创建管理员账号，并在 `profiles` 表中绑定对应角色。

## GitHub Pages 发布

1. 将代码推送到 GitHub 仓库 `main` 分支。
2. 仓库 Settings → Pages → Source 选择 GitHub Actions。
3. 仓库 Settings → Secrets and variables → Actions 中添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. 推送后 workflow 会自动构建并发布到 GitHub Pages。

## 主要目录

- `src/pages/public`：前台页面。
- `src/pages/admin`：后台管理页面。
- `src/data/demo.ts`：示例数据。
- `src/lib/supabase.ts`：Supabase 客户端。
- `src/lib/excel.ts`：Excel 导出工具。
- `supabase/schema.sql`：数据库表与 RLS 权限策略。
- `supabase/seed.sql`：示例初始化数据。
