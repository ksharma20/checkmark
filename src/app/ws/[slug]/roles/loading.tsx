import { Card, Skeleton } from '@/components/ui'

/**
 * Route-level skeleton, shown while the server component resolves the roles.
 *
 * The page renders its data server-side, so there is no client fetch to wait
 * on - this covers the navigation itself. Skeleton rather than a spinner, per
 * the design system.
 */
export default function Loading() {
  return (
    <>
      <Skeleton height={24} width={200} />
      <Skeleton height={14} width={340} style={{ margin: '8px 0 20px' }} />

      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Card style={{ width: '248px', flex: '0 0 auto' }}>
          <div className="stack-sm">
            {[0, 1, 2, 3].map((k) => <Skeleton key={k} height={34} radius="var(--radius-sm)" />)}
          </div>
        </Card>
        <Card style={{ flex: '1 1 320px', minWidth: '300px' }}>
          <Skeleton height={28} width={180} style={{ marginBottom: '14px' }} />
          <div className="stack-sm">
            {[0, 1, 2, 3, 4, 5, 6].map((k) => <Skeleton key={k} height={18} />)}
          </div>
        </Card>
      </div>
    </>
  )
}
