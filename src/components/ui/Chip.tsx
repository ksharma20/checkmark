'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import type { MatchedBy } from '@/lib/signals'

export type ChipTone =
  | 'verified'
  | 'partial'
  | 'none'
  | 'override'
  | 'owner'
  | 'leave'
  | 'roadmap'

export interface ChipProps extends Omit<HTMLAttributes<HTMLElement>, 'onClick' | 'children'> {
  tone: ChipTone
  children: ReactNode
  onClick?: () => void
}

/**
 * Maps a signal-matching result onto its chip tone. MatchedBy is imported from
 * lib/signals rather than redeclared, so the two can never drift apart.
 */
export function toneForMatchedBy(m: MatchedBy): ChipTone {
  return m
}

/** Status pill. Renders a real <button> when interactive, a <span> otherwise. */
export default function Chip({ tone, children, onClick, className, ...rest }: ChipProps) {
  const cls = ['chip', `chip-${tone}`, onClick && 'pressable', className].filter(Boolean).join(' ')

  if (onClick) {
    return (
      <button {...rest} type="button" className={cls} onClick={onClick}>
        {children}
      </button>
    )
  }

  return (
    <span {...rest} className={cls}>
      {children}
    </span>
  )
}
