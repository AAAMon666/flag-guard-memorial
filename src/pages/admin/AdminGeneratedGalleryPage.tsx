import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type GeneratedGalleryAdminItem = {
  id: string
  title: string
  prompt: string
  mode: 'text-to-image' | 'image-to-image'
  quality: string
  resolution: string
  providerName: string
  model: string
  imageUrl: string
  createdAt: string
}

export function AdminGeneratedGalleryPage() {
  const [items, setItems] = useState<GeneratedGalleryAdminItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')

  async function loadItems() {
    if (!supabase) {
      setError('尚未配置 Supabase，无法管理作品集。')
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: invokeError } = await supabase.functions.invoke('admin-generated-gallery', {
      body: { action: 'list' },
    })

    if (invokeError) {
      setError(invokeError.message)
    } else if (data?.error) {
      setError(data.error)
    } else {
      setItems(Array.isArray(data?.items) ? data.items : [])
      setError('')
    }

    setLoading(false)
  }

  useEffect(() => {
    loadItems().catch((err) => {
      setError(err instanceof Error ? err.message : '作品集加载失败。')
      setLoading(false)
    })
  }, [])

  async function deleteItem(id: string) {
    if (!supabase || !window.confirm('确定删除这件作品吗？删除后会同时清理作品集记录和存储图片。')) return

    setDeletingId(id)
    const { data, error: invokeError } = await supabase.functions.invoke('admin-generated-gallery', {
      body: { action: 'delete', id },
    })

    if (invokeError) {
      setError(invokeError.message)
    } else if (data?.error) {
      setError(data.error)
    } else {
      setItems(Array.isArray(data?.items) ? data.items : [])
      setError('')
    }

    setDeletingId('')
  }

  return (
    <div className="admin-page">
      <div className="section-title">
        <h1>作品集管理</h1>
        <span>{loading ? '加载中...' : `${items.length} 件作品`}</span>
      </div>

      {error && <section className="section-card status-warn">{error}</section>}

      {items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>预览</th>
                <th>标题</th>
                <th>提示词</th>
                <th>模式</th>
                <th>参数</th>
                <th>供应商</th>
                <th>发布时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <a href={item.imageUrl} target="_blank" rel="noreferrer">
                      <img className="admin-generated-thumb" src={item.imageUrl} alt={item.title || '作品预览'} />
                    </a>
                  </td>
                  <td>{item.title || '未命名作品'}</td>
                  <td className="admin-generated-prompt">{item.prompt}</td>
                  <td>{item.mode === 'text-to-image' ? '文生图' : '图生图'}</td>
                  <td>{item.resolution} / {item.quality}</td>
                  <td>{item.providerName || item.model || '默认供应商'}</td>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="danger"
                      disabled={deletingId === item.id}
                      onClick={() => deleteItem(item.id)}
                    >
                      {deletingId === item.id ? '删除中...' : '删除'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section className="section-card empty-state">{loading ? '作品集加载中...' : '当前还没有公开作品。'}</section>
      )}
    </div>
  )
}
