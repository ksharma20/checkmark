'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Workspace {
  id: string
  slug: string
  name: string
  plan: string
  archived_at: string | null
}

interface Props {
  workspaces: Workspace[]
  archivedWorkspaces: Workspace[]
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '44px',
  padding: '0 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: '14px',
  fontFamily: 'DM Sans, sans-serif',
  background: 'var(--surface-0)',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
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

      <div>
        <label style={{ display: 'block', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
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
          <p style={{ fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: slugColor, marginTop: '5px' }}>
            {slugMsg}
          </p>
        )}
        {slug && slugState === 'available' && (
          <p style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-muted)', marginTop: '3px' }}>
            /ws/{slug}
          </p>
        )}
      </div>

      {error && (
        <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={loading || slugState !== 'available' || !orgName.trim()}
        style={{
          width: '100%',
          height: '48px',
          background: 'var(--brand)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: '15px',
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 600,
          cursor: (loading || slugState !== 'available' || !orgName.trim()) ? 'not-allowed' : 'pointer',
          opacity: (loading || slugState !== 'available' || !orgName.trim()) ? 0.6 : 1,
        }}
      >
        {loading ? 'Creating…' : 'Create workspace'}
      </button>
    </div>
  )
}

export default function WsClient({ workspaces, archivedWorkspaces }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  function handleCreated(slug: string) {
    router.push(`/ws/${slug}`)
  }

  const hasAny = workspaces.length > 0 || archivedWorkspaces.length > 0

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--surface-1)',
        display: 'flex',
        justifyContent: 'center',
        padding: '40px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Header */}
        {!showForm && (
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--navy)',
              margin: '0 0 6px',
              lineHeight: 1.2,
            }}>
              {hasAny ? 'Your workspaces' : 'No workspaces yet'}
            </h1>
            <p style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '14px',
              color: 'var(--text-muted)',
              margin: 0,
            }}>
              {hasAny ? 'Select a workspace or create a new one.' : 'Create a workspace to manage your team.'}
            </p>
          </div>
        )}

        {/* Active workspaces */}
        {workspaces.length > 0 && !showForm && (
          <div style={{ marginBottom: '12px' }}>
            <p style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.09em',
              marginBottom: '8px',
            }}>
              Active
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {workspaces.map((ws) => (
                <Link
                  key={ws.id}
                  href={`/ws/${ws.slug}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--surface-0)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    textDecoration: 'none',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div>
                    <p style={{
                      fontFamily: 'DM Sans, sans-serif',
                      fontWeight: 600,
                      fontSize: '15px',
                      color: 'var(--text-primary)',
                      marginBottom: '2px',
                    }}>
                      {ws.name}
                    </p>
                    <p style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                    }}>
                      /ws/{ws.slug}
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Archived workspaces */}
        {archivedWorkspaces.length > 0 && !showForm && (
          <div style={{ marginBottom: '12px' }}>
            <p style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.09em',
              marginBottom: '8px',
            }}>
              Archived
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {archivedWorkspaces.map((ws) => (
                <Link
                  key={ws.id}
                  href={`/ws/${ws.slug}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--surface-0)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    textDecoration: 'none',
                    opacity: 0.6,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <p style={{
                        fontFamily: 'DM Sans, sans-serif',
                        fontWeight: 600,
                        fontSize: '15px',
                        color: 'var(--text-primary)',
                        margin: 0,
                      }}>
                        {ws.name}
                      </p>
                      <span style={{
                        fontSize: '10px',
                        fontFamily: 'DM Sans, sans-serif',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: '20px',
                        padding: '1px 7px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        Archived
                      </span>
                    </div>
                    <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                      /ws/{ws.slug}
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* New workspace button */}
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{
              width: '100%',
              height: '48px',
              background: hasAny ? 'transparent' : 'var(--brand)',
              border: hasAny ? '1.5px dashed var(--border)' : 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              color: hasAny ? 'var(--brand)' : '#fff',
              marginTop: hasAny ? '8px' : '0',
              marginBottom: '24px',
            }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span>
            New workspace
          </button>
        )}

        {/* Create form */}
        {showForm && (
          <div style={{
            background: 'var(--surface-0)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '28px',
            marginBottom: '20px',
          }}>
            <h2 style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--navy)',
              marginBottom: '6px',
            }}>
              Create workspace
            </h2>
            <p style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '13px',
              color: 'var(--text-muted)',
              marginBottom: '24px',
            }}>
              Organisation features are separate from your personal /me dashboard.
            </p>
            <CreateWorkspaceForm onCreated={handleCreated} />
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                marginTop: '16px',
                background: 'none',
                border: 'none',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: '13px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              ← Cancel
            </button>
          </div>
        )}

        {/* Back link */}
        <Link href="/me" style={{
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '13px',
          color: 'var(--text-muted)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          ← Back to personal dashboard
        </Link>
      </div>
    </div>
  )
}
