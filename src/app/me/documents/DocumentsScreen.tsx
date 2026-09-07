'use client'

/**
 * `/me/documents` - the two halves of an employee's folder.
 *
 * "Your documents" are the slots the member is expected to fill (owner =
 * `employee`); "Provided by company" are the ones HR issues (owner = `admin`)
 * and are read-only here. The split is the `owner` column, not a guess from
 * the status.
 *
 * The upload constraints - 2 MB, PDF/PNG/JPEG only, and a 409 when replacing
 * an already-verified file - are enforced in `parseDocumentUpload` and the
 * route. This screen states them so nobody discovers them by failing, and
 * renders the server's own `error` string when one does fail; it deliberately
 * does not re-check the bytes, because a second copy of a magic-byte
 * allowlist is exactly how the two drift apart.
 */

import { useCallback, useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import {
  Card,
  Chip,
  Dropzone,
  EmptyState,
  Skeleton,
  type ChipTone,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import type { EmployeeDocument, DocumentStatus } from '@/lib/db/queries/documents'
import { documents as docCopy } from '@/locales/en/documents'
import { meScreens } from '@/locales/en/me-screens'
import { useWorkspaceScope } from '../workspace-scope'

const D = meScreens.documents

/** What the browser will offer in the file picker; the server sniffs for real. */
const ACCEPT = 'application/pdf,image/png,image/jpeg'

const STATUS_TONE: Record<DocumentStatus, ChipTone> = {
  missing: 'none',
  pending: 'partial',
  verified: 'verified',
  rejected: 'none',
  issued: 'verified',
}

function fmtWhen(raw: string | null): string | null {
  if (!raw) return null
  const iso = raw.includes('T') ? (raw.endsWith('Z') ? raw : `${raw}Z`) : `${raw.replace(' ', 'T')}Z`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function DocIcon() {
  return (
    <span
      aria-hidden
      style={{
        width: '34px',
        height: '34px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-2)',
        color: 'var(--brand)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <FileText size={17} />
    </span>
  )
}

function DocHeader({ doc, subtitle }: { doc: EmployeeDocument; subtitle: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <DocIcon />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, fontSize: '13.5px' }}>{doc.name}</p>
        {subtitle && (
          <p
            className="t-muted"
            style={{
              fontSize: '11px',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <Chip tone={STATUS_TONE[doc.status]}>{docCopy.status[doc.status]}</Chip>
    </div>
  )
}

function fileLine(doc: EmployeeDocument): string | null {
  if (!doc.file_name) return null
  const parts = [doc.file_name]
  if (doc.size_bytes) parts.push(D.fileSize(Math.max(1, Math.round(doc.size_bytes / 1024))))
  const when = fmtWhen(doc.uploaded_at)
  if (when) parts.push(D.uploadedAt(when))
  return parts.join(' · ')
}

// ─── rows ─────────────────────────────────────────────────────────────────────

function MyDocumentRow({
  doc,
  busy,
  onUpload,
}: {
  doc: EmployeeDocument
  busy: boolean
  onUpload: (doc: EmployeeDocument, file: File) => void
}) {
  const locked = doc.status === 'verified'
  const needsUpload = doc.status === 'missing' || doc.status === 'rejected'

  return (
    <Card style={{ marginTop: '10px' }}>
      <DocHeader doc={doc} subtitle={fileLine(doc)} />

      {doc.status === 'rejected' && (
        <p className="field-error">
          {doc.reject_reason ? `${D.rejectedPrefix} ${doc.reject_reason}` : D.rejectedReupload}
        </p>
      )}

      {locked ? (
        <p className="t-muted" style={{ marginTop: '10px' }}>
          {D.verifiedLocked}
        </p>
      ) : (
        <>
          <Dropzone
            accept={ACCEPT}
            compact={!needsUpload}
            disabled={busy}
            label={busy ? D.uploading : needsUpload ? D.upload : D.replace}
            onFile={(file) => onUpload(doc, file)}
            style={{ marginTop: '10px' }}
          />
          <p className="t-muted" style={{ marginTop: '6px' }}>
            {D.constraints}
          </p>
        </>
      )}
    </Card>
  )
}

function CompanyDocumentRow({ doc, slug }: { doc: EmployeeDocument; slug: string }) {
  const hasFile = !!doc.file_name

  return (
    <Card style={{ marginTop: '10px' }}>
      <DocHeader doc={doc} subtitle={hasFile ? fileLine(doc) : D.awaitingHr} />
      {hasFile && (
        <a
          className="btn btn-secondary btn-sm pressable"
          style={{ marginTop: '10px', textDecoration: 'none' }}
          href={`/api/me/ws/${encodeURIComponent(slug)}/documents/${encodeURIComponent(doc.id)}/file`}
        >
          <Download size={15} aria-hidden />
          {D.download}
        </a>
      )}
    </Card>
  )
}

// ─── screen ───────────────────────────────────────────────────────────────────

export default function DocumentsScreen() {
  const { slug } = useWorkspaceScope()
  const toast = useToast()

  const [docs, setDocs] = useState<EmployeeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [noRecord, setNoRecord] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    setFailed(false)
    setNoRecord(false)
    try {
      const res = await fetch(`/api/me/ws/${encodeURIComponent(slug)}/documents`)
      const body = (await res.json().catch(() => ({}))) as {
        documents?: EmployeeDocument[]
        code?: string
      }
      if (res.status === 404 || body.code === 'NOT_FOUND') {
        setDocs([])
        setNoRecord(true)
      } else if (!res.ok) {
        setFailed(true)
      } else {
        setDocs(Array.isArray(body.documents) ? body.documents : [])
      }
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  async function upload(doc: EmployeeDocument, file: File) {
    if (!slug) return
    setBusyKey(doc.id)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('doc_key', doc.doc_key)
      formData.append('name', doc.name)

      const res = await fetch(`/api/me/ws/${encodeURIComponent(slug)}/documents`, {
        method: 'POST',
        body: formData,
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.show(body.error ?? D.uploadFailed, 'error')
        return
      }
      toast.show(D.uploadSuccess, 'success')
      await load()
    } catch {
      toast.show(D.uploadFailed, 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const header = (
    <>
      <h1 className="t-h1">{D.title}</h1>
      <p className="t-secondary" style={{ marginTop: '2px' }}>
        {D.subtitle}
      </p>
    </>
  )

  if (!slug) {
    return (
      <>
        {header}
        <EmptyState
          title={meScreens.common.noWorkspaceTitle}
          hint={meScreens.common.noWorkspaceBody}
        />
      </>
    )
  }

  const mine = docs.filter((d) => d.owner === 'employee')
  const fromCompany = docs.filter((d) => d.owner === 'admin')

  return (
    <>
      {header}

      {loading ? (
        <div className="stack">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={104} radius="var(--radius-lg)" />
          ))}
        </div>
      ) : failed ? (
        <EmptyState title={meScreens.common.loadFailed} />
      ) : noRecord ? (
        <EmptyState title={D.noRecordTitle} hint={D.noRecordBody} />
      ) : (
        <>
          <p className="t-eyebrow" style={{ marginTop: '18px' }}>
            {D.yoursHeading}
          </p>
          {mine.length === 0 ? (
            <EmptyState title={D.yoursEmpty} hint={D.yoursEmptyHint} />
          ) : (
            mine.map((doc) => (
              <MyDocumentRow
                key={doc.id}
                doc={doc}
                busy={busyKey === doc.id}
                onUpload={upload}
              />
            ))
          )}

          <p className="t-eyebrow" style={{ marginTop: '24px' }}>
            {D.companyHeading}
          </p>
          {fromCompany.length === 0 ? (
            <EmptyState title={D.companyEmpty} hint={D.companyEmptyHint} />
          ) : (
            fromCompany.map((doc) => <CompanyDocumentRow key={doc.id} doc={doc} slug={slug} />)
          )}
        </>
      )}
    </>
  )
}
