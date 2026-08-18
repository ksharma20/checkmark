import { db } from '../index'
import { localMidnightToUtc } from '@/lib/timezone'
import { createAdminOverride } from './workspaces'
import { createRegularizedEvent } from './events'

export type RegularizationType = 'office' | 'remote'
export type RegularizationStatus = 'pending' | 'approved' | 'rejected'

export interface RegularizationRequest {
  id: string
  workspace_id: string
  user_id: string
  target_date: string
  presence_event_id: string | null
  requested_type: RegularizationType
  reason: string
  status: RegularizationStatus
  rejection_reason: string | null
  actioned_by_user_id: string | null
  resulting_presence_event_id: string | null
  created_at: string
}

export interface RegularizationRequestWithUser extends RegularizationRequest {
  user_full_name: string | null
  user_email: string
}

export async function createRegularizationRequest(params: {
  workspaceId: string
  userId: string
  targetDate: string
  presenceEventId: string | null
  requestedType: RegularizationType
  reason: string
}): Promise<RegularizationRequest> {
  const id = crypto.randomUUID().replace(/-/g, '')
  await db.execute(
    `INSERT INTO regularization_requests
       (id, workspace_id, user_id, target_date, presence_event_id, requested_type, reason, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      params.workspaceId,
      params.userId,
      params.targetDate,
      params.presenceEventId,
      params.requestedType,
      params.reason,
    ],
  )
  const row = await db.queryOne<RegularizationRequest>(
    'SELECT * FROM regularization_requests WHERE id = ?',
    [id],
  )
  if (!row) throw new Error('Regularization request insert succeeded but row not found')
  return row
}

export async function getUserRegularizationRequests(
  workspaceId: string,
  userId: string,
): Promise<RegularizationRequest[]> {
  return db.query<RegularizationRequest>(
    `SELECT * FROM regularization_requests
     WHERE workspace_id = ? AND user_id = ?
     ORDER BY created_at DESC`,
    [workspaceId, userId],
  )
}

export async function getPendingRegularizationRequests(
  workspaceId: string,
  limit?: number,
): Promise<RegularizationRequestWithUser[]> {
  return db.query<RegularizationRequestWithUser>(
    `SELECT rr.*, u.full_name AS user_full_name, u.email AS user_email
     FROM regularization_requests rr
     JOIN users u ON u.id = rr.user_id
     WHERE rr.workspace_id = ? AND rr.status = 'pending'
     ORDER BY rr.created_at ASC
     ${limit ? 'LIMIT ?' : ''}`,
    limit ? [workspaceId, limit] : [workspaceId],
  )
}

export async function getPendingRegularizationCount(workspaceId: string): Promise<number> {
  const row = await db.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM regularization_requests WHERE workspace_id = ? AND status = 'pending'`,
    [workspaceId],
  )
  return row?.cnt ?? 0
}

export async function getRegularizationRequestById(
  id: string,
  workspaceId: string,
): Promise<RegularizationRequest | null> {
  return db.queryOne<RegularizationRequest>(
    'SELECT * FROM regularization_requests WHERE id = ? AND workspace_id = ?',
    [id, workspaceId],
  )
}

export async function hasPendingOrApprovedRegularization(
  workspaceId: string,
  userId: string,
  targetDate: string,
): Promise<boolean> {
  const row = await db.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM regularization_requests
     WHERE workspace_id = ? AND user_id = ? AND target_date = ? AND status IN ('pending','approved')`,
    [workspaceId, userId, targetDate],
  )
  return (row?.cnt ?? 0) > 0
}

export enum RegularizationAction {
  APPROVE = 'approve',
  REJECT = 'reject',
}

export type ActionRegularizationError = 'NOT_FOUND' | 'ALREADY_ACTIONED'
export type ActionRegularizationResult =
  | { updated: RegularizationRequest }
  | { error: ActionRegularizationError }

/**
 * Synthesizes the approval-time side effect: an office request bypasses signal
 * matching via admin_overrides (same mechanism the old Disputes page used); a
 * remote request needs no override since a non-office-matched event already
 * computes as a "remote" day. For a fully-absent day (no presence_event_id),
 * a new event is created first so there is something to attach the day-status
 * outcome to.
 */
async function applyRegularizationApproval(
  request: RegularizationRequest,
  workspaceTimezone: string,
  adminUserId: string,
): Promise<string | null> {
  const note = `Regularization approved: ${request.reason}`

  if (request.presence_event_id) {
    if (request.requested_type === 'office') {
      await createAdminOverride({
        workspaceId: request.workspace_id,
        presenceEventId: request.presence_event_id,
        adminUserId,
        note,
      })
    }
    return null
  }

  // Fully-absent day - synthesize a full workday window (09:30-18:30 local) on target_date.
  const midnightUtcMs = new Date(localMidnightToUtc(request.target_date, workspaceTimezone)).getTime()
  const checkinAt = new Date(midnightUtcMs + 9.5 * 3600_000).toISOString()
  const checkoutAt = new Date(midnightUtcMs + 18.5 * 3600_000).toISOString()

  const event = await createRegularizedEvent({
    userId: request.user_id,
    eventType: request.requested_type === 'office' ? 'office_checkin' : 'remote_checkin',
    checkinAt,
    checkoutAt,
    note,
  })

  if (request.requested_type === 'office') {
    await createAdminOverride({
      workspaceId: request.workspace_id,
      presenceEventId: event.id,
      adminUserId,
      note,
    })
  }

  return event.id
}

export async function actionRegularizationRequest(params: {
  id: string
  workspaceId: string
  workspaceTimezone: string
  action: RegularizationAction
  actionedByUserId: string
  rejectionReason?: string | null
}): Promise<ActionRegularizationResult> {
  const newStatus = params.action === RegularizationAction.APPROVE ? 'approved' : 'rejected'

  // Atomic: WHERE status='pending' prevents concurrent double-actions.
  const { changes } = await db.execute(
    `UPDATE regularization_requests
     SET status = ?, actioned_by_user_id = ?, rejection_reason = ?
     WHERE id = ? AND workspace_id = ? AND status = 'pending'`,
    [newStatus, params.actionedByUserId, params.rejectionReason ?? null, params.id, params.workspaceId],
  )
  if (changes === 0) {
    const existing = await getRegularizationRequestById(params.id, params.workspaceId)
    return existing ? { error: 'ALREADY_ACTIONED' } : { error: 'NOT_FOUND' }
  }

  const updated = await getRegularizationRequestById(params.id, params.workspaceId)
  if (!updated) throw new Error('Regularization request updated but row not found')

  if (params.action === RegularizationAction.APPROVE) {
    const resultingEventId = await applyRegularizationApproval(updated, params.workspaceTimezone, params.actionedByUserId)
    if (resultingEventId) {
      await db.execute(
        `UPDATE regularization_requests SET resulting_presence_event_id = ? WHERE id = ?`,
        [resultingEventId, params.id],
      )
      updated.resulting_presence_event_id = resultingEventId
    }
  }

  return { updated }
}
