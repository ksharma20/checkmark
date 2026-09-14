/**
 * Workspace announcements - the admin composer and its confirmations.
 *
 * The member side has no copy of its own: an announcement is delivered as an
 * ordinary notification, so it renders through the existing feed row.
 */
export const wsAnnouncements = {
  title: 'Announcements',
  subtitle: 'Tell everyone in this workspace something — a policy update, an office day, a closure.',

  composeTitle: 'New announcement',
  fieldTitle: 'Title',
  fieldTitlePlaceholder: 'e.g. Office open this Saturday',
  fieldBody: 'Message',
  fieldBodyPlaceholder: 'What everyone needs to know. Keep it short — it lands on a phone.',
  submit: 'Post announcement',
  submitting: 'Posting…',

  // ── attachment ────────────────────────────────────────────────────────────
  fieldAttachment: 'Attachment',
  fieldAttachmentHint: 'Optional. One PDF, PNG or JPEG, up to 2 MB.',
  attachmentDropzone: 'Drop a file here, or choose one',
  attachmentRemove: 'Remove',
  /** Filename plus size, under the dropzone once a file is chosen. */
  attachmentChosen: (name: string, kb: number) => `${name} · ${kb} KB`,
  attachmentLabel: 'Attachment',
  attachmentDownload: 'Download',
  /**
   * The two rejections a person can actually cause. Both are decided by the
   * SERVER - the size against `MAX_FILE_BYTES`, the type by sniffing magic
   * bytes - so these strings describe the rule rather than re-implementing it.
   */
  attachmentTooLarge: 'That file is larger than 2 MB.',
  attachmentUnsupported: 'Only PDF, PNG and JPEG files are accepted.',

  titleRequired: 'A title is required.',
  bodyRequired: 'A message is required.',
  postFailed: 'Could not post the announcement.',
  /**
   * Zero is not an error and not a failure to post - it is what a workspace
   * that has switched the `announcements` category off in Notification settings
   * gets. The notice IS posted and IS readable in every member's announcements
   * list; nothing was sent to anybody's bell or phone. Saying "sent to 0 people"
   * would read as a bug, so the zero case says what actually happened instead.
   */
  posted: (count: number) =>
    count === 0
      ? 'Announcement posted silently — notifications for this workspace are switched off, so nobody was alerted. It is still in everyone’s announcements list.'
      : `Announcement sent to ${count} ${count === 1 ? 'person' : 'people'}`,

  listTitle: 'Posted',
  listEmpty: 'No announcements yet',
  listEmptyHint: 'Anything you post here reaches every active member, in-app and on their phone.',
  postedBy: (name: string, date: string) => `${name} · ${date}`,
  /** Byline fallback when the author's account has since been deleted - the
   *  announcement must still say when it went out, not vanish. */
  authorRemoved: 'Removed member',
  loadFailed: 'Could not load announcements.',

  deleteAction: 'Delete',
  deleteTitle: 'Delete this announcement?',
  /**
   * Say plainly that this is not a recall. A push already on someone's phone
   * cannot be withdrawn, and implying otherwise is worse than not offering it.
   */
  deleteBody:
    'It disappears from this list. Notifications already delivered stay in people’s feeds and on their phones — this does not unsend it.',
  deleteConfirm: 'Delete',
  deleteCancel: 'Cancel',
  deleted: 'Announcement deleted',
  deleteFailed: 'Could not delete the announcement.',
} as const
