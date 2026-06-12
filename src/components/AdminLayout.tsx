import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const adminLinks = [
  { to: '/admin', label: '鎺у埗鍙? },
  { to: '/admin/generations', label: '灞婃绠＄悊' },
  { to: '/admin/members', label: '鎴愬憳绠＄悊' },
  { to: '/admin/taxonomy', label: '瀛﹂櫌鐝骇涓撲笟' },
  { to: '/admin/tags', label: '韬唤鏍囩' },
  { to: '/admin/media', label: '濯掍綋绠＄悊' },
  { to: '/admin/generated-gallery', label: '浣滃搧闆嗙鐞? },
  { to: '/admin/image-providers', label: '鐢熷浘渚涘簲鍟? },
  { to: '/admin/messages', label: '鐣欒█绠＄悊' },
  { to: '/admin/permissions', label: '鏉冮檺璁剧疆' },
  { to: '/admin/import-export', label: '瀵煎叆瀵煎嚭' },
  { to: '/admin/settings', label: '绯荤粺璁剧疆' },
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
          <strong>鍚庡彴绠＄悊</strong>
          <p>鍙鍖栫淮鎶ょ綉绔欏唴瀹?/p>
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
          <button onClick={handleSignOut}>閫€鍑虹櫥褰?/button>
        </div>
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  )
}
