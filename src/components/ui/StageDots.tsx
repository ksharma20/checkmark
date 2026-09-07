import { Fragment } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export interface Stage {
  key: string
  label: ReactNode
}

interface StageDotsProps extends ComponentPropsWithoutRef<'div'> {
  stages: Stage[]
  /** Index of the stage currently in progress; earlier stages read as done. */
  currentIndex: number
}

/**
 * Read-only lifecycle track (`.stage-dot` / `.stage-connector`) - the smaller,
 * non-interactive sibling of WizardSteps used for the maternity 4-stage flow.
 */
export default function StageDots({ stages, currentIndex, className, ...rest }: StageDotsProps) {
  const classes = ['stage-steps', className].filter(Boolean).join(' ')

  return (
    <div className={classes} {...rest}>
      {stages.map((stage, i) => {
        const done = i < currentIndex
        const current = i === currentIndex
        const dotClass = ['stage-dot', done && 'done', current && 'current'].filter(Boolean).join(' ')

        return (
          <Fragment key={stage.key}>
            {i > 0 && <span className={done || current ? 'stage-connector done' : 'stage-connector'} />}
            <span className={dotClass} aria-current={current ? 'step' : undefined}>
              {i + 1}
            </span>
            <span className={current ? 'wizard-step-label current' : 'wizard-step-label'}>
              {stage.label}
            </span>
          </Fragment>
        )
      })}
    </div>
  )
}
