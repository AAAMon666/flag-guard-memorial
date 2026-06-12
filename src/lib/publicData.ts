import { supabase } from './supabase'

export type PublicGeneration = {
  id: string
  name: string
  year: number
  description: string
  cover_image: string | null
  slogan: string
}

export type PublicMember = {
  id: string
  name: string
  college_id: string | null
  major_id: string | null
  class_id: string | null
  phone: string | null
  gender: string
  retired_status: boolean
  avatar: string | null
  bio: string
}

export type PublicCollege = { id: string; name: string }
export type PublicMajor = { id: string; college_id: string; name: string }
export type PublicClass = { id: string; college_id: string; major_id: string | null; name: string }
export type PublicTag = { id: string; name: string; description: string }
export type PublicMemberGeneration = { id: string; member_id: string; generation_id: string; remark: string }
export type PublicMemberGenerationTag = { member_generation_id: string; identity_tag_id: string }

export type PublicMedia = {
  id: string
  type: 'image' | 'video'
  title: string
  file_url: string
  cover_url: string | null
  generation_id: string | null
  member_id: string | null
  activity_name: string | null
  taken_date: string | null
  year: number | null
  tags: string[]
  is_public: boolean
  created_at: string
  updated_at?: string
  asset_count: number
  assets: Array<{
    id: string
    file_url: string
    cover_url: string | null
    asset_type: 'image' | 'video'
    sort_order: number
  }>
}

export type PublicMessage = {
  id: string
  content: string
  author_name: string
  member_id: string | null
  generation_id: string | null
  status: string
  created_at: string
}

export type PublicGeneratedGalleryItem = {
  id: string
  title: string
  prompt: string
  mode: 'text-to-image' | 'image-to-image'
  quality: string
  resolution: string
  free_size: string
  provider_name: string
  model: string
  image_url: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export type PublicSettings = {
  imageUploadEnabled: boolean
  videoUploadEnabled: boolean
  messageEnabled: boolean
}

export type MediaStorageStatus = {
  usedBytes: number
  totalBytes: number
  remainingBytes: number
  usagePercent: number
  objectCount: number
}

export const defaultSettings: PublicSettings = {
  imageUploadEnabled: true,
  videoUploadEnabled: true,
  messageEnabled: true,
}

export const defaultMediaStorageStatus: MediaStorageStatus = {
  usedBytes: 0,
  totalBytes: 0,
  remainingBytes: 0,
  usagePercent: 0,
  objectCount: 0,
}

export function formatStorageSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** unitIndex

  return `${value >= 100 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

export async function loadPublicData() {
  if (!supabase) throw new Error('尚未配置 Supabase。')

  const [generations, members, colleges, majors, classes, tags, memberGenerations, memberGenerationTags, media, mediaAssets, messages, settings] = await Promise.all([
    supabase.from('generations').select('id,name,year,description,cover_image,slogan').order('year', { ascending: false }),
    supabase.from('members').select('id,name,college_id,major_id,class_id,phone,gender,retired_status,avatar,bio').order('created_at', { ascending: false }),
    supabase.from('colleges').select('id,name').order('name'),
    supabase.from('majors').select('id,college_id,name').order('name'),
    supabase.from('classes').select('id,college_id,major_id,name').order('name'),
    supabase.from('identity_tags').select('id,name,description').order('name'),
    supabase.from('member_generations').select('id,member_id,generation_id,remark'),
    supabase.from('member_generation_tags').select('member_generation_id,identity_tag_id'),
    supabase.from('media_items').select('id,type,title,file_url,cover_url,generation_id,member_id,activity_name,taken_date,year,tags,is_public,created_at,updated_at').eq('is_public', true).order('created_at', { ascending: false }),
    supabase.from('media_item_assets').select('id,media_item_id,file_url,cover_url,asset_type,sort_order').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('messages').select('id,content,author_name,member_id,generation_id,status,created_at').eq('status', 'approved').order('created_at', { ascending: false }),
    loadSettings(),
  ])

  const firstError = generations.error ?? members.error ?? colleges.error ?? majors.error ?? classes.error ?? tags.error ?? memberGenerations.error ?? memberGenerationTags.error ?? media.error ?? mediaAssets.error ?? messages.error
  if (firstError) throw firstError

  const assetsByMediaId = (mediaAssets.data ?? []).reduce<Record<string, PublicMedia['assets']>>((result, asset) => {
    if (!result[asset.media_item_id]) result[asset.media_item_id] = []
    result[asset.media_item_id].push({
      id: asset.id,
      file_url: asset.file_url,
      cover_url: asset.cover_url,
      asset_type: asset.asset_type,
      sort_order: asset.sort_order,
    })
    return result
  }, {})

  const normalizedMedia = (media.data ?? []).map((item) => {
    const assets = assetsByMediaId[item.id] ?? (item.file_url ? [{
      id: `${item.id}-legacy`,
      file_url: item.file_url,
      cover_url: item.cover_url,
      asset_type: item.type,
      sort_order: 0,
    }] : [])

    return {
      ...item,
      asset_count: assets.length,
      assets,
    }
  })

  return {
    generations: generations.data ?? [],
    members: members.data ?? [],
    colleges: colleges.data ?? [],
    majors: majors.data ?? [],
    classes: classes.data ?? [],
    tags: tags.data ?? [],
    memberGenerations: memberGenerations.data ?? [],
    memberGenerationTags: memberGenerationTags.data ?? [],
    media: normalizedMedia,
    messages: messages.data ?? [],
    settings,
  }
}

export async function loadSettings(): Promise<PublicSettings> {
  if (!supabase) return defaultSettings

  const { data, error } = await supabase.from('system_settings').select('key,value')
  if (error) throw error

  return (data ?? []).reduce<PublicSettings>((result, item) => ({
    ...result,
    [item.key]: Boolean(item.value),
  }), defaultSettings)
}

export async function loadMediaStorageStatus(): Promise<MediaStorageStatus> {
  if (!supabase) return defaultMediaStorageStatus

  const { data, error } = await supabase.rpc('get_media_storage_status')
  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  if (!row) return defaultMediaStorageStatus

  return {
    usedBytes: Number(row.used_bytes ?? 0),
    totalBytes: Number(row.total_bytes ?? 0),
    remainingBytes: Number(row.remaining_bytes ?? 0),
    usagePercent: Number(row.usage_percent ?? 0),
    objectCount: Number(row.object_count ?? 0),
  }
}

export async function loadGeneratedGalleryItems(): Promise<PublicGeneratedGalleryItem[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('generated_gallery_items')
    .select('id,title,prompt,mode,quality,resolution,free_size,provider_name,model,image_url,is_public,created_at,updated_at')
    .eq('is_public', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}
