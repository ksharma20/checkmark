/**
 * Parental-leave constants and type guards.
 *
 * PURE. No database access, no imports from the query layer - exactly like
 * `src/lib/hierarchy.ts`, and for a sharper reason: the admin form that creates
 * a case is a CLIENT component. When these lived in
 * `lib/db/queries/maternity.ts`, importing `DEFAULT_CASE_WEEKS` from that form
 * pulled `lib/db/index.ts` into the browser bundle, and with it better-sqlite3
 * and libSQL - a build failure with a long, unhelpful `Can't resolve 'fs'`
 * trace. A `import type` is erased and would have been fine; a runtime value is
 * not. So anything both sides need lives here, and the query file re-exports it
 * for its own callers.
 */

/**
 * Which statutory entitlement a case is being taken under.
 *
 * The two share one table and one stage machine: `requested → approved →
 * onleave → returned` is the same walk whichever parent takes it, and the
 * reminder gate reads the same start/end dates. Only the entitlement differs, so
 * a discriminator column is the smaller thing than a second table.
 *
 * `isParentalCaseType()` IS THE VALIDATION. `maternity_cases.case_type` was
 * added by `ALTER TABLE`, and SQLite cannot attach a CHECK constraint to a
 * column added that way, so unlike `status` there is no database-level guard on
 * it - a route that writes an unvalidated string will be accepted by the
 * database and read back as garbage. Every write path must run its input
 * through it first. Keep the list in step with the comment on that ALTER in
 * scripts/migrate.js.
 */
export type ParentalCaseType = 'maternity' | 'paternity'

export const PARENTAL_CASE_TYPES: readonly ParentalCaseType[] = ['maternity', 'paternity']

export function isParentalCaseType(value: unknown): value is ParentalCaseType {
  return typeof value === 'string' && (PARENTAL_CASE_TYPES as readonly string[]).includes(value)
}

/**
 * The statutory entitlement each case type opens with, in weeks.
 *
 * Shared so the admin form and the INSERT default cannot disagree - a paternity
 * case created without an explicit `weeks` must not silently inherit
 * maternity's 26. India's Maternity Benefit Act sets 26 weeks; there is no
 * central statutory paternity entitlement, and the common private-sector and
 * central-government figure is 2 weeks, so that is the default offered. It is
 * only a default: the form lets an admin type any value up to 104.
 */
export const DEFAULT_CASE_WEEKS: Record<ParentalCaseType, number> = {
  maternity: 26,
  paternity: 2,
}
