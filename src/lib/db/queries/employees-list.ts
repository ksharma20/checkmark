import { db } from '../index'
import type { EmployeeStatus } from '@/lib/constants/employees'
import type { EmployeePublic } from '@/lib/types/employees'
import { type EmployeeRow, toPublic } from './employees'

export interface ListEmployeesOpts {
  limit?: number
  offset?: number
  department?: string
  status?: EmployeeStatus
  location?: string
  include_archived?: boolean
}

export async function listEmployeesPaged(
  workspaceId: string,
  opts: ListEmployeesOpts = {},
): Promise<{ employees: EmployeePublic[]; total: number }> {
  const limit = Math.min(opts.limit ?? 25, 100)
  const offset = opts.offset ?? 0

  const conditions: string[] = ['e.workspace_id = ?']
  const params: unknown[] = [workspaceId]

  if (!opts.include_archived) conditions.push('e.deleted_at IS NULL')
  if (opts.status)     { conditions.push('e.employee_status = ?'); params.push(opts.status) }
  if (opts.department) { conditions.push('ed.department = ?');     params.push(opts.department) }
  if (opts.location)   { conditions.push('ed.work_location = ?');  params.push(opts.location) }

  const where = `WHERE ${conditions.join(' AND ')}`
  const join = `LEFT JOIN employment_details ed ON ed.employee_id = e.id`

  const countRow = await db.queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM employees e ${join} ${where}`,
    params,
  )
  const total = countRow?.total ?? 0

  const rows = await db.query<EmployeeRow>(
    `SELECT e.*,
       ed.designation, ed.department, ed.work_location, ed.work_mode,
       ed.reporting_manager_id, ed.employment_type, ed.source_of_hire,
       ed.total_work_experience, ed.date_of_joining, ed.confirmation_date,
       ed.probation_end_date, ed.exit_date, ed.exit_reason
     FROM employees e ${join}
     ${where}
     ORDER BY e.last_name ASC, e.first_name ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )

  return { employees: rows.map(row => toPublic(row)), total }
}
