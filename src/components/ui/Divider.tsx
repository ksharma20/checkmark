import type { ComponentPropsWithoutRef } from 'react'

interface DividerProps extends ComponentPropsWithoutRef<'div'> {
  /**
   * Pulls the rule in from both edges - `true` uses the 20px `.card` padding,
   * a number sets the inset in px. Used when the divider sits inside an
   * unpadded card whose rows carry their own gutters.
   */
  inset?: boolean | number
}

/** A 1px `.divider` rule. */
export default function Divider({ inset, className, style, ...rest }: DividerProps) {
  // `inset === true` is the 20px card gutter, which `.divider.inset` already
  // carries; a numeric inset is caller-chosen, so it stays inline.
  const gutter = typeof inset === 'number' ? inset : 0
  const classes = ['divider', inset === true && 'inset', className].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      role="separator"
      style={gutter ? { marginLeft: `${gutter}px`, marginRight: `${gutter}px`, ...style } : style}
      {...rest}
    />
  )
}
