/**
 * Route-level skeleton, shown while the server component resolves the roles.
 *
 * The page renders its data server-side, so there is no client fetch to wait
 * on - this covers the navigation itself. Skeleton rather than a spinner, per
 * the design system.
 */
export default function Loading() {
  const card: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-0)',
    padding: '12px',
  }
  const sk: React.CSSProperties = { background: 'var(--surface-2)', borderRadius: '3px' }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ ...sk, height: '24px', width: '200px', marginBottom: '8px' }} />
      <div style={{ ...sk, height: '14px', width: '340px', marginBottom: '20px' }} />
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ ...card, width: '240px', flexShrink: 0 }}>
          {[1, 2, 3, 4].map((k) => (
            <div key={k} style={{ ...sk, height: '34px', marginBottom: '8px' }} />
          ))}
        </div>
        <div style={{ ...card, flex: 1, minWidth: '300px' }}>
          <div style={{ ...sk, height: '28px', width: '180px', marginBottom: '14px' }} />
          {[1, 2, 3, 4, 5, 6, 7].map((k) => (
            <div key={k} style={{ ...sk, height: '18px', marginBottom: '9px' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
