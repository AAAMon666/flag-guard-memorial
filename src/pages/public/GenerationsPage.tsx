import { Link } from 'react-router-dom'
import { generations, members } from '../../data/demo'

export function GenerationsPage() {
  return (
    <div className="page-stack narrow">
      <div className="page-heading">
        <span className="eyebrow">Generations</span>
        <h1>届次档案</h1>
        <p>按届次沉淀队伍简介、成员名单、媒体资料、活动记录与留言。</p>
      </div>
      <div className="card-grid two">
        {generations.map((generation) => {
          const memberCount = members.filter((member) => member.generations.some((item) => item.generationId === generation.id)).length
          return (
            <Link className="generation-card large" to={`/generations/${generation.id}`} key={generation.id}>
              <img src={generation.coverImage} alt={generation.name} />
              <div>
                <span>{generation.year}</span>
                <strong>{generation.name}</strong>
                <p>{generation.description}</p>
                <small>{memberCount} 名示例成员 · {generation.slogan}</small>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
