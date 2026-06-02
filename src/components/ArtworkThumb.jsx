import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ArtworkThumb({ path, size = 44, radius = 4 }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!path) return
    supabase.storage.from('tracks').createSignedUrl(path, 3600)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl) })
  }, [path])

  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      background: 'var(--surface-2)',
      border: '1.5px solid var(--border)',
      borderRadius: radius,
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <span style={{ fontSize: Math.round(size * 0.38), opacity: 0.2, userSelect: 'none' }}>♪</span>
      }
    </div>
  )
}
