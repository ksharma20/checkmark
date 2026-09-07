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

  titleRequired: 'A title is required.',
  bodyRequired: 'A message is required.',
  postFailed: 'Could not post the announcement.',
  posted: (count: number) =>
    `Announcement sent to ${count} ${count === 1 ? 'person' : 'people'}`,

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
