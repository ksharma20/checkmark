'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Download, FileText, X } from 'lucide-react'
import {
  Button, Card, Chip, Dropzone, EmptyState, Field, IconButton, Input, Select, SkeletonText, Textarea,
  type ChipTone,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsEmployees } from '@/locales/en/ws-people'
import { documents as docCopy } from '@/locales/en/documents'
import type { DocumentOwner, DocumentStatus, EmployeeDocument } from '@/lib/db/queries/documents'

// The API sniffs magic bytes and accepts only these three; naming them in the
// picker means the OS dialog filters instead of the server rejecting.
const ACCEPT = 'application/pdf,image/png,image/jpeg'

const STATUS_TONE: Record<DocumentStatus, ChipTone> = {
  verified: 'verified',
  issued: 'verified',
  pending: 'partial',
  rejected: 'none',
  missing: 'roadmap',
}

/** Slot keys are `[a-z0-9_]{1,64}` server-side, so the label is folded to that. */
function toDocKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64)
}

interface Props {
  slug: string
  employeeId: string
  /** documents:write - gates upload, verify and reject. */
  canWrite: boolean
}

/**
 * The admin side of employee documents.
 *
 * Two kinds of row, because they are two different jobs: a company-issued slot
 * is something the admin UPLOADS into, and an employee-uploaded slot is
 * something the admin REVIEWS. Verify/reject therefore never appear on a row
 * the company itself produced - there is nothing to verify about your own file.
 */
export default function EmployeeDocuments({ slug, employeeId, canWrite }: Props) {
  // Destructured: `show` is a stable useCallback, the context object is not,
  // so this is what makes it safe in a useCallback/useEffect dep array.
  const { show: toast } = useToast()
  const [docs, setDocs] = useState<EmployeeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const [newName, setNewName] = useState('')
  const [newOwner, setNewOwner] = useState<DocumentOwner>('admin')

  const base = `/api/ws/${slug}/employees/${employeeId}/documents`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(base)
      if (res.ok) {
        const data = await res.json() as { documents: EmployeeDocument[] }
        setDocs(data.documents ?? [])
      } else {
        toast(wsEmployees.documentsLoadFailed, 'error')
      }
    } finally {
      setLoading(false)
    }
  }, [base, toast])

  useEffect(() => { void load() }, [load])

  async function upload(file: File, docKey: string, name: string, owner: DocumentOwner) {
    setBusyId(docKey)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('doc_key', docKey)
      fd.append('name', name)
      fd.append('owner', owner)
      const res = await fetch(base, { method: 'POST', body: fd })
      if (res.ok) {
        toast(wsEmployees.documentUploaded, 'success')
        setNewName('')
        await load()
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        toast(data.error ?? wsEmployees.documentUploadFailed, 'error')
      }
    } finally {
      setBusyId(null)
    }
  }

  async function review(doc: EmployeeDocument, status: 'verified' | 'rejected', reason?: string) {
    setBusyId(doc.id)
    try {
      const res = await fetch(`${base}/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(status === 'rejected' ? { status, reject_reason: reason } : { status }),
      })
      if (res.ok) {
        const data = await res.json() as { document: EmployeeDocument }
        setDocs(prev => prev.map(d => (d.id === doc.id ? data.document : d)))
        setRejectingId(null)
        setRejectReason('')
        toast(status === 'verified' ? wsEmployees.documentVerified : wsEmployees.documentRejected, 'success')
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        toast(data.error ?? wsEmployees.documentActionFailed, 'error')
      }
    } finally {
      setBusyId(null)
    }
  }

  function submitNewSlot(file: File) {
    const name = newName.trim()
    const key = toDocKey(name)
    if (!name || !key) {
      toast(wsEmployees.documentSlotNameRequired, 'error')
      return
    }
    void upload(file, key, name, newOwner)
  }

  return (
    <Card padded={false} style={{ overflow: 'hidden', marginTop: '14px' }}>
      <p className="t-h2" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        {wsEmployees.documentsTitle}
      </p>

      {loading ? (
        <div style={{ padding: '16px 20px' }}><SkeletonText lines={3} /></div>
      ) : docs.length === 0 ? (
        <EmptyState title={wsEmployees.documentsEmpty} hint={wsEmployees.documentsEmptyHint} />
      ) : (
        docs.map(doc => {
          const isRejecting = rejectingId === doc.id
          const busy = busyId === doc.id
          return (
            <div key={doc.id} style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span
                  aria-hidden
                  style={{
                    width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)',
                    color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  <FileText size={15} />
                </span>

                <div style={{ flex: 1, minWidth: '160px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{doc.name}</span>{' '}
                  <span className="t-muted" style={{ fontSize: '10.5px' }}>
                    · {docCopy.owner[doc.owner]}
                  </span>
                  {doc.file_name && (
                    <p className="t-muted" style={{ fontSize: '11px', marginTop: '2px', overflowWrap: 'anywhere' }}>
                      {doc.file_name}
                    </p>
                  )}
                </div>

                {/* The status table, not the raw column value - `pending` is a
                    database word, "Awaiting review" is the product's. */}
                <Chip tone={STATUS_TONE[doc.status]}>{docCopy.status[doc.status]}</Chip>

                {doc.file_name && (
                  <a
                    className="btn btn-ghost btn-sm pressable"
                    href={`${base}/${doc.id}/file`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Download size={14} aria-hidden /> {wsEmployees.documentDownload}
                  </a>
                )}

                {/* Verify / reject only for what the EMPLOYEE supplied, and
                    only while it is awaiting a decision. */}
                {canWrite && doc.owner === 'employee' && doc.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <IconButton
                      variant="decline"
                      label={wsEmployees.documentReject}
                      icon={<X size={15} />}
                      disabled={busy}
                      onClick={() => { setRejectingId(doc.id); setRejectReason('') }}
                    />
                    <IconButton
                      variant="approve"
                      label={wsEmployees.documentVerify}
                      icon={<Check size={15} />}
                      disabled={busy}
                      onClick={() => void review(doc, 'verified')}
                    />
                  </div>
                )}
              </div>

              {doc.status === 'rejected' && doc.reject_reason && (
                <p className="t-muted" style={{ marginTop: '6px', fontSize: '11.5px' }}>
                  {wsEmployees.documentRejectedNote(doc.reject_reason)}
                </p>
              )}

              {/* A rejection without a reason is a dead end for the employee,
                  so the server requires one and so does this form. */}
              {isRejecting && (
                <div style={{ marginTop: '10px' }}>
                  <Field label={wsEmployees.documentRejectReasonLabel} htmlFor={`reject-${doc.id}`} required>
                    <Textarea
                      id={`reject-${doc.id}`}
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder={wsEmployees.documentRejectReasonPlaceholder}
                    />
                  </Field>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <Button variant="ghost" size="sm" onClick={() => setRejectingId(null)}>
                      {wsEmployees.documentRejectCancel}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={busy}
                      disabled={!rejectReason.trim()}
                      onClick={() => void review(doc, 'rejected', rejectReason.trim())}
                    >
                      {wsEmployees.documentRejectConfirm}
                    </Button>
                  </div>
                </div>
              )}

              {/* Company-issued slots are filled by the admin, so they get a
                  dropzone instead of a verdict. */}
              {canWrite && doc.owner === 'admin' && (
                <Dropzone
                  compact
                  accept={ACCEPT}
                  disabled={busyId === doc.doc_key}
                  label={doc.file_name ? wsEmployees.documentReplace : wsEmployees.documentUpload}
                  onFile={file => void upload(file, doc.doc_key, doc.name, 'admin')}
                  style={{ marginTop: '10px' }}
                />
              )}
            </div>
          )
        })
      )}

      {canWrite && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <p className="t-eyebrow" style={{ marginBottom: '10px' }}>{wsEmployees.documentAddSlotTitle}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <Field label={wsEmployees.documentSlotNameLabel} htmlFor="doc-slot-name">
              <Input
                id="doc-slot-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={wsEmployees.documentSlotNamePlaceholder}
              />
            </Field>
            <Field label={wsEmployees.documentSlotOwnerLabel} htmlFor="doc-slot-owner">
              <Select
                id="doc-slot-owner"
                value={newOwner}
                onChange={e => setNewOwner(e.target.value as DocumentOwner)}
                options={[
                  { value: 'admin', label: wsEmployees.documentSlotOwnerAdmin },
                  { value: 'employee', label: wsEmployees.documentSlotOwnerEmployee },
                ]}
              />
            </Field>
          </div>
          {/* Disabled while ANY upload is in flight. Two files dropped here
              before the first POST answers would derive the same doc_key and
              race for the same slot - the unique index rejects the loser, and
              the user's second file silently vanishes into a 409. */}
          <Dropzone
            compact
            accept={ACCEPT}
            disabled={busyId !== null}
            label={wsEmployees.documentSlotFileLabel}
            onFile={submitNewSlot}
            style={{ marginTop: '12px' }}
          />
        </div>
      )}
    </Card>
  )
}
