'use client'

/**
 * `/me/announcements` - workspace notices, newest first, with their files.
 *
 * Scoped to the ACTIVE workspace, read from `useWorkspaceScope()`. There is no
 * picker here and there must never be one: the top-bar pill is the only
 * workspace selector on `/me`. For the same reason the workspace name is never
 * printed in the list - the pill above already answers "which one", and
 * repeating it inside scoped content is noise.
 *
 * Attachments are metadata only. The bytes come from
 * `/api/me/ws/[slug]/announcements/[id]/attachments/[attachmentId]/file`,
 * which is the only route that emits them, so the download is a plain link
 * rather than anything this screen has to fetch and hold.
 */

import { useCallback, useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { Card, EmptyState, Skeleton } from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { fmtTimeOnDate } from '@/lib/client/format-time'
import type { AnnouncementAttachmentPublic } from '@/lib/db/queries/announcements'
import { meAnnouncements as t } from '@/locales/en/me-announcements'
import { useWorkspaceScope } from '../workspace-scope'

interface AnnouncementRow {
  id: string
  title: string
  body: string
  created_at: string
  author_name: string | null
  attachments: AnnouncementAttachmentPublic[]
}

interface Props {
  /**
   * A slug the SERVER validated against this user's memberships, or null. It
   * exists because an announcement notification deep-links here with `?ws=`;
   * the client is not allowed to read that param itself. Null means "whatever
   * the pill says", which is the normal case.
   */
  scopedSlug: string | null
}

function AttachmentLink({
  slug,
  announcementId,
  attachment,
}: {
  slug: string
  announcementId: string
  attachment: AnnouncementAttachmentPublic
}) {
  const kb = attachment.size_bytes ? Math.max(1, Math.round(attachment.size_bytes / 1024)) : null

  return (
    <a
      className="rowlink row-between"
      href={`/api/me/ws/${slug}/announcements/${announcementId}/attachments/${attachment.id}/file`}
      download
    >
      <span className="row-gap-sm">
        <FileText size={16} aria-hidden />
        <span>
          <span className="t-rowtitle">{attachment.file_name ?? attachment.name}</span>
          {kb !== null && <span className="t-rowsub"> · {t.fileSize(kb)}</span>}
        </span>
      </span>
      <span className="row-gap-sm">
        <Download size={16} aria-hidden />
        <span className="t-secondary">{t.downloadAction}</span>
      </span>
    </a>
  )
}

export default function AnnouncementsScreen({ scopedSlug }: Props) {
  const { show } = useToast()
  // `scopedSlug` wins when the server validated one off `?ws=`; otherwise the
  // pill decides. Both resolve to a workspace this person is actually in, and
  // the route re-checks membership regardless.
  const { slug: activeSlug } = useWorkspaceScope()
  const slug = scopedSlug ?? activeSlug

  const [items, setItems] = useState<AnnouncementRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!slug) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/me/ws/${slug}/announcements`)
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setItems((data.announcements ?? []) as AnnouncementRow[])
    } catch {
      show(t.loadFailed, 'error')
    } finally {
      setLoading(false)
    }
  }, [slug, show])

  useEffect(() => { void load() }, [load])

  return (
    <div className="stack">
      <div>
        <h1 className="t-h1">{t.title}</h1>
        {/* No workspace name: the pill above already answers "which one". */}
        <p className="t-muted">{t.subtitle}</p>
      </div>

      {loading ? (
        // Skeletons, never a spinner.
        <div className="stack">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <div className="stack-sm">
                <Skeleton width="60%" height={15} />
                <Skeleton width="95%" height={12} />
                <Skeleton width="40%" height={12} />
              </div>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t.emptyTitle} hint={t.emptyHint} />
      ) : (
        items.map((a) => (
          <Card key={a.id}>
            <p className="t-h2">{a.title}</p>
            <p className="t-secondary t-prewrap">{a.body}</p>
            {a.attachments.length > 0 && slug && (
              <div className="stack-sm mt-12">
                <p className="t-eyebrow">{t.attachmentLabel}</p>
                {a.attachments.map((att) => (
                  <AttachmentLink
                    key={att.id}
                    slug={slug}
                    announcementId={a.id}
                    attachment={att}
                  />
                ))}
              </div>
            )}
            <p className="t-muted mt-12">
              {t.postedBy(a.author_name ?? t.authorRemoved, fmtTimeOnDate(a.created_at))}
            </p>
          </Card>
        ))
      )}
    </div>
  )
}
