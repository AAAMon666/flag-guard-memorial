import { useState } from 'react'
import { messages, systemSettings } from '../../data/demo'

export function MessagesPage() {
  const [content, setContent] = useState('')
  const [authorName, setAuthorName] = useState('')
  const approvedMessages = messages.filter((message) => message.status === 'approved')

  return (
    <div className="page-stack narrow">
      <div className="page-heading">
        <span className="eyebrow">Message Wall</span>
        <h1>留言与寄语</h1>
        <p>留言提交后进入后台审核，通过后展示在纪念墙。</p>
      </div>
      <section className="section-card message-wall">
        {approvedMessages.map((message) => (
          <blockquote key={message.id}>{message.content}<cite>— {message.authorName} · {message.createdAt}</cite></blockquote>
        ))}
      </section>
      <section className="section-card form-card">
        <div className="section-title"><h2>写下留言</h2><span>{systemSettings.messageEnabled ? '已开放' : '已关闭'}</span></div>
        <input value={authorName} onChange={(event) => setAuthorName(event.target.value)} placeholder="你的署名" disabled={!systemSettings.messageEnabled} />
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="写给队伍、某一届或某位成员的话" disabled={!systemSettings.messageEnabled} />
        <button disabled={!systemSettings.messageEnabled || !content || !authorName}>提交审核</button>
      </section>
    </div>
  )
}
