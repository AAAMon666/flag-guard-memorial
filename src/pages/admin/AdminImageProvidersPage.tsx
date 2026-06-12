import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type ProviderRecord = {
  id: string
  name: string
  officialUrl: string | null
  apiRootUrl: string | null
  apiV1Url: string
  model: string
  notes: string
  isActive: boolean
  apiKeyStatus: string
  hasApiKey: boolean
  updatedAt: string
}

type ProviderForm = {
  id: string
  name: string
  officialUrl: string
  apiRootUrl: string
  apiV1Url: string
  model: string
  notes: string
  apiKey: string
  isActive: boolean
}

const emptyProviderForm: ProviderForm = {
  id: '',
  name: '',
  officialUrl: '',
  apiRootUrl: '',
  apiV1Url: '',
  model: 'gpt-image-2',
  notes: '',
  apiKey: '',
  isActive: true,
}

export function AdminImageProvidersPage() {
  const [items, setItems] = useState<ProviderRecord[]>([])
  const [form, setForm] = useState<ProviderForm>(emptyProviderForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadProviders() {
    if (!supabase) {
      setError('尚未配置 Supabase，无法管理生图供应商。')
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: invokeError } = await supabase.functions.invoke('admin-image-provider', {
      body: { action: 'list' },
    })

    if (invokeError) setError(invokeError.message)
    else {
      setItems(Array.isArray(data?.items) ? data.items : [])
      setError('')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadProviders().catch((err) => {
      setError(err instanceof Error ? err.message : '供应商加载失败。')
      setLoading(false)
    })
  }, [])

  function startEdit(item: ProviderRecord) {
    setForm({
      id: item.id,
      name: item.name,
      officialUrl: item.officialUrl ?? '',
      apiRootUrl: item.apiRootUrl ?? '',
      apiV1Url: item.apiV1Url,
      model: item.model,
      notes: item.notes,
      apiKey: '',
      isActive: item.isActive,
    })
    setError('')
  }

  function resetForm() {
    setForm(emptyProviderForm)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return

    setSaving(true)
    const { data, error: invokeError } = await supabase.functions.invoke('admin-image-provider', {
      body: {
        action: 'upsert',
        payload: {
          id: form.id || undefined,
          name: form.name,
          officialUrl: form.officialUrl,
          apiRootUrl: form.apiRootUrl,
          apiV1Url: form.apiV1Url,
          model: form.model,
          notes: form.notes,
          apiKey: form.apiKey,
          isActive: form.isActive,
        },
      },
    })

    if (invokeError) setError(invokeError.message)
    else if (data?.error) setError(data.error)
    else {
      setItems(Array.isArray(data?.items) ? data.items : [])
      resetForm()
      setError('')
    }
    setSaving(false)
  }

  async function deleteProvider(id: string) {
    if (!supabase || !window.confirm('确定删除这个供应商吗？')) return
    const { data, error: invokeError } = await supabase.functions.invoke('admin-image-provider', {
      body: { action: 'delete', id },
    })
    if (invokeError) setError(invokeError.message)
    else if (data?.error) setError(data.error)
    else {
      setItems(Array.isArray(data?.items) ? data.items : [])
      if (form.id === id) resetForm()
      setError('')
    }
  }

  async function activateProvider(id: string) {
    if (!supabase) return
    const { data, error: invokeError } = await supabase.functions.invoke('admin-image-provider', {
      body: { action: 'activate', id },
    })
    if (invokeError) setError(invokeError.message)
    else if (data?.error) setError(data.error)
    else {
      setItems(Array.isArray(data?.items) ? data.items : [])
      if (form.id === id) setForm((current) => ({ ...current, isActive: true }))
      setError('')
    }
  }

  return (
    <div className="admin-page">
      <div className="section-title">
        <h1>生图供应商</h1>
        <span>{loading ? '加载中...' : `${items.length} 条记录`}</span>
      </div>

      {error && <section className="section-card status-warn">{error}</section>}

      <section className="section-card form-card">
        <h2>{form.id ? '编辑供应商' : '新增供应商'}</h2>
        <form className="generation-form" onSubmit={handleSubmit}>
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="供应商名称" required />
          <input value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} placeholder="模型名，例如 gpt-image-1" required />
          <input value={form.officialUrl} onChange={(event) => setForm((current) => ({ ...current, officialUrl: event.target.value }))} placeholder="官网地址" />
          <input value={form.apiRootUrl} onChange={(event) => setForm((current) => ({ ...current, apiRootUrl: event.target.value }))} placeholder="API 根地址" />
          <input value={form.apiV1Url} onChange={(event) => setForm((current) => ({ ...current, apiV1Url: event.target.value }))} placeholder="API /v1 地址" required />
          <input value={form.apiKey} onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))} type="password" placeholder={form.id ? '留空则保持当前 API Key' : 'API Key'} />
          <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="备注" />
          <label><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /> 设为当前启用供应商</label>
          <div className="form-actions">
            <button disabled={saving}>{saving ? '保存中...' : form.id ? '保存修改' : '新增供应商'}</button>
            {form.id && <button type="button" className="secondary-button" onClick={resetForm}>取消编辑</button>}
          </div>
        </form>
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>供应商</th>
              <th>模型</th>
              <th>官网</th>
              <th>/v1 地址</th>
              <th>API Key</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.model}</td>
                <td>{item.officialUrl || ''}</td>
                <td>{item.apiV1Url}</td>
                <td>{item.apiKeyStatus}</td>
                <td>{item.isActive ? '启用中' : '未启用'}</td>
                <td>
                  <button type="button" onClick={() => startEdit(item)}>编辑</button>
                  {!item.isActive && <button type="button" className="secondary-button" onClick={() => activateProvider(item.id)}>启用</button>}
                  <button type="button" className="danger" onClick={() => deleteProvider(item.id)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
