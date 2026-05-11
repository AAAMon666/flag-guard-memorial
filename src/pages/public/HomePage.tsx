import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Image, MessageSquare, Search, ShieldCheck, Users } from 'lucide-react'
import { hasSupabaseConfig } from '../../lib/supabase'
import { loadPublicData } from '../../lib/publicData'
import type { PublicGeneration, PublicMedia, PublicMember, PublicMessage } from '../../lib/publicData'

type HomeData = {
  generations: PublicGeneration[]
  members: PublicMember[]
  media: PublicMedia[]
  messages: PublicMessage[]
}

export function HomePage() {
  const [data, setData] = useState<HomeData>({ generations: [], members: [], media: [], messages: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setError('尚未配置 Supabase，无法加载真实网站数据。')
      setLoading(false)
      return
    }

    loadPublicData()
      .then((result) => {
        setData({ generations: result.generations, members: result.members, media: result.media, messages: result.messages })
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : '首页数据加载失败。'))
      .finally(() => setLoading(false))
  }, [])

  const latestGeneration = data.generations[0]

  return (
    <div className="page-stack">
      {error && <section className="section-card status-warn">{error}</section>}
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">国旗护卫队 · 数字纪念馆</span>
          <h1>把每一届队员、每一次升旗、每一张照片长久留存。</h1>
          <p>面向国旗护卫队历史展示、成员管理、媒体资料沉淀和留言互动，前台庄重展示，后台可视化维护。</p>
          <div className="hero-actions">
            <Link className="primary-button" to="/generations">浏览届次 <ArrowRight size={18} /></Link>
            <Link className="ghost-button" to="/members">查找成员</Link>
          </div>
        </div>
        <div className="hero-card image-card">
          {latestGeneration ? <img src={latestGeneration.cover_image ?? ''} alt={latestGeneration.name} /> : <div><strong>{loading ? '加载中...' : '暂无届次'}</strong></div>}
          {latestGeneration && <div><strong>{latestGeneration.name}</strong><span>{latestGeneration.slogan}</span></div>}
        </div>
      </section>

      <section className="metric-grid">
        <div><ShieldCheck /><strong>{data.generations.length}</strong><span>届队伍档案</span></div>
        <div><Users /><strong>{data.members.length}</strong><span>成员资料</span></div>
        <div><Image /><strong>{data.media.length}</strong><span>媒体资料</span></div>
        <div><MessageSquare /><strong>{data.messages.length}</strong><span>纪念留言</span></div>
      </section>

      <section className="section-card">
        <div className="section-title"><div><span className="eyebrow">届次档案</span><h2>届次入口</h2></div><Link to="/generations">查看全部</Link></div>
        <div className="card-grid three">
          {data.generations.map((generation) => (
            <Link className="generation-card" to={`/generations/${generation.id}`} key={generation.id}>
              <img src={generation.cover_image ?? ''} alt={generation.name} />
              <strong>{generation.name}</strong>
              <span>{generation.year} · {generation.slogan}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="split-grid">
        <div className="section-card">
          <div className="section-title"><div><span className="eyebrow">成员查询</span><h2>快速成员查询</h2></div><Search size={22} /></div>
          <p>按学院、班级、姓名定位成员个人页，支持一名成员关联多个届次与不同身份标签。</p>
          <Link className="primary-button compact" to="/members">进入查询</Link>
        </div>
        <div className="section-card message-wall">
          <div className="section-title"><div><span className="eyebrow">留言纪念</span><h2>留言精选</h2></div></div>
          {data.messages.slice(0, 3).map((message) => <blockquote key={message.id}>{message.content}<cite>— {message.author_name}</cite></blockquote>)}
        </div>
      </section>
    </div>
  )
}
