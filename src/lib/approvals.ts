import { getPendingLeaveRequests, type PendingLeaveSummary } from './db/queries/leaves'
import { getPendingRegularizationRequests, type RegularizationRequestWithUser, type RegularizationType } from './db/queries/regularizations'
import { getPendingDocuments, type PendingDocumentSummary } from './db/queries/documents'
import { can } from './permissions/can'
import { Action, Resource, type PermissionGrid } from './permissions/catalogue'

export type ApprovalItem =
  | {
      kind: 'leave'
      id: string
      user_full_name: string | null
      user_email: string
      leave_type_name: string
      start_date: string
      end_date: string
      days: number
    }
  | {
      kind: 'regularization'
      id: string
      user_full_name: string | null
      user_email: string
      target_date: string
      requested_type: RegularizationType
      reason: string
    }
  | {
      /**
       * A document an employee uploaded that is waiting on admin
       * verification. `user_full_name` / `user_email` are filled from the
       * EMPLOYEE record rather than the users table - a document can belong to
       * an employee who has no linked login yet, and the approvals list still
       * has to name them.
       */
      kind: 'doc'
      id: string
      user_full_name: string | null
      user_email: string
      employee_id: string
      doc_key: string
      doc_name: string
      file_name: string | null
      uploaded_at: string | null
    }

/**
 * The viewer this feed is being built for.
 *
 * Structural, not `ResolvedRole`, so this module stays out of the roles query
 * layer - `ctx.role` from requireWsAccess() satisfies it as-is.
 */
export interface ApprovalsViewer {
  permissions: PermissionGrid | null | undefined
}

/**
 * The single source of truth for "pending approvals" - reused by the Overview
 * dashboard widget, the dedicated Approvals page, and the People page section
 * so all three surfaces always agree with each other.
 *
 * `viewer` is REQUIRED even though it is optional in the type, and omitting it
 * hides the document items rather than showing them. The three surfaces are
 * gated on three different permissions - dashboard:read, approvals:read and
 * the People page's own - so none of them implies documents:read, and a doc
 * item carries an employee's name, work email, employee id and the name of the
 * file they uploaded. Deny-by-default is the only safe reading of "no viewer
 * was passed"; a caller that legitimately has the permission passes ctx.role.
 */
export async function getPendingApprovalItems(
  workspaceId: string,
  opts?: { limit?: number; leavesEnabled?: boolean; viewer?: ApprovalsViewer | null },
): Promise<{
  leave: PendingLeaveSummary[]
  regularization: RegularizationRequestWithUser[]
  doc: PendingDocumentSummary[]
  items: ApprovalItem[]
}> {
  // Not fetched at all rather than fetched and filtered out afterwards: an
  // empty `doc` array is what keeps every count honest by construction. Both
  // the returned `doc` list and `items` are the same shortened truth, so a
  // caller totalling either (the Overview widget's pendingApprovalsTotal, the
  // Approvals page's `total`) cannot show a badge counting rows it is not
  // allowed to see.
  const canReadDocs = can(opts?.viewer?.permissions, Resource.Documents, Action.Read)

  const [leave, regularization, doc] = await Promise.all([
    opts?.leavesEnabled === false ? Promise.resolve([]) : getPendingLeaveRequests(workspaceId, opts?.limit ?? 100_000),
    getPendingRegularizationRequests(workspaceId, opts?.limit),
    canReadDocs ? getPendingDocuments(workspaceId, opts?.limit) : Promise.resolve([]),
  ])

  const items: ApprovalItem[] = [
    ...leave.map((l): ApprovalItem => ({
      kind: 'leave',
      id: l.id,
      user_full_name: l.user_full_name,
      user_email: l.user_email,
      leave_type_name: l.leave_type_name,
      start_date: l.start_date,
      end_date: l.end_date,
      days: l.days,
    })),
    ...regularization.map((r): ApprovalItem => ({
      kind: 'regularization',
      id: r.id,
      user_full_name: r.user_full_name,
      user_email: r.user_email,
      target_date: r.target_date,
      requested_type: r.requested_type,
      reason: r.reason,
    })),
    ...doc.map((d): ApprovalItem => ({
      kind: 'doc',
      id: d.id,
      user_full_name: `${d.employee_first_name} ${d.employee_last_name}`.trim() || null,
      user_email: d.employee_work_email,
      employee_id: d.employee_id,
      doc_key: d.doc_key,
      doc_name: d.name,
      file_name: d.file_name,
      uploaded_at: d.uploaded_at,
    })),
  ]

  return { leave, regularization, doc, items }
}
