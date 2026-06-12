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

const emptyForm: GenerateForm = {
  prompt: '',
  resolution: '4K',
  quality: 'high',
  count: 1,
}

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

function buildWorkTitle(prompt: string, index: number) {
  const trimmed = prompt.trim()
  return trimmed ? `${trimmed.slice(0, 24)}${trimmed.length > 24 ? '...' : ''} #${index + 1}` : `作品 ${index + 1}`
}

function buildDownloadFileName(prompt: string, index: number) {
  const base = prompt.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
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

export function GeneratePage() {
  const [mode, setMode] = useState<GenerateMode>('text-to-image')
  const [form, setForm] = useState<GenerateForm>(emptyForm)
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])
  const [galleryItems, setGalleryItems] = useState<PublicGeneratedGalleryItem[]>([])
  const [results, setResults] = useState<GeneratedResult[]>([])
  const [loadingGallery, setLoadingGallery] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingIds, setSavingIds] = useState<string[]>([])
  const [error, setError] = useState('')

  const countOptions = useMemo(() => [1, 2, 3, 4], [])

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
    setReferenceFiles((current) => appendUniqueFiles(current, Array.from(nextFiles ?? [])))
  }

  function removeReferenceFile(file: File) {
    setReferenceFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)))
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
        ? await Promise.all(referenceFiles.map((file) => readFileAsDataUrl(file)))
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
    }

    setGenerating(false)
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
    }

    setSavingIds((current) => current.filter((id) => id !== result.id))
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
            {results.map((result, index) => (
              <article className="media-card large generated-card" key={result.id}>
                {result.imageDataUrl || result.imageUrl ? (
                  <img src={result.imageDataUrl ?? result.imageUrl} alt={`生成结果 ${index + 1}`} />
                ) : (
                  <div className="media-placeholder">暂无图片</div>
                )}
                <div>
                  <strong>{buildWorkTitle(result.prompt, index)}</strong>
                  <span>{result.providerName || '当前供应商'} / {result.modelName || '默认模型'} / {result.resolution} / {result.quality}</span>
                  {result.revisedPrompt && <p className="generated-note">模型改写提示词：{result.revisedPrompt}</p>}
                  <div className="form-actions media-card-actions">
                    <button
                      type="button"
                      disabled={savingIds.includes(result.id)}
                      onClick={() => publishResult(result, index)}
                    >
                      {savingIds.includes(result.id) ? '保存中...' : '保存到作品集'}
                    </button>
                    {(result.imageDataUrl || result.imageUrl) && (
                      <a
                        className="secondary-button button-link"
                        href={result.imageDataUrl ?? result.imageUrl}
                        download={buildDownloadFileName(result.prompt, index)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        下载图片
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
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
            {galleryItems.map((item) => (
              <article className="media-card" key={item.id}>
                <img src={item.image_url} alt={item.title} />
                <div>
                  <strong>{item.title || '未命名作品'}</strong>
                  <span>{item.provider_name || '公开作品'} / {item.model || '默认模型'} / {new Date(item.created_at).toLocaleString()}</span>
                  <p className="generated-note">{item.prompt}</p>
                  <div className="tag-list">
                    <em>{item.mode === 'text-to-image' ? '文生图' : '图生图'}</em>
                    <em>{item.resolution}</em>
                    <em>{item.quality}</em>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">{loadingGallery ? '作品集加载中...' : '作品欣赏集还没有公开作品。'}</p>
        )}
      </section>
    </div>
  )
}
