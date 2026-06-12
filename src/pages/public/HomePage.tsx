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

type HeroSlide = {
  id: string
  imageUrl: string
  title: string
  subtitle: string
}

const heroSlideIntervalMs = 4500

function buildHeroSlides(data: HomeData): HeroSlide[] {
  return data.generations
    .filter((generation) => /第三届|第四届/.test(generation.name))
    .flatMap((generation) => (
      generation.cover_image
        ? [{
            id: generation.id,
            imageUrl: generation.cover_image,
            title: generation.name,
            subtitle: generation.slogan,
          }]
        : []
    ))
}

export function HomePage() {
  const [data, setData] = useState<HomeData>({ generations: [], members: [], media: [], messages: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [isCarouselPaused, setIsCarouselPaused] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

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

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches)

    syncPreference()
    mediaQuery.addEventListener('change', syncPreference)
    return () => mediaQuery.removeEventListener('change', syncPreference)
  }, [])

  const heroSlides = buildHeroSlides(data)
  const activeSlide = heroSlides[activeSlideIndex] ?? heroSlides[0]

  useEffect(() => {
    setActiveSlideIndex(0)
  }, [heroSlides.length])

  useEffect(() => {
    if (prefersReducedMotion || isCarouselPaused || heroSlides.length <= 1) return

    const timer = window.setInterval(() => {
      setActiveSlideIndex((current) => (current + 1) % heroSlides.length)
    }, heroSlideIntervalMs)

    return () => window.clearInterval(timer)
  }, [heroSlides.length, isCarouselPaused, prefersReducedMotion])

  return (
    <div className="page-stack home-page">
      {error && <section className="section-card status-warn">{error}</section>}
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">第五届招新 · 往届点滴</span>
          <h1>在一次次升旗、训练和合影里，认识这支队伍。</h1>
          <p>第三届、第四届留下的照片、留言和故事，是第五届新同学了解队伍的入口。</p>
          <div className="hero-actions">
            <Link className="primary-button" to="/generations">看看往届点滴 <ArrowRight size={18} /></Link>
            <Link className="ghost-button" to="/members">认识队员</Link>
          </div>
        </div>
        <div
          className="hero-card image-card hero-carousel"
          onMouseEnter={() => setIsCarouselPaused(true)}
          onMouseLeave={() => setIsCarouselPaused(false)}
        >
          {activeSlide ? (
            <>
              <div className="hero-slide-stage">
                {heroSlides.map((slide, index) => (
                  <img
                    className={index === activeSlideIndex ? 'active' : ''}
                    src={slide.imageUrl}
                    alt={slide.title}
                    loading={index === activeSlideIndex ? 'eager' : 'lazy'}
                    key={slide.id}
                  />
                ))}
              </div>
              <div className="hero-slide-caption">
                <strong>{activeSlide.title}</strong>
                <span>{activeSlide.subtitle}</span>
              </div>
              {heroSlides.length > 1 && (
                <div className="hero-carousel-dots" aria-label="首页图片轮播">
                  {heroSlides.map((slide, index) => (
                    <button
                      type="button"
                      className={index === activeSlideIndex ? 'active' : ''}
                      aria-label={`切换到 ${slide.title}`}
                      onClick={() => setActiveSlideIndex(index)}
                      key={slide.id}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="hero-empty-state"><strong>{loading ? '加载中...' : '暂无图片'}</strong></div>
          )}
        </div>
      </section>

      <section className="metric-grid">
        <div><ShieldCheck /><strong>{data.generations.length}</strong><span>届次记录</span></div>
        <div><Users /><strong>{data.members.length}</strong><span>成员资料</span></div>
        <div><Image /><strong>{data.media.length}</strong><span>媒体资料</span></div>
        <div><MessageSquare /><strong>{data.messages.length}</strong><span>留言寄语</span></div>
      </section>

      <section className="section-card">
        <div className="section-title"><div><span className="eyebrow">往届点滴</span><h2>届次入口</h2></div><Link to="/generations">查看全部</Link></div>
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
          <p>按学院、班级、姓名定位成员个人页，看看他们在不同届次留下的身份和片段。</p>
          <Link className="primary-button compact" to="/members">进入查询</Link>
        </div>
        <div className="section-card message-wall">
          <div className="section-title"><div><span className="eyebrow">留言寄语</span><h2>留言精选</h2></div></div>
          {data.messages.length ? data.messages.slice(0, 3).map((message) => <blockquote key={message.id}>{message.content}<cite>— {message.author_name}</cite></blockquote>) : <p>暂无留言，等你留下第一句寄语。</p>}
        </div>
      </section>
    </div>
  )
}
