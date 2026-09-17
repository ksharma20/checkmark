/**
 * Copy for the personal space at `/me/space` - notes, to-dos, focus, insights.
 *
 *   import { meSpace } from '@/locales/en/me-space'
 *
 * Every string on this surface, including the API routes' error messages, so
 * the wording a member sees in a toast is the wording the route sent (invariant
 * 16). Imported directly at call sites rather than through `en`, which keeps two
 * agents editing two different areas out of `src/locales/en.ts`; both styles
 * resolve to the same object once it is composed there.
 *
 * NOTHING HERE NAMES A WORKSPACE. This is the one `/me` screen that is not
 * workspace-scoped at all - a note, a task and a focus session belong to the
 * person - and the Insights tab is careful to say which of its numbers depend on
 * a workspace and which do not.
 */

export const meSpace = {
  title: 'My space',
  /**
   * The bottom-nav label. Short on purpose: four tabs share a 320px bar at the
   * narrowest supported width, and "My space" would be the only one to wrap.
   */
  navLabel: 'Space',
  subtitle: 'Yours alone — notes, tasks and focus, in every workspace and none.',

  tabNotes: 'Notes',
  tabTodos: 'To-dos',
  tabFocus: 'Focus',
  tabInsights: 'Insights',

  /** Shown when a fetch fails for a reason the server did not explain. */
  loadFailed: 'Could not load this. Try again.',
  saveFailed: 'Could not save that. Try again.',

  // ── notes ──────────────────────────────────────────────────────────────────
  notes: {
    newAction: 'New note',
    emptyTitle: 'Your notes live here',
    emptyHint: 'Anything you want to keep — a meeting note, an idea, a reminder.',
    emptyAction: 'Add your first note',

    editTitle: 'Note',
    createTitle: 'New note',
    titleLabel: 'Title',
    titlePlaceholder: 'Title (optional)',
    contentLabel: 'Note',
    contentPlaceholder: 'Write anything…',
    /** The card's stand-in when a note has neither title nor content yet. */
    untitled: 'Untitled',

    colorLabel: 'Colour',
    colorName: {
      default: 'Plain',
      yellow: 'Yellow',
      teal: 'Teal',
      coral: 'Coral',
      purple: 'Purple',
    } as Record<string, string>,

    pinAction: 'Pin',
    pinnedAction: 'Pinned',
    pinnedBadge: 'Pinned',

    saveAction: 'Save',
    savingAction: 'Saving…',
    savedNote: 'Note saved',
    closeAction: 'Close',

    deleteAction: 'Delete',
    deleteTitle: 'Delete note',
    deleteBody: 'This note will be removed from your space.',
    deleteConfirm: 'Delete',
    deleteBusy: 'Deleting…',
    deleteCancel: 'Keep it',
    deletedNote: 'Note deleted',

    /** Server-side refusals, mirrored by the form's own `maxLength`. */
    errorTitleTooLong: (max: number) => `Keep the title under ${max} characters.`,
    errorContentTooLong: (max: number) => `That note is too long — keep it under ${max} characters.`,
    errorBadColour: 'That is not one of the note colours.',
    errorEmpty: 'Add a title or some text before saving.',
  },

  // ── to-dos ─────────────────────────────────────────────────────────────────
  todos: {
    addPlaceholder: 'Add a task…',
    addAction: 'Add',
    addedNote: 'Task added',

    filterAll: 'All',
    filterToday: 'Today',
    filterPending: 'Pending',
    filterDone: 'Done',

    dueLabel: 'Due date',
    dueNone: 'No date',
    priorityLabel: 'Priority',
    priorityName: {
      none: 'No priority',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
    } as Record<string, string>,

    /** The chip on a row whose due date has passed and which is not done. */
    overdue: 'Overdue',
    dueToday: 'Today',

    toggleLabel: (text: string) => `Mark “${text}” as done`,
    untoggleLabel: (text: string) => `Mark “${text}” as not done`,
    focusLabel: (text: string) => `Start a focus session on “${text}”`,
    moveUpLabel: (text: string) => `Move “${text}” up`,
    moveDownLabel: (text: string) => `Move “${text}” down`,
    deleteLabel: (text: string) => `Delete “${text}”`,

    completedHeading: (count: number) => `Completed (${count})`,
    restoreAction: 'Restore',

    emptyTitle: 'Nothing to do',
    emptyHint: 'Add a task above and it will wait here for you.',
    emptyTodayTitle: 'Nothing due today',
    emptyTodayHint: 'Tasks due today and tasks with no date both show up here.',
    emptyDoneTitle: 'Nothing finished yet',
    emptyDoneHint: 'Tick a task off and it moves here.',

    deleteTitle: 'Delete task',
    deleteBody: 'This task will be removed from your list.',
    deleteNote: 'It disappears from your focus history too — sessions you ran against it stay, they just stop naming it.',
    deleteConfirm: 'Delete',
    deleteBusy: 'Deleting…',
    deleteCancel: 'Keep it',
    deletedNote: 'Task deleted',

    errorTextRequired: 'Type something to do first.',
    errorTextTooLong: (max: number) => `Keep a task under ${max} characters — anything longer belongs in a note.`,
    errorBadPriority: 'That is not one of the priorities.',
    errorBadDate: 'Use a real calendar date.',
    errorBadOrder: 'That reorder named tasks that are not yours.',
    errorTooManyIds: (max: number) => `A reorder can carry at most ${max} tasks.`,
  },

  // ── focus ──────────────────────────────────────────────────────────────────
  focus: {
    modeFocus: 'Focus',
    modeShortBreak: 'Short break',
    modeLongBreak: 'Long break',

    labelPlaceholder: 'What are you working on? (optional)',
    linkLabel: 'Link to a task',
    linkNone: 'No task',

    startAction: 'Start',
    pauseAction: 'Pause',
    resumeAction: 'Resume',
    stopAction: 'Stop',
    skipBreakAction: 'Skip break',
    startBreakAction: 'Start break',

    completeTitle: 'Session complete',
    completeBody: (minutes: number) => `${minutes} minutes done. Take a break.`,

    setsLabel: (done: number, total: number) => `Session ${done} of ${total} before a long break`,

    statsToday: (sessions: number, minutes: number) =>
      `Today: ${sessions} ${sessions === 1 ? 'session' : 'sessions'} · ${minutes} min focused`,
    statsEmpty: 'No focus sessions today yet.',

    settingsLabel: 'Timer settings',
    settingsHint: 'Saved on this device only — a timer length is not worth a round trip.',
    focusLengthLabel: 'Focus',
    shortBreakLabel: 'Short break',
    longBreakLabel: 'Long break',
    setLengthLabel: 'Sessions before a long break',
    minutes: (n: number) => `${n} min`,

    /** The timer keeps running while the tab is hidden; this says it out loud. */
    runningHint: 'The timer runs in this tab. A session is only recorded once it ends, so closing the tab records nothing.',

    recordedNote: 'Focus session recorded',
    stoppedNote: 'Session stopped',

    errorBadDuration: (min: number, max: number) =>
      `A session has to be between ${min} and ${max} minutes.`,
    errorBadTodo: 'That task is not one of yours.',
    errorLabelTooLong: (max: number) => `Keep the label under ${max} characters.`,
  },

  // ── insights ───────────────────────────────────────────────────────────────
  insights: {
    heading: 'Your own numbers',
    /**
     * Said once, at the top. `presence_events` carries no `workspace_id`, so the
     * counts below are the member's whole record; only the office/remote split
     * can be workspace-specific, and it says so where it appears.
     */
    scopeHint: 'Counted from your own check-ins, across every workspace you belong to.',

    weekHeading: 'This week',
    monthHeading: 'This month',

    daysPresent: 'Days present',
    hoursTracked: 'Hours tracked',
    sessions: 'Check-ins',
    streak: 'Current streak',

    streakValue: (days: number) => `${days} ${days === 1 ? 'day' : 'days'}`,
    streakHint: 'Consecutive days with a check-in, counting back from your last one.',
    hoursHint: 'Closed sessions only — a session still open has no length yet.',

    splitHeading: 'Office vs remote',
    splitOffice: 'Office',
    splitRemote: 'Remote',
    splitDays: (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`,
    /**
     * Stated rather than hidden. Whether a day counts as office is decided by a
     * workspace's signal configuration, so with no workspace there is no split
     * to show - not an empty one.
     */
    splitNoWorkspace:
      'Office and remote are decided by a workspace’s signals, so this split needs one. Join or create a workspace and it appears here.',
    splitHint: 'From your active workspace — the one in the pill above.',

    emptyTitle: 'Nothing to show yet',
    emptyHint: 'Check in from the home tab and your first numbers appear here.',
  },
} as const
