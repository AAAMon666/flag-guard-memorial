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

type EffectiveGenerationConfig = {
  resolution: ResolutionOption
  quality: QualityOption
  count: number
}

type ProviderRecord = {
  id: string
  name: string
  api_v1_url: string
  model: string
  api_key_ciphertext: string | null
  api_key_iv: string | null
}

const resolutionMap: Record<ResolutionOption, string> = {
  '1K': '1024x1024',
  '2K': '2048x2048',
  '4K': '3840x2160',
}

const promptNativeSizePatterns = [
  /\b\d{3,5}\s*[x×]\s*\d{3,5}\b/i,
  /\b\d+\s*:\s*\d+\b/,
  /\b(a0|a1|a2|a3|a4|a5|a6|b4|b5)\b/i,
  /(\u6d77\u62a5|poster|\u6a2a\u7248|\u7ad6\u7248|\u6a2a\u6784\u56fe|\u7ad6\u6784\u56fe|\u65b9\u56fe|\u957f\u56fe|\u5c3a\u5bf8|\u6bd4\u4f8b)/i,
]

function usesPromptNativeSize(prompt: string) {
  return promptNativeSizePatterns.some((pattern) => pattern.test(prompt))
}

function getResolutionBaseSize(resolution: ResolutionOption) {
  const rawSize = resolutionMap[resolution]
  const [widthText, heightText] = rawSize.split('x')
  return {
    width: Number(widthText),
    height: Number(heightText),
  }
}

function normalizeStep16(value: number) {
  return Math.max(64, Math.round(value / 16) * 16)
}

function getPromptOrientation(prompt: string) {
  if (/(\u7ad6\u7248|\u7ad6\u5411|\u7ad6\u6784\u56fe|portrait)/i.test(prompt)) {
    return 'portrait'
  }
  if (/(\u6a2a\u7248|\u6a2a\u5411|\u6a2a\u6784\u56fe|landscape)/i.test(prompt)) {
    return 'landscape'
  }
  return 'landscape'
}

function buildSizeFromRatio(widthRatio: number, heightRatio: number, resolution: ResolutionOption) {
  const baseSize = getResolutionBaseSize(resolution)
  const pixelBudget = baseSize.width * baseSize.height
  const ratio = widthRatio / heightRatio

  let width = normalizeStep16(Math.sqrt(pixelBudget * ratio))
  let height = normalizeStep16(width / ratio)

  while (width * height > pixelBudget && width > 64 && height > 64) {
    if (width >= height) {
      width -= 16
      height = normalizeStep16(width / ratio)
    } else {
      height -= 16
      width = normalizeStep16(height * ratio)
    }
  }

  return `${width}x${height}`
}

function getPromptNativeSize(prompt: string, resolution: ResolutionOption) {
  const explicitSize = prompt.match(/\b(\d{3,5})\s*[x×]\s*(\d{3,5})\b/i)
  if (explicitSize) {
    const width = normalizeStep16(Number(explicitSize[1]))
    const height = normalizeStep16(Number(explicitSize[2]))
    return `${width}x${height}`
  }

  const explicitRatio = prompt.match(/\b(\d+)\s*:\s*(\d+)\b/)
  if (explicitRatio) {
    return buildSizeFromRatio(Number(explicitRatio[1]), Number(explicitRatio[2]), resolution)
  }

  const hasPaperSize = /\b(a0|a1|a2|a3|a4|a5|a6|b4|b5)\b/i.test(prompt)
  if (!hasPaperSize) return ''

  const orientation = getPromptOrientation(prompt)
  return orientation === 'portrait'
    ? buildSizeFromRatio(1, Math.SQRT2, resolution)
    : buildSizeFromRatio(Math.SQRT2, 1, resolution)
}

function buildProviderPrompt(prompt: string, usePromptNativeSize: boolean) {
  if (!usePromptNativeSize) return prompt

  return [
    prompt,
    'Full-bleed output: the final image canvas must be the artwork itself.',
    'Do not place the poster on a larger white background or mockup canvas.',
    'No white margins, no borders, no padding, no letterboxing, no pillarboxing.',
    'Extend the background and design all the way to every edge of the final image.',
  ].join('\n')
}

function buildFallbackConfig(config: EffectiveGenerationConfig) {
  if (config.resolution === '4K') {
    return {
      resolution: '2K',
      quality: config.quality === 'high' ? 'medium' : config.quality,
      count: 1,
    } satisfies EffectiveGenerationConfig
  }

  if (config.quality === 'high') {
    return {
      resolution: config.resolution,
      quality: 'medium',
      count: 1,
    } satisfies EffectiveGenerationConfig
  }

  if (config.quality === 'medium') {
    return {
      resolution: config.resolution,
      quality: 'low',
      count: 1,
    } satisfies EffectiveGenerationConfig
  }

  if (config.count > 1) {
    return {
      resolution: config.resolution,
      quality: config.quality,
      count: 1,
    } satisfies EffectiveGenerationConfig
  }

  return null
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
    const count = Math.min(Math.max(Number(body.count ?? 1), 1), 4)

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
    const usePromptNativeSize = usesPromptNativeSize(prompt)
    const providerPrompt = buildProviderPrompt(prompt, usePromptNativeSize)

    async function requestProvider(config: EffectiveGenerationConfig) {
      const size = resolutionMap[config.resolution]
      const promptSize = getPromptNativeSize(prompt, config.resolution)
      const requestSize = promptSize || size

      if (mode === 'text-to-image') {
        const requestBody: Record<string, unknown> = {
          model: provider.model,
          prompt: providerPrompt,
          n: config.count,
          quality: config.quality,
          response_format: 'url',
        }

        if (!usePromptNativeSize || promptSize) {
          requestBody.size = requestSize
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
      formData.set('n', String(config.count))
      formData.set('quality', config.quality)
      formData.set('response_format', 'url')

      if (!usePromptNativeSize || promptSize) {
        formData.set('size', requestSize)
      }

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

    const requestedConfig: EffectiveGenerationConfig = { resolution, quality, count }
    const fallbackConfig = buildFallbackConfig(requestedConfig)

    let effectiveConfig = requestedConfig
    let upstreamResponse: Response

    try {
      upstreamResponse = await requestProvider(requestedConfig)
    } catch (error) {
      if (!fallbackConfig || !(error instanceof Error) || error.name !== 'TimeoutError') {
        throw error
      }

      effectiveConfig = fallbackConfig
      upstreamResponse = await requestProvider(fallbackConfig)
    }

    let payload = await upstreamResponse.json().catch(() => ({}))
    if (!upstreamResponse.ok && fallbackConfig && effectiveConfig === requestedConfig) {
      effectiveConfig = fallbackConfig
      upstreamResponse = await requestProvider(fallbackConfig)
      payload = await upstreamResponse.json().catch(() => ({}))
    }

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
      usedResolution: effectiveConfig.resolution,
      usedQuality: effectiveConfig.quality,
      usedCount: effectiveConfig.count,
      images: normalizeImagesResponse(payload as Record<string, unknown>),
    })
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : '生图服务异常。' },
      { status: 500 },
    )
  }
})
