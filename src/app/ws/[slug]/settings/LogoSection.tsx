'use client'

import { useRef, useState } from 'react'
import { Button, Card } from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsAdmin } from '@/locales/en/ws-settings'

const s = wsAdmin.settings

interface Props {
  slug: string
  canWrite: boolean
  /** `null` when the workspace has no logo. Doubles as the cache-buster. */
  logoUpdatedAt: string | null
  /** Ask the parent to re-read the workspace, so the preview follows the upload. */
  onChanged: () => void
}

/**
 * A workspace's own mark, uploaded here and shown in both app shells.
 *
 * Its own card with its own two actions rather than a field inside the org
 * form's single Save, for the reason the Access panel gives: an upload and a
 * text field fail in completely different ways, and one Save button would have
 * to invent a combined success state for them.
 *
 * The preview is served from `/api/me/ws/[slug]/logo` - the MEMBER-scoped route,
 * not an admin one. There is only one serving route because every member's shell
 * renders the logo, and an admin is a member too.
 */
export default function LogoSection({ slug, canWrite, logoUpdatedAt, onChanged }: Props) {
  const { show: toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)

  // The timestamp in the query string is what makes a replaced logo appear
  // immediately: the bytes are cached for an hour, so without it the browser
  // would keep serving the old image from a URL that had not changed.
  const src = logoUpdatedAt
    ? `/api/me/ws/${slug}/logo?v=${encodeURIComponent(logoUpdatedAt)}`
    : null

  async function upload(file: File) {
    setBusy('upload')
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`/api/ws/${slug}/logo`, { method: 'POST', body })
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) {
        // The route's messages are specific - too large, wrong type - and are
        // more use than a generic failure, so they are preferred when present.
        toast(data.error ?? s.logoFailed, 'error')
        return
      }
      toast(s.logoSaved, 'success')
      onChanged()
    } catch {
      toast(s.logoFailed, 'error')
    } finally {
      setBusy(null)
      // Clear the input, or picking the same file again fires no change event.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove() {
    setBusy('remove')
    try {
      const res = await fetch(`/api/ws/${slug}/logo`, { method: 'DELETE' })
      if (!res.ok) { toast(s.logoFailed, 'error'); return }
      toast(s.logoRemoved, 'success')
      onChanged()
    } catch {
      toast(s.logoFailed, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="fx-spring mt-16">
      <p className="t-eyebrow mb-8">{s.logoTitle}</p>
      <p className="t-muted mb-12">{s.logoHint}</p>

      <div className="logo-row">
        {/*
          A plain <img>, not next/image. The optimiser fetches the source
          server-side and cannot carry the caller's session cookie, so it
          cannot read an authenticated API route. The upload already caps the
          bytes at 512 KB and the CSS box is fixed, so there is nothing left
          for the optimiser to save here.
        */}
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={s.logoCurrentAlt} className="logo-preview" />
        ) : (
          <div className="logo-preview is-empty" aria-hidden />
        )}

        {canWrite && (
          <div className="logo-actions">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="visually-hidden"
              id={`ws-logo-${slug}`}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void upload(file)
              }}
            />
            <Button
              variant="secondary"
              loading={busy === 'upload'}
              onClick={() => inputRef.current?.click()}
            >
              {busy === 'upload' ? s.logoUploading : src ? s.logoReplace : s.logoUpload}
            </Button>
            {src && (
              <Button variant="ghost" loading={busy === 'remove'} onClick={() => void remove()}>
                {busy === 'remove' ? s.logoRemoving : s.logoRemove}
              </Button>
            )}
          </div>
        )}
      </div>

      <p className="t-muted mt-12">{s.logoConstraints}</p>
    </Card>
  )
}
