import { db } from '../index'

/**
 * Workspace announcements - the canonical record of a workspace-wide notice.
 *
 * Delivery is NOT stored here. An announcement is fanned out as ordinary
 * `notifications` rows (one per active member, `ref_type: 'announcement'`,
 * `ref_id` = this row's id), which is what gives every recipient their own
 * read state and bell count with no new machinery. This table exists so the
 * admin can see and retract what they posted; retracting hides the row and
 * does not unsend what was already delivered.
 *
 * Soft-deleted, and every statement carries `AND workspace_id = ?` - the id is
 * never trusted on its own, so a row id guessed from another workspace matches
 * nothing.
 */
export interface Announcement {
  id: string
  workspace_id: string
  title: string
  body: string
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/** A listed announcement carries its author's display name for the byline. */
export interface AnnouncementWithAuthor extends Announcement {
  /** NULL when the author's user row is gone (soft-deleted account). */
  author_name: string | null
}

export async function getAnnouncement(
  id: string,
  workspaceId: string,
): Promise<Announcement | null> {
  return db.queryOne<Announcement>(
    `SELECT * FROM workspace_announcements
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
}

/**
 * Active announcements, newest first - the order the index
 * `idx_workspace_announcements_ws (workspace_id, created_at DESC)` is built for.
 *
 * LEFT JOIN, not JOIN: an author whose account was deleted must not make their
 * announcement vanish from the admin's list.
 */
export async function listAnnouncements(
  workspaceId: string,
): Promise<AnnouncementWithAuthor[]> {
  return db.query<AnnouncementWithAuthor>(
    `SELECT a.*, u.full_name AS author_name
     FROM workspace_announcements a
     LEFT JOIN users u ON u.id = a.created_by
     WHERE a.workspace_id = ? AND a.deleted_at IS NULL
     ORDER BY a.created_at DESC`,
    [workspaceId],
  )
}

export async function createAnnouncement(params: {
  workspaceId: string
  title: string
  body: string
  createdBy: string
}): Promise<Announcement> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO workspace_announcements (id, workspace_id, title, body, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [id, params.workspaceId, params.title, params.body, params.createdBy],
  )
  const row = await getAnnouncement(id, params.workspaceId)
  if (!row) throw new Error('Announcement insert succeeded but row not found')
  return row
}

/**
 * Soft delete. Returns false when nothing matched - a wrong id, another
 * workspace's id, or an already-deleted row - which the route turns into a 404
 * rather than pretending it retracted something.
 */
export async function softDeleteAnnouncement(
  id: string,
  workspaceId: string,
): Promise<boolean> {
  const result = await db.execute(
    `UPDATE workspace_announcements
     SET deleted_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
  return result.changes > 0
}

// ─── Attachments ─────────────────────────────────────────────────────────────
//
// A file hung off an announcement. METADATA ONLY - the bytes live in
// `announcement_attachment_blobs` and are reachable exclusively through
// `announcementStore` in lib/storage.ts. That split is what keeps a feed read
// from dragging megabytes of base64 through every row, and it is why there is
// deliberately no `data_base64` field on the interface below.
//
// Every statement carries `AND workspace_id = ?`, like the announcement
// statements above: an id guessed from another workspace matches nothing.

export interface AnnouncementAttachment {
  id: string
  workspace_id: string
  announcement_id: string
  /** Human label for the file, shown in the list. */
  name: string
  /**
   * NULL until the bytes are stored. The row is created empty and only claims
   * `file_name` / `mime_type` / `size_bytes` after `announcementStore.put()`
   * has returned, so a crash between the two leaves an honest empty slot
   * rather than a download that 404s.
   */
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  /** NULL when the uploader's account has since been removed. */
  uploaded_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * An attachment as the UI sees it: no bytes, and no `deleted_at` to reason
 * about because every read below already filters them out.
 */
export type AnnouncementAttachmentPublic = Omit<AnnouncementAttachment, 'deleted_at'>

export async function listAttachmentsForAnnouncement(
  workspaceId: string,
  announcementId: string,
): Promise<AnnouncementAttachment[]> {
  return db.query<AnnouncementAttachment>(
    `SELECT * FROM announcement_attachments
     WHERE workspace_id = ? AND announcement_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [workspaceId, announcementId],
  )
}

/**
 * The batch read. Both list surfaces - the admin's Posted list and the member
 * feed - render every announcement with its files, so fetching per row would
 * be N+1 on a screen that is already one query.
 *
 * An empty id list short-circuits: an `IN ()` is a syntax error in SQLite, and
 * a workspace with no announcements is the normal first-run case.
 */
export async function listAttachmentsForAnnouncements(
  workspaceId: string,
  announcementIds: string[],
): Promise<AnnouncementAttachment[]> {
  if (announcementIds.length === 0) return []
  const placeholders = announcementIds.map(() => '?').join(',')
  return db.query<AnnouncementAttachment>(
    `SELECT * FROM announcement_attachments
     WHERE workspace_id = ? AND announcement_id IN (${placeholders}) AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [workspaceId, ...announcementIds],
  )
}

export async function getAttachment(
  id: string,
  workspaceId: string,
): Promise<AnnouncementAttachment | null> {
  return db.queryOne<AnnouncementAttachment>(
    `SELECT * FROM announcement_attachments
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
}

/**
 * Open an empty slot. `file_name`, `mime_type` and `size_bytes` are left NULL
 * on purpose - see `markAttachmentUploaded`, which is what claims them once
 * the bytes are actually stored.
 */
export async function createAttachment(params: {
  workspaceId: string
  announcementId: string
  name: string
  uploadedBy: string
}): Promise<AnnouncementAttachment> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO announcement_attachments
       (id, workspace_id, announcement_id, name, uploaded_by)
     VALUES (?, ?, ?, ?, ?)`,
    [id, params.workspaceId, params.announcementId, params.name, params.uploadedBy],
  )
  const row = await getAttachment(id, params.workspaceId)
  if (!row) throw new Error('Attachment insert succeeded but row not found')
  return row
}

/**
 * Claim the stored bytes. Called ONLY after `announcementStore.put()` has
 * returned - this is the step that makes the row's file claim true, and
 * running it earlier is what would produce a download that 404s.
 */
export async function markAttachmentUploaded(
  id: string,
  workspaceId: string,
  file: { file_name: string; mime_type: string; size_bytes: number },
): Promise<boolean> {
  const result = await db.execute(
    `UPDATE announcement_attachments
     SET file_name = ?, mime_type = ?, size_bytes = ?, updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [file.file_name, file.mime_type, file.size_bytes, id, workspaceId],
  )
  return result.changes > 0
}

/**
 * Soft delete the metadata. The BYTES are removed separately, by the caller,
 * through `announcementStore.delete()` and always afterwards: once this row is
 * soft-deleted nothing can serve the file (the blob read joins it and filters
 * `deleted_at IS NULL`), so a failed byte delete leaves unreachable orphans
 * rather than a live row pointing at shredded bytes.
 */
export async function softDeleteAttachment(
  id: string,
  workspaceId: string,
): Promise<boolean> {
  const result = await db.execute(
    `UPDATE announcement_attachments
     SET deleted_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
  return result.changes > 0
}

/**
 * Soft delete every live attachment on an announcement, returning their ids so
 * the caller can then clear the bytes for each. Retracting an announcement has
 * to take its files with it - a soft-deleted notice whose attachment was still
 * downloadable by URL would not be retracted at all.
 */
export async function softDeleteAttachmentsForAnnouncement(
  workspaceId: string,
  announcementId: string,
): Promise<string[]> {
  const rows = await listAttachmentsForAnnouncement(workspaceId, announcementId)
  await db.execute(
    `UPDATE announcement_attachments
     SET deleted_at = datetime('now'), updated_at = datetime('now')
     WHERE workspace_id = ? AND announcement_id = ? AND deleted_at IS NULL`,
    [workspaceId, announcementId],
  )
  return rows.map((r) => r.id)
}

// ─── Composed reads ──────────────────────────────────────────────────────────

/** An announcement as both list surfaces render it: byline plus its files. */
export interface AnnouncementWithAttachments extends AnnouncementWithAuthor {
  attachments: AnnouncementAttachmentPublic[]
}

function withoutDeletedAt(row: AnnouncementAttachment): AnnouncementAttachmentPublic {
  // Destructured off rather than selected around: `SELECT *` is what keeps the
  // row interface honest against a column added later, so the trim happens here.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { deleted_at, ...rest } = row
  return rest
}

/**
 * `listAnnouncements` plus the attachments, in TWO queries rather than one per
 * row. A LEFT JOIN would have been one query and would have fanned each
 * announcement out into a row per file, leaving the caller to regroup - and
 * would have put the metadata join on the same statement that reads the body.
 */
export async function listAnnouncementsWithAttachments(
  workspaceId: string,
): Promise<AnnouncementWithAttachments[]> {
  const announcements = await listAnnouncements(workspaceId)
  if (announcements.length === 0) return []

  const attachments = await listAttachmentsForAnnouncements(
    workspaceId,
    announcements.map((a) => a.id),
  )

  const byAnnouncement = new Map<string, AnnouncementAttachmentPublic[]>()
  for (const row of attachments) {
    const list = byAnnouncement.get(row.announcement_id)
    if (list) list.push(withoutDeletedAt(row))
    else byAnnouncement.set(row.announcement_id, [withoutDeletedAt(row)])
  }

  return announcements.map((a) => ({ ...a, attachments: byAnnouncement.get(a.id) ?? [] }))
}
