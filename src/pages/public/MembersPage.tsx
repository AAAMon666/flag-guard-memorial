import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { hasSupabaseConfig } from '../../lib/supabase'
import { loadPublicData } from '../../lib/publicData'
import type { PublicClass, PublicCollege, PublicMember, PublicTag } from '../../lib/publicData'

type MemberCard = PublicMember & { tags: string[] }

export function MembersPage() {
  const [collegeId, setCollegeId] = useState('')
  const [classId, setClassId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [colleges, setColleges] = useState<PublicCollege[]>([])
  const [classes, setClasses] = useState<PublicClass[]>([])
  const [members, setMembers] = useState<MemberCard[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setError('尚未配置 Supabase，无法加载真实成员数据。')
      return
    }

    loadPublicData()
      .then((data) => {
        setColleges(data.colleges)
        setClasses(data.classes)
        setMembers(data.members.map((member) => {
          const relations = data.memberGenerations.filter((relation) => relation.member_id === member.id)
          const tagIds = relations.flatMap((relation) => data.memberGenerationTags.filter((tag) => tag.member_generation_id === relation.id).map((tag) => tag.identity_tag_id))
          const tags = Array.from(new Set(tagIds.map((tagId) => data.tags.find((tag: PublicTag) => tag.id === tagId)?.name).filter((tag): tag is string => Boolean(tag))))
          return { ...member, tags }
        }))
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : '成员数据加载失败。'))
  }, [])

  const filteredClasses = classes.filter((item) => !collegeId || item.college_id === collegeId)
  const filteredMembers = useMemo(() => members.filter((member) => {
    const byCollege = !collegeId || member.college_id === collegeId
    const byClass = !classId || member.class_id === classId
    const byKeyword = !keyword || member.name.includes(keyword.trim())
    return byCollege && byClass && byKeyword
  }), [classId, collegeId, keyword, members])

  return (
    <div className="page-stack narrow">
      <div className="page-heading">
        <span className="eyebrow">成员资料</span>
        <h1>成员查询</h1>
        <p>通过学院、班级、姓名快速定位成员资料；公开页手机号默认脱敏显示。</p>
      </div>
      {error && <section className="section-card status-warn">{error}</section>}
      <section className="filter-panel">
        <select value={collegeId} onChange={(event) => { setCollegeId(event.target.value); setClassId('') }}>
          <option value="">全部学院</option>
          {colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
        </select>
        <select value={classId} onChange={(event) => setClassId(event.target.value)}>
          <option value="">全部班级</option>
          {filteredClasses.map((classInfo) => <option key={classInfo.id} value={classInfo.id}>{classInfo.name}</option>)}
        </select>
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="输入姓名" />
      </section>
      <section className="member-grid">
        {filteredMembers.length ? filteredMembers.map((member) => (
          <Link className="member-card" to={`/members/${member.id}`} key={member.id}>
            {member.avatar ? <img src={member.avatar} alt={member.name} /> : <div className="avatar-placeholder card-avatar">{member.name.slice(0, 1)}</div>}
            <strong>{member.name}</strong>
            <span>{colleges.find((item) => item.id === member.college_id)?.name}</span>
            <span>{member.gender || '未填写性别'} · {member.retired_status ? '已退役' : '在队'}</span>
            <div className="tag-list">{member.tags.map((tag) => <em key={tag}>{tag}</em>)}</div>
          </Link>
        )) : <p className="empty-state">暂无匹配成员。</p>}
      </section>
    </div>
  )
}
