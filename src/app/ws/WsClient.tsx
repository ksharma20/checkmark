'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Workspace {
  id: string
  slug: string
  name: string
  plan: string
}

interface Props {
  workspaces: Workspace[]
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '44px',
  padding: '0 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '14px',
  fontFamily: 'DM Sans, sans-serif',
  background: 'var(--surface-2)',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .slice(0, 50)
}

function CreateWorkspaceForm({ onCreated }: { onCreated: (slug: string) => void }) {
  const [orgName, setOrgName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugState, setSlugState] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [slugTimer, setSlugTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOrgName(val: string) {
    setOrgName(val)
    const generated = slugify(val)
    handleSlugChange(generated)
  }

  function handleSlugChange(val: string) {
    setSlug(val)
    if (slugTimer) clearTimeout(slugTimer)
    if (!val) { setSlugState('idle'); return }
    if (!/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/.test(val) && val.length > 1) {
      setSlugState('invalid'); return
    }
    setSlugState('checking')
    setSlugTimer(setTimeout(async () => {
      const res = await fetch('/api/workspace/check-slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: val }),
      })
      const data = await res.json()
      setSlugState(data.available ? 'available' : 'taken')
    }, 400))
  }

  async function submit() {
    if (!orgName.trim() || !slug) return
    if (slugState !== 'available') return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName.trim(), slug }),
      })
      const data = await res.json()
      if (res.ok) {
        onCreated(data.workspace.slug)
      } else {
        setError(data.error || 'Failed to create workspace')
      }
    } finally {
      setLoading(false)
    }
  }

  const slugColor =
    slugState === 'available' ? 'var(--teal)' :
    slugState === 'taken' || slugState === 'invalid' ? 'var(--danger)' :
    'var(--text-muted)'

  const slugMsg =
    slugState === 'available' ? '✓ Available' :
    slugState === 'taken' ? '✗ Already taken' :
    slugState === 'invalid' ? '✗ Lowercase letters, numbers and hyphens only' :
    slugState === 'checking' ? 'Checking…' : ''

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '5px' }}>
          Organisation name
        </label>
        <input
          type="text"
          value={orgName}
          onChange={(e) => handleOrgName(e.target.value)}
          placeholder="Acme Corp"
          style={inputStyle}
          autoFocus
        />
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '5px' }}>
          Workspace URL handle
        </label>
        <input
          type="text"
          value={slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          placeholder="acme-corp"
          style={inputStyle}
        />
        {slugMsg && (
          <p style={{ fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: slugColor, marginTop: '4px' }}>
            {slugMsg}
          </p>
        )}
        {slug && slugState === 'available' && (
          <p style={{ fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)', marginTop: '2px' }}>
            Your workspace: /ws/{slug}
          </p>
        )}
      </div>

      {error && (
        <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--danger)', marginBottom: '12px' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={loading || slugState !== 'available' || !orgName.trim()}
        style={{
          width: '100%',
          height: '44px',
          background: 'var(--brand)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: '14px',
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 500,
          cursor: (loading || slugState !== 'available' || !orgName.trim()) ? 'not-allowed' : 'pointer',
          opacity: (loading || slugState !== 'available' || !orgName.trim()) ? 0.6 : 1,
        }}
      >
        {loading ? 'Creating…' : 'Create workspace'}
      </button>
    </div>
  )
}

export default function WsClient({ workspaces }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  function handleCreated(slug: string) {
    router.push(`/ws/${slug}`)
  }

  if (workspaces.length === 0 && !showForm) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: 'var(--surface-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '480px' }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: 'var(--brand)', marginBottom: '24px' }}>
            CheckMark
          </p>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
            No workspaces yet
          </h1>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Create a workspace to start managing your team&apos;s presence data.
          </p>

          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{
              width: '100%',
              height: '80px',
              background: 'var(--surface-0)',
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--brand)',
              marginBottom: '20px',
            }}
          >
            <span style={{ fontSize: '24px', lineHeight: 1 }}>+</span>
            Create a workspace
          </button>

          <Link href="/me" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
            ← Back to personal dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (workspaces.length === 0 || showForm) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: 'var(--surface-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '480px' }}>
          <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: 'var(--brand)', marginBottom: '24px' }}>
            CheckMark
          </p>
          <div
            style={{
              background: 'var(--surface-0)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '28px',
              marginBottom: '16px',
            }}
          >
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', padding: '10px 12px', background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              Creating a workspace adds organisation features to your account. Your personal check-in history at /me is not affected.
            </p>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--navy)', marginBottom: '20px' }}>
              Create workspace
            </h2>
            <CreateWorkspaceForm onCreated={handleCreated} />
          </div>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            style={{ background: 'none', border: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
          >
            ← Back
          </button>
        </div>
      </div>
    )
  }

  // Multiple workspaces — picker + add more
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--surface-1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '480px' }}>
        <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '18px', color: 'var(--brand)', marginBottom: '24px' }}>
          CheckMark
        </p>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' }}>
          Your workspaces
        </h1>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Select a workspace to view its dashboard.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {workspaces.map((ws) => (
            <Link
              key={ws.id}
              href={`/ws/${ws.slug}`}
              style={{
                display: 'block',
                background: 'var(--surface-0)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 18px',
                textDecoration: 'none',
              }}
            >
              <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '15px', color: 'var(--navy)', marginBottom: '2px' }}>
                {ws.name}
              </p>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--text-muted)' }}>
                /ws/{ws.slug}
              </p>
            </Link>
          ))}

          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              style={{
                height: '60px',
                background: 'var(--surface-0)',
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1 }}>+</span>
              Add workspace
            </button>
          )}
        </div>

        {showForm && (
          <div style={{ background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '12px' }}>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700, color: 'var(--navy)', marginBottom: '16px' }}>
              New workspace
            </h2>
            <CreateWorkspaceForm onCreated={handleCreated} />
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{ marginTop: '12px', background: 'none', border: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
            >
              Cancel
            </button>
          </div>
        )}

        <Link href="/me" style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
          ← Back to personal dashboard
        </Link>
      </div>
    </div>
  )
}
