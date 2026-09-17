/**
 * The vocabulary of the personal space at `/me/space` - note colours, to-do
 * priorities, and every length and range limit the three domains enforce.
 *
 * THIS MODULE IS PURE. No database access, no imports from `lib/db/**`, exactly
 * like `src/lib/hierarchy.ts`, `src/lib/parental.ts` and
 * `src/lib/presence-ladder.ts` - and for the sharp reason those two cite rather
 * than as a stylistic preference. The note editor, the to-do form and the focus
 * timer are CLIENT components and need these values at runtime: a colour picker
 * has to enumerate the colours, and a `maxLength` has to be a number in the
 * browser. A runtime import from `lib/db/queries/notes.ts` would pull
 * `lib/db/index.ts` into the browser bundle, and with it better-sqlite3 and
 * libSQL - a build failure whose error is a long `Can't resolve 'fs'` trace that
 * names none of that. `import type` is erased and is always safe; a runtime
 * import is not.
 *
 * The query files re-export what their own server-side callers need, so a route
 * needs one import rather than two.
 */

// ── notes ────────────────────────────────────────────────────────────────────

/**
 * The note palette. Fixed, and mirrored by a `CHECK` on `user_notes.color` in
 * `scripts/migrate.js` - so unlike `maternity_cases.case_type`, this guard is
 * the second line of defence rather than the only one.
 */
export const NOTE_COLORS = ['default', 'yellow', 'teal', 'coral', 'purple'] as const
export type NoteColor = (typeof NOTE_COLORS)[number]

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && (NOTE_COLORS as readonly string[]).includes(value)
}

/** A heading, not a document. Long enough for a sentence, short enough to list. */
export const MAX_NOTE_TITLE_LEN = 200
/**
 * Roughly a dozen screens of text. A ceiling exists at all because a note is
 * member-authored free text with no other limit on it: the column is TEXT and
 * SQLite would happily store a pasted megabyte, which every list read then drags
 * back out. The list query selects the content (the card shows a preview), so an
 * unbounded column is an unbounded list response.
 */
export const MAX_NOTE_CONTENT_LEN = 20_000

// ── to-dos ───────────────────────────────────────────────────────────────────

/**
 * Ordered least-to-most urgent, which is the order the picker offers them in.
 * `'none'` is a real value rather than NULL: the column is NOT NULL with a
 * default, so "no priority" is a choice the member can return to rather than an
 * absence that has to be spelled differently from every other value.
 */
export const TODO_PRIORITIES = ['none', 'low', 'medium', 'high'] as const
export type TodoPriority = (typeof TODO_PRIORITIES)[number]

export function isTodoPriority(value: unknown): value is TodoPriority {
  return typeof value === 'string' && (TODO_PRIORITIES as readonly string[]).includes(value)
}

/** One line of a list. Anything longer is a note, and notes are the other tab. */
export const MAX_TODO_TEXT_LEN = 500

/**
 * How many ids one reorder may carry.
 *
 * The reorder endpoint writes one UPDATE per id inside a single transaction, so
 * the request length is the transaction length - and an unbounded array is an
 * unbounded write held open against the one connection this app has. The list
 * a member can actually drag is far smaller than this; the cap is here to make
 * a hostile body cheap to refuse rather than to constrain real use.
 */
export const MAX_REORDER_IDS = 500

// ── focus ────────────────────────────────────────────────────────────────────

/** What the member typed they were working on. Optional everywhere. */
export const MAX_FOCUS_LABEL_LEN = 200

/**
 * The bounds on a focus session's length, in minutes.
 *
 * Both the planned and the actual duration are checked against them. The actual
 * one matters more: it is reported by the browser after a countdown the server
 * never saw, so it is a CLAIM, and "I focused for nine million minutes" would
 * otherwise become today's stats. The ceiling is a day rather than a shift -
 * the point is to refuse nonsense, not to police how long somebody worked.
 */
export const MIN_SESSION_MIN = 1
export const MAX_SESSION_MIN = 1440

/** The durations the timer offers, in minutes. Device preference, not stored. */
export const FOCUS_DURATION_OPTIONS = [15, 20, 25, 30, 45, 60] as const
export const SHORT_BREAK_OPTIONS = [3, 5, 10] as const
export const LONG_BREAK_OPTIONS = [10, 15, 20, 30] as const
export const SESSIONS_BEFORE_LONG_BREAK_OPTIONS = [2, 3, 4] as const

// ── shared ───────────────────────────────────────────────────────────────────

/**
 * A `YYYY-MM-DD` calendar day, checked by shape AND by round-trip.
 *
 * The round-trip is what rejects `2026-02-31`: the regexp alone accepts it,
 * `Date.UTC` rolls it forward to 3 March, and re-formatting then disagrees with
 * the input. A due date that silently moves is worse than one refused.
 */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

/**
 * Where the focus timer's lengths are remembered.
 *
 * `localStorage`, not the database, and that is the same argument
 * `member_presence_prefs` makes in reverse: the session ladder is a schedule the
 * SERVER acts on, so it has to be stored where the cron can read it, while a
 * countdown length is only ever read by the tab that is counting. It is a device
 * preference - a member may well want 25 minutes on a laptop and 15 on a phone -
 * and syncing it would buy nothing but a round trip and a conflict.
 *
 * The key lives here rather than in `en.constants` only because this feature's
 * copy is a standalone module; it is a technical identifier and belongs with the
 * other constants when the two files are next reconciled.
 */
export const FOCUS_SETTINGS_STORAGE_KEY = 'cm_focus_settings'

export interface FocusSettings {
  focusMin: number
  shortBreakMin: number
  longBreakMin: number
  setLength: number
}

export const DEFAULT_FOCUS_SETTINGS: FocusSettings = {
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  setLength: 4,
}

/**
 * Read stored settings, falling back field by field.
 *
 * Per-field rather than all-or-nothing: `localStorage` is user-writable and
 * survives across deploys, so a value that stops being offered (or a key added
 * later) must not throw away the three settings beside it that are still good.
 */
export function parseFocusSettings(raw: string | null): FocusSettings {
  if (!raw) return DEFAULT_FOCUS_SETTINGS
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return DEFAULT_FOCUS_SETTINGS }
  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_FOCUS_SETTINGS

  const source = parsed as Record<string, unknown>
  const pick = (key: keyof FocusSettings, allowed: readonly number[]): number => {
    const value = source[key]
    return typeof value === 'number' && allowed.includes(value)
      ? value
      : DEFAULT_FOCUS_SETTINGS[key]
  }

  return {
    focusMin: pick('focusMin', FOCUS_DURATION_OPTIONS),
    shortBreakMin: pick('shortBreakMin', SHORT_BREAK_OPTIONS),
    longBreakMin: pick('longBreakMin', LONG_BREAK_OPTIONS),
    setLength: pick('setLength', SESSIONS_BEFORE_LONG_BREAK_OPTIONS),
  }
}
