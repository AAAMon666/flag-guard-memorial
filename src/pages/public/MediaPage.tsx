import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'
import { defaultMediaStorageStatus, defaultSettings, formatStorageSize, loadMediaStorageStatus, loadPublicData, loadSettings } from '../../lib/publicData'
import type { MediaStorageStatus, PublicMedia, PublicSettings } from '../../lib/publicData'

type GenerationOption = { id: string; name: string }
type SortMode = 'takenDate' | 'uploadTime'

type UploadForm = {
  title: string
  type: 'image' | 'video'
  generationId: string
  uploaderName: string
  takenDate: string
  editPassword: string
}

const imageLimit = 10 * 1024 * 1024
const videoLimit = 100 * 1024 * 1024

const emptyUploadForm: UploadForm = {
  title: '',
  type: 'image',
  generationId: '',
  uploaderName: '',
  takenDate: '',
  editPassword: '',
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function appendUniqueFiles(currentFiles: File[], nextFiles: File[]) {
  const filesByKey = new Map(currentFiles.map((file) => [fileKey(file), file]))
  nextFiles.forEach((file) => filesByKey.set(fileKey(file), file))
  return Array.from(filesByKey.values())
}

export function MediaPage() {
  const [type, setType] = useState('all')
  const [generationId, setGenerationId] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('takenDate')
  const [generations, setGenerations] = useState<GenerationOption[]>([])
  const [mediaItems, setMediaItems] = useState<PublicMedia[]>([])
  const [settings, setSettings] = useState<PublicSettings>(defaultSettings)
  const [storageStatus, setStorageStatus] = useState<MediaStorageStatus>(defaultMediaStorageStatus)
  const [form, setForm] = useState<UploadForm>(emptyUploadForm)
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const filteredMedia = useMemo(() => {
    const getTime = (item: PublicMedia) => {
      const fallbackTime = new Date(item.created_at).getTime()
      const sortedTime = sortMode === 'uploadTime'
        ? fallbackTime
        : item.taken_date
          ? new Date(item.taken_date).getTime()
          : item.year
            ? new Date(`${item.year}-01-01`).getTime()
            : fallbackTime

      return Number.isFinite(sortedTime) ? sortedTime : fallbackTime
    }

    return mediaItems
      .filter((item) => (type === 'all' || item.type === type) && (!generationId || item.generation_id === generationId))
      .slice()
      .sort((current, next) => getTime(next) - getTime(current))
  }, [generationId, mediaItems, sortMode, type])
  const uploadEnabled = form.type === 'image' ? settings.imageUploadEnabled : settings.videoUploadEnabled
  const fileLimit = form.type === 'image' ? imageLimit : videoLimit
  const hasStorageQuota = storageStatus.totalBytes > 0

  async function refreshMedia() {
    if (!supabase) {
      setError('尚未配置 Supabase，无法使用真实媒体上传功能。')
      setLoading(false)
      return
    }

    setLoading(true)
    const [publicData, nextSettings, nextStorageStatus] = await Promise.all([
      loadPublicData(),
      loadSettings(),
      loadMediaStorageStatus(),
    ])

    setGenerations(publicData.generations.map((item) => ({ id: item.id, name: item.name })))
    setMediaItems(publicData.media)
    setSettings(nextSettings)
    setStorageStatus(nextStorageStatus)
    setError('')
    if (!nextSettings.videoUploadEnabled && form.type === 'video') setForm((current) => ({ ...current, type: 'image' }))
    setLoading(false)
  }

  useEffect(() => {
    refreshMedia().catch((err) => {
      setError(err instanceof Error ? err.message : '媒体数据加载失败。')
      setLoading(false)
    })
  }, [])

  function handleFileChange(nextFiles: FileList | null) {
    const selectedFiles = Array.from(nextFiles ?? [])
    const normalizedFiles = form.type === 'image' ? appendUniqueFiles(files, selectedFiles) : selectedFiles.slice(0, 1)
    setFiles(normalizedFiles)
    const oversized = normalizedFiles.find((file) => file.size > fileLimit)
    if (oversized) setError(`${form.type === 'image' ? '图片' : '视频'}文件过大，当前最多支持${form.type === 'image' ? '10MB' : '100MB'}。`)
    else setError('')
  }

  function removeSelectedFile(file: File) {
    setFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)))
    setError('')
  }

  async function uploadAsset(file: File, folder: string) {
    if (!supabase) throw new Error('尚未配置 Supabase。')
    const extension = file.name.split('.').pop() ?? 'file'
    const filePath = `${folder}/${crypto.randomUUID()}.${extension}`
    const uploadResult = await supabase.storage.from('media').upload(filePath, file)
    if (uploadResult.error) throw uploadResult.error
    return supabase.storage.from('media').getPublicUrl(filePath).data.publicUrl
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase || !files.length || !uploadEnabled) return

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
    const oversized = files.find((file) => file.size > fileLimit)
    if (oversized) {
      setError(`${form.type === 'image' ? '图片' : '视频'}文件过大，当前最多支持${form.type === 'image' ? '10MB' : '100MB'}。`)
      return
    }
    if (hasStorageQuota && totalBytes > storageStatus.remainingBytes) {
      setError(`媒体库剩余空间不足，当前还可用 ${formatStorageSize(storageStatus.remainingBytes)}。`)
      return
    }

    setUploading(true)
    setError('')

    try {
      const uploadedFiles = await Promise.all(files.map((file) => uploadAsset(file, form.type)))
      const primaryUrl = uploadedFiles[0] ?? ''
      const { data: insertedMedia, error: insertError } = await supabase.from('media_items').insert({
        type: form.type,
        title: form.title,
        file_url: primaryUrl,
        cover_url: primaryUrl,
        generation_id: form.generationId || null,
        activity_name: form.uploaderName || null,
        taken_date: form.takenDate || null,
        year: form.takenDate ? Number(form.takenDate.slice(0, 4)) : null,
        tags: form.takenDate ? [form.takenDate] : [],
        is_public: true,
        edit_password_hash: null,
      }).select('id').single()
      if (insertError || !insertedMedia) throw insertError ?? new Error('媒体创建失败。')

      const assetRows = uploadedFiles.map((url, index) => ({
        media_item_id: insertedMedia.id,
        file_url: url,
        cover_url: form.type === 'video' ? primaryUrl : null,
        asset_type: form.type,
        sort_order: index,
      }))
      const { error: assetError } = await supabase.from('media_item_assets').insert(assetRows)
      if (assetError) throw assetError

      if (form.editPassword) {
        const { data: passwordOk, error: passwordError } = await supabase.rpc('set_media_edit_password', {
          media_id: insertedMedia.id,
          plain_password: form.editPassword,
        })
        if (passwordError) throw passwordError
        if (!passwordOk) throw new Error('编辑密码设置失败。')
      }

      setForm(emptyUploadForm)
      setFiles([])
      await refreshMedia()
    } catch (err) {
      setError(err instanceof Error ? err.message : '媒体上传失败。')
    }

    setUploading(false)
  }

  return (
    <div className="page-stack narrow">
      <div className="page-heading">
        <span className="eyebrow">媒体资料</span>
        <h1>图片与视频资料</h1>
        <p>图片支持一次填写资料后批量上传，适合按一次活动整理成相册；点进卡片可查看全部照片。</p>
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
          <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="活动标题" disabled={!hasSupabaseConfig || !uploadEnabled} required />
          <select value={form.type} onChange={(event) => { setForm((current) => ({ ...current, type: event.target.value as 'image' | 'video' })); setFiles([]); setError('') }} disabled={!hasSupabaseConfig}>
            {settings.imageUploadEnabled && <option value="image">照片相册</option>}
            {settings.videoUploadEnabled && <option value="video">视频</option>}
          </select>
          <select value={form.generationId} onChange={(event) => setForm((current) => ({ ...current, generationId: event.target.value }))} disabled={!hasSupabaseConfig || !uploadEnabled}>
            <option value="">不关联届次</option>
            {generations.map((generation) => <option key={generation.id} value={generation.id}>{generation.name}</option>)}
          </select>
          <input value={form.uploaderName} onChange={(event) => setForm((current) => ({ ...current, uploaderName: event.target.value }))} placeholder="上传者姓名" disabled={!hasSupabaseConfig || !uploadEnabled} />
          <input value={form.takenDate} onChange={(event) => setForm((current) => ({ ...current, takenDate: event.target.value }))} type="date" placeholder="日期" disabled={!hasSupabaseConfig || !uploadEnabled} />
          <input value={form.editPassword} onChange={(event) => setForm((current) => ({ ...current, editPassword: event.target.value }))} type="password" placeholder="设置编辑密码（可留空）" disabled={!hasSupabaseConfig || !uploadEnabled} />
          <input type="file" multiple={form.type === 'image'} accept={form.type === 'image' ? 'image/*' : 'video/*'} onChange={(event) => { handleFileChange(event.target.files); event.currentTarget.value = '' }} disabled={!hasSupabaseConfig || !uploadEnabled} required={!files.length} />
          {files.length > 0 && (
            <div className="selected-file-list">
              <strong>待上传 {files.length} 个文件</strong>
              {files.map((file) => (
                <span key={fileKey(file)}>
                  {file.name}
                  <button type="button" className="secondary-button" onClick={() => removeSelectedFile(file)}>移除</button>
                </span>
              ))}
            </div>
          )}
          <small>{form.type === 'image' ? '可分多次选择照片，系统会累加到同一批待上传列表；设置编辑密码后，后续修改需要输入该密码；不设置则允许所有人修改。' : '视频仍保持单条上传；设置编辑密码后，后续修改需要输入该密码；不设置则允许所有人修改。'}</small>
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
        <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
          <option value="takenDate">按填写日期排序</option>
          <option value="uploadTime">按上传时间排序</option>
        </select>
      </section>
      <section className="media-grid">
        {loading ? <p>媒体加载中...</p> : filteredMedia.length ? filteredMedia.map((item) => {
          const primaryAsset = item.assets[0]
          return (
            <article className="media-card large" key={item.id}>
              {item.type === 'video' ? (
                <video src={primaryAsset?.file_url ?? item.file_url} poster={primaryAsset?.cover_url ?? item.cover_url ?? undefined} controls />
              ) : (
                <Link to={`/media/${item.id}`} className="media-cover-link">
                  {primaryAsset?.file_url || item.file_url ? <img src={primaryAsset?.file_url ?? item.file_url} alt={item.title} /> : <div className="media-placeholder">暂无图片</div>}
                </Link>
              )}
              <div>
                <strong>{item.title}</strong>
                <span>{item.type === 'video' ? '视频' : `图片 · 共 ${item.asset_count} 张`} · 上传者：{item.activity_name ?? '未填写'} · 日期：{item.taken_date ?? item.year ?? '未填写'}</span>
                <div className="tag-list">
                  {item.generation_id && <em>{generations.find((generation) => generation.id === item.generation_id)?.name}</em>}
                  {item.type === 'image' && item.asset_count > 1 && <em>{item.asset_count} 张图片</em>}
                </div>
                <div className="form-actions media-card-actions">
                  <Link className="secondary-button" to={`/media/${item.id}`}>{item.type === 'image' ? '查看相册' : '查看详情'}</Link>
                  <Link className="secondary-button" to={`/media/${item.id}`}>编辑资料</Link>
                  {item.type === 'image' && primaryAsset?.file_url && <a href={primaryAsset.file_url} download target="_blank" rel="noreferrer">下载首图</a>}
                </div>
              </div>
            </article>
          )
        }) : <p className="empty-state">暂无相关资料。</p>}
      </section>
    </div>
  )
}
