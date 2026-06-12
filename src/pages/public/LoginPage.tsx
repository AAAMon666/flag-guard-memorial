import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { hasSupabaseConfig } from '../../lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn(email, password)
      navigate('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查账号密码。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-stack narrow">
      <section className="section-card login-card">
        <span className="eyebrow">后台登录</span>
        <h1>管理员登录</h1>
        <p>请输入 Supabase Authentication 中创建的管理员邮箱和密码。</p>
        <form className="form-card" onSubmit={handleSubmit}>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="邮箱" type="email" required />
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="密码" type="password" required />
          <button disabled={!hasSupabaseConfig || submitting}>{submitting ? '登录中...' : '登录后台'}</button>
          {error && <p className="status-warn">{error}</p>}
        </form>
        <p className={hasSupabaseConfig ? 'status-ok' : 'status-warn'}>
          {hasSupabaseConfig ? '已检测到 Supabase 环境变量。' : '尚未配置 Supabase 环境变量，无法使用真实登录。'}
        </p>
      </section>
    </div>
  )
}
