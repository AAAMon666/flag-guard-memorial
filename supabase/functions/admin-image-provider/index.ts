import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, requireAdminAccess } from '../_shared/providerAccess.ts'
import { encryptProviderKey, maskProviderKey } from '../_shared/providerCrypto.ts'

type ProviderPayload = {
  id?: string
  name: string
  officialUrl?: string
  apiRootUrl?: string
  apiV1Url: string
  model: string
  notes?: string
  apiKey?: string
  isActive?: boolean
}

type ActionRequest =
  | { action: 'list' }
  | { action: 'upsert'; payload: ProviderPayload }
  | { action: 'delete'; id: string }
  | { action: 'activate'; id: string }

async function listProviders() {
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('image_providers')
    .select('id,name,official_url,api_root_url,api_v1_url,model,notes,is_active,api_key_ciphertext,updated_at,created_at')
    .order('is_active', { ascending: false })
    .order('updated_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    officialUrl: item.official_url,
    apiRootUrl: item.api_root_url,
    apiV1Url: item.api_v1_url,
    model: item.model,
    notes: item.notes,
    isActive: item.is_active,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    apiKeyStatus: maskProviderKey(Boolean(item.api_key_ciphertext)),
    hasApiKey: Boolean(item.api_key_ciphertext),
  }))
}

async function setActiveProvider(id: string) {
  const serviceClient = createServiceClient()
  const resetResult = await serviceClient.from('image_providers').update({
    is_active: false,
    updated_at: new Date().toISOString(),
  }).eq('is_active', true)
  if (resetResult.error) throw resetResult.error

  const activateResult = await serviceClient.from('image_providers').update({
    is_active: true,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (activateResult.error) throw activateResult.error
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authorization = req.headers.get('Authorization')
    if (!authorization) {
      return jsonResponse({ error: '缺少登录信息。' }, { status: 401 })
    }

    await requireAdminAccess(authorization)
    const body = await req.json() as ActionRequest
    const serviceClient = createServiceClient()

    if (body.action === 'list') {
      return jsonResponse({ items: await listProviders() })
    }

    if (body.action === 'delete') {
      const result = await serviceClient.from('image_providers').delete().eq('id', body.id)
      if (result.error) throw result.error
      return jsonResponse({ items: await listProviders() })
    }

    if (body.action === 'activate') {
      await setActiveProvider(body.id)
      return jsonResponse({ items: await listProviders() })
    }

    if (body.action === 'upsert') {
      const payload = body.payload
      if (!payload.name?.trim() || !payload.apiV1Url?.trim() || !payload.model?.trim()) {
        return jsonResponse({ error: '供应商名称、/v1 地址和模型名不能为空。' }, { status: 400 })
      }

      const nextRow: Record<string, unknown> = {
        name: payload.name.trim(),
        official_url: payload.officialUrl?.trim() || null,
        api_root_url: payload.apiRootUrl?.trim() || null,
        api_v1_url: payload.apiV1Url.trim(),
        model: payload.model.trim(),
        notes: payload.notes?.trim() || '',
        updated_at: new Date().toISOString(),
      }

      if (payload.apiKey?.trim()) {
        const encryptionSecret = Deno.env.get('IMAGE_PROVIDER_KEY_SECRET')
        if (!encryptionSecret) {
          throw new Error('未配置供应商密钥加密 Secret。')
        }
        const encrypted = await encryptProviderKey(payload.apiKey.trim(), encryptionSecret)
        nextRow.api_key_ciphertext = encrypted.ciphertext
        nextRow.api_key_iv = encrypted.iv
      }

      let providerId = payload.id ?? ''
      if (providerId) {
        const updateResult = await serviceClient.from('image_providers').update(nextRow).eq('id', providerId)
        if (updateResult.error) throw updateResult.error
      } else {
        const insertResult = await serviceClient.from('image_providers').insert({
          ...nextRow,
          is_active: Boolean(payload.isActive),
        }).select('id').single()
        if (insertResult.error) throw insertResult.error
        providerId = insertResult.data.id
      }

      if (payload.isActive && providerId) {
        await setActiveProvider(providerId)
      }

      return jsonResponse({ items: await listProviders() })
    }

    return jsonResponse({ error: '不支持的操作。' }, { status: 400 })
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : '供应商操作失败。' },
      { status: 500 },
    )
  }
})
