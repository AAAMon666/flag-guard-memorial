import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { hasSupabaseConfig } from '../../lib/supabase'
import { maskPhone } from '../../lib/auth'
import { loadPublicData } from '../../lib/publicData'
import type { PublicClass, PublicCollege, PublicGeneration, PublicMajor, PublicMedia, PublicMember } from '../../lib/publicData'

type MemberGenerationView = {
  generation: PublicGeneration | undefined
  remark: string
  tags: string[]
}

type MemberDetailData = {
  member: PublicMember | null
  colleges: PublicCollege[]
  majors: PublicMajor[]
  classes: PublicClass[]
  generations: MemberGenerationView[]
  media: PublicMedia[]
}

export function MemberDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState<MemberDetailData>({ member: null, colleges: [], majors: [], classes: [], generations: [], media: [] })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setError('尚未配置 Supabase，无法加载真实成员详情。')
      return
    }

    loadPublicData()
      .then((result) => {
        const member = result.members.find((item) => item.id === id) ?? null
        if (!member) {
          setData((current) => ({ ...current, member: null }))
          return
        }

        const relations = result.memberGenerations.filter((relation) => relation.member_id === member.id)
        const generationViews = relations.map((relation) => {
          const tagIds = result.memberGenerationTags.filter((tag) => tag.member_generation_id === relation.id).map((tag) => tag.identity_tag_id)
          return {
            generation: result.generations.find((generation) => generation.id === relation.generation_id),
            remark: relation.remark,
            tags: tagIds.map((tagId) => result.tags.find((tag) => tag.id === tagId)?.name).filter((tag): tag is string => Boolean(tag)),
          }
        })
        setData({
          member,
          colleges: result.colleges,
          majors: result.majors,
          classes: result.classes,
          generations: generationViews,
          media: result.media.filter((item) => item.member_id === member.id || relations.some((relation) => relation.generation_id === item.generation_id)),
        })
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : '成员详情加载失败。'))
  }, [id])

  const member = data.member
  if (!member) {
    return <div className="page-stack narrow">{error && <section className="section-card status-warn">{error}</section>}<section className="section-card">该成员不存在或已被删除。</section></div>
  }

  return (
    <div className="page-stack narrow">
      <section className="profile-hero section-card">
        <img src={member.avatar ?? ''} alt={member.name} />
        <div>
          <span className="eyebrow">Member Profile</span>
          <h1>{member.name}</h1>
          <p>{member.bio}</p>
          <div className="profile-meta">
            <span>{data.colleges.find((item) => item.id === member.college_id)?.name}</span>
            <span>{data.majors.find((item) => item.id === member.major_id)?.name}</span>
            <span>{data.classes.find((item) => item.id === member.class_id)?.name}</span>
            <span>{member.retired_status ? '已退役' : '在队'}</span>
            <span>手机号：{member.phone ? maskPhone(member.phone, false) : '未填写'}</span>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-title"><h2>所属届次与身份</h2></div>
        <div className="timeline-list">
          {data.generations.map((relation) => (
            <article key={relation.generation?.id ?? relation.remark}>
              <strong>{relation.generation?.name} · {relation.generation?.year}</strong>
              <p>{relation.remark}</p>
              <div className="tag-list">{relation.tags.map((tag) => <em key={tag}>{tag}</em>)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card">
        <div className="section-title"><h2>相关媒体资料</h2></div>
        <div className="card-grid three">
          {data.media.map((item) => (
            <article className="media-card" key={item.id}>
              <img src={item.cover_url ?? item.file_url} alt={item.title} />
              <strong>{item.title}</strong>
              <span>{item.activity_name}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
