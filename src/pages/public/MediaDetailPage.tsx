import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'
import { loadPublicData } from '../../lib/publicData'
import type { PublicGeneration, PublicMedia } from '../../lib/publicData'

type EditForm = {
  title: string
  generationId: string
  uploaderName: string
  takenDate: string
  isPublic: boolean
  password: string
  nextPassword: string
}

const emptyEditForm: EditForm = {
  title: '',
  generationId: '',
  uploaderName: '',
  takenDate: '',
  isPublic: true,
  password: '',
  nextPassword: '',
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function appendUniqueFiles(currentFiles: File[], nextFiles: File[]) {
  const filesByKey = new Map(currentFiles.map((file) => [fileKey(file), file]))
  nextFiles.forEach((file) => filesByKey.set(fileKey(file), file))
  return Array.from(filesByKey.values())
}

export function MediaDetailPage() {
  const { id } = useParams()
  const [media, setMedia] = useState<PublicMedia | null>(null)
  const [generations, setGenerations] = useState<PublicGeneration[]>([])
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm)
  const [pendingAssetFiles, setPendingAssetFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadMedia() {
    if (!supabase || !hasSupabaseConfig) {
      setError('尚未配置 Supabase，无法加载真实媒体详情。')
      return
    }

    const data = await loadPublicData()
    const current = data.media.find((item) => item.id === id) ?? null
    setMedia(current)
    setGenerations(data.generations)
    setError('')
  }

  useEffect(() => {
    loadMedia().catch((err) => setError(err instanceof Error ? err.message : '媒体详情加载失败。'))
  }, [id])

  function startEdit(item: PublicMedia) {
    setEditing(true)
    setPendingAssetFiles([])
    setEditForm({
      title: item.title,
      generationId: item.generation_id ?? '',
      uploaderName: item.activity_name ?? '',
      takenDate: item.taken_date ?? '',
      isPublic: item.is_public,
      password: '',
      nextPassword: '',
    })
    setError('')
  }

  function cancelEdit() {
    setEditing(false)
    setPendingAssetFiles([])
    setEditForm(emptyEditForm)
  }

  function handlePendingAssetFileChange(nextFiles: FileList | null) {
    setPendingAssetFiles((current) => appendUniqueFiles(current, Array.from(nextFiles ?? [])))
  }

  function removePendingAssetFile(file: File) {
    setPendingAssetFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)))
  }

  async function uploadAsset(file: File) {
    if (!supabase) throw new Error('尚未配置 Supabase。')
    const extension = file.name.split('.').pop() ?? 'file'
    const filePath = `image/${crypto.randomUUID()}.${extension}`
    const uploadResult = await supabase.storage.from('media').upload(filePath, file)
    if (uploadResult.error) throw uploadResult.error
    return supabase.storage.from('media').getPublicUrl(filePath).data.publicUrl
  }

  async function saveEdit(item: PublicMedia) {
    if (!supabase) return
    if (!editForm.title) {
      setError('请填写标题。')
      return
    }

    setSaving(true)
    setError('')

    try {
      const { data: updateOk, error: updateError } = await supabase.rpc('update_media_with_password', {
        media_id: item.id,
        plain_password: editForm.password,
        next_title: editForm.title,
        next_generation_id: editForm.generationId || null,
        next_activity_name: editForm.uploaderName || null,
        next_taken_date: editForm.takenDate || null,
        next_is_public: editForm.isPublic,
      })
      if (updateError) throw updateError
      if (!updateOk) throw new Error('编辑密码不正确。')

      if (editForm.nextPassword) {
        const { data: passwordOk, error: passwordError } = await supabase.rpc('change_media_edit_password_with_password', {
          media_id: item.id,
          old_password: editForm.password,
          new_password: editForm.nextPassword,
        })
        if (passwordError) throw passwordError
        if (!passwordOk) throw new Error('编辑密码不正确。')
      }

      if (item.type === 'image' && pendingAssetFiles.length) {
        const uploadedFiles = await Promise.all(pendingAssetFiles.map((file) => uploadAsset(file)))
        for (const url of uploadedFiles) {
          const { data: assetOk, error: assetError } = await supabase.rpc('add_media_asset_with_password', {
            media_id: item.id,
            plain_password: editForm.password,
            next_file_url: url,
            next_cover_url: null,
            next_asset_type: 'image',
          })
          if (assetError) throw assetError
          if (!assetOk) throw new Error('编辑密码不正确。')
        }
      }

      await loadMedia()
      cancelEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : '媒体更新失败。')
    }

    setSaving(false)
  }

  async function deleteAsset(item: PublicMedia, assetId: string) {
    if (!supabase) return
    if (item.asset_count <= 1) {
      setError('相册至少保留一张图片。')
      return
    }

    const { data: deleteOk, error: deleteError } = await supabase.rpc('delete_media_asset_with_password', {
      media_id: item.id,
      asset_id: assetId,
      plain_password: editForm.password,
    })
    if (deleteError) setError(deleteError.message)
    else if (!deleteOk) setError('编辑密码不正确，或相册只剩最后一张图片。')
    else await loadMedia()
  }

  async function setPrimaryAsset(item: PublicMedia, assetId: string) {
    if (!supabase) return
    const { data: updateOk, error: updateError } = await supabase.rpc('set_media_primary_asset_with_password', {
      media_id: item.id,
      asset_id: assetId,
      plain_password: editForm.password,
    })
    if (updateError) setError(updateError.message)
    else if (!updateOk) setError('编辑密码不正确。')
    else await loadMedia()
  }

  if (!media) {
    return <div className="page-stack narrow">{error && <section className="section-card status-warn">{error}</section>}<section className="section-card">该媒体不存在或已被删除。</section></div>
  }

  const primaryAsset = media.assets[0]

  return (
    <div className="page-stack narrow">
      {error && <section className="section-card status-warn">{error}</section>}
      <section className="section-card media-detail-card">
        <div className="section-title">
          <div>
            <span className="eyebrow">媒体详情</span>
            <h1>{media.title}</h1>
          </div>
          <Link to="/media">返回媒体资料</Link>
        </div>
        {media.type === 'video' ? (
          <video className="media-detail-video" src={primaryAsset?.file_url ?? media.file_url} poster={primaryAsset?.cover_url ?? media.cover_url ?? undefined} controls />
        ) : (
          <div className="media-detail-main-image">
            <img src={primaryAsset?.file_url ?? media.file_url} alt={media.title} />
          </div>
        )}
        <p>{media.type === 'video' ? '视频' : `图片 · 共 ${media.asset_count} 张`} · 上传者：{media.activity_name ?? '未填写'} · 日期：{media.taken_date ?? media.year ?? '未填写'}</p>
        <div className="tag-list">
          {media.generation_id && <em>{generations.find((generation) => generation.id === media.generation_id)?.name}</em>}
          {!media.is_public && <em>未公开</em>}
        </div>
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={() => editing ? cancelEdit() : startEdit(media)}>{editing ? '取消编辑' : '编辑资料'}</button>
          {media.type === 'image' && primaryAsset?.file_url && <a href={primaryAsset.file_url} download target="_blank" rel="noreferrer">下载首图</a>}
        </div>
      </section>

      {media.type === 'image' && (
        <section className="section-card">
          <div className="section-title"><h2>全部照片</h2><span>{media.asset_count} 张</span></div>
          <div className="media-detail-gallery">
            {media.assets.map((asset, index) => (
              <article className="media-detail-photo" key={asset.id}>
                <img src={asset.file_url} alt={`${media.title}-${index + 1}`} />
                <div className="form-actions">
                  <a href={asset.file_url} download target="_blank" rel="noreferrer">下载</a>
                  {editing && media.asset_count > 1 && <button type="button" className="secondary-button" onClick={() => deleteAsset(media, asset.id)}>删除</button>}
                  {editing && media.assets[0]?.id !== asset.id && <button type="button" className="secondary-button" onClick={() => setPrimaryAsset(media, asset.id)}>设为首图</button>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {editing && (
        <section className="section-card form-card">
          <h2>编辑资料</h2>
          <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} placeholder="活动标题" />
          <select value={editForm.generationId} onChange={(event) => setEditForm((current) => ({ ...current, generationId: event.target.value }))}>
            <option value="">不关联届次</option>
            {generations.map((generation) => <option key={generation.id} value={generation.id}>{generation.name}</option>)}
          </select>
          <input value={editForm.uploaderName} onChange={(event) => setEditForm((current) => ({ ...current, uploaderName: event.target.value }))} placeholder="上传者姓名" />
          <input value={editForm.takenDate} onChange={(event) => setEditForm((current) => ({ ...current, takenDate: event.target.value }))} type="date" />
          <label><input type="checkbox" checked={editForm.isPublic} onChange={(event) => setEditForm((current) => ({ ...current, isPublic: event.target.checked }))} /> 公开显示</label>
          <input value={editForm.password} onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))} type="password" placeholder="当前编辑密码（未设置可留空）" />
          <input value={editForm.nextPassword} onChange={(event) => setEditForm((current) => ({ ...current, nextPassword: event.target.value }))} type="password" placeholder="修改为新编辑密码（可选）" />
          {media.type === 'image' && <input type="file" multiple accept="image/*" onChange={(event) => { handlePendingAssetFileChange(event.target.files); event.currentTarget.value = '' }} />}
          {pendingAssetFiles.length > 0 && (
            <div className="selected-file-list">
              <strong>待追加 {pendingAssetFiles.length} 张图片</strong>
              {pendingAssetFiles.map((file) => (
                <span key={fileKey(file)}>
                  {file.name}
                  <button type="button" className="secondary-button" onClick={() => removePendingAssetFile(file)}>移除</button>
                </span>
              ))}
            </div>
          )}
          <div className="form-actions"><button type="button" disabled={saving} onClick={() => saveEdit(media)}>{saving ? '保存中...' : '保存修改'}</button></div>
        </section>
      )}
    </div>
  )
}
