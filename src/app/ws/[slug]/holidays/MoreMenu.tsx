'use client'

import { useState, useEffect, useRef } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'

export function MoreMenu({ onAdd }: { onAdd: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          height: '32px', width: '32px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: '1px solid var(--border)',
          borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)',
        }}
      >
        <MoreHorizontal size={15} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '36px', right: 0, zIndex: 50,
          background: 'var(--surface-0)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '4px', minWidth: '140px',
        }}>
          <button
            type="button"
            onClick={() => { onAdd(); setOpen(false) }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            style={{
              width: '100%', height: '34px', padding: '0 10px',
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'transparent', border: 'none', borderRadius: '5px',
              fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
              color: 'var(--navy)', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <Plus size={13} />
            Add holiday
          </button>
        </div>
      )}
    </div>
  )
}
