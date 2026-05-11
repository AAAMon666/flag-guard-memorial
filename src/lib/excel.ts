import { utils, writeFile } from 'xlsx'
import type { Member } from '../types'
import { classes, colleges, identityTags, majors } from '../data/demo'

export type MemberExportRow = {
  姓名: string
  学院: string
  专业: string
  班级: string
  手机号?: string
  是否退役: string
  所属届次: string
  身份标签: string
}

export function buildMemberRows(members: Member[], canViewPhone: boolean): MemberExportRow[] {
  return members.map((member) => {
    const college = colleges.find((item) => item.id === member.collegeId)?.name ?? ''
    const major = majors.find((item) => item.id === member.majorId)?.name ?? ''
    const className = classes.find((item) => item.id === member.classId)?.name ?? ''
    const tags = member.generations
      .flatMap((item) => item.tagIds)
      .map((tagId) => identityTags.find((tag) => tag.id === tagId)?.name)
      .filter(Boolean)
      .join('、')

    return {
      姓名: member.name,
      学院: college,
      专业: major,
      班级: className,
      ...(canViewPhone ? { 手机号: member.phone } : {}),
      是否退役: member.retiredStatus ? '是' : '否',
      所属届次: member.generations.map((item) => item.generationId).join('、'),
      身份标签: tags,
    }
  })
}

export function exportMembers(members: Member[], canViewPhone: boolean) {
  const worksheet = utils.json_to_sheet(buildMemberRows(members, canViewPhone))
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, worksheet, '成员数据')
  writeFile(workbook, canViewPhone ? '成员数据-含手机号.xlsx' : '成员数据-公开版.xlsx')
}
