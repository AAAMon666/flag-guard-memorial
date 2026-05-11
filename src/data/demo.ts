import type { ClassInfo, College, Generation, IdentityTag, Major, MediaItem, Member, Message, Role, SystemSettings } from '../types'

export const roles: Role[] = [
  {
    id: 'super-admin',
    name: '超级管理员',
    description: '拥有全站管理、权限配置和敏感信息查看权限',
    permissions: ['admin.access', 'member.manage', 'phone.view', 'media.manage', 'message.manage', 'excel.manage', 'video.manage'],
  },
  {
    id: 'manager',
    name: '管理员 / 核心干部',
    description: '负责成员资料、媒体内容和留言审核',
    permissions: ['admin.access', 'member.manage', 'phone.view', 'media.manage', 'message.manage', 'excel.manage'],
  },
  {
    id: 'member',
    name: '普通成员',
    description: '可查看公开内容并提交留言、图片资料',
    permissions: [],
  },
]

export const generations: Generation[] = [
  {
    id: 'g-2022',
    name: '第三届',
    year: 2022,
    description: '以纪律、荣誉与传承为核心，完成多项升旗与大型活动保障任务。',
    coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    slogan: '步履铿锵，青春向国旗致敬',
  },
  {
    id: 'g-2023',
    name: '第四届',
    year: 2023,
    description: '持续完善训练制度与仪仗规范，留下属于这一届的集体记忆。',
    coverImage: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
    slogan: '守护晨光，也守护彼此的热爱',
  },
  {
    id: 'g-2024',
    name: '第五届',
    year: 2024,
    description: '面向新成员建设数字化纪念平台，让照片、视频和留言长期留存。',
    coverImage: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
    slogan: '让每一次正步都有回响',
  },
]

export const colleges: College[] = [
  { id: 'c-computer', name: '计算机学院' },
  { id: 'c-management', name: '管理学院' },
  { id: 'c-mechanical', name: '机械工程学院' },
]

export const majors: Major[] = [
  { id: 'm-software', collegeId: 'c-computer', name: '软件工程' },
  { id: 'm-network', collegeId: 'c-computer', name: '网络工程' },
  { id: 'm-business', collegeId: 'c-management', name: '工商管理' },
  { id: 'm-mechanical', collegeId: 'c-mechanical', name: '机械设计制造及其自动化' },
]

export const classes: ClassInfo[] = [
  { id: 'cl-soft-1', collegeId: 'c-computer', majorId: 'm-software', name: '软件 2201 班' },
  { id: 'cl-net-1', collegeId: 'c-computer', majorId: 'm-network', name: '网络 2301 班' },
  { id: 'cl-biz-1', collegeId: 'c-management', majorId: 'm-business', name: '工商 2202 班' },
  { id: 'cl-mech-1', collegeId: 'c-mechanical', majorId: 'm-mechanical', name: '机械 2401 班' },
]

export const identityTags: IdentityTag[] = [
  { id: 'captain', name: '队长', description: '负责队伍整体训练、纪律与活动统筹' },
  { id: 'vice-captain', name: '副队', description: '协助队长推进日常管理' },
  { id: 'flag-bearer', name: '护旗手', description: '承担护旗与仪仗展示任务' },
  { id: 'trainer', name: '教官', description: '负责训练指导与动作规范' },
  { id: 'propaganda', name: '宣传', description: '负责影像记录与宣传资料整理' },
  { id: 'trainee', name: '学员', description: '参与日常训练与活动保障' },
]

export const members: Member[] = [
  {
    id: 'mem-1',
    name: '陈明远',
    collegeId: 'c-computer',
    majorId: 'm-software',
    classId: 'cl-soft-1',
    phone: '13800000001',
    retiredStatus: false,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    bio: '严谨细致，参与多次升旗仪式与队列训练组织。',
    generations: [
      { generationId: 'g-2023', remark: '训练标兵', tagIds: ['trainer', 'flag-bearer'] },
      { generationId: 'g-2024', remark: '负责新队员训练', tagIds: ['captain', 'trainer'] },
    ],
  },
  {
    id: 'mem-2',
    name: '李若安',
    collegeId: 'c-management',
    majorId: 'm-business',
    classId: 'cl-biz-1',
    phone: '13800000002',
    retiredStatus: false,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    bio: '负责队伍活动组织与纪念资料归档。',
    generations: [{ generationId: 'g-2024', remark: '资料整理负责人', tagIds: ['vice-captain', 'propaganda'] }],
  },
  {
    id: 'mem-3',
    name: '周启航',
    collegeId: 'c-mechanical',
    majorId: 'm-mechanical',
    classId: 'cl-mech-1',
    phone: '13800000003',
    retiredStatus: true,
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    bio: '退役队员，曾参与校庆升旗仪式保障。',
    generations: [{ generationId: 'g-2022', remark: '优秀队员', tagIds: ['flag-bearer'] }],
  },
  {
    id: 'mem-4',
    name: '王思雨',
    collegeId: 'c-computer',
    majorId: 'm-network',
    classId: 'cl-net-1',
    phone: '13800000004',
    retiredStatus: false,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    bio: '新队员，参与日常训练和资料采集。',
    generations: [{ generationId: 'g-2024', remark: '新训优秀学员', tagIds: ['trainee', 'propaganda'] }],
  },
]

export const mediaItems: MediaItem[] = [
  {
    id: 'media-1',
    type: 'image',
    title: '清晨训练剪影',
    fileUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
    generationId: 'g-2024',
    activityName: '晨训',
    year: 2024,
    tags: ['训练', '队列'],
    isPublic: true,
  },
  {
    id: 'media-2',
    type: 'image',
    title: '升旗仪式合影',
    fileUrl: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=80',
    generationId: 'g-2023',
    activityName: '升旗仪式',
    year: 2023,
    tags: ['升旗', '合影'],
    isPublic: true,
  },
  {
    id: 'media-3',
    type: 'video',
    title: '仪仗展示预留视频',
    fileUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    coverUrl: 'https://images.unsplash.com/photo-1543269664-56d93c1b41a6?auto=format&fit=crop&w=1200&q=80',
    generationId: 'g-2024',
    activityName: '仪仗展示',
    year: 2024,
    tags: ['视频', '预留'],
    isPublic: true,
  },
]

export const messages: Message[] = [
  {
    id: 'msg-1',
    content: '愿每一届队员都记得第一次穿上制服时的庄重与骄傲。',
    authorName: '往届队员',
    generationId: 'g-2022',
    status: 'approved',
    createdAt: '2025-05-04',
  },
  {
    id: 'msg-2',
    content: '把训练场上的坚持，带到以后更远的路上。',
    authorName: '指导老师',
    generationId: 'g-2024',
    status: 'approved',
    createdAt: '2025-06-01',
  },
]

export const systemSettings: SystemSettings = {
  imageUploadEnabled: true,
  videoUploadEnabled: false,
  messageEnabled: true,
}
