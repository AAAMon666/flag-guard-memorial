import { useEffect, useState } from 'react'
import { exportMembers } from '../../lib/excel'
import { can, defaultRole } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { classes, colleges, generations, identityTags, mediaItems, members, roles, systemSettings } from '../../data/demo'

type GenerationRecord = {
  id: string
  name: string
  year: number
  description: string
  cover_image: string | null
  slogan: string
}

type GenerationForm = Omit<GenerationRecord, 'id'>

type CollegeRecord = { id: string; name: string }
type MajorRecord = { id: string; college_id: string; name: string }
type ClassRecord = { id: string; college_id: string; major_id: string | null; name: string }
type AdminMediaRecord = { id: string; title: string; type: 'image' | 'video'; activity_name: string | null; is_public: boolean }
type AdminMessageRecord = { id: string; author_name: string; content: string; created_at: string }

const emptyGenerationForm: GenerationForm = {
  name: '',
  year: new Date().getFullYear(),
  description: '',
  cover_image: '',
  slogan: '',
}

const stats = [
  ['届次', generations.length],
  ['成员', members.length],
  ['媒体', mediaItems.length],
  ['留言', 0],
]

export function AdminDashboardPage() {
  return (
    <div className="admin-page">
      <h1>控制台</h1>
      <div className="metric-grid admin-metrics">
        {stats.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </div>
      <section className="section-card">
        <h2>当前能力</h2>
        <ul className="check-list">
          <li>前台/后台页面已分离</li>
          <li>成员支持多届次、多身份标签</li>
          <li>手机号按权限显示与导出</li>
          <li>图片和视频已开放前台上传</li>
        </ul>
      </section>
    </div>
  )
}

export function AdminGenerationsPage() {
  const [items, setItems] = useState<GenerationRecord[]>([])
  const [form, setForm] = useState<GenerationForm>(emptyGenerationForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadGenerations() {
    if (!supabase) {
      setError('尚未配置 Supabase，无法管理真实届次数据。')
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('generations')
      .select('id,name,year,description,cover_image,slogan')
      .order('year', { ascending: false })

    if (loadError) setError(loadError.message)
    else {
      setItems(data ?? [])
      setError('')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadGenerations()
  }, [])

  function startEdit(item: GenerationRecord) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      year: item.year,
      description: item.description,
      cover_image: item.cover_image ?? '',
      slogan: item.slogan,
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyGenerationForm)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return

    setSaving(true)
    setError('')
    const payload = { ...form, cover_image: form.cover_image || null }
    const result = editingId
      ? await supabase.from('generations').update(payload).eq('id', editingId)
      : await supabase.from('generations').insert(payload)

    if (result.error) setError(result.error.message)
    else {
      resetForm()
      await loadGenerations()
    }
    setSaving(false)
  }

  async function deleteGeneration(id: string) {
    if (!supabase || !window.confirm('确定删除这个届次吗？')) return
    const { error: deleteError } = await supabase.from('generations').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else await loadGenerations()
  }

  return (
    <div className="admin-page">
      <div className="section-title"><h1>届次管理</h1><span>{loading ? '加载中...' : `${items.length} 条记录`}</span></div>
      {error && <section className="section-card status-warn">{error}</section>}
      <section className="section-card form-card">
        <h2>{editingId ? '编辑届次' : '新增届次'}</h2>
        <form className="generation-form" onSubmit={handleSubmit}>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="届次名称" required />
          <input value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })} placeholder="年份" type="number" required />
          <input value={form.slogan} onChange={(event) => setForm({ ...form, slogan: event.target.value })} placeholder="口号" />
          <input value={form.cover_image ?? ''} onChange={(event) => setForm({ ...form, cover_image: event.target.value })} placeholder="封面图 URL" />
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="届次简介" />
          <div className="form-actions">
            <button disabled={saving}>{saving ? '保存中...' : editingId ? '保存修改' : '新增届次'}</button>
            {editingId && <button type="button" className="secondary-button" onClick={resetForm}>取消编辑</button>}
          </div>
        </form>
      </section>
      <div className="table-wrap">
        <table>
          <thead><tr><th>届次</th><th>年份</th><th>口号</th><th>简介</th><th>操作</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.year}</td>
                <td>{item.slogan}</td>
                <td>{item.description}</td>
                <td><button onClick={() => startEdit(item)}>编辑</button><button className="danger" onClick={() => deleteGeneration(item.id)}>删除</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AdminMembersPage() {
  return <ReadOnlyAdminTable title="成员管理" note="成员新增和编辑尚未接入；当前仅展示演示成员数据。" headers={['姓名', '学院', '班级', '手机号', '状态']} rows={members.map((member) => [member.name, colleges.find((item) => item.id === member.collegeId)?.name, classes.find((item) => item.id === member.classId)?.name, can(defaultRole, 'phone.view') ? member.phone : '无权限', member.retiredStatus ? '已退役' : '在队'])} />
}

export function AdminTaxonomyPage() {
  const [collegeItems, setCollegeItems] = useState<CollegeRecord[]>([])
  const [majorItems, setMajorItems] = useState<MajorRecord[]>([])
  const [classItems, setClassItems] = useState<ClassRecord[]>([])
  const [collegeName, setCollegeName] = useState('')
  const [majorName, setMajorName] = useState('')
  const [majorCollegeId, setMajorCollegeId] = useState('')
  const [className, setClassName] = useState('')
  const [classCollegeId, setClassCollegeId] = useState('')
  const [classMajorId, setClassMajorId] = useState('')
  const [error, setError] = useState('')

  async function loadTaxonomy() {
    if (!supabase) {
      setError('尚未配置 Supabase，无法管理学院、专业和班级。')
      return
    }

    const [collegeResult, majorResult, classResult] = await Promise.all([
      supabase.from('colleges').select('id,name').order('name'),
      supabase.from('majors').select('id,college_id,name').order('name'),
      supabase.from('classes').select('id,college_id,major_id,name').order('name'),
    ])

    if (collegeResult.error || majorResult.error || classResult.error) setError(collegeResult.error?.message ?? majorResult.error?.message ?? classResult.error?.message ?? '分类数据加载失败。')
    else {
      setCollegeItems(collegeResult.data ?? [])
      setMajorItems(majorResult.data ?? [])
      setClassItems(classResult.data ?? [])
      setMajorCollegeId((collegeResult.data ?? [])[0]?.id ?? '')
      setClassCollegeId((collegeResult.data ?? [])[0]?.id ?? '')
      setError('')
    }
  }

  useEffect(() => {
    loadTaxonomy()
  }, [])

  async function addCollege(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const { error: addError } = await supabase.from('colleges').insert({ name: collegeName })
    if (addError) setError(addError.message)
    else {
      setCollegeName('')
      await loadTaxonomy()
    }
  }

  async function addMajor(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const { error: addError } = await supabase.from('majors').insert({ name: majorName, college_id: majorCollegeId })
    if (addError) setError(addError.message)
    else {
      setMajorName('')
      await loadTaxonomy()
    }
  }

  async function addClass(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const { error: addError } = await supabase.from('classes').insert({ name: className, college_id: classCollegeId, major_id: classMajorId || null })
    if (addError) setError(addError.message)
    else {
      setClassName('')
      await loadTaxonomy()
    }
  }

  async function deleteItem(table: 'colleges' | 'majors' | 'classes', id: string) {
    if (!supabase || !window.confirm('确定删除吗？')) return
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else await loadTaxonomy()
  }

  return (
    <div className="admin-page">
      <h1>学院 / 班级 / 专业管理</h1>
      {error && <section className="section-card status-warn">{error}</section>}
      <div className="card-grid three">
        <TaxonomyCard title="学院" items={collegeItems.map((item) => ({ id: item.id, label: item.name }))} onDelete={(id) => deleteItem('colleges', id)}>
          <form className="taxonomy-form" onSubmit={addCollege}>
            <input value={collegeName} onChange={(event) => setCollegeName(event.target.value)} placeholder="学院名称" required />
            <button>添加学院</button>
          </form>
        </TaxonomyCard>
        <TaxonomyCard title="专业" items={majorItems.map((item) => ({ id: item.id, label: `${item.name} · ${collegeItems.find((college) => college.id === item.college_id)?.name ?? ''}` }))} onDelete={(id) => deleteItem('majors', id)}>
          <form className="taxonomy-form" onSubmit={addMajor}>
            <input value={majorName} onChange={(event) => setMajorName(event.target.value)} placeholder="专业名称" required />
            <select value={majorCollegeId} onChange={(event) => setMajorCollegeId(event.target.value)} required>{collegeItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <button>添加专业</button>
          </form>
        </TaxonomyCard>
        <TaxonomyCard title="班级" items={classItems.map((item) => ({ id: item.id, label: `${item.name} · ${collegeItems.find((college) => college.id === item.college_id)?.name ?? ''}` }))} onDelete={(id) => deleteItem('classes', id)}>
          <form className="taxonomy-form" onSubmit={addClass}>
            <input value={className} onChange={(event) => setClassName(event.target.value)} placeholder="班级名称" required />
            <select value={classCollegeId} onChange={(event) => { setClassCollegeId(event.target.value); setClassMajorId('') }} required>{collegeItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <select value={classMajorId} onChange={(event) => setClassMajorId(event.target.value)}><option value="">不关联专业</option>{majorItems.filter((item) => item.college_id === classCollegeId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <button>添加班级</button>
          </form>
        </TaxonomyCard>
      </div>
    </div>
  )
}

export function AdminTagsPage() {
  return <ReadOnlyAdminTable title="身份标签管理" note="身份标签当前仅展示演示数据，暂未接入新增和编辑。" headers={['标签', '说明']} rows={identityTags.map((item) => [item.name, item.description])} />
}

export function AdminMediaPage() {
  const [items, setItems] = useState<AdminMediaRecord[]>([])
  const [error, setError] = useState('')

  async function loadMedia() {
    if (!supabase) {
      setError('尚未配置 Supabase，无法管理媒体。')
      return
    }
    const { data, error: loadError } = await supabase.from('media_items').select('id,title,type,activity_name,is_public').order('created_at', { ascending: false })
    if (loadError) setError(loadError.message)
    else {
      setItems(data ?? [])
      setError('')
    }
  }

  useEffect(() => {
    loadMedia()
  }, [])

  async function deleteMedia(id: string) {
    if (!supabase || !window.confirm('确定删除这条媒体记录吗？')) return
    const { error: deleteError } = await supabase.from('media_items').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else await loadMedia()
  }

  return <ActionAdminTable title="媒体管理" error={error} headers={['标题', '类型', '活动', '公开']} rows={items.map((item) => ({ id: item.id, cells: [item.title, item.type === 'video' ? '视频' : '图片', item.activity_name ?? '', item.is_public ? '是' : '否'] }))} onDelete={deleteMedia} />
}

export function AdminMessagesPage() {
  const [items, setItems] = useState<AdminMessageRecord[]>([])
  const [error, setError] = useState('')

  async function loadMessages() {
    if (!supabase) {
      setError('尚未配置 Supabase，无法管理留言。')
      return
    }
    const { data, error: loadError } = await supabase.from('messages').select('id,author_name,content,created_at').order('created_at', { ascending: false })
    if (loadError) setError(loadError.message)
    else {
      setItems(data ?? [])
      setError('')
    }
  }

  useEffect(() => {
    loadMessages()
  }, [])

  async function deleteMessage(id: string) {
    if (!supabase || !window.confirm('确定删除这条留言吗？')) return
    const { error: deleteError } = await supabase.from('messages').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else await loadMessages()
  }

  return <ActionAdminTable title="留言管理" error={error} headers={['署名', '内容', '时间']} rows={items.map((item) => ({ id: item.id, cells: [item.author_name, item.content, new Date(item.created_at).toLocaleString()] }))} onDelete={deleteMessage} />
}

export function AdminPermissionsPage() {
  return <ReadOnlyAdminTable title="权限设置" note="权限当前由 Supabase SQL 初始化，暂未提供页面编辑入口。" headers={['角色', '说明', '权限码']} rows={roles.map((item) => [item.name, item.description, item.permissions.join('、') || '公开访问'])} />
}

export function AdminImportExportPage() {
  const canViewPhone = can(defaultRole, 'phone.view')
  return (
    <div className="admin-page">
      <h1>Excel 导入导出</h1>
      <section className="section-card form-card">
        <p>当前支持导出演示成员数据；Excel 导入尚未接入数据库写入。</p>
        <button onClick={() => exportMembers(members, canViewPhone)}>导出成员数据{canViewPhone ? '（含手机号）' : '（公开版）'}</button>
      </section>
    </div>
  )
}

export function AdminSettingsPage() {
  return (
    <div className="admin-page">
      <h1>系统设置</h1>
      <section className="section-card settings-grid">
        <p>当前上传和留言开关已在前台开放；页面编辑开关暂未接入。</p>
        <label><input type="checkbox" checked={systemSettings.imageUploadEnabled} readOnly /> 图片上传开放</label>
        <label><input type="checkbox" checked readOnly /> 视频上传开放</label>
        <label><input type="checkbox" checked={systemSettings.messageEnabled} readOnly /> 留言开放</label>
      </section>
    </div>
  )
}

function ReadOnlyAdminTable({ title, note, headers, rows }: { title: string; note: string; headers: string[]; rows: Array<Array<string | number | undefined>> }) {
  return (
    <div className="admin-page">
      <div className="section-title"><h1>{title}</h1></div>
      <section className="section-card status-warn">{note}</section>
      <SimpleTable headers={headers} rows={rows} />
    </div>
  )
}

function ActionAdminTable({ title, error, headers, rows, onDelete }: { title: string; error: string; headers: string[]; rows: Array<{ id: string; cells: Array<string | number | undefined> }>; onDelete: (id: string) => void }) {
  return (
    <div className="admin-page">
      <div className="section-title"><h1>{title}</h1><span>{rows.length} 条记录</span></div>
      {error && <section className="section-card status-warn">{error}</section>}
      <div className="table-wrap">
        <table>
          <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}<th>操作</th></tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id}>{row.cells.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}<td><button className="danger" onClick={() => onDelete(row.id)}>删除</button></td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number | undefined>> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function TaxonomyCard({ title, items, children, onDelete }: { title: string; items: Array<{ id: string; label: string }>; children: React.ReactNode; onDelete: (id: string) => void }) {
  return (
    <section className="section-card taxonomy-card">
      <h2>{title}</h2>
      {children}
      <div className="taxonomy-list">
        {items.map((item) => <div key={item.id}><span>{item.label}</span><button className="danger" onClick={() => onDelete(item.id)}>删除</button></div>)}
      </div>
    </section>
  )
}
