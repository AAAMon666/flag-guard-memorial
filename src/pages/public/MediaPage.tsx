import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../lib/AuthContext'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'
import { defaultMediaStorageStatus, defaultSettings, formatStorageSize, loadMediaStorageStatus, loadPublicData, loadSettings } from '../../lib/publicData'
import type { MediaStorageStatus, PublicMedia, PublicSettings } from '../../lib/publicData'

type GenerationOption = { id: string; name: string }

type UploadForm = {
  title: string
  type: 'image' | 'video'
  generationId: string
  uploaderName: string
  takenDate: string
  editPassword: string
}

type EditForm = {
  title: string
  generationId: string
  uploaderName: string
  takenDate: string
  isPublic: boolean
  password: string
  nextPassword: string
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

const emptyEditForm: EditForm = {
  title: '',
  generationId: '',
  uploaderName: '',
  takenDate: '',
  isPublic: true,
  password: '',
  nextPassword: '',
}

export function MediaPage() {
  const { session } = useAuth()
  const [type, setType] = useState('all')
  const [generationId, setGenerationId] = useState('')
  const [generations, setGenerations] = useState<GenerationOption[]>([])
  const [mediaItems, setMediaItems] = useState<PublicMedia[]>([])
  const [settings, setSettings] = useState<PublicSettings>(defaultSettings)
  const [storageStatus, setStorageStatus] = useState<MediaStorageStatus>(defaultMediaStorageStatus)
  const [form, setForm] = useState<UploadForm>(emptyUploadForm)
  const [files, setFiles] = useState<File[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm)
  const [pendingAssetFiles, setPendingAssetFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [error, setError] = useState('')

  const filteredMedia = useMemo(() => mediaItems.filter((item) => (type === 'all' || item.type === type) && (!generationId || item.generation_id === generationId)), [generationId, mediaItems, type])
  const uploadEnabled = form.type === 'image' ? settings.imageUploadEnabled : settings.videoUploadEnabled
  const fileLimit = form.type === 'image' ? imageLimit : videoLimit
  const hasStorageQuota = storageStatus.totalBytes > 0
  const canAdminEdit = Boolean(session)

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
    const normalizedFiles = Array.from(nextFiles ?? [])
    setFiles(normalizedFiles)
    const oversized = normalizedFiles.find((file) => file.size > fileLimit)
    if (oversized) setError(`${form.type === 'image' ? '图片' : '视频'}文件过大，当前最多支持${form.type === 'image' ? '10MB' : '100MB'}。`)
    else setError('')
  }

  function openEdit(item: PublicMedia) {
    setEditingId(item.id)
    setExpandedId(item.id)
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

  function closeEdit() {
    setEditingId(null)
    setPendingAssetFiles([])
    setEditForm(emptyEditForm)
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
    if (!supabase || !files.length || !uploadEnabled || !form.editPassword) return

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
      const payload = {
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
      }

      const { data: insertedMedia, error: insertError } = await supabase.from('media_items').insert(payload).select('id').single()
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

      const { data: passwordOk, error: passwordError } = await supabase.rpc('set_media_edit_password', {
        media_id: insertedMedia.id,
        plain_password: form.editPassword,
      })
      if (passwordError) throw passwordError
      if (!passwordOk) throw new Error('编辑密码设置失败。')

      setForm(emptyUploadForm)
      setFiles([])
      await refreshMedia()
    } catch (err) {
      setError(err instanceof Error ? err.message : '媒体上传失败。')
    }

    setUploading(false)
  }

  async function handleSaveEdit(item: PublicMedia) {
    if (!supabase) return
    if (!editForm.title || (!canAdminEdit && !editForm.password)) {
      setError(canAdminEdit ? '请填写标题。' : '请填写标题和编辑密码。')
      return
    }

    setSavingEdit(true)
    setError('')

    try {
      if (canAdminEdit) {
        const { error: updateError } = await supabase.from('media_items').update({
          title: editForm.title,
          generation_id: editForm.generationId || null,
          activity_name: editForm.uploaderName || null,
          taken_date: editForm.takenDate || null,
          year: editForm.takenDate ? Number(editForm.takenDate.slice(0, 4)) : null,
          tags: editForm.takenDate ? [editForm.takenDate] : [],
          is_public: editForm.isPublic,
          updated_at: new Date().toISOString(),
        }).eq('id', item.id)
        if (updateError) throw updateError

        if (editForm.nextPassword) {
          const { error: passwordError } = await supabase.rpc('admin_update_media_edit_password', {
            media_id: item.id,
            new_password: editForm.nextPassword,
          })
          if (passwordError) throw passwordError
        }
      } else {
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
      }

      if (item.type === 'image' && pendingAssetFiles.length) {
        const uploadedFiles = await Promise.all(pendingAssetFiles.map((file) => uploadAsset(file, 'image')))
        if (canAdminEdit) {
          const assetRows = uploadedFiles.map((url, index) => ({
            media_item_id: item.id,
            file_url: url,
            cover_url: null,
            asset_type: 'image',
            sort_order: item.asset_count + index,
          }))
          const { error: assetError } = await supabase.from('media_item_assets').insert(assetRows)
          if (assetError) throw assetError
        } else {
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
      }

      await refreshMedia()
      closeEdit()
    } catch (err) {
      setError(err instanceof Error ? err.message : '媒体更新失败。')
    }

    setSavingEdit(false)
  }

  async function deleteAsset(item: PublicMedia, assetId: string) {
    if (!supabase) return
    if (item.asset_count <= 1) {
      setError('相册至少保留一张图片。')
      return
    }
    if (canAdminEdit) {
      const { error: deleteError } = await supabase.from('media_item_assets').delete().eq('id', assetId)
      if (deleteError) {
        setError(deleteError.message)
        return
      }
      await refreshMedia()
      return
    }

    const { data: deleteOk, error: deleteError } = await supabase.rpc('delete_media_asset_with_password', {
      media_id: item.id,
      asset_id: assetId,
      plain_password: editForm.password,
    })
    if (deleteError) setError(deleteError.message)
    else if (!deleteOk) setError('编辑密码不正确，或相册只剩最后一张图片。')
    else await refreshMedia()
  }

  async function setPrimaryAsset(item: PublicMedia, assetId: string) {
    if (!supabase) return
    const client = supabase
    const asset = item.assets.find((current) => current.id === assetId)
    if (!asset) return

    if (!canAdminEdit) {
      const { data: updateOk, error: updateError } = await client.rpc('set_media_primary_asset_with_password', {
        media_id: item.id,
        asset_id: assetId,
        plain_password: editForm.password,
      })
      if (updateError) setError(updateError.message)
      else if (!updateOk) setError('编辑密码不正确。')
      else await refreshMedia()
      return
    }

    const sortedIds = [assetId, ...item.assets.filter((current) => current.id !== assetId).map((current) => current.id)]
    const updates = sortedIds.map((id, index) => client.from('media_item_assets').update({ sort_order: index }).eq('id', id))
    const updateResults = await Promise.all(updates)
    const failed = updateResults.find((result) => result.error)
    if (failed?.error) {
      setError(failed.error.message)
      return
    }

    const { error: coverError } = await client.from('media_items').update({
      file_url: asset.file_url,
      cover_url: asset.cover_url ?? asset.file_url,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id)
    if (coverError) setError(coverError.message)
    else await refreshMedia()
  }

  return (
    <div className="page-stack narrow">
      <div className="page-heading">
        <span className="eyebrow">媒体资料</span>
        <h1>图片与视频资料</h1>
        <p>图片支持一次填写资料后批量上传，适合按一次活动整理成相册；视频仍按单条发布。</p>
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
          <input value={form.editPassword} onChange={(event) => setForm((current) => ({ ...current, editPassword: event.target.value }))} type="password" placeholder="设置编辑密码" disabled={!hasSupabaseConfig || !uploadEnabled} required />
          <input type="file" multiple={form.type === 'image'} accept={form.type === 'image' ? 'image/*' : 'video/*'} onChange={(event) => handleFileChange(event.target.files)} disabled={!hasSupabaseConfig || !uploadEnabled} required />
          <small>{form.type === 'image' ? '可一次选择多张图片；以后修改标题、日期或补传图片时，需要输入这里设置的编辑密码。' : '视频仍保持单条上传；后续修改文案也需要编辑密码。'}</small>
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
      <section className="media-grid media-grid-wide">
        {loading ? <p>媒体加载中...</p> : filteredMedia.length ? filteredMedia.map((item) => {
          const expanded = expandedId === item.id
          const editing = editingId === item.id
          const primaryAsset = item.assets[0]
          return (
            <article className="media-card large media-album-card" key={item.id}>
              {item.type === 'video'
                ? <video src={primaryAsset?.file_url ?? item.file_url} poster={primaryAsset?.cover_url ?? item.cover_url ?? undefined} controls />
                : (primaryAsset?.file_url || item.file_url ? <img src={primaryAsset?.file_url ?? item.file_url} alt={item.title} /> : <div className="media-placeholder">暂无图片</div>)}
              <div>
                <strong>{item.title}</strong>
                <span>{item.type === 'video' ? '视频' : `图片 · 共 ${item.asset_count} 张`} · 上传者：{item.activity_name ?? '未填写'} · 日期：{item.taken_date ?? item.year ?? '未填写'}</span>
                <div className="tag-list">
                  {item.generation_id && <em>{generations.find((generation) => generation.id === item.generation_id)?.name}</em>}
                  {item.type === 'image' && item.asset_count > 1 && <em>{item.asset_count} 张图片</em>}
                </div>
                <div className="form-actions media-card-actions">
                  {item.type === 'image' && <button type="button" className="secondary-button" onClick={() => setExpandedId(expanded ? null : item.id)}>{expanded ? '收起图片' : '展开图片'}</button>}
                  <button type="button" className="secondary-button" onClick={() => editing ? closeEdit() : openEdit(item)}>{editing ? '取消编辑' : '编辑资料'}</button>
                  {item.type === 'image' && primaryAsset?.file_url && <a href={primaryAsset.file_url} download target="_blank" rel="noreferrer">下载首图</a>}
                </div>

                {expanded && item.type === 'image' && (
                  <div className="media-album-grid">
                    {item.assets.map((asset) => (
                      <div className="media-album-tile" key={asset.id}>
                        <img src={asset.file_url} alt={item.title} />
                        <div className="form-actions">
                          <a href={asset.file_url} download target="_blank" rel="noreferrer">下载</a>
                          {editing && item.asset_count > 1 && <button type="button" className="secondary-button" onClick={() => deleteAsset(item, asset.id)}>删除</button>}
                          {editing && item.assets[0]?.id !== asset.id && <button type="button" className="secondary-button" onClick={() => setPrimaryAsset(item, asset.id)}>设为首图</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {editing && (
                  <div className="media-edit-panel">
                    <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} placeholder="活动标题" />
                    <select value={editForm.generationId} onChange={(event) => setEditForm((current) => ({ ...current, generationId: event.target.value }))}>
                      <option value="">不关联届次</option>
                      {generations.map((generation) => <option key={generation.id} value={generation.id}>{generation.name}</option>)}
                    </select>
                    <input value={editForm.uploaderName} onChange={(event) => setEditForm((current) => ({ ...current, uploaderName: event.target.value }))} placeholder="上传者姓名" />
                    <input value={editForm.takenDate} onChange={(event) => setEditForm((current) => ({ ...current, takenDate: event.target.value }))} type="date" />
                    <label><input type="checkbox" checked={editForm.isPublic} onChange={(event) => setEditForm((current) => ({ ...current, isPublic: event.target.checked }))} /> 公开显示</label>
                    {!canAdminEdit && <input value={editForm.password} onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))} type="password" placeholder="当前编辑密码" />}
                    <input value={editForm.nextPassword} onChange={(event) => setEditForm((current) => ({ ...current, nextPassword: event.target.value }))} type="password" placeholder={canAdminEdit ? '管理员重置新密码（可选）' : '修改为新密码（可选）'} />
                    {item.type === 'image' && <input type="file" multiple accept="image/*" onChange={(event) => setPendingAssetFiles(Array.from(event.target.files ?? []))} />}
                    {item.type === 'image' && pendingAssetFiles.length > 0 && <small>待追加 {pendingAssetFiles.length} 张图片。</small>}
                    <div className="form-actions">
                      <button type="button" disabled={savingEdit} onClick={() => handleSaveEdit(item)}>{savingEdit ? '保存中...' : '保存修改'}</button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          )
        }) : <p className="empty-state">暂无相关资料。</p>}
      </section>
    </div>
  )
}
