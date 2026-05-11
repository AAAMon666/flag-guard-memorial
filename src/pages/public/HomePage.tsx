import { Link } from 'react-router-dom'
import { ArrowRight, Image, MessageSquare, Search, ShieldCheck, Users } from 'lucide-react'
import { generations, mediaItems, members, messages } from '../../data/demo'

export function HomePage() {
  const latestGeneration = generations[generations.length - 1]
  const approvedMessages = messages.filter((message) => message.status === 'approved')

  return (
    <div className="page-stack">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">国旗护卫队 · 数字纪念馆</span>
          <h1>把每一届队员、每一次升旗、每一张照片长久留存。</h1>
          <p>
            面向国旗护卫队历史展示、成员管理、媒体资料沉淀和留言互动，前台庄重展示，后台可视化维护。
          </p>
          <div className="hero-actions">
            <Link className="primary-button" to="/generations">浏览届次 <ArrowRight size={18} /></Link>
            <Link className="ghost-button" to="/members">查找成员</Link>
          </div>
        </div>
        <div className="hero-card image-card">
          <img src={latestGeneration.coverImage} alt={latestGeneration.name} />
          <div>
            <strong>{latestGeneration.name}</strong>
            <span>{latestGeneration.slogan}</span>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <div><ShieldCheck /><strong>{generations.length}</strong><span>届队伍档案</span></div>
        <div><Users /><strong>{members.length}</strong><span>示例成员资料</span></div>
        <div><Image /><strong>{mediaItems.length}</strong><span>媒体资料</span></div>
        <div><MessageSquare /><strong>{approvedMessages.length}</strong><span>纪念留言</span></div>
      </section>

      <section className="section-card">
        <div className="section-title">
          <div>
            <span className="eyebrow">Generations</span>
            <h2>届次入口</h2>
          </div>
          <Link to="/generations">查看全部</Link>
        </div>
        <div className="card-grid three">
          {generations.map((generation) => (
            <Link className="generation-card" to={`/generations/${generation.id}`} key={generation.id}>
              <img src={generation.coverImage} alt={generation.name} />
              <strong>{generation.name}</strong>
              <span>{generation.year} · {generation.slogan}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="split-grid">
        <div className="section-card">
          <div className="section-title">
            <div>
              <span className="eyebrow">Search</span>
              <h2>快速成员查询</h2>
            </div>
            <Search size={22} />
          </div>
          <p>按学院、班级、姓名定位成员个人页，支持一名成员关联多个届次与不同身份标签。</p>
          <Link className="primary-button compact" to="/members">进入查询</Link>
        </div>
        <div className="section-card message-wall">
          <div className="section-title">
            <div>
              <span className="eyebrow">Messages</span>
              <h2>留言精选</h2>
            </div>
          </div>
          {approvedMessages.map((message) => (
            <blockquote key={message.id}>{message.content}<cite>— {message.authorName}</cite></blockquote>
          ))}
        </div>
      </section>
    </div>
  )
}
