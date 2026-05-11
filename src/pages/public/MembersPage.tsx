import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { classes, colleges, identityTags, members } from '../../data/demo'

export function MembersPage() {
  const [collegeId, setCollegeId] = useState('')
  const [classId, setClassId] = useState('')
  const [keyword, setKeyword] = useState('')

  const filteredClasses = classes.filter((item) => !collegeId || item.collegeId === collegeId)
  const filteredMembers = useMemo(() => members.filter((member) => {
    const byCollege = !collegeId || member.collegeId === collegeId
    const byClass = !classId || member.classId === classId
    const byKeyword = !keyword || member.name.includes(keyword.trim())
    return byCollege && byClass && byKeyword
  }), [classId, collegeId, keyword])

  return (
    <div className="page-stack narrow">
      <div className="page-heading">
        <span className="eyebrow">Members</span>
        <h1>成员查询</h1>
        <p>通过学院、班级、姓名快速定位成员资料；手机号默认仅授权角色可见。</p>
      </div>
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
        {filteredMembers.map((member) => {
          const tagNames = member.generations.flatMap((item) => item.tagIds).map((tagId) => identityTags.find((tag) => tag.id === tagId)?.name).filter(Boolean)
          return (
            <Link className="member-card" to={`/members/${member.id}`} key={member.id}>
              <img src={member.avatar} alt={member.name} />
              <strong>{member.name}</strong>
              <span>{colleges.find((item) => item.id === member.collegeId)?.name}</span>
              <div className="tag-list">{Array.from(new Set(tagNames)).map((tag) => <em key={tag}>{tag}</em>)}</div>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
