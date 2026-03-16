export type Plan = 'free' | 'starter' | 'growth'

export interface PlanLimits {
  maxUsers: number | null       // null = unlimited
  historyMonths: number | null  // null = unlimited
  maxLocations: number
  csvExport: boolean
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxUsers: 10,
    historyMonths: 3,
    maxLocations: 1,
    csvExport: false,
  },
  starter: {
    maxUsers: null,
    historyMonths: 12,
    maxLocations: 1,
    csvExport: true,
  },
  growth: {
    maxUsers: null,
    historyMonths: 84, // 7 years
    maxLocations: 5,
    csvExport: true,
  },
}

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.free
}

/**
 * Returns the earliest allowed UTC ISO date string for a plan's history window.
 */
export function historyStartDate(plan: string): string | null {
  const limits = getPlanLimits(plan)
  if (limits.historyMonths === null) return null
  const d = new Date()
  d.setMonth(d.getMonth() - limits.historyMonths)
  return d.toISOString()
}
