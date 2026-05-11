import { Link, NavLink, Outlet } from 'react-router-dom'
import { Shield } from 'lucide-react'

const publicLinks = [
  { to: '/', label: '首页' },
  { to: '/generations', label: '届次' },
  { to: '/members', label: '成员查询' },
  { to: '/media', label: '媒体资料' },
  { to: '/messages', label: '留言纪念' },
]

export function Layout() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <Link className="brand" to="/">
          <span className="brand-mark"><Shield size={24} /></span>
          <span>
            <strong>国旗护卫队纪念网站</strong>
            <small>National Flag Guard Memorial</small>
          </span>
        </Link>
        <nav>
          {publicLinks.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {link.label}
            </NavLink>
          ))}
          <NavLink to="/login" className={({ isActive }) => (isActive ? 'active admin-link' : 'admin-link')}>
            登录后台
          </NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>以青春护卫国旗，以记忆连接每一届队员。</span>
        <span>GitHub Pages + Supabase</span>
      </footer>
    </div>
  )
}
