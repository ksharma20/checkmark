/**
 * Plan limits.
 *
 * CheckMark is free and open source, with no payment integration, and every
 * plan resolves to the same unlimited limits: no member cap, no history window,
 * spreadsheet export on. Users are never blocked.
 *
 * The `workspaces.plan` column, the `Plan` type and every enforcement point
 * (`queryWorkspaceEvents()`, the export and monthly routes, the regularization
 * and office-day history checks) are kept on purpose. They are no-ops while
 * every limit is unlimited, and they are the seam an operator running a hosted
 * instance would use to reintroduce caps: give a plan its own limits object in
 * `PLAN_LIMITS` and the existing checks start enforcing it.
 */
export type Plan = 'free' | 'starter' | 'growth'

export interface PlanLimits {
  maxUsers: number | null       // null = unlimited
  historyMonths: number | null  // null = unlimited
  maxLocations: number | null   // null = unlimited; advisory, never enforced
  csvExport: boolean
}

const UNLIMITED: PlanLimits = {
  maxUsers: null,
  historyMonths: null,
  maxLocations: null,
  csvExport: true,
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: UNLIMITED,
  starter: UNLIMITED,
  growth: UNLIMITED,
}

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as Plan] ?? UNLIMITED
}

/**
 * Returns the earliest allowed UTC ISO date string for a plan's history window,
 * or null when the plan has no window - which, today, is every plan.
 */
export function historyStartDate(plan: string): string | null {
  const limits = getPlanLimits(plan)
  if (limits.historyMonths === null) return null
  const d = new Date()
  d.setMonth(d.getMonth() - limits.historyMonths)
  return d.toISOString()
}
