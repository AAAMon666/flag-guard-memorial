import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { hasSupabaseConfig } from '../../lib/supabase'
import { loadPublicData } from '../../lib/publicData'
import type { PublicGeneration, PublicMedia, PublicMember, PublicMessage } from '../../lib/publicData'

type GenerationMember = PublicMember & { remark: string; tags: string[] }

export function GenerationDetailPage() {
  const { id } = useParams()
  const [generation, setGeneration] = useState<PublicGeneration | null>(null)
  const [members, setMembers] = useState<GenerationMember[]>([])
  const [media, setMedia] = useState<PublicMedia[]>([])
  const [messages, setMessages] = useState<PublicMessage[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setError('尚未配置 Supabase，无法加载真实届次详情。')
      return
    }

    loadPublicData()
      .then((data) => {
        const current = data.generations.find((item) => item.id === id) ?? null
        setGeneration(current)
        if (!current) return

        const relations = data.memberGenerations.filter((item) => item.generation_id === current.id)
        setMembers(relations.map((relation) => {
          const member = data.members.find((item) => item.id === relation.member_id)
          const tagIds = data.memberGenerationTags.filter((item) => item.member_generation_id === relation.id).map((item) => item.identity_tag_id)
          const tags = tagIds.map((tagId) => data.tags.find((tag) => tag.id === tagId)?.name).filter((tag): tag is string => Boolean(tag))
          return member ? { ...member, remark: relation.remark, tags } : null
        }).filter((member): member is GenerationMember => Boolean(member)))
        setMedia(data.media.filter((item) => item.generation_id === current.id))
        setMessages(data.messages.filter((item) => item.generation_id === current.id))
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : '届次详情加载失败。'))
  }, [id])

  if (!generation) {
    return <div className="page-stack narrow">{error && <section className="section-card status-warn">{error}</section>}<section className="section-card">该届次不存在或已被删除。</section></div>
  }

  return (
    <div className="page-stack narrow">
      <section className="detail-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(72, 0, 0, .88), rgba(72, 0, 0, .35)), url(${generation.cover_image ?? ''})` }}>
        <span>{generation.year}</span>
        <h1>{generation.name}</h1>
        <p>{generation.description}</p>
        <strong>{generation.slogan}</strong>
      </section>

      <section className="section-card">
        <div className="section-title"><h2>成员名单</h2><span>{members.length} 人</span></div>
        {members.length ? (
          <div className="member-list">
            {members.map((member) => (
              <Link className="member-row" key={member.id} to={`/members/${member.id}`}>
                {member.avatar ? <img src={member.avatar} alt={member.name} /> : <div className="avatar-placeholder">{member.name.slice(0, 1)}</div>}
                <div><strong>{member.name}</strong><span>{member.gender || '未填写性别'} · {member.remark}</span></div>
                <div className="tag-list">{member.tags.map((tag) => <em key={tag}>{tag}</em>)}</div>
              </Link>
            ))}
          </div>
        ) : <p>暂无成员资料。</p>}
      </section>

      <section className="section-card">
        <div className="section-title"><h2>图片 / 视频</h2><Link to="/media">更多媒体</Link></div>
        {media.length ? (
          <div className="card-grid three">
            {media.map((item) => (
              <article className="media-card" key={item.id}>
                {item.assets[0]?.cover_url || item.assets[0]?.file_url || item.cover_url || item.file_url ? <img src={item.assets[0]?.cover_url ?? item.assets[0]?.file_url ?? item.cover_url ?? item.file_url} alt={item.title} /> : <div className="media-placeholder">暂无封面</div>}
                <strong>{item.title}</strong>
                <span>{item.type === 'video' ? '视频' : `图片 · 共 ${item.asset_count} 张`} · 上传者：{item.activity_name ?? '未填写'} · 日期：{item.taken_date ?? item.year ?? '未填写'}</span>
              </article>
            ))}
          </div>
        ) : <p>暂无相关媒体。</p>}
      </section>

      <section className="section-card message-wall">
        <div className="section-title"><h2>留言 / 祝福</h2></div>
        {messages.length ? messages.map((message) => <blockquote key={message.id}>{message.content}<cite>— {message.author_name}</cite></blockquote>) : <p>暂无该届留言。</p>}
      </section>
    </div>
  )
}
