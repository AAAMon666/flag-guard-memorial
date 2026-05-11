import { useEffect, useState } from 'react'
import { exportMembers } from '../../lib/excel'
import { can, defaultRole } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { classes, colleges, generations, identityTags, mediaItems, members, messages, roles, systemSettings } from '../../data/demo'

type GenerationRecord = {
  id: string
  name: string
  year: number
  description: string
  cover_image: string | null
  slogan: string
}

type GenerationForm = Omit<GenerationRecord, 'id'>

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
  ['留言', messages.length],
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
          <li>视频上传开关当前为：{systemSettings.videoUploadEnabled ? '开放' : '关闭'}</li>
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
  return <AdminTable title="成员管理" headers={['姓名', '学院', '班级', '手机号', '状态']} rows={members.map((member) => [member.name, colleges.find((item) => item.id === member.collegeId)?.name, classes.find((item) => item.id === member.classId)?.name, can(defaultRole, 'phone.view') ? member.phone : '无权限', member.retiredStatus ? '已退役' : '在队'])} />
}

export function AdminTaxonomyPage() {
  return (
    <div className="admin-page">
      <h1>学院 / 班级 / 专业管理</h1>
      <div className="card-grid three">
        <AdminList title="学院" items={colleges.map((item) => item.name)} />
        <AdminList title="班级" items={classes.map((item) => item.name)} />
        <AdminList title="专业" items={Array.from(new Set(members.map((member) => member.majorId))).map((majorId) => majorId)} />
      </div>
    </div>
  )
}

export function AdminTagsPage() {
  return <AdminTable title="身份标签管理" headers={['标签', '说明']} rows={identityTags.map((item) => [item.name, item.description])} />
}

export function AdminMediaPage() {
  return <AdminTable title="媒体管理" headers={['标题', '类型', '活动', '公开']} rows={mediaItems.map((item) => [item.title, item.type === 'video' ? '视频' : '图片', item.activityName, item.isPublic ? '是' : '否'])} />
}

export function AdminMessagesPage() {
  return <AdminTable title="留言管理" headers={['署名', '内容', '状态']} rows={messages.map((item) => [item.authorName, item.content, item.status])} />
}

export function AdminPermissionsPage() {
  return <AdminTable title="权限设置" headers={['角色', '说明', '权限码']} rows={roles.map((item) => [item.name, item.description, item.permissions.join('、') || '公开访问'])} />
}

export function AdminImportExportPage() {
  const canViewPhone = can(defaultRole, 'phone.view')
  return (
    <div className="admin-page">
      <h1>Excel 导入导出</h1>
      <section className="section-card form-card">
        <p>当前演示支持导出成员数据；接入 Supabase 后可将导入结果写入数据库。</p>
        <button onClick={() => exportMembers(members, canViewPhone)}>导出成员数据{canViewPhone ? '（含手机号）' : '（公开版）'}</button>
        <input type="file" accept=".xlsx,.xls" />
      </section>
    </div>
  )
}

export function AdminSettingsPage() {
  return (
    <div className="admin-page">
      <h1>系统设置</h1>
      <section className="section-card settings-grid">
        <label><input type="checkbox" checked={systemSettings.imageUploadEnabled} readOnly /> 图片上传开放</label>
        <label><input type="checkbox" checked={systemSettings.videoUploadEnabled} readOnly /> 视频上传开放</label>
        <label><input type="checkbox" checked={systemSettings.messageEnabled} readOnly /> 留言开放</label>
      </section>
    </div>
  )
}

function AdminTable({ title, headers, rows }: { title: string; headers: string[]; rows: Array<Array<string | number | undefined>> }) {
  return (
    <div className="admin-page">
      <div className="section-title"><h1>{title}</h1><button>新增</button></div>
      <div className="table-wrap">
        <table>
          <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}<th>操作</th></tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}<td><button>编辑</button><button className="danger">删除</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdminList({ title, items }: { title: string; items: string[] }) {
  return <section className="section-card"><h2>{title}</h2><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>
}
