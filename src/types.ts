export type PermissionCode =
  | 'admin.access'
  | 'member.manage'
  | 'phone.view'
  | 'media.manage'
  | 'message.manage'
  | 'excel.manage'
  | 'video.manage'

export type Role = {
  id: string
  name: string
  description: string
  permissions: PermissionCode[]
}

export type Generation = {
  id: string
  name: string
  year: number
  description: string
  coverImage: string
  slogan: string
}

export type College = {
  id: string
  name: string
}

export type Major = {
  id: string
  collegeId: string
  name: string
}

export type ClassInfo = {
  id: string
  collegeId: string
  majorId: string
  name: string
}

export type IdentityTag = {
  id: string
  name: string
  description: string
}

export type MemberGeneration = {
  generationId: string
  remark: string
  tagIds: string[]
}

export type Member = {
  id: string
  name: string
  collegeId: string
  classId: string
  majorId: string
  phone: string
  retiredStatus: boolean
  avatar: string
  bio: string
  generations: MemberGeneration[]
}

export type MediaItem = {
  id: string
  type: 'image' | 'video'
  title: string
  fileUrl: string
  coverUrl?: string
  generationId?: string
  memberId?: string
  activityName?: string
  year?: number
  tags: string[]
  isPublic: boolean
}

export type Message = {
  id: string
  content: string
  authorName: string
  memberId?: string
  generationId?: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export type SystemSettings = {
  imageUploadEnabled: boolean
  videoUploadEnabled: boolean
  messageEnabled: boolean
}
