import { useEffect, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'

type GenerationOption = {
  id: string
  name: string
}

type MediaRecord = {
  id: string
  type: 'image' | 'video'
  title: string
  file_url: string
  cover_url: string | null
  generation_id: string | null
  activity_name: string | null
  year: number | null
  tags: string[]
  is_public: boolean
}

const emptyUploadForm = {
  title: '',
  type: 'image' as 'image' | 'video',
  generationId: '',
  activityName: '',
  year: new Date().getFullYear(),
  tags: '',
}

export function MediaPage() {
  const [type, setType] = useState('all')
  const [generationId, setGenerationId] = useState('')
  const [generations, setGenerations] = useState<GenerationOption[]>([])
  const [mediaItems, setMediaItems] = useState<MediaRecord[]>([])
  const [form, setForm] = useState(emptyUploadForm)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const filteredMedia = mediaItems.filter((item) => (type === 'all' || item.type === type) && (!generationId || item.generation_id === generationId))

  async function loadMedia() {
    if (!supabase) {
      setError('尚未配置 Supabase，无法使用真实媒体上传功能。')
      setLoading(false)
      return
    }

    setLoading(true)
    const [generationResult, mediaResult] = await Promise.all([
      supabase.from('generations').select('id,name').order('year', { ascending: false }),
      supabase.from('media_items').select('id,type,title,file_url,cover_url,generation_id,activity_name,year,tags,is_public').eq('is_public', true).order('created_at', { ascending: false }),
    ])

    if (generationResult.error || mediaResult.error) setError(generationResult.error?.message ?? mediaResult.error?.message ?? '媒体数据加载失败。')
    else {
      setGenerations(generationResult.data ?? [])
      setMediaItems(mediaResult.data ?? [])
      setError('')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadMedia()
  }, [])

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase || !file) return

    setUploading(true)
    setError('')
    const extension = file.name.split('.').pop() ?? 'file'
    const filePath = `${form.type}/${crypto.randomUUID()}.${extension}`
    const uploadResult = await supabase.storage.from('media').upload(filePath, file)

    if (uploadResult.error) {
      setError(uploadResult.error.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('media').getPublicUrl(filePath)
    const { error: insertError } = await supabase.from('media_items').insert({
      type: form.type,
      title: form.title,
      file_url: data.publicUrl,
      generation_id: form.generationId || null,
      activity_name: form.activityName || null,
      year: form.year || null,
      tags: form.tags.split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean),
      is_public: true,
    })

    if (insertError) setError(insertError.message)
    else {
      setForm(emptyUploadForm)
      setFile(null)
      await loadMedia()
    }
    setUploading(false)
  }

  return (
    <div className="page-stack narrow">
      <div className="page-heading">
        <span className="eyebrow">Media</span>
        <h1>图片与视频资料</h1>
        <p>支持按届次和类型筛选，也可以直接上传照片或视频留存。</p>
      </div>
      {error && <section className="section-card status-warn">{error}</section>}
      <section className="section-card form-card">
        <div className="section-title"><h2>上传照片 / 视频</h2><span>{hasSupabaseConfig ? '已开放' : '未配置'}</span></div>
        <form className="upload-form" onSubmit={handleUpload}>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="标题" disabled={!hasSupabaseConfig} required />
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as 'image' | 'video' })} disabled={!hasSupabaseConfig}>
            <option value="image">照片</option>
            <option value="video">视频</option>
          </select>
          <select value={form.generationId} onChange={(event) => setForm({ ...form, generationId: event.target.value })} disabled={!hasSupabaseConfig}>
            <option value="">不关联届次</option>
            {generations.map((generation) => <option key={generation.id} value={generation.id}>{generation.name}</option>)}
          </select>
          <input value={form.activityName} onChange={(event) => setForm({ ...form, activityName: event.target.value })} placeholder="活动名称" disabled={!hasSupabaseConfig} />
          <input value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })} type="number" placeholder="年份" disabled={!hasSupabaseConfig} />
          <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="标签，用逗号或空格分隔" disabled={!hasSupabaseConfig} />
          <input type="file" accept={form.type === 'image' ? 'image/*' : 'video/*'} onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={!hasSupabaseConfig} required />
          <div className="form-actions"><button disabled={!hasSupabaseConfig || uploading}>{uploading ? '上传中...' : '上传并发布'}</button></div>
        </form>
      </section>
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
        {loading ? <p>媒体加载中...</p> : filteredMedia.map((item) => (
          <article className="media-card large" key={item.id}>
            {item.type === 'video' ? <video src={item.file_url} poster={item.cover_url ?? undefined} controls /> : <img src={item.file_url} alt={item.title} />}
            <div>
              <strong>{item.title}</strong>
              <span>{item.activity_name ?? '未填写活动'} · {item.year ?? '未填写年份'}</span>
              <div className="tag-list">{item.tags.map((tag) => <em key={tag}>{tag}</em>)}</div>
              {item.type === 'image' && <a href={item.file_url} download target="_blank" rel="noreferrer">下载图片</a>}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
