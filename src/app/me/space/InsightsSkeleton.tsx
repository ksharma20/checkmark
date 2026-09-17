import { Skeleton } from '@/components/ui'

/**
 * The Insights placeholder, mirroring the real panel's shape - two headings,
 * four tiles, one split bar. A skeleton, never a spinner: the design system
 * forbids spinners, and a shape that matches what arrives stops the layout
 * jumping when it does.
 */
export default function InsightsSkeleton() {
  return (
    <div className="stack">
      <Skeleton width="55%" height={18} />
      <div className="space-stat-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={84} radius="var(--radius-lg)" />
        ))}
      </div>
      <Skeleton height={96} radius="var(--radius-lg)" />
    </div>
  )
}
