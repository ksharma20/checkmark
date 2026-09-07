'use client'

import { useState } from 'react'
import { Button, Field, Input, Modal } from '@/components/ui'
import { en } from '@/locales/en'

/** The member row this transfer targets - only these two fields are read. */
export interface TransferTarget {
  member_id: string
  email: string
  full_name: string | null
}

// ─── Transfer Ownership Modal ─────────────────────────────────────────────────

interface TransferModalProps {
  slug: string
  target: TransferTarget
  onDone: () => void
  onCancel: () => void
}

export default function TransferOwnershipModal({ slug, target, onDone, onCancel }: TransferModalProps) {
  const [step, setStep] = useState<'confirm' | 'otp'>('confirm')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Factor 1: the account password. The server re-checks it and only then
  // issues the code, so a hijacked session with inbox access is not enough.
  async function requestOtp() {
    if (!password) {
      setError(en.wsTransferOwnership.errorPasswordRequired)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', targetMemberId: target.member_id, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setAdminEmail(data.email)
        // Don't keep it in state while the OTP step is open.
        setPassword('')
        setStep('otp')
      } else {
        setError(data.error || en.wsTransferOwnership.errorRequestFailed)
      }
    } finally {
      setLoading(false)
    }
  }

  async function confirmTransfer() {
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', targetMemberId: target.member_id, code: code.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(en.wsTransferOwnership.successMsg(data.new_admin))
        setTimeout(() => {
          onDone()
          // Not /ws: the outgoing owner is now a plain member, so they no longer
          // match getAdminWorkspacesForUser and would land on an empty picker
          // with no explanation. /me is the surface they still have.
          window.location.href = '/me'
        }, 2000)
      } else {
        setError(data.error || en.wsTransferOwnership.errorTransferFailed)
      }
    } finally {
      setLoading(false)
    }
  }

  const footer = success ? null : step === 'confirm' ? (
    <>
      <Button variant="secondary" onClick={onCancel}>{en.wsTransferOwnership.cancelBtn}</Button>
      <Button variant="danger" loading={loading} disabled={!password} onClick={requestOtp}>
        {loading ? en.wsTransferOwnership.continuingBtn : en.wsTransferOwnership.continueBtn}
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={onCancel}>{en.wsTransferOwnership.cancelBtn}</Button>
      <Button variant="danger" loading={loading} disabled={code.length < 6} onClick={confirmTransfer}>
        {loading ? en.wsTransferOwnership.transferringBtn : en.wsTransferOwnership.confirmBtn}
      </Button>
    </>
  )

  return (
    <Modal open onClose={onCancel} title={en.wsTransferOwnership.title} maxWidth={440} footer={footer}>
      {success ? (
        <p style={{ fontSize: '14px', color: 'var(--teal)', lineHeight: 1.5 }}>{success}</p>
      ) : step === 'confirm' ? (
        <>
          <p className="t-secondary" style={{ marginBottom: '16px', lineHeight: 1.5 }}>
            {en.wsTransferOwnership.confirmBodyPrefix}{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{target.full_name ?? target.email}</strong>.
          </p>

          {/* Destructive warning - stays on screen while they type the
              password, so the consequence is visible at the moment they
              authorise it rather than on a screen they already clicked past. */}
          <div
            style={{
              border: '1px solid var(--danger)',
              background: 'color-mix(in srgb, var(--danger) 8%, transparent)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              marginBottom: '20px',
            }}
          >
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--danger)', marginBottom: '8px' }}>
              {en.wsTransferOwnership.warningTitle}
            </p>
            <ul style={{ margin: 0, paddingLeft: '18px' }} className="stack-sm">
              {[
                en.wsTransferOwnership.warningTheyGain,
                en.wsTransferOwnership.warningYouLose,
                en.wsTransferOwnership.warningNoUndo,
              ].map((line) => (
                <li key={line} className="t-secondary" style={{ lineHeight: 1.5 }}>{line}</li>
              ))}
            </ul>
          </div>

          <Field label={en.wsTransferOwnership.passwordLabel} htmlFor="transfer-password" error={error ?? undefined}>
            <Input
              id="transfer-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={en.wsTransferOwnership.passwordPlaceholder}
              onKeyDown={(e) => e.key === 'Enter' && requestOtp()}
              autoComplete="current-password"
              invalid={!!error}
              autoFocus
            />
          </Field>
        </>
      ) : (
        <>
          <p className="t-secondary" style={{ marginBottom: '20px', lineHeight: 1.5 }}>
            {en.wsTransferOwnership.otpBodyPrefix}{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{adminEmail}</strong>{' '}
            {en.wsTransferOwnership.otpBodySuffix}
          </p>
          <Field label={en.wsTransferOwnership.title} htmlFor="transfer-otp" error={error ?? undefined}>
            <Input
              id="transfer-otp"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={en.wsTransferOwnership.otpPlaceholder}
              maxLength={6}
              onKeyDown={(e) => e.key === 'Enter' && confirmTransfer()}
              invalid={!!error}
              style={{ letterSpacing: '0.15em', fontSize: '18px', textAlign: 'center' }}
              autoFocus
            />
          </Field>
        </>
      )}
    </Modal>
  )
}
