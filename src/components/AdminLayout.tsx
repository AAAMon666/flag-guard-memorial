import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const adminLinks = [
  { to: '/admin', label: '控制台' },
  { to: '/admin/generations', label: '届次管理' },
  { to: '/admin/members', label: '成员管理' },
  { to: '/admin/taxonomy', label: '学院班级专业' },
  { to: '/admin/tags', label: '身份标签' },
  { to: '/admin/media', label: '媒体管理' },
  { to: '/admin/messages', label: '留言管理' },
  { to: '/admin/permissions', label: '权限设置' },
  { to: '/admin/import-export', label: '导入导出' },
  { to: '/admin/settings', label: '系统设置' },
]

export function AdminLayout() {
  const navigate = useNavigate()
  const { session, signOut } = useAuth()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div>
          <strong>后台管理</strong>
          <p>可视化维护网站内容</p>
        </div>
        <nav>
          {adminLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/admin'} className={({ isActive }) => (isActive ? 'active' : '')}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-user-card">
          <span>{session?.user.email}</span>
          <button onClick={handleSignOut}>退出登录</button>
        </div>
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  )
}
