import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/providerAccess.ts'
import { decryptProviderKey } from '../_shared/providerCrypto.ts'

type ResolutionOption = '1K' | '2K' | '4K'
type QualityOption = 'low' | 'medium' | 'high'
type GenerateMode = 'text-to-image' | 'image-to-image'

type GenerateRequest = {
  mode: GenerateMode
  prompt: string
  images?: string[]
  resolution?: ResolutionOption
  quality?: QualityOption
  count?: number
}

type ProviderRecord = {
  id: string
  name: string
  api_v1_url: string
  model: string
  api_key_ciphertext: string | null
  api_key_iv: string | null
}

function buildProviderPrompt(prompt: string, resolution: ResolutionOption) {
  const resolutionLabels: Record<ResolutionOption, string> = {
    '1K': '1K 级别清晰度',
    '2K': '2K 级别清晰度',
    '4K': '4K 级别清晰度',
  }

  return `${prompt}\n\n输出清晰度倾向：${resolutionLabels[resolution]}。`
}

function dataUrlToFile(dataUrl: string, fallbackName: string) {
  const [meta, payload] = dataUrl.split(',', 2)
  if (!meta || !payload || !meta.startsWith('data:')) {
    throw new Error('Invalid reference image data.')
  }

  const mimeType = meta.match(/^data:([^;]+)/)?.[1] ?? 'image/png'
  const binary = atob(payload)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const extension = mimeType.split('/')[1] ?? 'png'
  return new File([bytes], `${fallbackName}.${extension}`, { type: mimeType })
}

function normalizeImagesResponse(payload: Record<string, unknown>) {
  const rows = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.images)
      ? payload.images
      : []

  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const imageRow = row as Record<string, unknown>

    if (typeof imageRow.b64_json === 'string') {
      return [{
        imageDataUrl: `data:image/png;base64,${imageRow.b64_json}`,
        revisedPrompt: typeof imageRow.revised_prompt === 'string' ? imageRow.revised_prompt : null,
      }]
    }

    if (typeof imageRow.url === 'string') {
      return [{
        imageUrl: imageRow.url,
        revisedPrompt: typeof imageRow.revised_prompt === 'string' ? imageRow.revised_prompt : null,
      }]
    }

    return []
  })
}

async function loadActiveProvider() {
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('image_providers')
    .select('id,name,api_v1_url,model,api_key_ciphertext,api_key_iv')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  const provider = data as ProviderRecord | null
  if (!provider || !provider.api_key_ciphertext || !provider.api_key_iv) {
    throw new Error('Image generation service is not enabled.')
  }

  return provider
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as GenerateRequest
    const prompt = body.prompt?.trim()
    const mode = body.mode
    const images = Array.isArray(body.images) ? body.images.filter(Boolean) : []
    const quality: QualityOption = body.quality ?? 'high'
    const resolution: ResolutionOption = body.resolution ?? '4K'

    if (!prompt) {
      return jsonResponse({ error: '请输入提示词。' }, { status: 400 })
    }
    if (mode !== 'text-to-image' && mode !== 'image-to-image') {
      return jsonResponse({ error: '不支持的生图模式。' }, { status: 400 })
    }
    if (mode === 'image-to-image' && images.length === 0) {
      return jsonResponse({ error: '图生图至少需要上传一张参考图。' }, { status: 400 })
    }

    const provider = await loadActiveProvider()
    const encryptionSecret = Deno.env.get('IMAGE_PROVIDER_KEY_SECRET')
    if (!encryptionSecret) {
      throw new Error('Image generation key secret is not configured.')
    }

    const apiKey = await decryptProviderKey(provider.api_key_ciphertext, provider.api_key_iv, encryptionSecret)
    const apiBase = provider.api_v1_url.replace(/\/+$/, '')
    const providerPrompt = buildProviderPrompt(prompt, resolution)

    async function requestProvider() {
      if (mode === 'text-to-image') {
        const requestBody: Record<string, unknown> = {
          model: provider.model,
          prompt: providerPrompt,
          quality,
          response_format: 'url',
        }

        return await fetch(`${apiBase}/images/generations`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(110_000),
        })
      }

      const formData = new FormData()
      formData.set('model', provider.model)
      formData.set('prompt', providerPrompt)
      formData.set('quality', quality)
      formData.set('response_format', 'url')

      images.forEach((image, index) => {
        const file = dataUrlToFile(image, `reference-${index + 1}`)
        if (index === 0) formData.append('image', file)
        else formData.append('image[]', file)
      })

      return await fetch(`${apiBase}/images/edits`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: AbortSignal.timeout(110_000),
      })
    }

    const upstreamResponse = await requestProvider()
    let payload = await upstreamResponse.json().catch(() => ({}))

    if (!upstreamResponse.ok) {
      const message = typeof payload?.error?.message === 'string'
        ? payload.error.message
        : typeof payload?.message === 'string'
          ? payload.message
          : '生成请求失败。'
      return jsonResponse({ error: message }, { status: upstreamResponse.status })
    }

    return jsonResponse({
      provider: provider.name,
      model: provider.model,
      usedResolution: resolution,
      usedQuality: quality,
      usedCount: 1,
      images: normalizeImagesResponse(payload as Record<string, unknown>),
    })
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : '生图服务异常。' },
      { status: 500 },
    )
  }
})
