import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/providerAccess.ts'

type PublishRequest = {
  title?: string
  prompt: string
  mode: 'text-to-image' | 'image-to-image'
  quality?: string
  resolution?: string
  freeSize?: string
  providerName?: string
  model?: string
  imageDataUrl?: string
  imageUrl?: string
}

function getBytesFromDataUrl(dataUrl: string) {
  const [meta, payload] = dataUrl.split(',', 2)
  if (!meta || !payload || !meta.startsWith('data:')) {
    throw new Error('图片数据格式不正确。')
  }

  const mimeType = meta.match(/^data:([^;]+)/)?.[1] ?? 'image/png'
  const binary = atob(payload)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return { mimeType, bytes }
}

function extensionFromMimeType(mimeType: string) {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'image/png':
    default:
      return 'png'
  }
}

function buildTitle(title: string | undefined, prompt: string) {
  const candidate = title?.trim() || prompt.trim()
  return candidate ? candidate.slice(0, 40) : '未命名作品'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json() as PublishRequest
    if (!body.prompt?.trim()) {
      return jsonResponse({ error: '缺少作品提示词。' }, { status: 400 })
    }
    if (!body.imageDataUrl && !body.imageUrl) {
      return jsonResponse({ error: '缺少待保存图片。' }, { status: 400 })
    }

    let bytes: Uint8Array
    let mimeType: string

    if (body.imageDataUrl) {
      const parsed = getBytesFromDataUrl(body.imageDataUrl)
      bytes = parsed.bytes
      mimeType = parsed.mimeType
    } else {
      const upstream = await fetch(body.imageUrl as string)
      if (!upstream.ok) {
        return jsonResponse({ error: '无法下载待保存图片。' }, { status: 400 })
      }
      mimeType = upstream.headers.get('content-type')?.split(';')[0] ?? 'image/png'
      bytes = new Uint8Array(await upstream.arrayBuffer())
    }

    const extension = extensionFromMimeType(mimeType)
    const path = `generated-works/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`
    const serviceClient = createServiceClient()

    const uploadResult = await serviceClient.storage.from('media').upload(path, bytes, {
      contentType: mimeType,
      upsert: false,
    })
    if (uploadResult.error) throw uploadResult.error

    const { data: publicUrlData } = serviceClient.storage.from('media').getPublicUrl(path)
    const insertResult = await serviceClient.from('generated_gallery_items').insert({
      title: buildTitle(body.title, body.prompt),
      prompt: body.prompt.trim(),
      mode: body.mode,
      quality: body.quality ?? 'medium',
      resolution: body.resolution ?? '1K',
      free_size: body.freeSize?.trim() ?? '',
      provider_name: body.providerName?.trim() ?? '',
      model: body.model?.trim() ?? '',
      image_url: publicUrlData.publicUrl,
      is_public: true,
      updated_at: new Date().toISOString(),
    }).select('*').single()

    if (insertResult.error) throw insertResult.error

    return jsonResponse({ item: insertResult.data })
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : '保存作品失败。' },
      { status: 500 },
    )
  }
})
