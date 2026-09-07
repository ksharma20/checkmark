'use client'

import { Fragment } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export interface WizardStep {
  key: string
  label: ReactNode
}

interface WizardStepsProps extends ComponentPropsWithoutRef<'div'> {
  steps: WizardStep[]
  /** Index of the step being edited; everything before it renders as done. */
  currentIndex: number
  /** When omitted the dots are inert - callers pass this to allow jumping. */
  onStepClick?: (index: number) => void
  /**
   * Steps that hold a validation error. Marked rather than blocked: the dots
   * are free to jump to, so the only honest way to say "you left something
   * behind" is on the dot itself.
   */
  invalidIndexes?: readonly number[]
}

/**
 * `.wizard-steps` - numbered dots joined by connectors, for multi-step forms.
 * Connectors before the current step are filled so progress reads left to right.
 */
export default function WizardSteps({
  steps,
  currentIndex,
  onStepClick,
  invalidIndexes,
  className,
  ...rest
}: WizardStepsProps) {
  const classes = ['wizard-steps', className].filter(Boolean).join(' ')
  const invalid = new Set(invalidIndexes ?? [])

  return (
    <div className={classes} {...rest}>
      {steps.map((step, i) => {
        const done = i < currentIndex
        const current = i === currentIndex
        const dotClass = [
          'wizard-step-dot',
          done && 'done',
          invalid.has(i) && 'invalid',
          current && 'current',
        ].filter(Boolean).join(' ')

        return (
          <Fragment key={step.key}>
            {i > 0 && <span className={done || current ? 'wizard-connector done' : 'wizard-connector'} />}
            <button
              type="button"
              className={dotClass}
              disabled={!onStepClick}
              aria-current={current ? 'step' : undefined}
              onClick={onStepClick ? () => onStepClick(i) : undefined}
            >
              {i + 1}
            </button>
            <span className={current ? 'wizard-step-label current' : 'wizard-step-label'}>
              {step.label}
            </span>
          </Fragment>
        )
      })}
    </div>
  )
}
