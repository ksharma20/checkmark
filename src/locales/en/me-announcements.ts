/**
 * Copy for the member-facing announcement archive at /me/announcements.
 *
 * An announcement used to have no screen of its own - the notification body
 * *was* the content, so tapping one reopened the notification list. That stopped
 * being true once announcements could carry attachments: a notification row has
 * nowhere to put a file. This is where a member reads the notice in full and
 * downloads whatever came with it.
 *
 *   import { meAnnouncements } from '@/locales/en/me-announcements'
 *
 * Scoped to the active workspace like every other /me screen, so it does NOT
 * print the workspace name - the top-bar pill already answers "which one".
 *
 * Seeded with the obvious keys; the screen's own agent extends it.
 */

export const meAnnouncements = {
  title: 'Announcements',
  subtitle: 'Notices posted to everyone in this workspace.',

  emptyTitle: 'Nothing announced yet',
  emptyHint: 'Workspace notices land here — a policy update, an office day, a closure.',

  loadFailed: 'Could not load announcements.',

  attachmentLabel: 'Attachment',
  downloadAction: 'Download',

  postedOn: (date: string) => `Posted ${date}`,
  /** Byline: who posted it, and when. */
  postedBy: (name: string, date: string) => `${name} · ${date}`,
  /** The author's account has since been removed - the notice still stands. */
  authorRemoved: 'Removed member',
  /** Size next to an attachment's filename, in whole kilobytes. */
  fileSize: (kb: number) => `${kb} KB`,
} as const
