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
      else reject(new Error('鍙傝€冨浘璇诲彇澶辫触銆?))
    }
    reader.onerror = () => reject(new Error('鍙傝€冨浘璇诲彇澶辫触銆?))
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
      reject(new Error('鍙傝€冨浘璇诲彇澶辫触銆?))
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
    throw new Error('鍙傝€冨浘澶勭悊澶辫触锛岃閲嶈瘯銆?)
  }

  context.drawImage(image, 0, 0, width, height)

  const createBlob = (quality: number) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('鍙傝€冨浘澶勭悊澶辫触锛岃閲嶈瘯銆?))
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
  return trimmed ? `${trimmed.slice(0, 24)}${trimmed.length > 24 ? '...' : ''} #${index + 1}` : `浣滃搧 ${index + 1}`
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
    throw new Error('涓嬭浇浣滃搧澶辫触锛岃绋嶅悗閲嶈瘯銆?)
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
  return `${result.providerName || '褰撳墠渚涘簲鍟?} / ${result.modelName || '榛樿妯″瀷'} / ${result.resolution} / ${result.quality}`
}

function buildGalleryMeta(item: PublicGeneratedGalleryItem) {
  return `${item.provider_name || '鍏紑浣滃搧'} / ${item.model || '榛樿妯″瀷'} / ${new Date(item.created_at).toLocaleString()}`
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
      setError(err instanceof Error ? err.message : '浣滃搧闆嗗姞杞藉け璐ャ€?)
      setLoadingGallery(false)
    })
  }, [])

  function handleReferenceFileChange(nextFiles: FileList | null) {
    const selectedFiles = Array.from(nextFiles ?? [])
    const validFiles = selectedFiles.filter((file) => supportedReferenceTypes.has(file.type))
    const invalidFiles = selectedFiles.filter((file) => !supportedReferenceTypes.has(file.type))

    setReferenceFiles((current) => appendUniqueFiles(current, validFiles))

    if (invalidFiles.length > 0) {
      setError('鍥剧敓鍥惧綋鍓嶆敮鎸?JPG銆丳NG銆乄ebP 鏍煎紡銆?)
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
      title: item.title || `浣滃搧 ${index + 1}`,
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
      setError(err instanceof Error ? err.message : '涓嬭浇浣滃搧澶辫触锛岃绋嶅悗閲嶈瘯銆?)
    } finally {
      setDownloadingName('')
    }
  }

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase || !hasSupabaseConfig) {
      setError('灏氭湭閰嶇疆 Supabase锛屾殏鏃舵棤娉曚娇鐢ㄧ敓鍥炬湇鍔°€?)
      return
    }
    if (!form.prompt.trim()) {
      setError('璇疯緭鍏ユ彁绀鸿瘝銆?)
      return
    }
    if (mode === 'image-to-image' && referenceFiles.length === 0) {
      setError('鍥剧敓鍥捐嚦灏戦渶瑕佷笂浼犱竴寮犲弬鑰冨浘銆?)
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
      setError(await extractFunctionErrorMessage(err, '鐢熷浘澶辫触銆?))
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
      setError(await extractFunctionErrorMessage(err, '淇濆瓨浣滃搧澶辫触銆?))
    } finally {
      setSavingIds((current) => current.filter((id) => id !== result.id))
    }
  }

  return (
    <div className="page-stack narrow">
      <div className="page-heading">
        <span className="eyebrow">Image2 鐢熷浘</span>
        <h1>鏂囩敓鍥句笌鍥剧敓鍥?/h1>
        <p>鐢熸垚缁撴灉鍙繚鐣欏湪褰撳墠椤甸潰銆傚枩娆㈢殑鍥惧啀鎵嬪姩淇濆瓨杩涗綔鍝佹璧忛泦锛屾墠浼氳繘鍏ュ叕鍏卞睍绀恒€?/p>
      </div>

      {error && <section className="section-card status-warn">{error}</section>}

      <section className="section-card form-card">
        <div className="section-title">
          <h2>寮€濮嬬敓鍥?/h2>
          <span>{mode === 'text-to-image' ? '鏂囩敓鍥? : '鍥剧敓鍥?}</span>
        </div>

        <div className="segmented-control">
          <button type="button" className={mode === 'text-to-image' ? 'active' : 'secondary-button'} onClick={() => setMode('text-to-image')}>鏂囩敓鍥?/button>
          <button type="button" className={mode === 'image-to-image' ? 'active' : 'secondary-button'} onClick={() => setMode('image-to-image')}>鍥剧敓鍥?/button>
        </div>

        <form className="generate-form" onSubmit={handleGenerate}>
          <textarea
            value={form.prompt}
            onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))}
            placeholder="杈撳叆浣犳兂鐢熸垚鐨勭敾闈㈠唴瀹癸紝灏介噺鍏蜂綋涓€鐐广€?
            required
          />
          <small>鎻愮ず璇嶉噷鍐?A3銆?6:9銆佺珫鐗堛€佹捣鎶ヨ繖绫绘槑纭昂瀵告垨姣斾緥淇℃伅鏃讹紝浼氫紭鍏堟寜鎻愮ず璇嶅鐞嗭紝涓嶅啀寮哄埗濂楃敤鍥哄畾鐢诲竷姣斾緥銆?/small>

          <div className="generate-options">
            <label>
              <span>鍒嗚鲸鐜?/span>
              <select value={form.resolution} onChange={(event) => setForm((current) => ({ ...current, resolution: event.target.value as ResolutionOption }))}>
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
            </label>
            <label>
              <span>璐ㄩ噺</span>
              <select value={form.quality} onChange={(event) => setForm((current) => ({ ...current, quality: event.target.value as QualityOption }))}>
                <option value="low">浣?/option>
                <option value="medium">涓?/option>
                <option value="high">楂?/option>
              </select>
            </label>
            <label>
              <span>杈撳嚭寮犳暟</span>
              <select value={form.count} onChange={(event) => setForm((current) => ({ ...current, count: Number(event.target.value) }))}>
                {countOptions.map((count) => <option key={count} value={count}>{count} 寮?/option>)}
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
                  <strong>宸查€夋嫨 {referenceFiles.length} 寮犲弬鑰冨浘</strong>
                  {referenceFiles.map((file) => (
                    <span key={fileKey(file)}>
                      {file.name}
                      <button type="button" className="secondary-button" onClick={() => removeReferenceFile(file)}>绉婚櫎</button>
                    </span>
                  ))}
                </div>
              )}
              <small>鍥剧敓鍥句細鍏堣嚜鍔ㄥ帇缂╁弬鑰冨浘锛屽啀鍙戦€佺敓鎴愯姹傦紝浼樺厛閬垮厤鎵嬫満鍘熷浘杩囧ぇ瀵艰嚧涓婁紶澶辫触銆?/small>
            </>
          )}

          <div className="form-actions">
            <button disabled={generating || !hasSupabaseConfig}>{generating ? '鐢熸垚涓?..' : '寮€濮嬬敓鎴?}</button>
          </div>
        </form>
      </section>

      <section className="section-card">
        <div className="section-title">
          <h2>鏈鐢熸垚缁撴灉</h2>
          <span>{results.length ? `${results.length} 寮燻 : '鏈敓鎴?}</span>
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
                      <img src={imageUrl} alt={`鐢熸垚缁撴灉 ${index + 1}`} />
                    </button>
                  ) : (
                    <div className="media-placeholder">鏆傛棤鍥剧墖</div>
                  )}
                  <div>
                    <strong>{buildWorkTitle(result.prompt, index)}</strong>
                    <span>{buildResultMeta(result)}</span>
                    {result.revisedPrompt && <p className="generated-note">妯″瀷鏀瑰啓鎻愮ず璇嶏細{result.revisedPrompt}</p>}
                    <div className="form-actions media-card-actions">
                      <button
                        type="button"
                        disabled={savingIds.includes(result.id)}
                        onClick={() => publishResult(result, index)}
                      >
                        {savingIds.includes(result.id) ? '淇濆瓨涓?..' : '淇濆瓨鍒颁綔鍝侀泦'}
                      </button>
                      {imageUrl && (
                        <>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => openResultPreview(result, index)}
                          >
                            鏌ョ湅澶у浘
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={downloadingName === fileName}
                            onClick={() => handleDownload(imageUrl, fileName)}
                          >
                            {downloadingName === fileName ? '涓嬭浇涓?..' : '涓嬭浇鍥剧墖'}
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
          <p className="empty-state">褰撳墠杩樻病鏈夌敓鎴愮粨鏋滐紝杈撳叆鎻愮ず璇嶅悗鍗冲彲寮€濮嬨€?/p>
        )}
      </section>

      <section className="section-card">
        <div className="section-title">
          <h2>浣滃搧娆ｈ祻闆?/h2>
          <span>{loadingGallery ? '鍔犺浇涓?..' : `${galleryItems.length} 浠朵綔鍝乣}</span>
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
                    <strong>{item.title || '鏈懡鍚嶄綔鍝?}</strong>
                    <span>{buildGalleryMeta(item)}</span>
                    <p className="generated-note">{item.prompt}</p>
                    <div className="tag-list">
                      <em>{item.mode === 'text-to-image' ? '鏂囩敓鍥? : '鍥剧敓鍥?}</em>
                      <em>{item.resolution}</em>
                      <em>{item.quality}</em>
                    </div>
                    <div className="form-actions media-card-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openGalleryPreview(item, index)}
                      >
                        鏌ョ湅澶у浘
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={downloadingName === fileName}
                        onClick={() => handleDownload(item.image_url, fileName)}
                      >
                        {downloadingName === fileName ? '涓嬭浇涓?..' : '涓嬭浇浣滃搧'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="empty-state">{loadingGallery ? '浣滃搧闆嗗姞杞戒腑...' : '浣滃搧娆ｈ祻闆嗚繕娌℃湁鍏紑浣滃搧銆?}</p>
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
              <button type="button" className="secondary-button" onClick={() => setPreviewItem(null)}>鍏抽棴</button>
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
                {downloadingName === previewItem.fileName ? '涓嬭浇涓?..' : '涓嬭浇鍥剧墖'}
              </button>
              <button type="button" className="secondary-button" onClick={() => setPreviewItem(null)}>杩斿洖</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
