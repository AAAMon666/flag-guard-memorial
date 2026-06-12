import { useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'
import { loadGeneratedGalleryItems } from '../../lib/publicData'
import type { PublicGeneratedGalleryItem } from '../../lib/publicData'

type GenerateMode = 'text-to-image' | 'image-to-image'
type ResolutionOption = '1K' | '2K' | '4K'
type QualityOption = 'low' | 'medium' | 'high'

type GenerateForm = {
  prompt: string
  resolution: ResolutionOption
  quality: QualityOption
  count: number
}

type GeneratedResult = {
  id: string
  imageDataUrl?: string
  imageUrl?: string
  revisedPrompt?: string | null
  prompt: string
  resolution: ResolutionOption
  quality: QualityOption
  mode: GenerateMode
  providerName: string
  modelName: string
}

type PreviewItem = {
  title: string
  imageUrl: string
  prompt: string
  meta: string
  fileName: string
}

const emptyForm: GenerateForm = {
  prompt: '',
  resolution: '4K',
  quality: 'high',
  count: 1,
}

const supportedReferenceTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
const maxReferenceDimension = 1600
const referenceJpegQuality = 0.86
const referenceMaxBytes = 1.5 * 1024 * 1024

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function appendUniqueFiles(currentFiles: File[], nextFiles: File[]) {
  const filesByKey = new Map(currentFiles.map((file) => [fileKey(file), file]))
  nextFiles.forEach((file) => filesByKey.set(fileKey(file), file))
  return Array.from(filesByKey.values())
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('参考图读取失败。'))
    }
    reader.onerror = () => reject(new Error('参考图读取失败。'))
    reader.readAsDataURL(file)
  })
}

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('参考图读取失败。'))
    }

    image.src = objectUrl
  })
}

async function normalizeReferenceImage(file: File) {
  if (supportedReferenceTypes.has(file.type) && file.size <= 1024 * 1024) {
    return file
  }

  const image = await loadImageElement(file)
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight) || 1
  const scale = Math.min(1, maxReferenceDimension / longestEdge)
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('参考图处理失败，请重试。')
  }

  context.drawImage(image, 0, 0, width, height)

  const createBlob = (quality: number) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('参考图处理失败，请重试。'))
    }, 'image/jpeg', quality)
  })

  let normalizedBlob = await createBlob(referenceJpegQuality)
  if (normalizedBlob.size > referenceMaxBytes) {
    normalizedBlob = await createBlob(0.72)
  }

  const normalizedName = file.name.replace(/\.[^.]+$/, '') || 'reference-image'
  return new File([normalizedBlob], `${normalizedName}.jpg`, { type: 'image/jpeg' })
}

function buildWorkTitle(prompt: string, index: number) {
  const trimmed = prompt.trim()
  return trimmed ? `${trimmed.slice(0, 24)}${trimmed.length > 24 ? '...' : ''} #${index + 1}` : `作品 ${index + 1}`
}

function buildDownloadFileName(name: string, index = 0) {
  const base = name.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
  const safeBase = (base || `generated-${index + 1}`).slice(0, 40)
  return `${safeBase}-${index + 1}.png`
}

async function extractFunctionErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'context' in error) {
    const response = (error as { context?: unknown }).context
    if (response instanceof Response) {
      try {
        const payload = await response.clone().json() as { error?: unknown; message?: unknown }
        if (typeof payload.error === 'string' && payload.error.trim()) return payload.error
        if (typeof payload.message === 'string' && payload.message.trim()) return payload.message
      } catch {
        // ignore and fall back below
      }

      try {
        const text = (await response.clone().text()).trim()
        if (text) return text
      } catch {
        // ignore and fall back below
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

async function downloadImageFile(fileUrl: string, fileName: string) {
  if (typeof document === 'undefined') return

  const link = document.createElement('a')
  link.download = fileName

  if (fileUrl.startsWith('data:')) {
    link.href = fileUrl
    link.click()
    return
  }

  const response = await fetch(fileUrl)
  if (!response.ok) {
    throw new Error('下载作品失败，请稍后重试。')
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)

  try {
    link.href = objectUrl
    link.click()
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }
}

function buildResultMeta(result: GeneratedResult) {
  return `${result.providerName || '当前供应商'} / ${result.modelName || '默认模型'} / ${result.resolution} / ${result.quality}`
}

function buildGalleryMeta(item: PublicGeneratedGalleryItem) {
  return `${item.provider_name || '公开作品'} / ${item.model || '默认模型'} / ${new Date(item.created_at).toLocaleString()}`
}

export function GeneratePage() {
  const [mode, setMode] = useState<GenerateMode>('text-to-image')
  const [form, setForm] = useState<GenerateForm>(emptyForm)
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])
  const [galleryItems, setGalleryItems] = useState<PublicGeneratedGalleryItem[]>([])
  const [results, setResults] = useState<GeneratedResult[]>([])
  const [loadingGallery, setLoadingGallery] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingIds, setSavingIds] = useState<string[]>([])
  const [downloadingName, setDownloadingName] = useState('')
  const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null)
  const [error, setError] = useState('')

  const countOptions = useMemo(() => [1, 2, 3, 4], [])

  useEffect(() => {
    if (!previewItem) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewItem(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewItem])

  async function refreshGallery() {
    setLoadingGallery(true)
    try {
      setGalleryItems(await loadGeneratedGalleryItems())
    } finally {
      setLoadingGallery(false)
    }
  }

  useEffect(() => {
    refreshGallery().catch((err) => {
      setError(err instanceof Error ? err.message : '作品集加载失败。')
      setLoadingGallery(false)
    })
  }, [])

  function handleReferenceFileChange(nextFiles: FileList | null) {
    const selectedFiles = Array.from(nextFiles ?? [])
    const validFiles = selectedFiles.filter((file) => supportedReferenceTypes.has(file.type))
    const invalidFiles = selectedFiles.filter((file) => !supportedReferenceTypes.has(file.type))

    setReferenceFiles((current) => appendUniqueFiles(current, validFiles))

    if (invalidFiles.length > 0) {
      setError('图生图当前支持 JPG、PNG、WebP 格式。')
    } else {
      setError('')
    }
  }

  function removeReferenceFile(file: File) {
    setReferenceFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)))
  }

  function openResultPreview(result: GeneratedResult, index: number) {
    const imageUrl = result.imageDataUrl ?? result.imageUrl
    if (!imageUrl) return

    setPreviewItem({
      title: buildWorkTitle(result.prompt, index),
      imageUrl,
      prompt: result.prompt,
      meta: buildResultMeta(result),
      fileName: buildDownloadFileName(result.prompt, index),
    })
  }

  function openGalleryPreview(item: PublicGeneratedGalleryItem, index: number) {
    setPreviewItem({
      title: item.title || `作品 ${index + 1}`,
      imageUrl: item.image_url,
      prompt: item.prompt,
      meta: buildGalleryMeta(item),
      fileName: buildDownloadFileName(item.title || item.prompt || `gallery-${index + 1}`, index),
    })
  }

  async function handleDownload(fileUrl: string, fileName: string) {
    setDownloadingName(fileName)
    setError('')

    try {
      await downloadImageFile(fileUrl, fileName)
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载作品失败，请稍后重试。')
    } finally {
      setDownloadingName('')
    }
  }

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase || !hasSupabaseConfig) {
      setError('尚未配置 Supabase，暂时无法使用生图服务。')
      return
    }
    if (!form.prompt.trim()) {
      setError('请输入提示词。')
      return
    }
    if (mode === 'image-to-image' && referenceFiles.length === 0) {
      setError('图生图至少需要上传一张参考图。')
      return
    }

    setGenerating(true)
    setError('')

    try {
      const images = mode === 'image-to-image'
        ? await Promise.all(referenceFiles.map(async (file) => readFileAsDataUrl(await normalizeReferenceImage(file))))
        : []

      const { data, error: invokeError } = await supabase.functions.invoke('generate-image', {
        body: {
          mode,
          prompt: form.prompt,
          images,
          resolution: form.resolution,
          quality: form.quality,
          count: form.count,
        },
      })

      if (invokeError) throw invokeError
      if (data?.error) throw new Error(data.error)

      const nextProviderName = typeof data?.provider === 'string' ? data.provider : ''
      const nextModelName = typeof data?.model === 'string' ? data.model : ''

      setResults(
        Array.isArray(data?.images)
          ? data.images.map((item: GeneratedResult, index: number) => ({
              id: `${Date.now()}-${index}`,
              imageDataUrl: item.imageDataUrl,
              imageUrl: item.imageUrl,
              revisedPrompt: item.revisedPrompt ?? null,
              prompt: form.prompt,
              resolution: form.resolution,
              quality: form.quality,
              mode,
              providerName: nextProviderName,
              modelName: nextModelName,
            }))
          : [],
      )
    } catch (err) {
      setError(await extractFunctionErrorMessage(err, '生图失败。'))
      setResults([])
    } finally {
      setGenerating(false)
    }
  }

  async function publishResult(result: GeneratedResult, index: number) {
    if (!supabase) return

    setSavingIds((current) => [...current, result.id])
    setError('')

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('publish-generated-image', {
        body: {
          title: buildWorkTitle(result.prompt, index),
          prompt: result.prompt,
          mode: result.mode,
          quality: result.quality,
          resolution: result.resolution,
          providerName: result.providerName,
          model: result.modelName,
          imageDataUrl: result.imageDataUrl,
          imageUrl: result.imageUrl,
        },
      })

      if (invokeError) throw invokeError
      if (data?.error) throw new Error(data.error)

      await refreshGallery()
    } catch (err) {
      setError(await extractFunctionErrorMessage(err, '保存作品失败。'))
    } finally {
      setSavingIds((current) => current.filter((id) => id !== result.id))
    }
  }

  return (
    <div className="page-stack narrow">
      <div className="page-heading">
        <span className="eyebrow">Image2 生图</span>
        <h1>文生图与图生图</h1>
        <p>生成结果只保留在当前页面。喜欢的图再手动保存进作品欣赏集，才会进入公共展示。</p>
      </div>

      {error && <section className="section-card status-warn">{error}</section>}

      <section className="section-card form-card">
        <div className="section-title">
          <h2>开始生图</h2>
          <span>{mode === 'text-to-image' ? '文生图' : '图生图'}</span>
        </div>

        <div className="segmented-control">
          <button type="button" className={mode === 'text-to-image' ? 'active' : 'secondary-button'} onClick={() => setMode('text-to-image')}>文生图</button>
          <button type="button" className={mode === 'image-to-image' ? 'active' : 'secondary-button'} onClick={() => setMode('image-to-image')}>图生图</button>
        </div>

        <form className="generate-form" onSubmit={handleGenerate}>
          <textarea
            value={form.prompt}
            onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
            placeholder="输入你想生成的画面内容，尽量具体一点。"
            required
          />
          <small>提示词里写 A3、16:9、竖版、海报这类明确尺寸或比例信息时，会优先按提示词处理，不再强制套用固定画布比例。</small>

          <div className="generate-options">
            <label>
              <span>分辨率</span>
              <select value={form.resolution} onChange={(event) => setForm((current) => ({ ...current, resolution: event.target.value as ResolutionOption }))}>
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
            </label>
            <label>
              <span>质量</span>
              <select value={form.quality} onChange={(event) => setForm((current) => ({ ...current, quality: event.target.value as QualityOption }))}>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </label>
            <label>
              <span>输出张数</span>
              <select value={form.count} onChange={(event) => setForm((current) => ({ ...current, count: Number(event.target.value) }))}>
                {countOptions.map((count) => <option key={count} value={count}>{count} 张</option>)}
              </select>
            </label>
          </div>

          {mode === 'image-to-image' && (
            <>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  handleReferenceFileChange(event.target.files)
                  event.currentTarget.value = ''
                }}
              />
              {referenceFiles.length > 0 && (
                <div className="selected-file-list">
                  <strong>已选择 {referenceFiles.length} 张参考图</strong>
                  {referenceFiles.map((file) => (
                    <span key={fileKey(file)}>
                      {file.name}
                      <button type="button" className="secondary-button" onClick={() => removeReferenceFile(file)}>移除</button>
                    </span>
                  ))}
                </div>
              )}
              <small>图生图会先自动压缩参考图，再发送生成请求，优先避免手机原图过大导致上传失败。</small>
            </>
          )}

          <div className="form-actions">
            <button disabled={generating || !hasSupabaseConfig}>{generating ? '生成中...' : '开始生成'}</button>
          </div>
        </form>
      </section>

      <section className="section-card">
        <div className="section-title">
          <h2>本次生成结果</h2>
          <span>{results.length ? `${results.length} 张` : '未生成'}</span>
        </div>
        {results.length ? (
          <div className="media-grid generated-grid">
            {results.map((result, index) => {
              const imageUrl = result.imageDataUrl ?? result.imageUrl
              const fileName = buildDownloadFileName(result.prompt, index)

              return (
                <article className="media-card large generated-card" key={result.id}>
                  {imageUrl ? (
                    <button type="button" className="media-preview-button" onClick={() => openResultPreview(result, index)}>
                      <img src={imageUrl} alt={`生成结果 ${index + 1}`} />
                    </button>
                  ) : (
                    <div className="media-placeholder">暂无图片</div>
                  )}
                  <div>
                    <strong>{buildWorkTitle(result.prompt, index)}</strong>
                    <span>{buildResultMeta(result)}</span>
                    {result.revisedPrompt && <p className="generated-note">模型改写提示词：{result.revisedPrompt}</p>}
                    <div className="form-actions media-card-actions">
                      <button
                        type="button"
                        disabled={savingIds.includes(result.id)}
                        onClick={() => publishResult(result, index)}
                      >
                        {savingIds.includes(result.id) ? '保存中...' : '保存到作品集'}
                      </button>
                      {imageUrl && (
                        <>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => openResultPreview(result, index)}
                          >
                            查看大图
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={downloadingName === fileName}
                            onClick={() => handleDownload(imageUrl, fileName)}
                          >
                            {downloadingName === fileName ? '下载中...' : '下载图片'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="empty-state">当前还没有生成结果，输入提示词后即可开始。</p>
        )}
      </section>

      <section className="section-card">
        <div className="section-title">
          <h2>作品欣赏集</h2>
          <span>{loadingGallery ? '加载中...' : `${galleryItems.length} 件作品`}</span>
        </div>
        {galleryItems.length ? (
          <div className="media-grid generated-grid">
            {galleryItems.map((item, index) => {
              const fileName = buildDownloadFileName(item.title || item.prompt || `gallery-${index + 1}`, index)

              return (
                <article className="media-card" key={item.id}>
                  <button type="button" className="media-preview-button" onClick={() => openGalleryPreview(item, index)}>
                    <img src={item.image_url} alt={item.title} />
                  </button>
                  <div className="gallery-card-copy">
                    <strong>{item.title || '未命名作品'}</strong>
                    <span>{buildGalleryMeta(item)}</span>
                    <p className="generated-note">{item.prompt}</p>
                    <div className="tag-list">
                      <em>{item.mode === 'text-to-image' ? '文生图' : '图生图'}</em>
                      <em>{item.resolution}</em>
                      <em>{item.quality}</em>
                    </div>
                    <div className="form-actions media-card-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openGalleryPreview(item, index)}
                      >
                        查看大图
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={downloadingName === fileName}
                        onClick={() => handleDownload(item.image_url, fileName)}
                      >
                        {downloadingName === fileName ? '下载中...' : '下载作品'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="empty-state">{loadingGallery ? '作品集加载中...' : '作品欣赏集还没有公开作品。'}</p>
        )}
      </section>

      {previewItem && (
        <div className="preview-modal" role="dialog" aria-modal="true" onClick={() => setPreviewItem(null)}>
          <div className="preview-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="preview-modal-header">
              <div>
                <strong>{previewItem.title}</strong>
                <span>{previewItem.meta}</span>
              </div>
              <button type="button" className="secondary-button" onClick={() => setPreviewItem(null)}>关闭</button>
            </div>
            <div className="preview-modal-image">
              <img src={previewItem.imageUrl} alt={previewItem.title} />
            </div>
            <p className="generated-note">{previewItem.prompt}</p>
            <div className="form-actions">
              <button
                type="button"
                onClick={() => handleDownload(previewItem.imageUrl, previewItem.fileName)}
                disabled={downloadingName === previewItem.fileName}
              >
                {downloadingName === previewItem.fileName ? '下载中...' : '下载图片'}
              </button>
              <button type="button" className="secondary-button" onClick={() => setPreviewItem(null)}>返回</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
