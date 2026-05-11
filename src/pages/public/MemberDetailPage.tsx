import { useParams } from 'react-router-dom'
import { classes, colleges, generations, identityTags, majors, mediaItems, members } from '../../data/demo'
import { can, defaultRole, maskPhone } from '../../lib/auth'

export function MemberDetailPage() {
  const { id } = useParams()
  const member = members.find((item) => item.id === id) ?? members[0]
  const canViewPhone = can(defaultRole, 'phone.view')
  const memberMedia = mediaItems.filter((item) => item.memberId === member.id || member.generations.some((generation) => generation.generationId === item.generationId))

  return (
    <div className="page-stack narrow">
      <section className="profile-hero section-card">
        <img src={member.avatar} alt={member.name} />
        <div>
          <span className="eyebrow">Member Profile</span>
          <h1>{member.name}</h1>
          <p>{member.bio}</p>
          <div className="profile-meta">
            <span>{colleges.find((item) => item.id === member.collegeId)?.name}</span>
            <span>{majors.find((item) => item.id === member.majorId)?.name}</span>
            <span>{classes.find((item) => item.id === member.classId)?.name}</span>
            <span>{member.retiredStatus ? '已退役' : '在队'}</span>
            <span>手机号：{maskPhone(member.phone, canViewPhone)}</span>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="section-title"><h2>所属届次与身份</h2></div>
        <div className="timeline-list">
          {member.generations.map((relation) => {
            const generation = generations.find((item) => item.id === relation.generationId)
            const tags = relation.tagIds.map((tagId) => identityTags.find((tag) => tag.id === tagId)?.name).filter(Boolean)
            return (
              <article key={relation.generationId}>
                <strong>{generation?.name} · {generation?.year}</strong>
                <p>{relation.remark}</p>
                <div className="tag-list">{tags.map((tag) => <em key={tag}>{tag}</em>)}</div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="section-card">
        <div className="section-title"><h2>相关媒体资料</h2></div>
        <div className="card-grid three">
          {memberMedia.map((item) => (
            <article className="media-card" key={item.id}>
              <img src={item.coverUrl ?? item.fileUrl} alt={item.title} />
              <strong>{item.title}</strong>
              <span>{item.activityName}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
