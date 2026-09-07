'use client'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export interface Tab {
  key: string
  label: ReactNode
  /** Count shown after the label; falsy counts are hidden. */
  badge?: number
}

interface TabBarProps extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange'> {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
}

/** Segmented `.tabbar` control. The active tab carries the `.active` class. */
export default function TabBar({ tabs, active, onChange, className, ...rest }: TabBarProps) {
  const classes = ['tabbar', className].filter(Boolean).join(' ')

  return (
    <div className={classes} role="tablist" {...rest}>
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={isActive ? 'active' : ''}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
            {tab.badge ? <span className="tab-badge">{tab.badge}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
