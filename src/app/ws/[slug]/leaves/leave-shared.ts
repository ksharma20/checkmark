/**
 * Types and formatters shared by the three Leave tabs.
 *
 * Requests and Applied render the SAME rows through different filters, so the
 * row shape and the date/duration maths live here rather than being written
 * once per tab and drifting.
 */

import type { ChipTone } from '@/components/ui'
import { wsLeaveScreen } from '@/locales/en/ws-people'

export interface LeaveRow {
  id: string
  user_full_name: string | null
  user_email: string
  leave_type_name: string
  start_date: string
  end_date: string
  reason: string | null
  status: string
  rejection_reason: string | null
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export const LEAVE_STATUS_TONE: Record<string, ChipTone> = {
  pending: 'partial',
  approved: 'verified',
  rejected: 'none',
}

export const LEAVE_STATUS_LABEL: Record<string, string> = {
  pending: wsLeaveScreen.statusPending,
  approved: wsLeaveScreen.statusApproved,
  rejected: wsLeaveScreen.statusRejected,
}

export function displayName(row: LeaveRow): string {
  return row.user_full_name ?? row.user_email
}

/** Local calendar dates, parsed part-by-part so no timezone shifts the day. */
export function formatRange(start: string, end: string): string {
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  const s = new Date(sy, sm - 1, sd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  const e = new Date(ey, em - 1, ed).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  return start === end ? e : `${s} → ${e}`
}

export function formatLongDate(value: string | null): string {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return value
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Inclusive day count, in UTC so a DST boundary cannot lose or add a day. */
export function leaveDays(start: string, end: string): number {
  const ms = new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()
  return Math.floor(ms / 86400000) + 1
}
