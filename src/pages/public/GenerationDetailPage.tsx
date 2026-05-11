import { Link, useParams } from 'react-router-dom'
import { generations, identityTags, mediaItems, members, messages } from '../../data/demo'

export function GenerationDetailPage() {
  const { id } = useParams()
  const generation = generations.find((item) => item.id === id) ?? generations[0]
  const generationMembers = members.filter((member) => member.generations.some((item) => item.generationId === generation.id))
  const generationMedia = mediaItems.filter((item) => item.generationId === generation.id)
  const generationMessages = messages.filter((item) => item.generationId === generation.id && item.status === 'approved')

  return (
    <div className="page-stack narrow">
      <section className="detail-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(72, 0, 0, .88), rgba(72, 0, 0, .35)), url(${generation.coverImage})` }}>
        <span>{generation.year}</span>
        <h1>{generation.name}</h1>
        <p>{generation.description}</p>
        <strong>{generation.slogan}</strong>
      </section>

      <section className="section-card">
        <div className="section-title"><h2>成员名单</h2><span>{generationMembers.length} 人</span></div>
        <div className="member-list">
          {generationMembers.map((member) => {
            const relation = member.generations.find((item) => item.generationId === generation.id)
            const tags = relation?.tagIds.map((tagId) => identityTags.find((tag) => tag.id === tagId)?.name).filter(Boolean)
            return (
              <Link className="member-row" key={member.id} to={`/members/${member.id}`}>
                <img src={member.avatar} alt={member.name} />
                <div><strong>{member.name}</strong><span>{relation?.remark}</span></div>
                <div className="tag-list">{tags?.map((tag) => <em key={tag}>{tag}</em>)}</div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="section-card">
        <div className="section-title"><h2>图片 / 视频</h2><Link to="/media">更多媒体</Link></div>
        <div className="card-grid three">
          {generationMedia.map((item) => (
            <article className="media-card" key={item.id}>
              <img src={item.coverUrl ?? item.fileUrl} alt={item.title} />
              <strong>{item.title}</strong>
              <span>{item.type === 'video' ? '视频' : '图片'} · {item.activityName}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card message-wall">
        <div className="section-title"><h2>留言 / 祝福</h2></div>
        {generationMessages.length ? generationMessages.map((message) => (
          <blockquote key={message.id}>{message.content}<cite>— {message.authorName}</cite></blockquote>
        )) : <p>暂无该届留言，后台审核通过后将在此展示。</p>}
      </section>
    </div>
  )
}
