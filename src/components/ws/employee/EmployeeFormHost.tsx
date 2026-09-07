'use client'

import { useId, useState } from 'react'
import { Button, Field, Input } from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsEmployees } from '@/locales/en/ws-people'
import type { EmployeePublic } from '@/lib/types/employees'
import {
  EMPTY_EMPLOYEE_FORM, buildEmployeeBody, serverFieldErrors, validateStep,
  FIELD_LABELS,
  type EmployeeFormData, type FieldErrors,
} from './employee-form'

/** Membership facts the seed needs. `userId` null means an invite not yet accepted. */
export interface MemberSeed {
  userId: string | null
  email: string
  fullName: string | null
}

interface Props {
  slug: string
  /** The membership behind the new record, when there already is one. */
  member: MemberSeed | null
  onCancel: () => void
  /**
   * `memberId` is the `workspace_members.id` the create returned - the person
   * screen is keyed on it, and it is the only navigation target that resolves.
   * Absent on the member-linked path, where the caller already has one.
   */
  onSaved: (employee: EmployeePublic, memberId?: string) => void | Promise<void>
}

/**
 * Create an employee record. Three fields, and only three.
 *
 * This replaces a five-step wizard, and the reduction is the point. The three
 * kept are the three NOT NULL columns - `employees.last_name` included, which
 * is why a single-word display name cannot simply be dropped into
 * `first_name`. Everything else about a person arrives later, from a different
 * source, on a different day: the wizard asked for all of it up front and got
 * an empty record whenever anybody stopped half way.
 *
 * The rest of the record is filled in tab by tab on the person screen, where
 * each section saves on its own. That is also where the invitation is offered -
 * the record is the artefact worth keeping, so it is written first.
 *
 * Two routes, one form:
 *  - member with an account  POST /members/:userId/employee - the only route
 *                            that links `employees.user_id` at insert time
 *  - everyone else           POST /employees - which also writes the membership
 *                            row (status `no_access`) and returns its id
 */
export default function EmployeeFormHost({ slug, member, onCancel, onSaved }: Props) {
  // Destructured: `show` is a stable useCallback, the context object is not.
  const { show: toast } = useToast()
  const reactId = useId()

  // Seed from what membership already knows, so an admin is not retyping a name
  // and an email the invite already carried. A single-word display name lands
  // entirely in `first_name` and leaves the surname blank for a human to
  // supply - `employees.last_name` is NOT NULL, and inventing one next to
  // somebody's PAN is not ours to do.
  const nameParts = (member?.fullName ?? '').trim().split(/\s+/).filter(Boolean)
  const [form, setForm] = useState<EmployeeFormData>({
    ...EMPTY_EMPLOYEE_FORM,
    first_name: nameParts[0] ?? '',
    last_name: nameParts.slice(1).join(' '),
    work_email: member?.email ?? '',
  })

  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const merged: FieldErrors = { ...serverErrors, ...errors }

  function change(key: 'first_name' | 'last_name' | 'work_email', value: string) {
    setForm(f => ({ ...f, [key]: value }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }))
    if (serverErrors[key]) setServerErrors(e => ({ ...e, [key]: undefined }))
  }

  async function submit() {
    // `validateStep(0, ...)` is the basic-details rules: it requires exactly
    // these three and validates the rest of that step only when non-empty,
    // which on a blank form is nothing. Reusing it rather than re-writing the
    // name and email rules is what stops this form drifting from the tab that
    // edits the same three fields later.
    const found = validateStep(0, form)
    if (Object.keys(found).length > 0) { setErrors(found); return }

    setErrors({})
    setServerErrors({})
    setError(null)
    setSaving(true)
    try {
      const linkedUserId = member?.userId ?? null
      const url = linkedUserId
        ? `/api/ws/${slug}/members/${linkedUserId}/employee`
        : `/api/ws/${slug}/employees`

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `create` mode omits blanks rather than nulling them, so the 30-odd
        // untouched keys never reach the server at all.
        body: JSON.stringify(buildEmployeeBody(form, 'create', ['first_name', 'last_name', 'work_email'])),
      }).catch(() => null)

      if (!res) { setError(wsEmployees.formGenericError); return }

      const data = await res.json().catch(() => ({})) as {
        employee?: EmployeePublic
        member_id?: string
        error?: string
        fields?: Record<string, string>
      }
      if (!res.ok || !data.employee) {
        setServerErrors(serverFieldErrors(data.fields))
        setError(data.error ?? wsEmployees.formGenericError)
        return
      }
      toast(wsEmployees.createdToast, 'success')
      await onSaved(data.employee, data.member_id)
    } finally {
      setSaving(false)
    }
  }

  const ids = {
    first: `new-emp-first-${reactId}`,
    last: `new-emp-last-${reactId}`,
    email: `new-emp-email-${reactId}`,
  }

  return (
    <div className="form-narrow">
      <div className="employee-form-grid">
        <Field label={FIELD_LABELS.first_name} htmlFor={ids.first} required error={merged.first_name}>
          <Input
            id={ids.first}
            value={form.first_name}
            invalid={!!merged.first_name}
            onChange={e => change('first_name', e.target.value)}
          />
        </Field>
        <Field label={FIELD_LABELS.last_name} htmlFor={ids.last} required error={merged.last_name}>
          <Input
            id={ids.last}
            value={form.last_name}
            invalid={!!merged.last_name}
            onChange={e => change('last_name', e.target.value)}
          />
        </Field>
        <Field
          label={FIELD_LABELS.work_email}
          htmlFor={ids.email}
          required
          error={merged.work_email}
          className="field-span-full"
        >
          <Input
            id={ids.email}
            type="email"
            value={form.work_email}
            placeholder="name@company.in"
            invalid={!!merged.work_email}
            onChange={e => change('work_email', e.target.value)}
          />
        </Field>
      </div>

      {error && <p className="field-error mt-12" role="alert">{error}</p>}

      <div className="form-actions">
        <Button loading={saving} onClick={() => void submit()}>
          {saving ? wsEmployees.createSaving : wsEmployees.createSubmit}
        </Button>
        <Button variant="secondary" disabled={saving} onClick={onCancel}>
          {wsEmployees.formCancel}
        </Button>
      </div>
    </div>
  )
}
