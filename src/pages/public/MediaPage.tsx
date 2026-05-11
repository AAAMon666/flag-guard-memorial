import { useState } from 'react'
import { generations, mediaItems } from '../../data/demo'

export function MediaPage() {
  const [type, setType] = useState('all')
  const [generationId, setGenerationId] = useState('')
  const filteredMedia = mediaItems.filter((item) => (type === 'all' || item.type === type) && (!generationId || item.generationId === generationId))

  return (
    <div className="page-stack narrow">
      <div className="page-heading">
        <span className="eyebrow">Media</span>
        <h1>图片与视频资料</h1>
        <p>支持按届次、类型、活动、标签筛选。视频模块默认关闭上传，前台预留展示能力。</p>
      </div>
      <section className="filter-panel">
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="all">全部类型</option>
          <option value="image">图片</option>
          <option value="video">视频</option>
        </select>
        <select value={generationId} onChange={(event) => setGenerationId(event.target.value)}>
          <option value="">全部届次</option>
          {generations.map((generation) => <option key={generation.id} value={generation.id}>{generation.name}</option>)}
        </select>
      </section>
      <section className="media-grid">
        {filteredMedia.map((item) => (
          <article className="media-card large" key={item.id}>
            {item.type === 'video' ? <video src={item.fileUrl} poster={item.coverUrl} controls /> : <img src={item.fileUrl} alt={item.title} />}
            <div>
              <strong>{item.title}</strong>
              <span>{item.activityName} · {item.year}</span>
              <div className="tag-list">{item.tags.map((tag) => <em key={tag}>{tag}</em>)}</div>
              {item.type === 'image' && <a href={item.fileUrl} download target="_blank" rel="noreferrer">下载图片</a>}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
