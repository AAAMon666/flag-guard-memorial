import { Link } from 'react-router-dom'
import { hasSupabaseConfig } from '../../lib/supabase'

export function LoginPage() {
  return (
    <div className="page-stack narrow">
      <section className="section-card login-card">
        <span className="eyebrow">Admin Login</span>
        <h1>管理员 / 授权成员登录</h1>
        <p>正式部署后使用 Supabase Auth 账号登录后台。当前页面保留登录入口与环境配置提示。</p>
        <div className="form-card">
          <input placeholder="邮箱 / 用户名" />
          <input placeholder="密码" type="password" />
          <Link className="primary-button" to="/admin">进入演示后台</Link>
        </div>
        <p className={hasSupabaseConfig ? 'status-ok' : 'status-warn'}>
          {hasSupabaseConfig ? '已检测到 Supabase 环境变量。' : '尚未配置 Supabase 环境变量，请复制 .env.example 后填写项目 URL 与 anon key。'}
        </p>
      </section>
    </div>
  )
}
