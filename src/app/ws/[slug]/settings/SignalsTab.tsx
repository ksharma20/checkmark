'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Chip, EmptyState, Field, Input, Modal, Skeleton } from '@/components/ui'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-settings'

const t = en.wsSettings
const s = wsAdmin.settings

interface SignalRow {
  id: string
  signal_type: string
  location_name: string | null
  gps_lat: number | null
  gps_lng: number | null
  gps_radius_m: number | null
  ip_geo_lat: number | null
  ip_geo_lng: number | null
}

interface Props {
  slug: string
  canWrite: boolean
  canDelete: boolean
}

/**
 * Signal configuration.
 *
 * The behaviour is carried over unchanged from the pre-re-skin section: capture
 * GPS from the browser (which posts straight away, so the workspace timezone is
 * auto-detected server-side), enter coordinates by hand, register the current
 * egress IP, and remove a signal. Only the chrome is new.
 */
export default function SignalsTab({ slug, canWrite, canDelete }: Props) {
  const [signals, setSignals] = useState<SignalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [showGpsForm, setShowGpsForm] = useState(false)
  const [locationName, setLocationName] = useState('')
  const [gpsLat, setGpsLat] = useState('')
  const [gpsLng, setGpsLng] = useState('')
  const [gpsRadius, setGpsRadius] = useState(300)
  const [gettingGps, setGettingGps] = useState(false)
  const [savingGps, setSavingGps] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<{ text: string; ok: boolean } | null>(null)

  const [registeringIp, setRegisteringIp] = useState(false)
  const [ipStatus, setIpStatus] = useState<{ text: string; ok: boolean } | null>(null)

  const [pendingDelete, setPendingDelete] = useState<SignalRow | null>(null)

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

  function captureGps() {
    if (!navigator.geolocation) {
      setGpsStatus({ text: t.gpsErrorNoSupport, ok: false })
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
            await loadSignals()
            setShowGpsForm(false)
            setLocationName('')
            setGpsLat('')
            setGpsLng('')
            setGpsStatus(null)
            showToast(t.gpsToastAuto)
          } else {
            setGpsStatus({ text: data.error || t.gpsErrorFailed, ok: false })
          }
        } catch {
          setGpsStatus({ text: t.gpsErrorFailed, ok: false })
        }
      },
      (err) => {
        setGettingGps(false)
        setGpsStatus({ text: t.gpsErrorDenied(err.message), ok: false })
      },
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  async function saveGpsManual() {
    const lat = parseFloat(gpsLat)
    const lng = parseFloat(gpsLng)
    if (isNaN(lat) || isNaN(lng)) {
      setGpsStatus({ text: t.gpsErrorInvalidCoords, ok: false })
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
        showToast(t.gpsManualToast)
      } else {
        setGpsStatus({ text: data.error || t.gpsErrorManualFailed, ok: false })
      }
    } finally {
      setSavingGps(false)
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
        showToast(t.ipToast)
      } else {
        setIpStatus({ text: data.error || t.ipErrorFailed, ok: false })
      }
    } finally {
      setRegisteringIp(false)
    }
  }

  async function deleteSignal(id: string) {
    const res = await fetch(`/api/ws/${slug}/signals/${id}`, { method: 'DELETE' })
    if (res.ok) setSignals((prev) => prev.filter((row) => row.id !== id))
    setPendingDelete(null)
  }

  function signalLabel(row: SignalRow) {
    if (row.signal_type === 'gps') {
      return `${row.location_name ?? 'Office'} · ${row.gps_lat?.toFixed(4)}, ${row.gps_lng?.toFixed(4)} · ${row.gps_radius_m}m`
    }
    if (row.signal_type === 'ip') {
      return `${row.ip_geo_lat?.toFixed(4)}, ${row.ip_geo_lng?.toFixed(4)}`
    }
    return row.signal_type
  }

  return (
    <Card className="fx-spring">
      <p className="t-eyebrow" style={{ marginBottom: '8px' }}>{t.signalsTitle}</p>
      <p className="t-secondary" style={{ marginBottom: '14px' }}>{t.signalsDescription}</p>

      {toast && (
        <p
          role="status"
          className="chip chip-verified"
          style={{ display: 'block', padding: '9px 12px', marginBottom: '14px', borderRadius: 'var(--radius-md)' }}
        >
          {toast}
        </p>
      )}

      {loading ? (
        <div className="stack-sm" style={{ marginBottom: '14px' }}>
          <Skeleton height={44} radius="var(--radius-md)" />
          <Skeleton height={44} radius="var(--radius-md)" />
        </div>
      ) : signals.length === 0 ? (
        <EmptyState title={t.signalsEmpty} />
      ) : (
        <div className="stack-sm" style={{ marginBottom: '14px' }}>
          {signals.map((row) => (
            <div
              key={row.id}
              className="row-between"
              style={{
                padding: '10px 12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <Chip tone={row.signal_type === 'gps' ? 'verified' : 'partial'}>
                  {row.signal_type.toUpperCase()}
                </Chip>
                <span className="mono" style={{ fontSize: '12.5px' }}>{signalLabel(row)}</span>
              </span>
              {canDelete && (
                <Button variant="ghost" size="sm" onClick={() => setPendingDelete(row)}>
                  {t.signalRemove}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {canWrite && showGpsForm && (
        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '10px',
          }}
        >
          <p className="t-eyebrow" style={{ marginBottom: '12px' }}>{t.gpsFormTitle}</p>

          <Field label={t.gpsLocationNameLabel} htmlFor="gps-name" style={{ marginBottom: '12px' }}>
            <Input
              id="gps-name"
              value={locationName}
              placeholder={t.gpsLocationNamePlaceholder}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </Field>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <Field label={t.gpsLatLabel} htmlFor="gps-lat" style={{ flex: '1 1 140px' }}>
              <Input id="gps-lat" value={gpsLat} placeholder="28.6139" onChange={(e) => setGpsLat(e.target.value)} />
            </Field>
            <Field label={t.gpsLngLabel} htmlFor="gps-lng" style={{ flex: '1 1 140px' }}>
              <Input id="gps-lng" value={gpsLng} placeholder="77.2090" onChange={(e) => setGpsLng(e.target.value)} />
            </Field>
          </div>

          <Field label={t.gpsRadiusLabel(gpsRadius)} htmlFor="gps-radius" style={{ marginBottom: '12px' }}>
            <input
              id="gps-radius"
              type="range"
              min={100}
              max={500}
              step={50}
              value={gpsRadius}
              onChange={(e) => setGpsRadius(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--brand)' }}
            />
          </Field>

          {gpsStatus && (
            <p style={{ fontSize: '13px', color: gpsStatus.ok ? 'var(--brand)' : 'var(--danger)', marginBottom: '10px' }}>
              {gpsStatus.text}
            </p>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" loading={gettingGps} onClick={captureGps}>
              {gettingGps ? t.gpsGettingBtn : t.gpsGetBtn}
            </Button>
            <Button size="sm" loading={savingGps} disabled={!gpsLat || !gpsLng} onClick={saveGpsManual}>
              {t.gpsSaveBtn}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowGpsForm(false); setGpsStatus(null) }}
            >
              {t.cancelBtn}
            </Button>
          </div>
        </div>
      )}

      {canWrite && !showGpsForm && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => setShowGpsForm(true)}>
            {t.addGpsBtn}
          </Button>
          <Button variant="secondary" size="sm" loading={registeringIp} onClick={registerIp}>
            {t.addIpBtn}
          </Button>
        </div>
      )}

      {ipStatus && (
        <p style={{ fontSize: '13px', color: ipStatus.ok ? 'var(--brand)' : 'var(--danger)', marginTop: '10px' }}>
          {ipStatus.text}
        </p>
      )}

      <p className="t-muted" style={{ marginTop: '14px' }}>{s.signalsAndTitle}</p>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t.signalRemoveConfirm}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPendingDelete(null)}>
              {t.cancelBtn}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => pendingDelete && deleteSignal(pendingDelete.id)}
            >
              {t.signalRemove}
            </Button>
          </>
        }
      >
        {pendingDelete && (
          <p className="t-secondary mono" style={{ wordBreak: 'break-word' }}>
            {signalLabel(pendingDelete)}
          </p>
        )}
      </Modal>
    </Card>
  )
}
