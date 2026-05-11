import { db } from '../index'

export interface Holiday {
  id: string
  workspace_id: string
  name: string
  date: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export async function listHolidays(workspaceId: string, year?: number): Promise<Holiday[]> {
  if (year != null) {
    return db.query<Holiday>(
      `SELECT * FROM workspace_holidays
       WHERE workspace_id = ? AND deleted_at IS NULL
         AND date >= ? AND date <= ?
       ORDER BY date ASC`,
      [workspaceId, `${year}-01-01`, `${year}-12-31`],
    )
  }
  return db.query<Holiday>(
    `SELECT * FROM workspace_holidays
     WHERE workspace_id = ? AND deleted_at IS NULL
     ORDER BY date ASC`,
    [workspaceId],
  )
}

export async function getHoliday(id: string, workspaceId: string): Promise<Holiday | null> {
  return db.queryOne<Holiday>(
    `SELECT * FROM workspace_holidays WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
}

export async function findHolidayByNameAndDate(
  workspaceId: string,
  name: string,
  date: string,
  excludeId?: string,
): Promise<Holiday | null> {
  if (excludeId) {
    return db.queryOne<Holiday>(
      `SELECT * FROM workspace_holidays
       WHERE workspace_id = ? AND name = ? AND date = ? AND deleted_at IS NULL AND id != ?`,
      [workspaceId, name, date, excludeId],
    )
  }
  return db.queryOne<Holiday>(
    `SELECT * FROM workspace_holidays
     WHERE workspace_id = ? AND name = ? AND date = ? AND deleted_at IS NULL`,
    [workspaceId, name, date],
  )
}

export async function createHoliday(params: {
  workspaceId: string
  name: string
  date: string
  description?: string
  createdBy: string
}): Promise<Holiday> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO workspace_holidays (id, workspace_id, name, date, description, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, params.workspaceId, params.name, params.date, params.description ?? null, params.createdBy],
  )
  const row = await getHoliday(id, params.workspaceId);
  if (!row) throw new Error("Holiday insert succeeded but row not found");
  return row;
}

export async function updateHoliday(
  id: string,
  workspaceId: string,
  params: {
    name?: string
    date?: string
    description?: string | null
  },
): Promise<Holiday | null> {
  const sets: string[] = [`updated_at = datetime('now')`]
  const args: unknown[] = []

  if (params.name !== undefined) { sets.push('name = ?'); args.push(params.name) }
  if (params.date !== undefined) { sets.push('date = ?'); args.push(params.date) }
  if ('description' in params) { sets.push('description = ?'); args.push(params.description ?? null) }

  if (sets.length > 1) {
    args.push(id, workspaceId)
    await db.execute(
      `UPDATE workspace_holidays SET ${sets.join(', ')} WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
      args,
    )
  }

  return getHoliday(id, workspaceId)
}

export type HolidayImportRow = {
  name: string
  date: string
  description: string | null
}

export async function bulkUpsertHolidays(
  workspaceId: string,
  createdBy: string,
  rows: HolidayImportRow[],
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0
  let updated = 0

  await db.transaction(async (tx) => {
    for (const row of rows) {
      const existing = await tx.queryOne<{ id: string }>(
        `SELECT id FROM workspace_holidays WHERE workspace_id = ? AND date = ? AND deleted_at IS NULL`,
        [workspaceId, row.date],
      )
      if (existing) {
        await tx.execute(
          `UPDATE workspace_holidays
           SET name = ?, description = ?, updated_at = datetime('now')
           WHERE id = ? AND workspace_id = ?`,
          [row.name, row.description, existing.id, workspaceId],
        )
        updated++
      } else {
        const id = crypto.randomUUID().replace(/-/g, '')
        await tx.execute(
          `INSERT INTO workspace_holidays (id, workspace_id, name, date, description, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, workspaceId, row.name, row.date, row.description, createdBy],
        )
        inserted++
      }
    }
  })

  return { inserted, updated }
}

export async function listHolidayDatesInRange(
  workspaceId: string,
  startDate: string,
  endDate: string,
): Promise<Set<string>> {
  const rows = await db.query<{ date: string }>(
    `SELECT date FROM workspace_holidays
     WHERE workspace_id = ? AND deleted_at IS NULL
       AND date >= ? AND date <= ?`,
    [workspaceId, startDate, endDate],
  )
  return new Set(rows.map((r) => r.date))
}

export async function deleteHoliday(id: string, workspaceId: string): Promise<void> {
  await db.execute(
    `UPDATE workspace_holidays
     SET deleted_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ? AND deleted_at IS NULL`,
    [id, workspaceId],
  )
}