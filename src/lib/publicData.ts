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
  year: number | null
  tags: string[]
  is_public: boolean
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

export type PublicSettings = {
  imageUploadEnabled: boolean
  videoUploadEnabled: boolean
  messageEnabled: boolean
}

export const defaultSettings: PublicSettings = {
  imageUploadEnabled: true,
  videoUploadEnabled: true,
  messageEnabled: true,
}

export async function loadPublicData() {
  if (!supabase) throw new Error('尚未配置 Supabase。')

  const [generations, members, colleges, majors, classes, tags, memberGenerations, memberGenerationTags, media, messages, settings] = await Promise.all([
    supabase.from('generations').select('id,name,year,description,cover_image,slogan').order('year', { ascending: false }),
    supabase.from('members').select('id,name,college_id,major_id,class_id,phone,retired_status,avatar,bio').order('created_at', { ascending: false }),
    supabase.from('colleges').select('id,name').order('name'),
    supabase.from('majors').select('id,college_id,name').order('name'),
    supabase.from('classes').select('id,college_id,major_id,name').order('name'),
    supabase.from('identity_tags').select('id,name,description').order('name'),
    supabase.from('member_generations').select('id,member_id,generation_id,remark'),
    supabase.from('member_generation_tags').select('member_generation_id,identity_tag_id'),
    supabase.from('media_items').select('id,type,title,file_url,cover_url,generation_id,member_id,activity_name,year,tags,is_public').eq('is_public', true).order('created_at', { ascending: false }),
    supabase.from('messages').select('id,content,author_name,member_id,generation_id,status,created_at').eq('status', 'approved').order('created_at', { ascending: false }),
    loadSettings(),
  ])

  const firstError = generations.error ?? members.error ?? colleges.error ?? majors.error ?? classes.error ?? tags.error ?? memberGenerations.error ?? memberGenerationTags.error ?? media.error ?? messages.error
  if (firstError) throw firstError

  return {
    generations: generations.data ?? [],
    members: members.data ?? [],
    colleges: colleges.data ?? [],
    majors: majors.data ?? [],
    classes: classes.data ?? [],
    tags: tags.data ?? [],
    memberGenerations: memberGenerations.data ?? [],
    memberGenerationTags: memberGenerationTags.data ?? [],
    media: media.data ?? [],
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
