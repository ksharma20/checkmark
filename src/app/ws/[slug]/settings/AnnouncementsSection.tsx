'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Field, Input, Modal, SkeletonText, Textarea } from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { fmtTimeOnDate } from '@/lib/client/format-time'
import { wsAnnouncements as t } from '@/locales/en/ws-announcements'

interface AnnouncementRow {
  id: string
  title: string
  body: string
  created_at: string
  author_name: string | null
}

interface Props {
  slug: string
  canWrite: boolean
  canDelete: boolean
}

/**
 * Workspace announcements: compose one, see what has been posted, retract one.
 *
 * It lives in Settings rather than on People or Overview because it is
 * workspace-wide comms - it is addressed to nobody in particular and belongs to
 * no day. `canWrite` / `canDelete` are `announcements:write` / `:delete`,
 * resolved server-side by the settings page. They only decide which controls
 * are offered; the routes enforce the same permissions independently.
 */
export default function AnnouncementsSection({ slug, canWrite, canDelete }: Props) {
  // Destructured, not held as `toast`: `show` is a stable useCallback, while
  // the context VALUE is a fresh object on every provider render - and the
  // provider re-renders whenever a toast appears. Depending on the object would
  // make `load` change identity each time a toast fired and refetch the list.
  const { show } = useToast()
  const [items, setItems] = useState<AnnouncementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({})
  const [pendingDelete, setPendingDelete] = useState<AnnouncementRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ws/${slug}/announcements`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setItems(data.announcements ?? [])
    } catch {
      show(t.loadFailed, 'error')
    } finally {
      setLoading(false)
    }
  }, [slug, show])

  useEffect(() => { void load() }, [load])

  async function post() {
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()

    // Mirror the server's rule so the common mistake never costs a round trip.
    // The route validates again regardless and is the one that decides.
    const next: { title?: string; body?: string } = {}
    if (!trimmedTitle) next.title = t.titleRequired
    if (!trimmedBody) next.body = t.bodyRequired
    setErrors(next)
    if (next.title || next.body) return

    setPosting(true)
    try {
      const res = await fetch(`/api/ws/${slug}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle, body: trimmedBody }),
      })
      const data = await res.json()
      if (!res.ok) {
        // 422 comes back as a per-field code map; anything else is a message.
        const fields = (data as { fields?: Record<string, string> }).fields
        if (fields) {
          setErrors({
            title: fields.title ? t.titleRequired : undefined,
            body: fields.body ? t.bodyRequired : undefined,
          })
        }
        show((data as { error?: string }).error ?? t.postFailed, 'error')
        return
      }
      setItems((prev) => [data.announcement as AnnouncementRow, ...prev])
      setTitle('')
      setBody('')
      setErrors({})
      show(t.posted((data as { delivered: number }).delivered), 'success')
    } catch {
      show(t.postFailed, 'error')
    } finally {
      setPosting(false)
    }
  }

  async function remove(id: string) {
    setDeleting(true)
    try {
      const res = await fetch(`/api/ws/${slug}/announcements/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setItems((prev) => prev.filter((a) => a.id !== id))
      show(t.deleted, 'success')
      setPendingDelete(null)
    } catch {
      show(t.deleteFailed, 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="fx-spring">
      <p className="t-h2">{t.title}</p>
      <p className="t-muted mb-12">{t.subtitle}</p>

      {canWrite && (
        <div className="stack">
          <p className="t-eyebrow">{t.composeTitle}</p>
          <Field label={t.fieldTitle} htmlFor="ann-title" required error={errors.title}>
            <Input
              id="ann-title"
              value={title}
              invalid={!!errors.title}
              placeholder={t.fieldTitlePlaceholder}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label={t.fieldBody} htmlFor="ann-body" required error={errors.body}>
            <Textarea
              id="ann-body"
              rows={4}
              value={body}
              invalid={!!errors.body}
              placeholder={t.fieldBodyPlaceholder}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          <div>
            <Button
              loading={posting}
              disabled={!title.trim() || !body.trim()}
              onClick={() => void post()}
            >
              {posting ? t.submitting : t.submit}
            </Button>
          </div>
        </div>
      )}

      <p className="t-eyebrow mt-16">{t.listTitle}</p>

      {loading ? (
        <div className="mt-12"><SkeletonText lines={2} /></div>
      ) : items.length === 0 ? (
        <div className="mt-12">
          <p className="t-muted">{t.listEmpty}</p>
          <p className="t-muted">{t.listEmptyHint}</p>
        </div>
      ) : (
        // Spacing comes from `.card + .card` in globals.css, so this wrapper
        // deliberately adds none of its own.
        <div className="mt-12">
          {items.map((a) => (
            <div key={a.id} className="card">
              <div className="row-between">
                <span className="t-h2">{a.title}</span>
                {canDelete && (
                  <Button variant="ghost" size="sm" onClick={() => setPendingDelete(a)}>
                    {t.deleteAction}
                  </Button>
                )}
              </div>
              <p className="t-secondary t-prewrap">{a.body}</p>
              <p className="t-muted">
                {t.postedBy(a.author_name ?? t.authorRemoved, fmtTimeOnDate(a.created_at))}
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t.deleteTitle}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setPendingDelete(null)}>
              {t.deleteCancel}
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleting}
              onClick={() => { if (pendingDelete) void remove(pendingDelete.id) }}
            >
              {t.deleteConfirm}
            </Button>
          </>
        }
      >
        {/* Say plainly that this is not a recall - a push already delivered
            cannot be withdrawn, and implying otherwise is worse than not
            offering the control at all. */}
        <p className="t-secondary">{t.deleteBody}</p>
      </Modal>
    </Card>
  )
}
