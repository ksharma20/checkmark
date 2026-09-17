import { db } from '../index'
import type { EmployeeStatus } from '@/lib/constants/employees'
import type { EmployeePublic } from '@/lib/types/employees'
import { type EmployeeRow, toPublic } from './employees'

export interface ListPeopleOpts {
  limit?: number
  offset?: number
  /** Free text over member name, member email, employee name and job title. */
  search?: string
  department?: string
  status?: EmployeeStatus
  location?: string
  include_archived?: boolean
}

/**
 * One person in the workforce directory.
 *
 * `workspace_members` and `employees` are separate tables and nothing links
 * them automatically: an employee row is only ever created by an admin filling
 * the wizard in. So a directory driven by `employees` shows the handful of
 * people HR has got round to, not the workforce - in a real workspace that
 * was one row out of dozens of members.
 *
 * The directory is therefore a list of MEMBERS with the HR record overlaid
 * where one exists. `employee: null` is not an error state, it is simply
 * "nobody has filled this in yet".
 *
 * The rejected alternative was auto-provisioning an `employees` row per member.
 * `employees.last_name` is NOT NULL and 10 of those 34 members hold a
 * single-word name, so it would have meant inventing a surname for a third of
 * the staff and storing it next to their PAN and bank details.
 */
export interface DirectoryPerson {
  /** `workspace_members.id`. */
  member_id: string
  user_id: string
  email: string
  full_name: string | null
  role: string
  added_at: string
  /** The HR record, or `null` when this member has none yet. */
  employee: EmployeePublic | null
}

/**
 * The employee half of a directory row arrives as a LEFT JOIN, so every column
 * of it may be null - `Partial` is what makes `row.id` the honest test for
 * "this member has a record" rather than a cast that lies.
 */
type DirectoryRow = Partial<EmployeeRow> & {
  member_id: string
  member_user_id: string
  member_email: string
  member_full_name: string | null
  member_role: string
  member_added_at: string
}

/** Neutralise the wildcards so a search for `100%` cannot match everything. */
function likeTerm(value: string): string {
  return `%${value.trim().toLowerCase().replace(/[\\%_]/g, c => `\\${c}`)}%`
}

/**
 * Page the directory: every active member of the workspace, HR data attached
 * where it exists.
 *
 * Filter semantics, deliberately: `status`, `department` and `location` read
 * columns that only an employee record carries, so applying one necessarily
 * hides every member without a record. That is the honest behaviour - the
 * alternative would be claiming someone is in "Engineering" on the strength of
 * no data at all - and the UI says so out loud rather than quietly shrinking
 * the list. `search` is the exception: it matches member name and email too, so
 * it finds people whether or not HR has got to them.
 */
export async function listDirectoryPeople(
  workspaceId: string,
  opts: ListPeopleOpts = {},
): Promise<{ people: DirectoryPerson[]; total: number; withRecord: number }> {
  const limit = Math.min(opts.limit ?? 25, 100)
  const offset = opts.offset ?? 0

  // The employee join is scoped by workspace_id as well as user_id: one account
  // can hold memberships in several workspaces, and each has its own HR record.
  const employeeJoin = [
    'LEFT JOIN employees e',
    '  ON e.user_id = m.user_id AND e.workspace_id = m.workspace_id',
    opts.include_archived ? '' : '  AND e.deleted_at IS NULL',
  ].filter(Boolean).join('\n     ')

  const joins = `
     LEFT JOIN users u ON u.id = m.user_id AND u.deleted_at IS NULL
     ${employeeJoin}
     LEFT JOIN employment_details ed ON ed.employee_id = e.id`

  const conditions: string[] = ["m.workspace_id = ?", "m.status = 'active'", 'm.user_id IS NOT NULL']
  const params: unknown[] = [workspaceId]

  if (opts.status)     { conditions.push('e.employee_status = ?'); params.push(opts.status) }
  if (opts.department) { conditions.push('ed.department = ?');     params.push(opts.department) }
  if (opts.location)   { conditions.push('ed.work_location = ?');  params.push(opts.location) }

  if (opts.search?.trim()) {
    const term = likeTerm(opts.search)
    conditions.push(`(
      LOWER(COALESCE(u.full_name, '')) LIKE ? ESCAPE '\\'
      OR LOWER(m.email) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(e.first_name, '') || ' ' || COALESCE(e.last_name, '')) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(ed.designation, '')) LIKE ? ESCAPE '\\'
    )`)
    params.push(term, term, term, term)
  }

  const where = `WHERE ${conditions.join(' AND ')}`

  // Both counts in one pass: `total` drives pagination, `withRecord` lets the
  // header say how many of those people HR has actually filled in.
  const countRow = await db.queryOne<{ total: number; with_record: number }>(
    `SELECT COUNT(*) AS total, COUNT(e.id) AS with_record
     FROM workspace_members m ${joins}
     ${where}`,
    params,
  )
  const total = countRow?.total ?? 0
  const withRecord = countRow?.with_record ?? 0

  // Sorted on the name the row actually displays, so the order the reader sees
  // is the order the pages are cut on. `m.id` breaks ties, without which two
  // people sharing a display name could repeat or vanish across a page break.
  const rows = await db.query<DirectoryRow>(
    `SELECT
       m.id       AS member_id,
       m.user_id  AS member_user_id,
       m.email    AS member_email,
       m.role     AS member_role,
       m.added_at AS member_added_at,
       u.full_name AS member_full_name,
       e.*,
       ed.designation, ed.department, ed.work_location, ed.work_mode,
       ed.reporting_manager_id, ed.employment_type, ed.source_of_hire,
       ed.total_work_experience, ed.date_of_joining, ed.confirmation_date,
       ed.probation_end_date, ed.exit_date, ed.exit_reason
     FROM workspace_members m ${joins}
     ${where}
     ORDER BY LOWER(COALESCE(NULLIF(TRIM(u.full_name), ''), m.email)) ASC, m.id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )

  const people = rows.map<DirectoryPerson>(row => ({
    member_id: row.member_id,
    user_id: row.member_user_id,
    email: row.member_email,
    full_name: row.member_full_name,
    role: row.member_role,
    added_at: row.member_added_at,
    // `e.id` is the only column guaranteed present on a real employee row, so
    // it - not a name or an email, either of which could be blank - is what
    // decides whether there is a record to hand back.
    employee: row.id ? toPublic(row as EmployeeRow) : null,
  }))

  return { people, total, withRecord }
}
