'use client'

import { useEffect, useRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export interface DropdownMenuItem {
  key: string
  label: ReactNode
  onSelect: () => void
  danger?: boolean
}

export interface DropdownMenuProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  open: boolean
  onClose: () => void
  items: DropdownMenuItem[]
  placement?: 'above' | 'below'
}

/**
 * Absolutely-positioned menu — the nearest positioned ancestor is the trigger's
 * wrapper, so render it as a sibling of the trigger inside a `position: relative`
 * container (see `.sidebar-foot` / `.topbar-account` in globals.css).
 *
 * Dismissal follows NotificationPanel: a mousedown listener that closes when the
 * click lands outside `ref`, plus Escape. Both listeners only exist while open.
 */
export default function DropdownMenu({
  open,
  onClose,
  items,
  placement = 'above',
  className,
  ...rest
}: DropdownMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!open) return null

  const cls = ['dropdown-menu', placement === 'below' && 'below', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div {...rest} ref={ref} className={cls} role="menu">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className={['rowlink', item.danger && 'text-danger'].filter(Boolean).join(' ')}
          onClick={() => {
            item.onSelect()
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
