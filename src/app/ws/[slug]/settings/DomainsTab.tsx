'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Chip, ConfirmDialog, Input } from '@/components/ui'
import { en } from '@/locales/en'

const t = en.wsSettings
const DNS_VERIFY_SUBDOMAIN = en.constants.dnsVerifySubdomain
const DNS_VERIFY_VALUE_PREFIX = en.constants.dnsVerifyValuePrefix

interface DomainRow {
  id: string
  domain: string
  verified_at: string | null
  verifyToken: string | null
}

interface Props {
  slug: string
  canWrite: boolean
  canDelete: boolean
}

/**
 * Email-domain verification.
 *
 * The DNS TXT flow is untouched: add a domain, publish
 * `_venzio-verify.<domain>  TXT  venzio-verify=<token>`, then ask the server to
 * look it up. Only the surface is new.
 */
export default function DomainsTab({ slug, canWrite, canDelete }: Props) {
  const [domains, setDomains] = useState<DomainRow[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [adding, setAdding] = useState(false)
  const [addStatus, setAddStatus] = useState<{ text: string; ok: boolean } | null>(null)
  const [verifyStatus, setVerifyStatus] = useState<Record<string, { text: string; ok: boolean }>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DomainRow | null>(null)

  const loadDomains = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/domain`)
    if (res.ok) {
      const data = await res.json()
      setDomains(data.domains ?? [])
    }
  }, [slug])

  useEffect(() => { loadDomains() }, [loadDomains])

  async function addDomain() {
    const domain = newDomain.trim().toLowerCase()
    if (!domain) return
    setAdding(true)
    setAddStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewDomain('')
        await loadDomains()
        setAddStatus({ text: t.domainAddSuccess(domain), ok: true })
      } else {
        setAddStatus({ text: data.error || t.domainAddError, ok: false })
      }
    } finally {
      setAdding(false)
    }
  }

  async function removeDomain(id: string) {
    const res = await fetch(`/api/ws/${slug}/domain/${id}`, { method: 'DELETE' })
    if (res.ok) setDomains((prev) => prev.filter((d) => d.id !== id))
    setPendingDelete(null)
  }

  async function checkVerification(domain: DomainRow) {
    setVerifyStatus((prev) => ({ ...prev, [domain.id]: { text: t.domainChecking, ok: true } }))
    const res = await fetch(`/api/ws/${slug}/domain/${domain.id}/verify`, { method: 'POST' })
    const data = await res.json()
    if (data.verified) {
      setVerifyStatus((prev) => ({ ...prev, [domain.id]: { text: t.domainVerifiedMsg, ok: true } }))
      await loadDomains()
    } else {
      setVerifyStatus((prev) => ({
        ...prev,
        [domain.id]: { text: data.message || t.domainNotFoundMsg, ok: false },
      }))
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <Card className="fx-spring">
      <p className="t-eyebrow">{t.domainsTitle}</p>
      <p className="t-muted" style={{ margin: '4px 0 14px' }}>{t.domainsDescription}</p>

      {domains.map((d) => (
        <div
          key={d.id}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '10px',
          }}
        >
          <div className="row-between" style={{ flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: '14px', fontWeight: 600 }}>{d.domain}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Chip tone={d.verified_at ? 'verified' : 'partial'}>
                {d.verified_at ? t.domainVerified : t.domainUnverified}
              </Chip>
              {canDelete && (
                <Button variant="ghost" size="sm" onClick={() => setPendingDelete(d)}>
                  {t.domainRemove}
                </Button>
              )}
            </span>
          </div>

          {!d.verified_at && d.verifyToken && (
            <div
              style={{
                marginTop: '12px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
              }}
            >
              <p className="t-eyebrow" style={{ marginBottom: '7px' }}>{t.domainDnsInstructions}</p>
              {[
                { label: t.domainDnsNameLabel, value: `${DNS_VERIFY_SUBDOMAIN}.${d.domain}` },
                { label: t.domainDnsValueLabel, value: `${DNS_VERIFY_VALUE_PREFIX}=${d.verifyToken}` },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}
                >
                  <span className="t-muted" style={{ width: '44px', flexShrink: 0 }}>{label}</span>
                  <code
                    className="mono"
                    style={{
                      flex: 1,
                      minWidth: '160px',
                      fontSize: '11.5px',
                      background: 'var(--surface-0)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 7px',
                      wordBreak: 'break-all',
                    }}
                  >
                    {value}
                  </code>
                  <Button variant="secondary" size="sm" onClick={() => copyToClipboard(value, `${d.id}-${label}`)}>
                    {copied === `${d.id}-${label}` ? t.domainCopied : t.domainCopy}
                  </Button>
                </div>
              ))}

              {canWrite && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <Button size="sm" onClick={() => checkVerification(d)}>{t.domainCheckBtn}</Button>
                  {verifyStatus[d.id] && (
                    <span
                      style={{
                        fontSize: '13px',
                        color: verifyStatus[d.id].ok ? 'var(--brand)' : 'var(--text-secondary)',
                      }}
                    >
                      {verifyStatus[d.id].text}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {canWrite && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <Input
            aria-label={t.domainsTitle}
            value={newDomain}
            placeholder={t.domainPlaceholder}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addDomain() }}
            style={{ flex: '1 1 200px' }}
          />
          <Button loading={adding} onClick={addDomain}>{t.domainAddBtn}</Button>
        </div>
      )}

      {addStatus && (
        <p style={{ fontSize: '13px', marginTop: '10px', color: addStatus.ok ? 'var(--brand)' : 'var(--danger)' }}>
          {addStatus.text}
        </p>
      )}

      {/* The body is the domain itself, so it keeps `.mono`. */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) removeDomain(pendingDelete.id) }}
        title={t.domainRemoveConfirm}
        body={pendingDelete ? <span className="mono">{pendingDelete.domain}</span> : ''}
        confirmLabel={t.domainRemove}
        cancelLabel={t.cancelBtn}
      />
    </Card>
  )
}
