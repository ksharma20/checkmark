'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

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

function PrimaryBtn({ children, onClick, loading, small, disabled }: {
  children: React.ReactNode
  onClick?: () => void
  loading?: boolean
  small?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
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
        cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
        opacity: (loading || disabled) ? 0.7 : 1,
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

interface SignalRow {
  id: string
  signal_type: string
  location_name: string | null
  wifi_ssid_display: string | null
  gps_lat: number | null
  gps_lng: number | null
  gps_radius_m: number | null
  ip_geo_lat: number | null
  ip_geo_lng: number | null
}

// ─── Workspace details section ────────────────────────────────────────────────

function WorkspaceSection({ slug }: { slug: string }) {
  const [name, setName] = useState('')
  const [tz, setTz] = useState('UTC')
  const [fetching, setFetching] = useState(true)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    fetch(`/api/ws/${slug}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return
        setName(data.name ?? '')
        // Use stored timezone if it's in our list; otherwise keep UTC
        if (data.display_timezone && TIMEZONES.includes(data.display_timezone)) {
          setTz(data.display_timezone)
        } else if (data.display_timezone) {
          // Add it dynamically so it's selectable even if not in the static list
          setTz(data.display_timezone)
        }
      })
      .finally(() => setFetching(false))
  }, [slug])

  async function save() {
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined, displayTimezone: tz }),
      })
      setStatus(res.ok ? { text: 'Settings saved', ok: true } : { text: 'Save failed', ok: false })
    } finally {
      setLoading(false)
    }
  }

  const tzOptions = TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES]

  return (
    <SectionCard title="Workspace details">
      {fetching ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', marginBottom: '14px' }}>Loading…</p>
      ) : (
        <>
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
          {tzOptions.map((t) => (
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
        </>
      )}
    </SectionCard>
  )
}

// ─── Signal configuration section ─────────────────────────────────────────────

function SignalsSection({ slug }: { slug: string }) {
  const [signals, setSignals] = useState<SignalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  // GPS form state
  const [showGpsForm, setShowGpsForm] = useState(false)
  const [locationName, setLocationName] = useState('')
  const [gpsLat, setGpsLat] = useState('')
  const [gpsLng, setGpsLng] = useState('')
  const [gpsRadius, setGpsRadius] = useState(300)
  const [gettingGps, setGettingGps] = useState(false)
  const [tzDetected, setTzDetected] = useState<string | null>(null)
  const [savingGps, setSavingGps] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<{ text: string; ok: boolean } | null>(null)

  // WiFi form state
  const [showWifiForm, setShowWifiForm] = useState(false)
  const [wifiName, setWifiName] = useState('')
  const [wifiSsid, setWifiSsid] = useState('')
  const [savingWifi, setSavingWifi] = useState(false)
  const [wifiStatus, setWifiStatus] = useState<{ text: string; ok: boolean } | null>(null)

  // IP form state
  const [registeringIp, setRegisteringIp] = useState(false)
  const [ipStatus, setIpStatus] = useState<{ text: string; ok: boolean } | null>(null)

  const loadSignals = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/signals`)
    if (res.ok) {
      const data = await res.json()
      setSignals(data.signals ?? [])
    }
    setLoading(false)
  }, [slug])

  useEffect(() => { loadSignals() }, [loadSignals])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  async function captureGps() {
    if (!navigator.geolocation) {
      setGpsStatus({ text: 'Geolocation not supported by this browser', ok: false })
      return
    }
    setGettingGps(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setGpsLat(lat.toFixed(6))
        setGpsLng(lng.toFixed(6))
        setGettingGps(false)
        // Detect timezone from coords (server will do it on save, but preview here)
        try {
          const res = await fetch(`/api/ws/${slug}/signals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              signal_type: 'gps',
              location_name: locationName || 'Office',
              gps_lat: lat,
              gps_lng: lng,
              gps_radius_m: gpsRadius,
            }),
          })
          const data = await res.json()
          if (res.ok) {
            // Server auto-detects timezone; fetch what it set
            const wsRes = await fetch(`/api/ws/${slug}/signals`)
            const wsData = await wsRes.json()
            setSignals(wsData.signals ?? [])
            setShowGpsForm(false)
            setLocationName('')
            setGpsLat('')
            setGpsLng('')
            setGpsStatus(null)
            // The server will return the detected tz in a future PATCH — show toast
            showToast('Location registered. Workspace timezone auto-updated.')
            setTzDetected(null)
          } else {
            setGpsStatus({ text: data.error || 'Failed to register GPS location', ok: false })
          }
        } catch {
          setGpsStatus({ text: 'Failed to register GPS location', ok: false })
        }
      },
      (err) => {
        setGettingGps(false)
        setGpsStatus({ text: `GPS denied: ${err.message}`, ok: false })
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  async function saveGpsManual() {
    const lat = parseFloat(gpsLat)
    const lng = parseFloat(gpsLng)
    if (isNaN(lat) || isNaN(lng)) {
      setGpsStatus({ text: 'Enter valid latitude and longitude', ok: false })
      return
    }
    setSavingGps(true)
    setGpsStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal_type: 'gps',
          location_name: locationName || undefined,
          gps_lat: lat,
          gps_lng: lng,
          gps_radius_m: gpsRadius,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        await loadSignals()
        setShowGpsForm(false)
        setLocationName('')
        setGpsLat('')
        setGpsLng('')
        setTzDetected(null)
        showToast('GPS location registered. Workspace timezone auto-updated.')
      } else {
        setGpsStatus({ text: data.error || 'Failed to register location', ok: false })
      }
    } finally {
      setSavingGps(false)
    }
  }

  async function saveWifi() {
    if (!wifiSsid.trim()) {
      setWifiStatus({ text: 'SSID is required', ok: false })
      return
    }
    setSavingWifi(true)
    setWifiStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal_type: 'wifi',
          location_name: wifiName || undefined,
          wifi_ssid: wifiSsid.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        await loadSignals()
        setShowWifiForm(false)
        setWifiName('')
        setWifiSsid('')
        showToast('WiFi network registered.')
      } else {
        setWifiStatus({ text: data.error || 'Failed to register WiFi', ok: false })
      }
    } finally {
      setSavingWifi(false)
    }
  }

  async function registerIp() {
    setRegisteringIp(true)
    setIpStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_type: 'ip' }),
      })
      const data = await res.json()
      if (res.ok) {
        await loadSignals()
        showToast('IP context registered.')
      } else {
        setIpStatus({ text: data.error || 'Failed to register IP context', ok: false })
      }
    } finally {
      setRegisteringIp(false)
    }
  }

  async function deleteSignal(id: string) {
    if (!confirm('Remove this signal?')) return
    const res = await fetch(`/api/ws/${slug}/signals/${id}`, { method: 'DELETE' })
    if (res.ok) setSignals((prev) => prev.filter((s) => s.id !== id))
  }

  function signalLabel(s: SignalRow) {
    if (s.signal_type === 'gps') return `GPS — ${s.location_name ?? 'Office'} (${s.gps_lat?.toFixed(4)}, ${s.gps_lng?.toFixed(4)}, ${s.gps_radius_m}m radius)`
    if (s.signal_type === 'wifi') return `WiFi — ${s.location_name ?? ''} SSID: ${s.wifi_ssid_display ?? '***'}`
    if (s.signal_type === 'ip') return `IP — lat ${s.ip_geo_lat?.toFixed(4)}, lng ${s.ip_geo_lng?.toFixed(4)}`
    return s.signal_type
  }

  function typeBadge(type: string) {
    const colors: Record<string, string> = { gps: 'var(--brand)', wifi: 'var(--teal)', ip: 'var(--amber)' }
    return (
      <span style={{
        fontSize: '11px',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 600,
        color: colors[type] ?? 'var(--text-muted)',
        background: 'var(--surface-2)',
        border: `1px solid ${colors[type] ?? 'var(--border)'}`,
        borderRadius: '4px',
        padding: '2px 7px',
        flexShrink: 0,
      }}>
        {type.toUpperCase()}
      </span>
    )
  }

  return (
    <SectionCard title="Signal configuration">
      {toast && (
        <div style={{
          background: 'color-mix(in srgb, var(--teal) 12%, transparent)',
          border: '1px solid var(--teal)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          marginBottom: '14px',
          fontSize: '13px',
          fontFamily: 'DM Sans, sans-serif',
          color: 'var(--teal)',
        }}>
          {toast}
        </div>
      )}

      <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '14px' }}>
        Signals define what counts as &ldquo;in office&rdquo; for your workspace. If no signals are registered, all check-in events from your members are shown.
      </p>

      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}>Loading…</p>
      ) : signals.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif', marginBottom: '14px' }}>
          No signals registered yet. Add a GPS location, WiFi network, or IP context below.
        </p>
      ) : (
        <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {signals.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              {typeBadge(s.signal_type)}
              <span style={{ flex: 1, fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-primary)' }}>
                {signalLabel(s)}
              </span>
              <button onClick={() => deleteSignal(s.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* GPS form */}
      {showGpsForm ? (
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '10px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'Syne, sans-serif', color: 'var(--navy)', marginBottom: '12px' }}>Register GPS location</p>
          <FieldGroup label="Location name">
            <input type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Head Office" style={{ ...inputStyle, height: '36px' }} />
          </FieldGroup>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'DM Sans, sans-serif', marginBottom: '4px' }}>Latitude</label>
              <input type="text" value={gpsLat} onChange={(e) => setGpsLat(e.target.value)} placeholder="28.6139" style={{ ...inputStyle, height: '36px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'DM Sans, sans-serif', marginBottom: '4px' }}>Longitude</label>
              <input type="text" value={gpsLng} onChange={(e) => setGpsLng(e.target.value)} placeholder="77.2090" style={{ ...inputStyle, height: '36px' }} />
            </div>
          </div>
          <FieldGroup label={`Geofence radius: ${gpsRadius}m`}>
            <input type="range" min={100} max={500} step={50} value={gpsRadius} onChange={(e) => setGpsRadius(parseInt(e.target.value))} style={{ width: '100%' }} />
          </FieldGroup>
          {tzDetected && (
            <p style={{ fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--teal)', marginBottom: '10px' }}>
              Timezone will auto-update to {tzDetected}
            </p>
          )}
          <StatusLine msg={gpsStatus} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={captureGps}
              disabled={gettingGps}
              style={{
                height: '36px', padding: '0 14px',
                background: 'var(--surface-2)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
                cursor: gettingGps ? 'not-allowed' : 'pointer',
                opacity: gettingGps ? 0.7 : 1,
              }}
            >
              {gettingGps ? 'Getting GPS…' : 'Use my current GPS'}
            </button>
            <PrimaryBtn small onClick={saveGpsManual} loading={savingGps} disabled={!gpsLat || !gpsLng}>
              Save location
            </PrimaryBtn>
            <button type="button" onClick={() => { setShowGpsForm(false); setGpsStatus(null) }} style={{ background: 'none', border: 'none', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* WiFi form */}
      {showWifiForm ? (
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '10px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'Syne, sans-serif', color: 'var(--navy)', marginBottom: '12px' }}>Register WiFi network</p>
          <FieldGroup label="Location name (optional)">
            <input type="text" value={wifiName} onChange={(e) => setWifiName(e.target.value)} placeholder="Head Office" style={{ ...inputStyle, height: '36px' }} />
          </FieldGroup>
          <FieldGroup label="WiFi SSID (network name)">
            <input type="text" value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="AcmeCorp-WiFi" style={{ ...inputStyle, height: '36px' }} />
          </FieldGroup>
          <p style={{ fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-muted)', marginBottom: '10px' }}>
            The SSID is hashed before storage and never displayed in full.
          </p>
          <StatusLine msg={wifiStatus} />
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <PrimaryBtn small onClick={saveWifi} loading={savingWifi}>Save WiFi</PrimaryBtn>
            <button type="button" onClick={() => { setShowWifiForm(false); setWifiStatus(null) }} style={{ background: 'none', border: 'none', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Action buttons */}
      {!showGpsForm && !showWifiForm && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowGpsForm(true)}
            style={{ height: '36px', padding: '0 14px', background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
          >
            + GPS location
          </button>
          <button
            type="button"
            onClick={() => setShowWifiForm(true)}
            style={{ height: '36px', padding: '0 14px', background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
          >
            + WiFi network
          </button>
          <button
            type="button"
            onClick={registerIp}
            disabled={registeringIp}
            style={{ height: '36px', padding: '0 14px', background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', cursor: registeringIp ? 'not-allowed' : 'pointer', opacity: registeringIp ? 0.7 : 1 }}
          >
            {registeringIp ? '…' : '+ IP context'}
          </button>
        </div>
      )}
      <StatusLine msg={ipStatus} />
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
      <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        Verified domains enable auto-enrolment: employees who sign up with a matching email are automatically added as members.
      </p>

      {domains.map((d) => (
        <div key={d.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: d.verified_at ? 0 : '12px' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'var(--text-primary)', flex: 1 }}>
              {d.domain}
            </span>
            {d.verified_at ? (
              <span style={{ fontSize: '11px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, color: 'var(--teal)', background: 'color-mix(in srgb, var(--teal) 12%, transparent)', border: '1px solid var(--teal)', borderRadius: '4px', padding: '2px 7px' }}>
                Verified
              </span>
            ) : (
              <span style={{ fontSize: '11px', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, color: 'var(--amber)', background: 'color-mix(in srgb, var(--amber) 12%, transparent)', border: '1px solid var(--amber)', borderRadius: '4px', padding: '2px 7px' }}>
                Unverified
              </span>
            )}
            <button onClick={() => removeDomain(d.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', padding: '0 4px' }}>
              Remove
            </button>
          </div>

          {!d.verified_at && d.verifyToken && (
            <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '10px' }}>
              <p style={{ fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Add this DNS TXT record, then click &ldquo;Check verification&rdquo;:
              </p>
              {[
                { label: 'Name', value: `_checkmark-verify.${d.domain}` },
                { label: 'Value', value: `checkmark-verify=${d.verifyToken}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', width: '40px', flexShrink: 0 }}>{label}</span>
                  <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '4px', padding: '3px 6px', flex: 1, wordBreak: 'break-all' }}>
                    {value}
                  </code>
                  <button onClick={() => copyToClipboard(value, `${d.id}-${label}`)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
                    {copied === `${d.id}-${label}` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!d.verified_at && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PrimaryBtn small onClick={() => checkVerification(d)}>Check verification</PrimaryBtn>
              {verifyStatus[d.id] && (
                <span style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: verifyStatus[d.id].ok ? 'var(--teal)' : 'var(--text-secondary)' }}>
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

// ─── Archive / Restore workspace section ──────────────────────────────────────

function ArchiveSection({ slug }: { slug: string }) {
  const router = useRouter()
  const [isArchived, setIsArchived] = useState<boolean | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/ws/${slug}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setIsArchived(!!data.archived_at)
      })
  }, [slug])

  async function archive() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/archive`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        router.push('/ws')
      } else {
        setError(data.error || 'Archive failed')
        setConfirming(false)
      }
    } finally {
      setLoading(false)
    }
  }

  async function restore() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/restore`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setIsArchived(false)
        setConfirming(false)
        router.refresh()
      } else {
        setError(data.error || 'Restore failed')
        setConfirming(false)
      }
    } finally {
      setLoading(false)
    }
  }

  if (isArchived === null) return null

  return (
    <SectionCard title={isArchived ? 'Restore workspace' : 'Archive workspace'}>
      {isArchived ? (
        <>
          <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
            This workspace is currently archived. Restoring it will make it active again (subject to the 1 active workspace limit).
          </p>
          {error && (
            <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--danger)', marginBottom: '12px' }}>{error}</p>
          )}
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              style={{
                height: '44px', padding: '0 20px',
                background: 'var(--brand)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-md)',
                fontSize: '14px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Restore workspace
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-primary)', margin: 0 }}>
                Restore this workspace?
              </p>
              <button
                type="button"
                onClick={restore}
                disabled={loading}
                style={{
                  height: '36px', padding: '0 16px',
                  background: 'var(--brand)', color: '#fff', border: 'none',
                  borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? '…' : 'Confirm restore'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                style={{ background: 'none', border: 'none', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
            Archiving hides this workspace from your active list. Members and all presence data are preserved. The workspace can be restored at any time from /ws.
          </p>
          {error && (
            <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--danger)', marginBottom: '12px' }}>{error}</p>
          )}
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              style={{
                height: '44px', padding: '0 20px',
                background: 'transparent', color: 'var(--text-secondary)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                fontSize: '14px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Archive workspace
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-primary)', margin: 0 }}>
                Archive this workspace?
              </p>
              <button
                type="button"
                onClick={archive}
                disabled={loading}
                style={{
                  height: '36px', padding: '0 16px',
                  background: 'var(--danger)', color: '#fff', border: 'none',
                  borderRadius: 'var(--radius-md)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? '…' : 'Confirm archive'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                style={{ background: 'none', border: 'none', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  )
}

// ─── Logout section ───────────────────────────────────────────────────────────

function LogoutSection() {
  const [loading, setLoading] = useState(false)

  async function logout() {
    setLoading(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <SectionCard title="Session">
      <p style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
        Sign out of your CheckMark account on this device.
      </p>
      <button
        type="button"
        onClick={logout}
        disabled={loading}
        style={{
          height: '44px', padding: '0 20px',
          background: 'transparent', color: 'var(--text-secondary)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          fontSize: '14px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Signing out…' : 'Sign out'}
      </button>
    </SectionCard>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const params = useParams()
  const slug = Array.isArray(params.slug) ? params.slug[0] : (params.slug as string)

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 20px' }}>
      <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700, color: 'var(--navy)', marginBottom: '20px' }}>
        Settings
      </h1>
      <WorkspaceSection slug={slug} />
      <SignalsSection slug={slug} />
      <DomainsSection slug={slug} />
      <ArchiveSection slug={slug} />
      <LogoutSection />
    </div>
  )
}
