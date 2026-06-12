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
      setError('灏氭湭閰嶇疆 Supabase锛屾棤娉曠鐞嗕綔鍝侀泦銆?)
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
      setError(err instanceof Error ? err.message : '浣滃搧闆嗗姞杞藉け璐ャ€?)
      setLoading(false)
    })
  }, [])

  async function deleteItem(id: string) {
    if (!supabase || !window.confirm('纭畾鍒犻櫎杩欎欢浣滃搧鍚楋紵鍒犻櫎鍚庝細鍚屾椂娓呯悊浣滃搧闆嗚褰曞拰瀛樺偍鍥剧墖銆?)) return

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
        <h1>浣滃搧闆嗙鐞?/h1>
        <span>{loading ? '鍔犺浇涓?..' : `${items.length} 浠朵綔鍝乣}</span>
      </div>

      {error && <section className="section-card status-warn">{error}</section>}

      {items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>棰勮</th>
                <th>鏍囬</th>
                <th>鎻愮ず璇?/th>
                <th>妯″紡</th>
                <th>鍙傛暟</th>
                <th>渚涘簲鍟?/th>
                <th>鍙戝竷鏃堕棿</th>
                <th>鎿嶄綔</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <a href={item.imageUrl} target="_blank" rel="noreferrer">
                      <img className="admin-generated-thumb" src={item.imageUrl} alt={item.title || '浣滃搧棰勮'} />
                    </a>
                  </td>
                  <td>{item.title || '鏈懡鍚嶄綔鍝?}</td>
                  <td className="admin-generated-prompt">{item.prompt}</td>
                  <td>{item.mode === 'text-to-image' ? '鏂囩敓鍥? : '鍥剧敓鍥?}</td>
                  <td>{item.resolution} / {item.quality}</td>
                  <td>{item.providerName || item.model || '榛樿渚涘簲鍟?}</td>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="danger"
                      disabled={deletingId === item.id}
                      onClick={() => deleteItem(item.id)}
                    >
                      {deletingId === item.id ? '鍒犻櫎涓?..' : '鍒犻櫎'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <section className="section-card empty-state">{loading ? '浣滃搧闆嗗姞杞戒腑...' : '褰撳墠杩樻病鏈夊叕寮€浣滃搧銆?}</section>
      )}
    </div>
  )
}
