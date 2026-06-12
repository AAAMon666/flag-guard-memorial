import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, requireAdminAccess } from '../_shared/providerAccess.ts'

type ActionRequest =
  | { action: 'list' }
  | { action: 'delete'; id: string }

type GalleryRow = {
  id: string
  title: string
  prompt: string
  mode: 'text-to-image' | 'image-to-image'
  quality: string
  resolution: string
  provider_name: string
  model: string
  image_url: string
  created_at: string
}

function extractStoragePath(publicUrl: string) {
  try {
    const url = new URL(publicUrl)
    const marker = '/storage/v1/object/public/media/'
    const markerIndex = url.pathname.indexOf(marker)
    if (markerIndex < 0) return null
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
  } catch {
    return null
  }
}

async function listItems() {
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('generated_gallery_items')
    .select('id,title,prompt,mode,quality,resolution,provider_name,model,image_url,created_at')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data as GalleryRow[] | null ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    prompt: item.prompt,
    mode: item.mode,
    quality: item.quality,
    resolution: item.resolution,
    providerName: item.provider_name,
    model: item.model,
    imageUrl: item.image_url,
    createdAt: item.created_at,
  }))
}

async function deleteItem(id: string) {
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('generated_gallery_items')
    .select('id,image_url')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error('浣滃搧涓嶅瓨鍦ㄦ垨宸插垹闄ゃ€?)
  }

  const storagePath = extractStoragePath(data.image_url)
  if (storagePath) {
    const removeResult = await serviceClient.storage.from('media').remove([storagePath])
    if (removeResult.error) throw removeResult.error
  }

  const deleteResult = await serviceClient.from('generated_gallery_items').delete().eq('id', id)
  if (deleteResult.error) throw deleteResult.error
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return jsonResponse({ error: '缂哄皯鐧诲綍淇℃伅銆? }, { status: 401 })
    }

    await requireAdminAccess(authorization)
    const body = await req.json() as ActionRequest

    if (body.action === 'list') {
      return jsonResponse({ items: await listItems() })
    }

    if (body.action === 'delete') {
      if (!body.id?.trim()) {
        return jsonResponse({ error: '缂哄皯浣滃搧 ID銆? }, { status: 400 })
      }

      await deleteItem(body.id)
      return jsonResponse({ items: await listItems() })
    }

    return jsonResponse({ error: '涓嶆敮鎸佺殑鎿嶄綔銆? }, { status: 400 })
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : '浣滃搧闆嗘搷浣滃け璐ャ€? },
      { status: 500 },
    )
  }
})
