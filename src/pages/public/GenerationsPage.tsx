import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { hasSupabaseConfig } from '../../lib/supabase'
import { loadPublicData } from '../../lib/publicData'
import type { PublicGeneration } from '../../lib/publicData'

type GenerationItem = PublicGeneration & { memberCount: number }

export function GenerationsPage() {
  const [items, setItems] = useState<GenerationItem[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setError('尚未配置 Supabase，无法加载真实届次数据。')
      return
    }

    loadPublicData()
      .then((data) => {
        setItems(data.generations.map((generation) => ({
          ...generation,
          memberCount: data.memberGenerations.filter((item) => item.generation_id === generation.id).length,
        })))
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : '届次数据加载失败。'))
  }, [])

  return (
    <div className="page-stack narrow">
      <div className="page-heading">
        <span className="eyebrow">届次档案</span>
        <h1>届次档案</h1>
        <p>按届次沉淀队伍简介、成员名单、媒体资料、活动记录与留言。</p>
      </div>
      {error && <section className="section-card status-warn">{error}</section>}
      <div className="card-grid two">
        {items.map((generation) => (
          <Link className="generation-card large" to={`/generations/${generation.id}`} key={generation.id}>
            <img src={generation.cover_image ?? ''} alt={generation.name} />
            <div>
              <span>{generation.year}</span>
              <strong>{generation.name}</strong>
              <p>{generation.description}</p>
              <small>{generation.memberCount} 名成员 · {generation.slogan}</small>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
