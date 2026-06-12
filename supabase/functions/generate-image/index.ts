import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/providerAccess.ts'
import { decryptProviderKey } from '../_shared/providerCrypto.ts'

type GenerateRequest = {
  mode: 'text-to-image' | 'image-to-image'
  prompt: string
  images?: string[]
  resolution?: '1K' | '2K' | '4K'
  quality?: 'low' | 'medium' | 'high'
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

const resolutionMap = {
  '1K': '1024x1024',
  '2K': '2048x2048',
  '4K': '3840x2160',
} as const

const nativeSizePromptPatterns = [
  /\b\d{3,5}\s*[x脳]\s*\d{3,5}\b/i,
  /\b\d+\s*:\s*\d+\b/,
  /\b(a0|a1|a2|a3|a4|a5|a6|b4|b5)\b/i,
  /(娴锋姤|poster|妯増|绔栫増|妯瀯鍥緗绔栨瀯鍥緗鏂瑰浘|闀垮浘|灏哄|姣斾緥)/i,
]

function shouldUsePromptNativeSize(prompt: string) {
  return nativeSizePromptPatterns.some((pattern) => pattern.test(prompt))
}

function dataUrlToFile(dataUrl: string, fallbackName: string) {
  const [meta, payload] = dataUrl.split(',', 2)
  if (!meta || !payload || !meta.startsWith('data:')) {
    throw new Error('鍙傝€冨浘鏍煎紡涓嶆纭€?)
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
    throw new Error('鐢熷浘鏈嶅姟鏆傛湭寮€鍚€?)
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
    const quality = body.quality ?? 'high'
    const resolution = body.resolution ?? '4K'
    const count = Math.min(Math.max(Number(body.count ?? 1), 1), 4)

    if (!prompt) {
      return jsonResponse({ error: '璇疯緭鍏ユ彁绀鸿瘝銆? }, { status: 400 })
    }
    if (mode !== 'text-to-image' && mode !== 'image-to-image') {
      return jsonResponse({ error: '涓嶆敮鎸佺殑鐢熷浘妯″紡銆? }, { status: 400 })
    }
    if (mode === 'image-to-image' && images.length === 0) {
      return jsonResponse({ error: '鍥剧敓鍥捐嚦灏戦渶瑕佷笂浼犱竴寮犲弬鑰冨浘銆? }, { status: 400 })
    }

    const provider = await loadActiveProvider()
    const encryptionSecret = Deno.env.get('IMAGE_PROVIDER_KEY_SECRET')
    if (!encryptionSecret) {
      throw new Error('鐢熷浘鏈嶅姟鏈畬鎴愬瘑閽ラ厤缃€?)
    }

    const apiKey = await decryptProviderKey(provider.api_key_ciphertext, provider.api_key_iv, encryptionSecret)
    const apiBase = provider.api_v1_url.replace(/\/+$/, '')
    const size = resolutionMap[resolution]
    const usePromptNativeSize = shouldUsePromptNativeSize(prompt)

    let upstreamResponse: Response

    if (mode === 'text-to-image') {
      const requestBody: Record<string, unknown> = {
        model: provider.model,
        prompt,
        n: count,
        quality,
        response_format: 'b64_json',
      }

      if (!usePromptNativeSize) {
        requestBody.size = size
      }

      upstreamResponse = await fetch(`${apiBase}/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
    } else {
      const formData = new FormData()
      formData.set('model', provider.model)
      formData.set('prompt', prompt)
      formData.set('n', String(count))
      formData.set('quality', quality)
      formData.set('response_format', 'b64_json')

      if (!usePromptNativeSize) {
        formData.set('size', size)
      }

      images.forEach((image, index) => {
        const file = dataUrlToFile(image, `reference-${index + 1}`)
        if (index === 0) formData.append('image', file)
        else formData.append('image[]', file)
      })

      upstreamResponse = await fetch(`${apiBase}/images/edits`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      })
    }

    const payload = await upstreamResponse.json().catch(() => ({}))
    if (!upstreamResponse.ok) {
      const message = typeof payload?.error?.message === 'string'
        ? payload.error.message
        : typeof payload?.message === 'string'
          ? payload.message
          : '鐢熷浘璇锋眰澶辫触銆?
      return jsonResponse({ error: message }, { status: upstreamResponse.status })
    }

    return jsonResponse({
      provider: provider.name,
      model: provider.model,
      images: normalizeImagesResponse(payload as Record<string, unknown>),
    })
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : '鐢熷浘鏈嶅姟寮傚父銆? },
      { status: 500 },
    )
  }
})
