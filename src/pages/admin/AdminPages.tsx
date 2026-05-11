import { exportMembers } from '../../lib/excel'
import { can, defaultRole } from '../../lib/auth'
import { classes, colleges, generations, identityTags, mediaItems, members, messages, roles, systemSettings } from '../../data/demo'

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
  return <AdminTable title="届次管理" headers={['届次', '年份', '简介']} rows={generations.map((item) => [item.name, item.year, item.description])} />
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
