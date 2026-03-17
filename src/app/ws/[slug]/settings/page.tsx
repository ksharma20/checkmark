'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

// ─── Timezone options ─────────────────────────────────────────────────────────

const TIMEZONES = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Vancouver', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'Europe/Amsterdam', 'Europe/Zurich', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Colombo', 'Asia/Dhaka',
  'Asia/Bangkok', 'Asia/Singapore', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
]

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        marginBottom: '16px',
      }}
    >
      <h2
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--navy)',
          marginBottom: '16px',
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label
        style={{
          display: 'block',
          fontSize: '12px',
          fontFamily: 'DM Sans, sans-serif',
          color: 'var(--text-secondary)',
          marginBottom: '5px',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
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

function PrimaryBtn({ children, onClick, loading, small }: {
  children: React.ReactNode
  onClick?: () => void
  loading?: boolean
  small?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        height: small ? '36px' : '44px',
        padding: small ? '0 14px' : '0 20px',
        background: 'var(--brand)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        fontSize: small ? '13px' : '14px',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 500,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        flexShrink: 0,
      }}
    >
      {loading ? '…' : children}
    </button>
  )
}

function StatusLine({ msg }: { msg: { text: string; ok: boolean } | null }) {
  if (!msg) return null
  return (
    <p
      style={{
        fontSize: '13px',
        fontFamily: 'DM Sans, sans-serif',
        color: msg.ok ? 'var(--teal)' : 'var(--danger)',
        marginTop: '8px',
      }}
    >
      {msg.text}
    </p>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DomainRow {
  id: string
  domain: string
  verified_at: string | null
  verifyToken: string | null
}

// ─── Workspace details section ────────────────────────────────────────────────

function WorkspaceSection({ slug }: { slug: string }) {
  const [name, setName] = useState('')
  const [tz, setTz] = useState('UTC')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    // Derive name from slug as a placeholder — actual name is shown after save
    // We don't have a GET endpoint for ws details, so we read from the page title on first render
    // The slug is the only thing we have without a dedicated GET
  }, [])

  async function save() {
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || undefined, displayTimezone: tz }),
      })
      setStatus(res.ok ? { text: 'Settings saved', ok: true } : { text: 'Save failed', ok: false })
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard title="Workspace details">
      <FieldGroup label="Workspace name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Organisation"
          style={inputStyle}
        />
      </FieldGroup>
      <FieldGroup label="Timezone">
        <select
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          {TIMEZONES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </FieldGroup>
      <p
        style={{
          fontSize: '12px',
          fontFamily: 'DM Sans, sans-serif',
          color: 'var(--text-muted)',
          marginBottom: '14px',
          marginTop: '-8px',
        }}
      >
        The Today dashboard uses this timezone to determine the current day.
      </p>
      <PrimaryBtn onClick={save} loading={loading}>Save settings</PrimaryBtn>
      <StatusLine msg={status} />
    </SectionCard>
  )
}

// ─── Domain verification section ─────────────────────────────────────────────

function DomainsSection({ slug }: { slug: string }) {
  const [domains, setDomains] = useState<DomainRow[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [adding, setAdding] = useState(false)
  const [addStatus, setAddStatus] = useState<{ text: string; ok: boolean } | null>(null)
  const [verifyStatus, setVerifyStatus] = useState<Record<string, { text: string; ok: boolean }>>({})
  const [copied, setCopied] = useState<string | null>(null)

  const loadDomains = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/domain`)
    if (res.ok) {
      const data = await res.json()
      setDomains(data.domains ?? [])
    }
  }, [slug])

  useEffect(() => { loadDomains() }, [loadDomains])

  async function addDomain() {
    const d = newDomain.trim().toLowerCase()
    if (!d) return
    setAdding(true)
    setAddStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: d }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewDomain('')
        await loadDomains()
        setAddStatus({ text: `${d} added`, ok: true })
      } else {
        setAddStatus({ text: data.error || 'Failed to add domain', ok: false })
      }
    } finally {
      setAdding(false)
    }
  }

  async function removeDomain(id: string) {
    if (!confirm('Remove this domain?')) return
    const res = await fetch(`/api/ws/${slug}/domain/${id}`, { method: 'DELETE' })
    if (res.ok) setDomains((prev) => prev.filter((d) => d.id !== id))
  }

  async function checkVerification(domain: DomainRow) {
    setVerifyStatus((p) => ({ ...p, [domain.id]: { text: 'Checking DNS…', ok: true } }))
    const res = await fetch(`/api/ws/${slug}/domain/${domain.id}/verify`, { method: 'POST' })
    const data = await res.json()
    if (data.verified) {
      setVerifyStatus((p) => ({ ...p, [domain.id]: { text: '✓ Domain verified', ok: true } }))
      await loadDomains()
    } else {
      setVerifyStatus((p) => ({ ...p, [domain.id]: { text: data.message || 'Not found yet', ok: false } }))
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <SectionCard title="Email domain verification">
      <p
        style={{
          fontSize: '13px',
          fontFamily: 'DM Sans, sans-serif',
          color: 'var(--text-secondary)',
          marginBottom: '16px',
        }}
      >
        Verified domains enable auto-enrolment: employees who sign up with a matching email are
        automatically added as members.
      </p>

      {domains.map((d) => (
        <div
          key={d.id}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: d.verified_at ? 0 : '12px' }}>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '13px',
                color: 'var(--text-primary)',
                flex: 1,
              }}
            >
              {d.domain}
            </span>
            {d.verified_at ? (
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'DM Sans, sans-serif',
                  fontWeight: 600,
                  color: 'var(--teal)',
                  background: 'color-mix(in srgb, var(--teal) 12%, transparent)',
                  border: '1px solid var(--teal)',
                  borderRadius: '4px',
                  padding: '2px 7px',
                }}
              >
                Verified
              </span>
            ) : (
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'DM Sans, sans-serif',
                  fontWeight: 600,
                  color: 'var(--amber)',
                  background: 'color-mix(in srgb, var(--amber) 12%, transparent)',
                  border: '1px solid var(--amber)',
                  borderRadius: '4px',
                  padding: '2px 7px',
                }}
              >
                Unverified
              </span>
            )}
            <button
              onClick={() => removeDomain(d.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--danger)',
                fontSize: '12px',
                fontFamily: 'DM Sans, sans-serif',
                cursor: 'pointer',
                padding: '0 4px',
              }}
            >
              Remove
            </button>
          </div>

          {!d.verified_at && d.verifyToken && (
            <div
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
                marginBottom: '10px',
              }}
            >
              <p
                style={{
                  fontSize: '12px',
                  fontFamily: 'DM Sans, sans-serif',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                }}
              >
                Add this DNS TXT record, then click &ldquo;Check verification&rdquo;:
              </p>
              {[
                { label: 'Name', value: `_checkmark-verify.${d.domain}` },
                { label: 'Value', value: `checkmark-verify=${d.verifyToken}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', width: '40px', flexShrink: 0 }}>
                    {label}
                  </span>
                  <code
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '11px',
                      color: 'var(--text-primary)',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      padding: '3px 6px',
                      flex: 1,
                      wordBreak: 'break-all',
                    }}
                  >
                    {value}
                  </code>
                  <button
                    onClick={() => copyToClipboard(value, `${d.id}-${label}`)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontFamily: 'DM Sans, sans-serif',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {copied === `${d.id}-${label}` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!d.verified_at && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PrimaryBtn small onClick={() => checkVerification(d)}>
                Check verification
              </PrimaryBtn>
              {verifyStatus[d.id] && (
                <span
                  style={{
                    fontSize: '13px',
                    fontFamily: 'DM Sans, sans-serif',
                    color: verifyStatus[d.id].ok ? 'var(--teal)' : 'var(--text-secondary)',
                  }}
                >
                  {verifyStatus[d.id].text}
                </span>
              )}
            </div>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <input
          type="text"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="acme.com"
          onKeyDown={(e) => e.key === 'Enter' && addDomain()}
          style={{ ...inputStyle, height: '40px', flex: 1 }}
        />
        <PrimaryBtn small onClick={addDomain} loading={adding}>Add</PrimaryBtn>
      </div>
      <StatusLine msg={addStatus} />
    </SectionCard>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const params = useParams()
  const slug = Array.isArray(params.slug) ? params.slug[0] : (params.slug as string)

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 20px' }}>
      <h1
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '20px',
        }}
      >
        Settings
      </h1>
      <WorkspaceSection slug={slug} />
      <DomainsSection slug={slug} />
    </div>
  )
}
