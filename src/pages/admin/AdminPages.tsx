import { useEffect, useState } from 'react'
import { exportMembers } from '../../lib/excel'
import { can, defaultRole } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { members, roles } from '../../data/demo'
import { defaultMediaStorageStatus, defaultSettings, formatStorageSize, loadMediaStorageStatus, loadSettings } from '../../lib/publicData'
import type { MediaStorageStatus, PublicSettings } from '../../lib/publicData'

type GenerationRecord = { id: string; name: string; year: number; description: string; cover_image: string | null; slogan: string }
type GenerationForm = Omit<GenerationRecord, 'id'>
type CollegeRecord = { id: string; name: string }
type MajorRecord = { id: string; college_id: string; name: string }
type ClassRecord = { id: string; college_id: string; major_id: string | null; name: string }
type MemberRecord = { id: string; name: string; college_id: string | null; major_id: string | null; class_id: string | null; phone: string | null; gender: string; retired_status: boolean; avatar: string | null; bio: string }
type TagRecord = { id: string; name: string; description: string }
type MemberGenerationRecord = { id: string; member_id: string; generation_id: string; remark: string }
type AdminMediaRecord = { id: string; title: string; type: 'image' | 'video'; activity_name: string | null; taken_date: string | null; generation_id: string | null; is_public: boolean; asset_count: number }
type AdminMessageRecord = { id: string; author_name: string; content: string; created_at: string }
type AdminMediaEditForm = { title: string; activity_name: string; taken_date: string; generation_id: string; is_public: boolean; next_password: string }

type MemberForm = {
  name: string
  college_id: string
  major_id: string
  class_id: string
  phone: string
  gender: string
  bio: string
  generation_id: string
  identity_tag_id: string
  generation_remark: string
  retired_status: boolean
}

const emptyGenerationForm: GenerationForm = { name: '', year: new Date().getFullYear(), description: '', cover_image: '', slogan: '' }
const emptyMemberForm: MemberForm = { name: '', college_id: '', major_id: '', class_id: '', phone: '', gender: '', bio: '', generation_id: '', identity_tag_id: '', generation_remark: '', retired_status: false }
const bytesPerGb = 1024 * 1024 * 1024

export function AdminDashboardPage() {
  const [stats, setStats] = useState<Array<[string, number]>>([['届次', 0], ['成员', 0], ['媒体', 0], ['留言', 0]])
  const [storageStatus, setStorageStatus] = useState<MediaStorageStatus>(defaultMediaStorageStatus)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) {
      setError('尚未配置 Supabase，无法加载真实统计。')
      return
    }

    Promise.all([
      supabase.from('generations').select('id', { count: 'exact', head: true }),
      supabase.from('members').select('id', { count: 'exact', head: true }),
      supabase.from('media_items').select('id', { count: 'exact', head: true }),
      supabase.from('messages').select('id', { count: 'exact', head: true }),
      loadMediaStorageStatus(),
    ]).then(([generationResult, memberResult, mediaResult, messageResult, nextStorageStatus]) => {
      const firstError = generationResult.error ?? memberResult.error ?? mediaResult.error ?? messageResult.error
      if (firstError) setError(firstError.message)
      else {
        setStats([
          ['届次', generationResult.count ?? 0],
          ['成员', memberResult.count ?? 0],
          ['媒体', mediaResult.count ?? 0],
          ['留言', messageResult.count ?? 0],
        ])
        setStorageStatus(nextStorageStatus)
      }
    }).catch((reason) => {
      setError(reason instanceof Error ? reason.message : '统计加载失败。')
    })
  }, [])

  return (
    <div className="admin-page">
      <h1>控制台</h1>
      {error && <section className="section-card status-warn">{error}</section>}
      <div className="metric-grid admin-metrics">{stats.map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      <section className="section-card">
        <div className="section-title"><h2>媒体库空间</h2><span>{storageStatus.totalBytes > 0 ? `已用 ${storageStatus.usagePercent.toFixed(1)}%` : '总量未设置'}</span></div>
        <div className="metric-grid admin-metrics">
          <div><strong>{formatStorageSize(storageStatus.usedBytes)}</strong><span>已用空间</span></div>
          <div><strong>{storageStatus.totalBytes > 0 ? formatStorageSize(storageStatus.totalBytes) : '未设置'}</strong><span>总量</span></div>
          <div><strong>{storageStatus.totalBytes > 0 ? formatStorageSize(storageStatus.remainingBytes) : '未设置'}</strong><span>剩余空间</span></div>
          <div><strong>{storageStatus.objectCount}</strong><span>文件数量</span></div>
        </div>
      </section>
      <section className="section-card"><h2>当前能力</h2><ul className="check-list"><li>前台页面读取 Supabase 真实数据</li><li>后台删除后前台刷新即可同步</li><li>系统设置可控制留言、图片和视频上传</li><li>成员、身份标签、学院专业班级支持基础增删</li></ul></section>
    </div>
  )
}

export function AdminGenerationsPage() {
  const [items, setItems] = useState<GenerationRecord[]>([])
  const [form, setForm] = useState<GenerationForm>(emptyGenerationForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  async function loadGenerations() {
    if (!supabase) { setError('尚未配置 Supabase，无法管理真实届次数据。'); setLoading(false); return }
    setLoading(true)
    const { data, error: loadError } = await supabase.from('generations').select('id,name,year,description,cover_image,slogan').order('year', { ascending: false })
    if (loadError) setError(loadError.message)
    else { setItems(data ?? []); setError('') }
    setLoading(false)
  }

  useEffect(() => { loadGenerations() }, [])

  function startEdit(item: GenerationRecord) {
    setEditingId(item.id)
    setForm({ name: item.name, year: item.year, description: item.description, cover_image: item.cover_image ?? '', slogan: item.slogan })
  }

  function resetForm() { setEditingId(null); setCoverFile(null); setForm(emptyGenerationForm) }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setSaving(true)
    setError('')
    let coverImage = form.cover_image || null
    if (coverFile) {
      const extension = coverFile.name.split('.').pop() ?? 'jpg'
      const filePath = `generation-covers/${crypto.randomUUID()}.${extension}`
      const uploadResult = await supabase.storage.from('media').upload(filePath, coverFile)
      if (uploadResult.error) {
        setError(uploadResult.error.message)
        setSaving(false)
        return
      }
      const { data } = supabase.storage.from('media').getPublicUrl(filePath)
      coverImage = data.publicUrl
    }
    const payload = { ...form, cover_image: coverImage }
    const result = editingId ? await supabase.from('generations').update(payload).eq('id', editingId) : await supabase.from('generations').insert(payload)
    if (result.error) setError(result.error.message)
    else { resetForm(); await loadGenerations() }
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
          <label className="file-field"><span>上传封面照片</span><input type="file" accept="image/*" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} /></label>
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="届次简介" />
          <div className="form-actions"><button disabled={saving}>{saving ? '保存中...' : editingId ? '保存修改' : '新增届次'}</button>{editingId && <button type="button" className="secondary-button" onClick={resetForm}>取消编辑</button>}</div>
        </form>
      </section>
      <div className="table-wrap"><table><thead><tr><th>届次</th><th>年份</th><th>口号</th><th>简介</th><th>操作</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.year}</td><td>{item.slogan}</td><td>{item.description}</td><td><button onClick={() => startEdit(item)}>编辑</button><button className="danger" onClick={() => deleteGeneration(item.id)}>删除</button></td></tr>)}</tbody></table></div>
    </div>
  )
}

export function AdminMembersPage() {
  const [items, setItems] = useState<MemberRecord[]>([])
  const [colleges, setColleges] = useState<CollegeRecord[]>([])
  const [majors, setMajors] = useState<MajorRecord[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [generations, setGenerations] = useState<GenerationRecord[]>([])
  const [tags, setTags] = useState<TagRecord[]>([])
  const [relations, setRelations] = useState<MemberGenerationRecord[]>([])
  const [form, setForm] = useState<MemberForm>(emptyMemberForm)
  const [error, setError] = useState('')

  async function loadMembers() {
    if (!supabase) { setError('尚未配置 Supabase，无法管理成员。'); return }
    const [memberResult, collegeResult, majorResult, classResult, generationResult, tagResult, relationResult] = await Promise.all([
      supabase.from('members').select('id,name,college_id,major_id,class_id,phone,gender,retired_status,avatar,bio').order('created_at', { ascending: false }),
      supabase.from('colleges').select('id,name').order('name'),
      supabase.from('majors').select('id,college_id,name').order('name'),
      supabase.from('classes').select('id,college_id,major_id,name').order('name'),
      supabase.from('generations').select('id,name,year,description,cover_image,slogan').order('year', { ascending: false }),
      supabase.from('identity_tags').select('id,name,description').order('name'),
      supabase.from('member_generations').select('id,member_id,generation_id,remark'),
    ])
    const firstError = memberResult.error ?? collegeResult.error ?? majorResult.error ?? classResult.error ?? generationResult.error ?? tagResult.error ?? relationResult.error
    if (firstError) setError(firstError.message)
    else { setItems(memberResult.data ?? []); setColleges(collegeResult.data ?? []); setMajors(majorResult.data ?? []); setClasses(classResult.data ?? []); setGenerations(generationResult.data ?? []); setTags(tagResult.data ?? []); setRelations(relationResult.data ?? []); setError('') }
  }

  useEffect(() => { loadMembers() }, [])

  async function addMember(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const { data: memberData, error: addError } = await supabase.from('members').insert({
      name: form.name,
      college_id: form.college_id || null,
      major_id: form.major_id || null,
      class_id: form.class_id || null,
      phone: form.phone || null,
      gender: form.gender,
      bio: form.bio,
      retired_status: form.retired_status,
    }).select('id').single()
    if (addError) {
      setError(addError.message)
      return
    }

    if (form.generation_id && memberData) {
      const { data: relationData, error: relationError } = await supabase.from('member_generations').insert({
        member_id: memberData.id,
        generation_id: form.generation_id,
        remark: form.generation_remark,
      }).select('id').single()
      if (relationError) {
        setError(relationError.message)
        return
      }
      if (form.identity_tag_id && relationData) {
        const { error: tagError } = await supabase.from('member_generation_tags').insert({ member_generation_id: relationData.id, identity_tag_id: form.identity_tag_id })
        if (tagError) {
          setError(tagError.message)
          return
        }
      }
    }

    setForm(emptyMemberForm)
    await loadMembers()
  }

  async function deleteMember(id: string) {
    if (!supabase || !window.confirm('确定删除这个成员吗？')) return
    const { error: deleteError } = await supabase.from('members').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else await loadMembers()
  }

  return (
    <div className="admin-page">
      <div className="section-title"><h1>成员管理</h1><span>{items.length} 条记录</span></div>
      {error && <section className="section-card status-warn">{error}</section>}
      <section className="section-card form-card"><h2>新增成员</h2><form className="generation-form" onSubmit={addMember}>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="姓名" required />
        <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="手机号" />
        <select value={form.college_id} onChange={(event) => setForm({ ...form, college_id: event.target.value, major_id: '', class_id: '' })}><option value="">不关联学院</option>{colleges.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select value={form.major_id} onChange={(event) => setForm({ ...form, major_id: event.target.value })}><option value="">不关联专业</option>{majors.filter((item) => !form.college_id || item.college_id === form.college_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select value={form.class_id} onChange={(event) => setForm({ ...form, class_id: event.target.value })}><option value="">不关联班级</option>{classes.filter((item) => !form.college_id || item.college_id === form.college_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} required><option value="">选择性别</option><option value="男">男</option><option value="女">女</option><option value="其他">其他</option></select>
        <select value={form.generation_id} onChange={(event) => setForm({ ...form, generation_id: event.target.value })}><option value="">不关联届次</option>{generations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select value={form.identity_tag_id} onChange={(event) => setForm({ ...form, identity_tag_id: event.target.value })} disabled={!form.generation_id}><option value="">不关联身份标签</option>{tags.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <input value={form.generation_remark} onChange={(event) => setForm({ ...form, generation_remark: event.target.value })} placeholder="届次备注，例如队长、队员、训练骨干" disabled={!form.generation_id} />
        <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="简介" />
        <label><input type="checkbox" checked={form.retired_status} onChange={(event) => setForm({ ...form, retired_status: event.target.checked })} /> 已退役</label>
        <div className="form-actions"><button>添加成员</button></div>
      </form></section>
      <ActionAdminTable title="成员列表" error="" headers={['姓名', '学院', '专业', '班级', '性别', '所属届次', '手机号', '状态']} rows={items.map((item) => {
        const memberRelations = relations.filter((relation) => relation.member_id === item.id)
        const generationNames = memberRelations.map((relation) => generations.find((generation) => generation.id === relation.generation_id)?.name).filter(Boolean).join('、')
        return { id: item.id, cells: [item.name, colleges.find((college) => college.id === item.college_id)?.name, majors.find((major) => major.id === item.major_id)?.name, classes.find((classInfo) => classInfo.id === item.class_id)?.name, item.gender, generationNames || '未关联', item.phone ?? '', item.retired_status ? '已退役' : '在队'] }
      })} onDelete={deleteMember} />
    </div>
  )
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
    if (!supabase) { setError('尚未配置 Supabase，无法管理学院、专业和班级。'); return }
    const [collegeResult, majorResult, classResult] = await Promise.all([supabase.from('colleges').select('id,name').order('name'), supabase.from('majors').select('id,college_id,name').order('name'), supabase.from('classes').select('id,college_id,major_id,name').order('name')])
    if (collegeResult.error || majorResult.error || classResult.error) setError(collegeResult.error?.message ?? majorResult.error?.message ?? classResult.error?.message ?? '分类数据加载失败。')
    else { setCollegeItems(collegeResult.data ?? []); setMajorItems(majorResult.data ?? []); setClassItems(classResult.data ?? []); setMajorCollegeId((collegeResult.data ?? [])[0]?.id ?? ''); setClassCollegeId((collegeResult.data ?? [])[0]?.id ?? ''); setError('') }
  }

  useEffect(() => { loadTaxonomy() }, [])

  async function addCollege(event: React.FormEvent) { event.preventDefault(); if (!supabase) return; const { error: addError } = await supabase.from('colleges').insert({ name: collegeName }); if (addError) setError(addError.message); else { setCollegeName(''); await loadTaxonomy() } }
  async function addMajor(event: React.FormEvent) { event.preventDefault(); if (!supabase) return; const { error: addError } = await supabase.from('majors').insert({ name: majorName, college_id: majorCollegeId }); if (addError) setError(addError.message); else { setMajorName(''); await loadTaxonomy() } }
  async function addClass(event: React.FormEvent) { event.preventDefault(); if (!supabase) return; const { error: addError } = await supabase.from('classes').insert({ name: className, college_id: classCollegeId, major_id: classMajorId || null }); if (addError) setError(addError.message); else { setClassName(''); await loadTaxonomy() } }
  async function deleteItem(table: 'colleges' | 'majors' | 'classes', id: string) { if (!supabase || !window.confirm('确定删除吗？')) return; const { error: deleteError } = await supabase.from(table).delete().eq('id', id); if (deleteError) setError(deleteError.message); else await loadTaxonomy() }

  return (
    <div className="admin-page"><h1>学院 / 班级 / 专业管理</h1>{error && <section className="section-card status-warn">{error}</section>}<div className="taxonomy-grid">
      <TaxonomyCard title="学院" items={collegeItems.map((item) => ({ id: item.id, label: item.name }))} onDelete={(id) => deleteItem('colleges', id)}><form className="taxonomy-form" onSubmit={addCollege}><input value={collegeName} onChange={(event) => setCollegeName(event.target.value)} placeholder="学院名称" required /><button>添加学院</button></form></TaxonomyCard>
      <TaxonomyCard title="专业" items={majorItems.map((item) => ({ id: item.id, label: `${item.name} · ${collegeItems.find((college) => college.id === item.college_id)?.name ?? ''}` }))} onDelete={(id) => deleteItem('majors', id)}><form className="taxonomy-form" onSubmit={addMajor}><input value={majorName} onChange={(event) => setMajorName(event.target.value)} placeholder="专业名称" required /><select value={majorCollegeId} onChange={(event) => setMajorCollegeId(event.target.value)} required>{collegeItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button>添加专业</button></form></TaxonomyCard>
      <TaxonomyCard title="班级" items={classItems.map((item) => ({ id: item.id, label: `${item.name} · ${collegeItems.find((college) => college.id === item.college_id)?.name ?? ''}` }))} onDelete={(id) => deleteItem('classes', id)}><form className="taxonomy-form" onSubmit={addClass}><input value={className} onChange={(event) => setClassName(event.target.value)} placeholder="班级名称" required /><select value={classCollegeId} onChange={(event) => { setClassCollegeId(event.target.value); setClassMajorId('') }} required>{collegeItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={classMajorId} onChange={(event) => setClassMajorId(event.target.value)}><option value="">不关联专业</option>{majorItems.filter((item) => item.college_id === classCollegeId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button>添加班级</button></form></TaxonomyCard>
    </div></div>
  )
}

export function AdminTagsPage() {
  const [items, setItems] = useState<TagRecord[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  async function loadTags() {
    if (!supabase) { setError('尚未配置 Supabase，无法管理身份标签。'); return }
    const { data, error: loadError } = await supabase.from('identity_tags').select('id,name,description').order('name')
    if (loadError) setError(loadError.message)
    else { setItems(data ?? []); setError('') }
  }

  useEffect(() => { loadTags() }, [])

  async function addTag(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    const { error: addError } = await supabase.from('identity_tags').insert({ name, description })
    if (addError) setError(addError.message)
    else { setName(''); setDescription(''); await loadTags() }
  }

  async function deleteTag(id: string) {
    if (!supabase || !window.confirm('确定删除这个身份标签吗？')) return
    const { error: deleteError } = await supabase.from('identity_tags').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else await loadTags()
  }

  return <div className="admin-page"><div className="section-title"><h1>身份标签管理</h1><span>{items.length} 条记录</span></div>{error && <section className="section-card status-warn">{error}</section>}<section className="section-card form-card"><h2>新增身份标签</h2><form className="taxonomy-form" onSubmit={addTag}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="标签名称" required /><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="说明" /><button>添加标签</button></form></section><ActionAdminTable title="标签列表" error="" headers={['标签', '说明']} rows={items.map((item) => ({ id: item.id, cells: [item.name, item.description] }))} onDelete={deleteTag} /></div>
}

export function AdminMediaPage() {
  const [items, setItems] = useState<AdminMediaRecord[]>([])
  const [generations, setGenerations] = useState<GenerationRecord[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AdminMediaEditForm>({ title: '', activity_name: '', taken_date: '', generation_id: '', is_public: true, next_password: '' })
  const [error, setError] = useState('')

  async function loadMedia() {
    if (!supabase) { setError('尚未配置 Supabase，无法管理媒体。'); return }
    const [mediaResult, generationResult, assetResult] = await Promise.all([
      supabase.from('media_items').select('id,title,type,activity_name,taken_date,generation_id,is_public').order('created_at', { ascending: false }),
      supabase.from('generations').select('id,name,year,description,cover_image,slogan').order('year', { ascending: false }),
      supabase.from('media_item_assets').select('media_item_id'),
    ])

    const firstError = mediaResult.error ?? generationResult.error ?? assetResult.error
    if (firstError) {
      setError(firstError.message)
      return
    }

    const countByMediaId = (assetResult.data ?? []).reduce<Record<string, number>>((result, asset) => {
      result[asset.media_item_id] = (result[asset.media_item_id] ?? 0) + 1
      return result
    }, {})

    setItems((mediaResult.data ?? []).map((item) => ({ ...item, asset_count: countByMediaId[item.id] ?? 0 })))
    setGenerations(generationResult.data ?? [])
    setError('')
  }

  useEffect(() => { loadMedia() }, [])

  function startEdit(item: AdminMediaRecord) {
    setEditingId(item.id)
    setForm({
      title: item.title,
      activity_name: item.activity_name ?? '',
      taken_date: item.taken_date ?? '',
      generation_id: item.generation_id ?? '',
      is_public: item.is_public,
      next_password: '',
    })
  }

  async function saveMedia(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase || !editingId) return

    const { error: updateError } = await supabase.from('media_items').update({
      title: form.title,
      activity_name: form.activity_name || null,
      taken_date: form.taken_date || null,
      generation_id: form.generation_id || null,
      year: form.taken_date ? Number(form.taken_date.slice(0, 4)) : null,
      tags: form.taken_date ? [form.taken_date] : [],
      is_public: form.is_public,
      updated_at: new Date().toISOString(),
    }).eq('id', editingId)
    if (updateError) {
      setError(updateError.message)
      return
    }

    if (form.next_password) {
      const { error: passwordError } = await supabase.rpc('admin_update_media_edit_password', {
        media_id: editingId,
        new_password: form.next_password,
      })
      if (passwordError) {
        setError(passwordError.message)
        return
      }
    }

    setEditingId(null)
    setForm({ title: '', activity_name: '', taken_date: '', generation_id: '', is_public: true, next_password: '' })
    await loadMedia()
  }

  async function deleteMedia(id: string) { if (!supabase || !window.confirm('确定删除这条媒体记录吗？')) return; const { error: deleteError } = await supabase.from('media_items').delete().eq('id', id); if (deleteError) setError(deleteError.message); else await loadMedia() }

  return <div className="admin-page">
    <div className="section-title"><h1>媒体管理</h1><span>{items.length} 条记录</span></div>
    {error && <section className="section-card status-warn">{error}</section>}
    {editingId && <section className="section-card form-card"><h2>编辑媒体</h2><form className="generation-form" onSubmit={saveMedia}>
      <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="标题" required />
      <input value={form.activity_name} onChange={(event) => setForm({ ...form, activity_name: event.target.value })} placeholder="上传者姓名" />
      <input value={form.taken_date} onChange={(event) => setForm({ ...form, taken_date: event.target.value })} type="date" />
      <select value={form.generation_id} onChange={(event) => setForm({ ...form, generation_id: event.target.value })}><option value="">不关联届次</option>{generations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <label><input type="checkbox" checked={form.is_public} onChange={(event) => setForm({ ...form, is_public: event.target.checked })} /> 公开显示</label>
      <input value={form.next_password} onChange={(event) => setForm({ ...form, next_password: event.target.value })} placeholder="重置编辑密码（可选）" />
      <div className="form-actions"><button>保存修改</button><button type="button" className="secondary-button" onClick={() => setEditingId(null)}>取消编辑</button></div>
    </form></section>}
    <div className="table-wrap"><table><thead><tr><th>标题</th><th>类型</th><th>上传者</th><th>届次</th><th>文件数</th><th>公开</th><th>操作</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.type === 'video' ? '视频' : '图片'}</td><td>{item.activity_name ?? ''}</td><td>{generations.find((generation) => generation.id === item.generation_id)?.name ?? ''}</td><td>{item.asset_count}</td><td>{item.is_public ? '是' : '否'}</td><td><button onClick={() => startEdit(item)}>编辑</button><button className="danger" onClick={() => deleteMedia(item.id)}>删除</button></td></tr>)}</tbody></table></div>
  </div>
}

export function AdminMessagesPage() {
  const [items, setItems] = useState<AdminMessageRecord[]>([])
  const [error, setError] = useState('')
  async function loadMessages() { if (!supabase) { setError('尚未配置 Supabase，无法管理留言。'); return } const { data, error: loadError } = await supabase.from('messages').select('id,author_name,content,created_at').order('created_at', { ascending: false }); if (loadError) setError(loadError.message); else { setItems(data ?? []); setError('') } }
  useEffect(() => { loadMessages() }, [])
  async function deleteMessage(id: string) { if (!supabase || !window.confirm('确定删除这条留言吗？')) return; const { error: deleteError } = await supabase.from('messages').delete().eq('id', id); if (deleteError) setError(deleteError.message); else await loadMessages() }
  return <ActionAdminTable title="留言管理" error={error} headers={['署名', '内容', '时间']} rows={items.map((item) => ({ id: item.id, cells: [item.author_name, item.content, new Date(item.created_at).toLocaleString()] }))} onDelete={deleteMessage} />
}

export function AdminPermissionsPage() {
  return <ReadOnlyAdminTable title="权限设置" note="权限当前由 Supabase SQL 初始化，暂未提供页面编辑入口。" headers={['角色', '说明', '权限码']} rows={roles.map((item) => [item.name, item.description, item.permissions.join('、') || '公开访问'])} />
}

export function AdminImportExportPage() {
  const canViewPhone = can(defaultRole, 'phone.view')
  return <div className="admin-page"><h1>Excel 导入导出</h1><section className="section-card form-card"><p>当前支持导出演示成员数据；Excel 导入尚未接入数据库写入。</p><button onClick={() => exportMembers(members, canViewPhone)}>导出成员数据{canViewPhone ? '（含手机号）' : '（公开版）'}</button></section></div>
}

export function AdminSettingsPage() {
  const [settings, setSettings] = useState<PublicSettings>(defaultSettings)
  const [mediaStorageQuotaGb, setMediaStorageQuotaGb] = useState('10')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSettings().then(setSettings).catch((err) => setError(err instanceof Error ? err.message : '设置加载失败。'))
    if (!supabase) return
    supabase.from('system_settings').select('value').eq('key', 'mediaStorageQuotaBytes').maybeSingle().then(({ data, error: loadError }) => {
      if (loadError) {
        setError(loadError.message)
        return
      }
      const bytes = Number(data?.value ?? 10 * bytesPerGb)
      setMediaStorageQuotaGb((bytes / bytesPerGb).toString())
    })
  }, [])

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setSaving(true)
    const rows = [
      ...Object.entries(settings).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() })),
      { key: 'mediaStorageQuotaBytes', value: Math.max(Number(mediaStorageQuotaGb) || 0, 0) * bytesPerGb, updated_at: new Date().toISOString() },
    ]
    const { error: saveError } = await supabase.from('system_settings').upsert(rows)
    if (saveError) setError(saveError.message)
    else setError('')
    setSaving(false)
  }

  return <div className="admin-page"><h1>系统设置</h1>{error && <section className="section-card status-warn">{error}</section>}<form className="section-card settings-grid" onSubmit={saveSettings}><label><input type="checkbox" checked={settings.imageUploadEnabled} onChange={(event) => setSettings({ ...settings, imageUploadEnabled: event.target.checked })} /> 图片上传开放</label><label><input type="checkbox" checked={settings.videoUploadEnabled} onChange={(event) => setSettings({ ...settings, videoUploadEnabled: event.target.checked })} /> 视频上传开放</label><label><input type="checkbox" checked={settings.messageEnabled} onChange={(event) => setSettings({ ...settings, messageEnabled: event.target.checked })} /> 留言开放</label><div><span>媒体库总量（GB）</span><input className="storage-input" type="number" min="0" step="0.1" value={mediaStorageQuotaGb} onChange={(event) => setMediaStorageQuotaGb(event.target.value)} /></div><p className="storage-help">前台和后台显示的剩余空间，会按这里设置的总量减去 media bucket 实际已用空间计算。</p><div className="form-actions"><button disabled={saving}>{saving ? '保存中...' : '保存设置'}</button></div></form></div>
}

function ReadOnlyAdminTable({ title, note, headers, rows }: { title: string; note: string; headers: string[]; rows: Array<Array<string | number | undefined>> }) {
  return <div className="admin-page"><div className="section-title"><h1>{title}</h1></div><section className="section-card status-warn">{note}</section><SimpleTable headers={headers} rows={rows} /></div>
}

function ActionAdminTable({ title, error, headers, rows, onDelete }: { title: string; error: string; headers: string[]; rows: Array<{ id: string; cells: Array<string | number | undefined> }>; onDelete: (id: string) => void }) {
  return <div className="admin-page"><div className="section-title"><h1>{title}</h1><span>{rows.length} 条记录</span></div>{error && <section className="section-card status-warn">{error}</section>}<div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}<th>操作</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{row.cells.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}<td><button className="danger" onClick={() => onDelete(row.id)}>删除</button></td></tr>)}</tbody></table></div></div>
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number | undefined>> }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>
}

function TaxonomyCard({ title, items, children, onDelete }: { title: string; items: Array<{ id: string; label: string }>; children: React.ReactNode; onDelete: (id: string) => void }) {
  return <section className="section-card taxonomy-card"><h2>{title}</h2>{children}<div className="taxonomy-list">{items.map((item) => <div key={item.id}><span>{item.label}</span><button className="danger" onClick={() => onDelete(item.id)}>删除</button></div>)}</div></section>
}
