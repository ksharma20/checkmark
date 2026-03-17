'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        padding: '24px',
        fontFamily: 'DM Sans, sans-serif',
        textAlign: 'center',
        background: 'var(--surface-1)',
      }}
    >
      <p
        style={{
          fontFamily: 'Syne, sans-serif',
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--navy)',
          marginBottom: '8px',
        }}
      >
        Something went wrong
      </p>
      <p
        style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          marginBottom: '24px',
          maxWidth: '360px',
          lineHeight: 1.6,
        }}
      >
        We ran into an unexpected problem. Your data is safe.
        {error.digest && (
          <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Error ID: {error.digest}
          </span>
        )}
      </p>
      <button
        onClick={reset}
        style={{
          height: '40px',
          padding: '0 20px',
          background: 'var(--brand)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: '14px',
          fontFamily: 'DM Sans, sans-serif',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}
