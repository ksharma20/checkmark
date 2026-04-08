'use client'

interface LoadingButtonProps {
  children: React.ReactNode
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'outline' | 'danger'
  disabled?: boolean
  style?: React.CSSProperties
}

export default function LoadingButton({
  children,
  loading = false,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
  style,
}: LoadingButtonProps) {
  const bg =
    variant === 'danger' ? 'var(--danger)'
    : variant === 'outline' ? 'transparent'
    : 'var(--brand)'
  const color = variant === 'outline' ? 'var(--text-secondary)' : '#fff'
  const border = variant === 'outline' ? '1px solid var(--border)' : 'none'

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        height: '44px',
        padding: '0 20px',
        background: bg,
        color,
        border,
        borderRadius: 'var(--radius-md)',
        fontSize: '14px',
        fontFamily: 'DM Sans, sans-serif',
        fontWeight: 500,
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        opacity: loading || disabled ? 0.7 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        ...style,
      }}
    >
      {loading && (
        <span
          style={{
            width: '14px',
            height: '14px',
            border: `2px solid ${variant === 'outline' ? 'var(--text-secondary)' : 'rgba(255,255,255,0.4)'}`,
            borderTopColor: variant === 'outline' ? 'var(--brand)' : '#fff',
            borderRadius: '50%',
            animation: 'cm-spin 0.7s linear infinite',
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
      )}
      {children}
    </button>
  )
}
