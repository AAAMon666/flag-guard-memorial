import { useEffect, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'
import { defaultMediaStorageStatus, defaultSettings, formatStorageSize, loadMediaStorageStatus, loadSettings } from '../../lib/publicData'
import type { MediaStorageStatus, PublicSettings } from '../../lib/publicData'

type GenerationOption = { id: string; name: string }

type MediaRecord = {
  id: string
  type: 'image' | 'video'
  title: string
  file_url: string
  cover_url: string | null
  generation_id: string | null
  activity_name: string | null
  taken_date: string | null
  year: number | null
  tags: string[]
  is_public: boolean
}

const imageLimit = 10 * 1024 * 1024
const videoLimit = 100 * 1024 * 1024

const emptyUploadForm = {
  title: '',
  type: 'image' as 'image' | 'video',
  generationId: '',
  uploaderName: '',
  takenDate: '',
}

export function MediaPage() {
  const [type, setType] = useState('all')
  const [generationId, setGenerationId] = useState('')
  const [generations, setGenerations] = useState<GenerationOption[]>([])
  const [mediaItems, setMediaItems] = useState<MediaRecord[]>([])
  const [settings, setSettings] = useState<PublicSettings>(defaultSettings)
  const [storageStatus, setStorageStatus] = useState<MediaStorageStatus>(defaultMediaStorageStatus)
  const [form, setForm] = useState(emptyUploadForm)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const filteredMedia = mediaItems.filter((item) => (type === 'all' || item.type === type) && (!generationId || item.generation_id === generationId))
  const uploadEnabled = form.type === 'image' ? settings.imageUploadEnabled : settings.videoUploadEnabled
  const fileLimit = form.type === 'image' ? imageLimit : videoLimit
  const hasStorageQuota = storageStatus.totalBytes > 0

  async function loadMedia() {
    if (!supabase) {
      setError('尚未配置 Supabase，无法使用真实媒体上传功能。')
      setLoading(false)
      return
    }

    setLoading(true)
    const [generationResult, mediaResult, nextSettings, nextStorageStatus] = await Promise.all([
      supabase.from('generations').select('id,name').order('year', { ascending: false }),
      supabase.from('media_items').select('id,type,title,file_url,cover_url,generation_id,activity_name,taken_date,year,tags,is_public').eq('is_public', true).order('created_at', { ascending: false }),
      loadSettings(),
      loadMediaStorageStatus(),
    ])

    if (generationResult.error || mediaResult.error) setError(generationResult.error?.message ?? mediaResult.error?.message ?? '媒体数据加载失败。')
    else {
      setGenerations(generationResult.data ?? [])
      setMediaItems(mediaResult.data ?? [])
      setSettings(nextSettings)
      setStorageStatus(nextStorageStatus)
      setError('')
      if (!nextSettings.videoUploadEnabled && form.type === 'video') setForm({ ...form, type: 'image' })
    }
    setLoading(false)
  }

  useEffect(() => {
    loadMedia()
  }, [])

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile)
    if (nextFile && nextFile.size > fileLimit) setError(`${form.type === 'image' ? '图片' : '视频'}文件过大，当前最多支持${form.type === 'image' ? '10MB' : '100MB'}。`)
    else setError('')
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase || !file || !uploadEnabled) return
    if (file.size > fileLimit) {
      setError(`${form.type === 'image' ? '图片' : '视频'}文件过大，当前最多支持${form.type === 'image' ? '10MB' : '100MB'}。`)
      return
    }
    if (hasStorageQuota && file.size > storageStatus.remainingBytes) {
      setError(`媒体库剩余空间不足，当前还可用 ${formatStorageSize(storageStatus.remainingBytes)}。`)
      return
    }

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
      activity_name: form.uploaderName || null,
      taken_date: form.takenDate || null,
      year: form.takenDate ? Number(form.takenDate.slice(0, 4)) : null,
      tags: form.takenDate ? [form.takenDate] : [],
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
        <span className="eyebrow">媒体资料</span>
        <h1>图片与视频资料</h1>
        <p>支持按届次和类型筛选，也可以直接上传照片或视频留存。选择届次后，资料会显示在对应届次详情页。图片最多 10MB，视频最多 100MB。</p>
      </div>
      {error && <section className="section-card status-warn">{error}</section>}
      <section className="section-card form-card">
        <div className="section-title"><h2>上传照片 / 视频</h2><span>{uploadEnabled ? '已开放' : '已关闭'}</span></div>
        <div className="tag-list storage-tags">
          <em>已用 {formatStorageSize(storageStatus.usedBytes)}</em>
          <em>总量 {hasStorageQuota ? formatStorageSize(storageStatus.totalBytes) : '未设置'}</em>
          <em>剩余 {hasStorageQuota ? formatStorageSize(storageStatus.remainingBytes) : '未设置'}</em>
        </div>
        <form className="upload-form" onSubmit={handleUpload}>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="标题" disabled={!hasSupabaseConfig || !uploadEnabled} required />
          <select value={form.type} onChange={(event) => { setForm({ ...form, type: event.target.value as 'image' | 'video' }); setFile(null); setError('') }} disabled={!hasSupabaseConfig}>
            {settings.imageUploadEnabled && <option value="image">照片</option>}
            {settings.videoUploadEnabled && <option value="video">视频</option>}
          </select>
          <select value={form.generationId} onChange={(event) => setForm({ ...form, generationId: event.target.value })} disabled={!hasSupabaseConfig || !uploadEnabled}>
            <option value="">不关联届次</option>
            {generations.map((generation) => <option key={generation.id} value={generation.id}>{generation.name}</option>)}
          </select>
          <input value={form.uploaderName} onChange={(event) => setForm({ ...form, uploaderName: event.target.value })} placeholder="上传者姓名" disabled={!hasSupabaseConfig || !uploadEnabled} />
          <input value={form.takenDate} onChange={(event) => setForm({ ...form, takenDate: event.target.value })} type="date" placeholder="日期" disabled={!hasSupabaseConfig || !uploadEnabled} />
          <input type="file" accept={form.type === 'image' ? 'image/*' : 'video/*'} onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)} disabled={!hasSupabaseConfig || !uploadEnabled} required />
          <small>当前{form.type === 'image' ? '图片' : '视频'}最多支持 {form.type === 'image' ? '10MB' : '100MB'}，媒体库剩余 {hasStorageQuota ? formatStorageSize(storageStatus.remainingBytes) : '未设置'}。</small>
          <div className="form-actions"><button disabled={!hasSupabaseConfig || !uploadEnabled || uploading}>{uploading ? '上传中...' : '上传并发布'}</button></div>
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
              <span>上传者：{item.activity_name ?? '未填写'} · 日期：{item.taken_date ?? item.year ?? '未填写'}</span>
              <div className="tag-list">{item.generation_id && <em>{generations.find((generation) => generation.id === item.generation_id)?.name}</em>}</div>
              {item.type === 'image' && <a href={item.file_url} download target="_blank" rel="noreferrer">下载图片</a>}
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
