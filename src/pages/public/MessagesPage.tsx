import { useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'
import { defaultSettings, loadSettings } from '../../lib/publicData'
import type { PublicGeneration, PublicSettings } from '../../lib/publicData'

type MessageRecord = {
  id: string
  content: string
  author_name: string
  generation_id: string | null
  created_at: string
  status: string
}

type MessageComment = {
  id: string
  message_id: string
  author_name: string
  content: string
  created_at: string
}

type CommentForm = {
  authorName: string
  content: string
}

function getClientId() {
  const key = 'flag-guard-client-id'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const next = crypto.randomUUID()
  window.localStorage.setItem(key, next)
  return next
}

export function MessagesPage() {
  const [content, setContent] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [generationId, setGenerationId] = useState('')
  const [generations, setGenerations] = useState<PublicGeneration[]>([])
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [comments, setComments] = useState<MessageComment[]>([])
  const [likedIds, setLikedIds] = useState<string[]>([])
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [commentForms, setCommentForms] = useState<Record<string, CommentForm>>({})
  const [settings, setSettings] = useState<PublicSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const clientId = useMemo(() => getClientId(), [])

  async function loadMessages() {
    if (!supabase) {
      setError('尚未配置 Supabase，无法使用真实留言功能。')
      setLoading(false)
      return
    }

    setLoading(true)
    const nextSettings = await loadSettings()
    setSettings(nextSettings)
    const { data: generationData, error: generationError } = await supabase.from('generations').select('id,name,year,description,cover_image,slogan').order('year', { ascending: false })
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .select('id,content,author_name,generation_id,created_at,status')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })

    if (generationError || messageError) {
      setError(generationError?.message ?? messageError?.message ?? '留言数据加载失败。')
      setLoading(false)
      return
    }

    setGenerations(generationData ?? [])
    const messageIds = (messageData ?? []).map((message) => message.id)
    const [likeResult, ownLikeResult, commentResult] = await Promise.all([
      messageIds.length ? supabase.from('message_likes').select('message_id').in('message_id', messageIds) : Promise.resolve({ data: [], error: null }),
      messageIds.length ? supabase.from('message_likes').select('message_id').eq('client_id', clientId).in('message_id', messageIds) : Promise.resolve({ data: [], error: null }),
      messageIds.length ? supabase.from('message_comments').select('id,message_id,author_name,content,created_at').in('message_id', messageIds).order('created_at', { ascending: true }) : Promise.resolve({ data: [], error: null }),
    ])

    if (likeResult.error || ownLikeResult.error || commentResult.error) {
      setError(likeResult.error?.message ?? ownLikeResult.error?.message ?? commentResult.error?.message ?? '留言互动数据加载失败。')
    } else {
      const counts: Record<string, number> = {}
      for (const like of likeResult.data ?? []) counts[like.message_id] = (counts[like.message_id] ?? 0) + 1
      setMessages(messageData ?? [])
      setLikeCounts(counts)
      setLikedIds((ownLikeResult.data ?? []).map((like) => like.message_id))
      setComments(commentResult.data ?? [])
      setError('')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadMessages()
  }, [])

  async function submitMessage(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase || !settings.messageEnabled) return

    setSubmitting(true)
    setError('')
    const { error: submitError } = await supabase.from('messages').insert({
      author_name: authorName,
      content,
      generation_id: generationId || null,
      status: 'approved',
    })

    if (submitError) setError(submitError.message)
    else {
      setAuthorName('')
      setGenerationId('')
      setContent('')
      await loadMessages()
    }
    setSubmitting(false)
  }

  async function likeMessage(messageId: string) {
    if (!supabase || likedIds.includes(messageId)) return

    const { error: likeError } = await supabase.from('message_likes').insert({ message_id: messageId, client_id: clientId })
    if (likeError && likeError.code !== '23505') setError(likeError.message)
    else {
      setLikedIds((current) => [...current, messageId])
      setLikeCounts((current) => ({ ...current, [messageId]: (current[messageId] ?? 0) + 1 }))
    }
  }

  async function submitComment(event: React.FormEvent, messageId: string) {
    event.preventDefault()
    if (!supabase) return

    const form = commentForms[messageId]
    if (!form?.authorName || !form.content) return

    const { error: commentError } = await supabase.from('message_comments').insert({
      message_id: messageId,
      author_name: form.authorName,
      content: form.content,
    })

    if (commentError) setError(commentError.message)
    else {
      setCommentForms((current) => ({ ...current, [messageId]: { authorName: '', content: '' } }))
      await loadMessages()
    }
  }

  return (
    <div className="page-stack narrow">
      <div className="page-heading">
        <span className="eyebrow">留言寄语</span>
        <h1>留言与寄语</h1>
        <p>留言提交后会立即展示，选择届次后也会同步显示在对应届次详情页。</p>
      </div>
      {error && <section className="section-card status-warn">{error}</section>}
      <section className="section-card form-card">
        <div className="section-title"><h2>写下留言</h2><span>{hasSupabaseConfig ? settings.messageEnabled ? '已开放' : '已关闭' : '未配置'}</span></div>
        <form className="form-card" onSubmit={submitMessage}>
          <input value={authorName} onChange={(event) => setAuthorName(event.target.value)} placeholder="你的署名" disabled={!hasSupabaseConfig || !settings.messageEnabled} required />
          <select value={generationId} onChange={(event) => setGenerationId(event.target.value)} disabled={!hasSupabaseConfig || !settings.messageEnabled}>
            <option value="">不关联届次</option>
            {generations.map((generation) => <option key={generation.id} value={generation.id}>{generation.name}</option>)}
          </select>
          <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="写给队伍、某一届或某位成员的话" disabled={!hasSupabaseConfig || !settings.messageEnabled} required />
          <button disabled={!hasSupabaseConfig || !settings.messageEnabled || submitting}>{submitting ? '提交中...' : '提交留言'}</button>
        </form>
      </section>
      <section className="section-card message-wall">
        {loading ? <p>留言加载中...</p> : messages.length ? messages.map((message) => {
          const messageComments = comments.filter((comment) => comment.message_id === message.id)
          const form = commentForms[message.id] ?? { authorName: '', content: '' }
          return (
            <article className="message-card" key={message.id}>
              <blockquote>{message.content}<cite>— {message.author_name} · {generations.find((generation) => generation.id === message.generation_id)?.name ?? '未关联届次'} · {new Date(message.created_at).toLocaleDateString()}</cite></blockquote>
              <div className="message-actions">
                <button type="button" className="secondary-button" disabled={likedIds.includes(message.id)} onClick={() => likeMessage(message.id)}>{likedIds.includes(message.id) ? '已点赞' : '点赞'}（{likeCounts[message.id] ?? 0}）</button>
                <span>{messageComments.length} 条评论</span>
              </div>
              <div className="comment-list">
                {messageComments.map((comment) => <p key={comment.id}><strong>{comment.author_name}：</strong>{comment.content}</p>)}
              </div>
              <form className="comment-form" onSubmit={(event) => submitComment(event, message.id)}>
                <input value={form.authorName} onChange={(event) => setCommentForms((current) => ({ ...current, [message.id]: { ...form, authorName: event.target.value } }))} placeholder="署名" required />
                <input value={form.content} onChange={(event) => setCommentForms((current) => ({ ...current, [message.id]: { ...form, content: event.target.value } }))} placeholder="写评论" required />
                <button>评论</button>
              </form>
            </article>
          )
        }) : <p>暂无留言，等你留下第一句寄语。</p>}
      </section>
    </div>
  )
}
