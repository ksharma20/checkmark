'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import {
  Button, Card, Field, Input, Select, Skeleton, Textarea,
  type SelectOption,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { wsEmployees } from '@/locales/en/ws-people'
import type { EmployeePublic } from '@/lib/types/employees'
import {
  FIELD_LABELS,
  EMPLOYEE_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, GENDER_LABELS,
  MARITAL_LABELS, SOURCE_OF_HIRE_LABELS, WORK_MODE_LABELS,
  buildEmployeeBody, formFromEmployee, serverFieldErrors, validateStep,
  type EmployeeFormData, type EmployeeFormKey, type FieldErrors,
} from './employee-form'
import { fieldsForTab, stepIndexForTab, type PersonTabKey } from './person-tabs'

// ─── Field descriptors ────────────────────────────────────────────────────────
//
// Purely presentational: which control a key renders as. The rules about what
// a key MEANS (required, format, masking) live in employee-form.ts, so this
// table can be reordered or restyled without touching validation.
//
// Lifted out of the deleted five-step wizard - it was the only part of it worth
// keeping. The wizard's mistake was the STEPPER, not the field table.

type ControlKind = 'text' | 'email' | 'tel' | 'date' | 'number' | 'textarea' | 'select' | 'sensitive'

interface Descriptor {
  kind: ControlKind
  placeholder?: string
  required?: boolean
  full?: boolean
  maxLength?: number
  labels?: Record<string, string>
}

function optionsFrom(labels: Record<string, string>): SelectOption[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }))
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const DESCRIPTORS: Record<EmployeeFormKey, Descriptor> = {
  first_name: { kind: 'text', required: true },
  last_name: { kind: 'text', required: true },
  work_email: { kind: 'email', required: true, placeholder: 'name@company.in' },
  personal_email: { kind: 'email' },
  phone: { kind: 'tel', placeholder: '10-digit mobile number', maxLength: 10 },
  alternate_phone: { kind: 'tel', maxLength: 10 },
  gender: { kind: 'select', labels: GENDER_LABELS },
  date_of_birth: { kind: 'date' },
  marital_status: { kind: 'select', labels: MARITAL_LABELS },
  number_of_children: { kind: 'number', placeholder: '0' },
  blood_group: { kind: 'select', labels: Object.fromEntries(BLOOD_GROUPS.map(g => [g, g])) },
  current_address: { kind: 'textarea', full: true, placeholder: 'Street, City, State, PIN' },
  permanent_address: { kind: 'textarea', full: true, placeholder: 'Same as current or different' },

  employee_id: { kind: 'text', placeholder: 'e.g. EMP-001' },
  designation: { kind: 'text', placeholder: 'e.g. Software Engineer' },
  department: { kind: 'text', placeholder: 'e.g. Engineering' },
  employment_type: { kind: 'select', labels: EMPLOYMENT_TYPE_LABELS },
  work_mode: { kind: 'select', labels: WORK_MODE_LABELS },
  work_location: { kind: 'text', placeholder: 'e.g. Mumbai HQ' },
  date_of_joining: { kind: 'date' },
  confirmation_date: { kind: 'date' },
  probation_end_date: { kind: 'date' },
  source_of_hire: { kind: 'select', labels: SOURCE_OF_HIRE_LABELS },
  total_work_experience: { kind: 'number', placeholder: '0' },
  employee_status: { kind: 'select', labels: EMPLOYEE_STATUS_LABELS },

  pan: { kind: 'sensitive', placeholder: 'ABCDE1234F', maxLength: 10 },
  aadhaar: { kind: 'sensitive', placeholder: '12-digit number', maxLength: 12 },
  uan: { kind: 'sensitive', placeholder: 'Universal Account Number', maxLength: 12 },
  passport_number: { kind: 'sensitive', placeholder: 'A1234567', maxLength: 8 },
  bank_account: { kind: 'sensitive', full: true, placeholder: 'Account number', maxLength: 18 },
  bank_ifsc: { kind: 'sensitive', placeholder: 'IFSC code' },
  bank_name: { kind: 'text', placeholder: 'e.g. HDFC Bank' },

  emergency_contact_name: { kind: 'text', full: true, placeholder: 'Full name' },
  emergency_contact_relationship: { kind: 'text', placeholder: 'e.g. Spouse, Parent' },
  emergency_contact_phone: { kind: 'tel', placeholder: '10-digit mobile number', maxLength: 10 },
}

// ─── Sensitive input ──────────────────────────────────────────────────────────

/**
 * A PAN or bank account typed in an open-plan office. Masked by default with
 * an explicit reveal, so the value is never on screen unless someone asked for
 * it. `tabIndex={-1}` on the eye keeps the toggle out of the tab order - it is
 * a convenience, not a step in filling the form.
 *
 * The eye sits BESIDE the input, not floating inside it. Overlaying meant
 * shrinking the button to 38px to fit a 42px control, which the old wizard did
 * with an inline style - invisible to the 44px touch-target selector list in
 * globals.css, and therefore silently exempt from it (invariant 15).
 */
function SensitiveInput({
  id, value, onChange, placeholder, maxLength, invalid, disabled,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  invalid?: boolean
  disabled?: boolean
}) {
  const [reveal, setReveal] = useState(false)
  return (
    <div className="input-affix">
      <Input
        id={id}
        type={reveal ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        invalid={invalid}
        disabled={disabled}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setReveal(r => !r)}
        aria-label={reveal ? wsEmployees.hide : wsEmployees.reveal}
        className="icon-btn icon-btn-plain"
      >
        {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

// ─── One field ────────────────────────────────────────────────────────────────

function RecordField({
  fieldKey, form, errors, disabled, onChange,
}: {
  fieldKey: EmployeeFormKey
  form: EmployeeFormData
  errors: FieldErrors
  disabled: boolean
  onChange: (key: EmployeeFormKey, value: string) => void
}) {
  const reactId = useId()
  const id = `emp-${fieldKey}-${reactId}`
  const d = DESCRIPTORS[fieldKey]
  const value = form[fieldKey]
  const error = errors[fieldKey]
  const set = (v: string) => onChange(fieldKey, v)

  let control
  if (d.kind === 'select') {
    control = (
      <Select
        id={id}
        value={value}
        disabled={disabled}
        onChange={e => set(e.target.value)}
        invalid={!!error}
        options={[{ value: '', label: 'Select' }, ...optionsFrom(d.labels ?? {})]}
      />
    )
  } else if (d.kind === 'textarea') {
    control = (
      <Textarea
        id={id}
        value={value}
        disabled={disabled}
        onChange={e => set(e.target.value)}
        placeholder={d.placeholder}
        invalid={!!error}
      />
    )
  } else if (d.kind === 'sensitive') {
    control = (
      <SensitiveInput
        id={id}
        value={value}
        disabled={disabled}
        onChange={set}
        placeholder={d.placeholder}
        maxLength={d.maxLength}
        invalid={!!error}
      />
    )
  } else {
    control = (
      <Input
        id={id}
        type={d.kind}
        value={value}
        disabled={disabled}
        onChange={e => set(e.target.value)}
        placeholder={d.placeholder}
        maxLength={d.maxLength}
        invalid={!!error}
      />
    )
  }

  return (
    <Field
      label={FIELD_LABELS[fieldKey]}
      htmlFor={id}
      required={d.required}
      error={error}
      className={d.full ? 'field-span-full' : undefined}
    >
      {control}
    </Field>
  )
}

// ─── The tab ──────────────────────────────────────────────────────────────────

interface Props {
  slug: string
  /** `employees.id` - what PATCH addresses. Not a membership or user id. */
  employeeId: string
  tabKey: PersonTabKey
  /**
   * The record as the server rendered the page. Used to paint real values
   * immediately on a tab switch; the fetch below is what confirms them.
   */
  employee: EmployeePublic
  /** `employees:write`. False renders the same fields, read-only. */
  canWrite: boolean
  onSaved: (employee: EmployeePublic) => void
}

/**
 * One tab of the employee record: its own fields, its own Save.
 *
 * This is the whole shape of the screen that replaced the five-step wizard.
 * A wizard assumes the record is filled in once, in order, by one person in one
 * sitting - and an HR record is not assembled that way. HR has the name today,
 * the bank details next week, the emergency contact whenever the person
 * answers. One component, parameterised by tab, so all four sections cannot
 * drift apart.
 *
 * **The `onlyKeys` argument to `buildEmployeeBody` is load-bearing, not an
 * optimisation.** In `update` mode every blank becomes an explicit `null`, so a
 * PATCH built from the whole form while standing on the Bank tab would send
 * `emergency_contact_name: null, current_address: null…` and wipe the tabs
 * nobody opened. Narrowing to `fieldsForTab(tabKey)` is what makes per-tab
 * saving safe at all.
 */
export default function EmployeeSectionTab({
  slug, employeeId, tabKey, employee, canWrite, onSaved,
}: Props) {
  const { show: toast } = useToast()

  const keys = fieldsForTab(tabKey)
  const stepIndex = stepIndexForTab(tabKey)

  /**
   * Three states, not a boolean - the same reason `OrgTab` has them.
   *
   * `form` starts as a set of DEFAULTS (`EMPTY_EMPLOYEE_FORM` sets
   * `employee_status: 'active'`, among others), so "still loading" and "failed
   * to load" have to be told apart from "loaded". Painting an editable form on
   * a failed fetch would let Save PATCH those defaults over a real record -
   * turning a terminated employee active because a request timed out.
   *
   * The seed from `employee` means a tab switch paints real values with no
   * skeleton, but it is a snapshot from the server render: a sibling tab may
   * have written to the same row since. So the fields are DISABLED until the
   * fetch confirms them, which also removes any chance of the response landing
   * on top of something being typed.
   */
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [loaded, setLoaded] = useState<EmployeeFormData>(() => formFromEmployee(employee))
  const [form, setForm] = useState<EmployeeFormData>(() => formFromEmployee(employee))
  const [dirty, setDirty] = useState(false)

  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const apply = useCallback((next: EmployeePublic) => {
    const seeded = formFromEmployee(next)
    setLoaded(seeded)
    setForm(seeded)
    setDirty(false)
    setErrors({})
    setServerErrors({})
    setError(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoad('loading')
    fetch(`/api/ws/${slug}/employees/${employeeId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET employees/${employeeId} responded ${res.status}`)
        const body = await res.json() as { employee?: EmployeePublic }
        if (!body.employee) throw new Error('GET employees/[id] returned no record')
        return body.employee
      })
      .then((fresh) => {
        if (cancelled) return
        apply(fresh)
        setLoad('ready')
      })
      .catch(() => { if (!cancelled) setLoad('error') })
    return () => { cancelled = true }
  }, [slug, employeeId, reloadKey, apply])

  function change(key: EmployeeFormKey, value: string) {
    setDirty(true)
    setForm(f => ({ ...f, [key]: value }))
    // Clear both error sources for the key being edited: a server 422 that is
    // still on screen after the admin has fixed the value reads as the fix
    // having been rejected.
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }))
    if (serverErrors[key]) setServerErrors(e => ({ ...e, [key]: undefined }))
  }

  async function save() {
    // Unreachable from the UI - the controls are disabled unless the real
    // values are in hand - but stated so it cannot become reachable by accident.
    if (load !== 'ready' || !canWrite) return
    // An empty `onlyKeys` narrows the body to nothing but the three NOT NULL
    // columns, which is a no-op write dressed up as a save.
    if (keys.length === 0) return

    const found = validateStep(stepIndex, form)
    if (Object.keys(found).length > 0) { setErrors(found); return }

    setErrors({})
    setServerErrors({})
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/ws/${slug}/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEmployeeBody(form, 'update', keys)),
      }).catch(() => null)

      if (!res) { setError(wsEmployees.formGenericError); return }

      const data = await res.json().catch(() => ({})) as {
        employee?: EmployeePublic
        error?: string
        fields?: Record<string, string>
      }
      if (!res.ok || !data.employee) {
        setServerErrors(serverFieldErrors(data.fields))
        setError(data.error ?? wsEmployees.formGenericError)
        return
      }
      apply(data.employee)
      onSaved(data.employee)
      toast(wsEmployees.formSaved, 'success')
    } finally {
      setSaving(false)
    }
  }

  if (load === 'error') {
    return (
      <Card className="mt-16">
        <div role="alert">
          <p className="t-eyebrow mb-12 text-danger">{wsEmployees.formLoadFailedTitle}</p>
          <p className="t-muted mb-12">{wsEmployees.formLoadFailedBody}</p>
        </div>
        <Button variant="secondary" onClick={() => setReloadKey(k => k + 1)}>
          {wsEmployees.formLoadFailedRetry}
        </Button>
      </Card>
    )
  }

  const merged: FieldErrors = { ...serverErrors, ...errors }
  const locked = load !== 'ready' || !canWrite || saving

  return (
    <Card className="mt-16">
      {load === 'loading' && <Skeleton height={3} radius="var(--radius-sm)" className="mb-12" />}

      <div className="employee-form-grid">
        {keys.map(k => (
          <RecordField
            key={k}
            fieldKey={k}
            form={form}
            errors={merged}
            disabled={locked}
            onChange={change}
          />
        ))}
      </div>

      {error && <p className="field-error mt-12" role="alert">{error}</p>}

      {canWrite ? (
        <div className="form-actions">
          <Button loading={saving} disabled={locked || !dirty} onClick={() => void save()}>
            {saving ? wsEmployees.formSaving : wsEmployees.formSave}
          </Button>
          {/* Revert, not "leave" - there is no wizard to leave any more. It puts
              back the values the last successful load or save returned. */}
          <Button
            variant="secondary"
            disabled={locked || !dirty}
            onClick={() => { setForm(loaded); setDirty(false); setErrors({}); setServerErrors({}); setError(null) }}
          >
            {wsEmployees.formCancel}
          </Button>
        </div>
      ) : (
        <p className="t-muted field-note">{wsEmployees.formReadOnly}</p>
      )}
    </Card>
  )
}
