'use client'

/**
 * `/me/profile` - the first UI over `GET/PATCH /api/me/ws/[slug]/employee`.
 *
 * The route already owns the hard part: a server-side whitelist of the fields
 * a member may edit about themselves (`ALLOWED_SELF_EDIT`), and
 * `validateEmployeeFields` behind it. This screen therefore does no validation
 * of its own - it renders the sections, sends a diff, and paints whatever
 * `fields` come back in a 422 onto the matching `Field`. Adding a regex here
 * would be a second copy of a rule that already exists on the server.
 *
 * Two shapes are worth calling out:
 *
 * - Employment details (designation, department, joining date...) are shown
 *   read-only. They are admin-owned; the whitelist rejects them, so offering
 *   an input would be a lie.
 * - The statutory/bank block reads out of `employee.sensitive`, which the API
 *   decrypts per request. Empty strings are converted to `null` before the
 *   PATCH, because the validator treats `''` as an invalid Aadhaar/UAN/date
 *   rather than as "cleared".
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  type SelectOption,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { BloodGroup, Gender, MaritalStatus } from '@/lib/constants/employees'
import type { EmployeePublic } from '@/lib/types/employees'
import { meScreens } from '@/locales/en/me-screens'
import { useWorkspaceScope } from '../workspace-scope'

// ─── field descriptors ────────────────────────────────────────────────────────

type FieldKind = 'text' | 'email' | 'tel' | 'date' | 'number' | 'textarea' | 'select'

interface ProfileField {
  key: string
  kind: FieldKind
  options?: SelectOption[]
  placeholder?: string
  /** Spans both grid columns. */
  full?: boolean
}

interface ProfileSection {
  key: string
  label: string
  hint?: string
  fields: ProfileField[]
}

const P = meScreens.profile

function enumOptions(values: string[], labels?: Record<string, string>): SelectOption[] {
  return [
    { value: '', label: P.select.none },
    ...values.map((value) => ({ value, label: labels?.[value] ?? value })),
  ]
}

const SECTIONS: ProfileSection[] = [
  {
    key: 'personal',
    label: P.sectionPersonal,
    fields: [
      { key: 'first_name', kind: 'text' },
      { key: 'last_name', kind: 'text' },
      { key: 'date_of_birth', kind: 'date' },
      { key: 'gender', kind: 'select', options: enumOptions(Object.values(Gender), P.select.gender) },
      {
        key: 'marital_status',
        kind: 'select',
        options: enumOptions(Object.values(MaritalStatus), P.select.marital_status),
      },
      { key: 'blood_group', kind: 'select', options: enumOptions(Object.values(BloodGroup)) },
      { key: 'number_of_children', kind: 'number' },
    ],
  },
  {
    key: 'contact',
    label: P.sectionContact,
    fields: [
      { key: 'personal_email', kind: 'email', full: true },
      { key: 'phone', kind: 'tel', placeholder: P.placeholder.phone },
      { key: 'alternate_phone', kind: 'tel', placeholder: P.placeholder.phone },
      { key: 'current_address', kind: 'textarea', full: true, placeholder: P.placeholder.address },
      { key: 'permanent_address', kind: 'textarea', full: true, placeholder: P.placeholder.address },
    ],
  },
  {
    key: 'emergency',
    label: P.sectionEmergency,
    fields: [
      { key: 'emergency_contact_name', kind: 'text', full: true },
      { key: 'emergency_contact_relationship', kind: 'text', placeholder: P.placeholder.relationship },
      { key: 'emergency_contact_phone', kind: 'tel', placeholder: P.placeholder.phone },
    ],
  },
  {
    key: 'ids',
    label: P.sectionIds,
    hint: P.sensitiveHint,
    fields: [
      { key: 'pan', kind: 'text', placeholder: P.placeholder.pan },
      { key: 'aadhaar', kind: 'text', placeholder: P.placeholder.aadhaar },
      { key: 'uan', kind: 'text', placeholder: P.placeholder.uan },
      { key: 'passport_number', kind: 'text', placeholder: P.placeholder.passport_number },
    ],
  },
  {
    key: 'bank',
    label: P.sectionBank,
    hint: P.sensitiveHint,
    fields: [
      { key: 'bank_account', kind: 'text', full: true, placeholder: P.placeholder.bank_account },
      { key: 'bank_ifsc', kind: 'text', placeholder: P.placeholder.bank_ifsc },
      { key: 'bank_name', kind: 'text', placeholder: P.placeholder.bank_name },
    ],
  },
]

const ALL_KEYS = SECTIONS.flatMap((section) => section.fields.map((field) => field.key))

/** Keys read out of `employee.sensitive` rather than off the record itself. */
const SENSITIVE_KEYS = new Set([
  'pan',
  'aadhaar',
  'uan',
  'passport_number',
  'bank_account',
  'bank_ifsc',
  'bank_name',
])

/** Required in the database, so clearing them is a no-op rather than a null. */
const NEVER_NULLABLE = new Set(['first_name', 'last_name'])

type FormValues = Record<string, string>

function toForm(employee: EmployeePublic): FormValues {
  const record = employee as unknown as Record<string, unknown>
  const sensitive = (employee.sensitive ?? {}) as unknown as Record<string, unknown>
  const form: FormValues = {}
  for (const key of ALL_KEYS) {
    const raw = SENSITIVE_KEYS.has(key) ? sensitive[key] : record[key]
    form[key] = raw == null ? '' : String(raw)
  }
  return form
}

function fieldLabel(key: string): string {
  return (P.field as Record<string, string>)[key] ?? key
}

// ─── read-only employment block ───────────────────────────────────────────────

function EmploymentCard({ employee }: { employee: EmployeePublic }) {
  const rows: [string, string | null][] = [
    [P.employmentField.employee_id, employee.employee_id],
    [P.employmentField.designation, employee.employment.designation],
    [P.employmentField.department, employee.employment.department],
    [P.employmentField.employment_type, employee.employment.employment_type],
    [P.employmentField.work_mode, employee.employment.work_mode],
    [P.employmentField.work_location, employee.employment.work_location],
    [P.employmentField.date_of_joining, employee.employment.date_of_joining],
    [P.employmentField.work_email, employee.work_email],
  ]

  return (
    <Card style={{ marginTop: '14px' }}>
      <p className="t-eyebrow" style={{ marginBottom: '12px' }}>
        {P.employmentHeading}{' '}
        <span style={{ fontWeight: 500, textTransform: 'none' }}>· {P.employmentManagedBy}</span>
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ minWidth: 0 }}>
            <p className="t-muted" style={{ fontSize: '11px', marginBottom: '2px' }}>
              {label}
            </p>
            <p
              style={{
                fontSize: '13.5px',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {value || meScreens.common.empty}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { slug } = useWorkspaceScope()
  const toast = useToast()

  const [employee, setEmployee] = useState<EmployeePublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const [form, setForm] = useState<FormValues>({})
  const [initial, setInitial] = useState<FormValues>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const adopt = useCallback((record: EmployeePublic) => {
    const values = toForm(record)
    setEmployee(record)
    setForm(values)
    setInitial(values)
  }, [])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)
    setFailed(false)
    setFieldErrors({})
    setFormError(null)

    fetch(`/api/me/ws/${encodeURIComponent(slug)}/employee`)
      .then((r) => r.json())
      .then((d: { employee?: EmployeePublic | null }) => {
        if (cancelled) return
        if (d.employee) adopt(d.employee)
        else setEmployee(null)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setFailed(true)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug, adopt])

  const dirtyKeys = useMemo(
    () => ALL_KEYS.filter((key) => (form[key] ?? '') !== (initial[key] ?? '')),
    [form, initial],
  )

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function save() {
    if (!slug || dirtyKeys.length === 0) return
    setSaving(true)
    setFormError(null)
    setFieldErrors({})

    const payload: Record<string, unknown> = {}
    for (const key of dirtyKeys) {
      const value = form[key].trim()
      if (!value) {
        // A required column cannot be nulled from here; leaving it out means the
        // stored value simply stays as it was.
        if (NEVER_NULLABLE.has(key)) continue
        payload[key] = null
        continue
      }
      payload[key] = key === 'number_of_children' ? Number(value) : value
    }

    if (Object.keys(payload).length === 0) {
      setSaving(false)
      return
    }

    try {
      const res = await fetch(`/api/me/ws/${encodeURIComponent(slug)}/employee`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = (await res.json().catch(() => ({}))) as {
        employee?: EmployeePublic
        error?: string
        fields?: Record<string, string>
      }

      if (res.status === 422 && body.fields) {
        setFieldErrors(body.fields)
        setFormError(P.validationFailed)
        return
      }
      if (!res.ok || !body.employee) {
        setFormError(body.error ?? P.saveFailed)
        return
      }

      adopt(body.employee)
      toast.show(P.savedToast, 'success')
    } catch {
      setFormError(P.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  const header = (
    <>
      <h1 className="t-h1">{P.title}</h1>
      <p className="t-secondary" style={{ marginTop: '2px' }}>
        {P.subtitle}
      </p>
    </>
  )

  if (!slug) {
    return (
      <>
        {header}
        <EmptyState
          title={meScreens.common.noWorkspaceTitle}
          hint={meScreens.common.noWorkspaceBody}
        />
      </>
    )
  }

  return (
    <>
      {header}

      {loading ? (
        <div className="stack">
          <Skeleton height={78} radius="var(--radius-lg)" />
          <Skeleton height={190} radius="var(--radius-lg)" />
          <Skeleton height={240} radius="var(--radius-lg)" />
        </div>
      ) : failed ? (
        <EmptyState title={meScreens.common.loadFailed} />
      ) : !employee ? (
        <EmptyState title={P.noRecordTitle} hint={P.noRecordBody} />
      ) : (
        <>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Avatar name={`${employee.first_name} ${employee.last_name}`} size={46} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: '15px' }}>
                  {employee.first_name} {employee.last_name}
                </p>
                <p className="t-muted">
                  {employee.employment.designation || employee.work_email}
                </p>
              </div>
            </div>
          </Card>

          <EmploymentCard employee={employee} />

          {SECTIONS.map((section) => (
            <Card key={section.key} style={{ marginTop: '14px' }}>
              <p className="t-eyebrow" style={{ marginBottom: section.hint ? '4px' : '12px' }}>
                {section.label}
              </p>
              {section.hint && (
                <p className="t-muted" style={{ marginBottom: '12px' }}>
                  {section.hint}
                </p>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                {section.fields.map((field) => {
                  const id = `mp-${field.key}`
                  const code = fieldErrors[field.key]
                  const error = code ? P.fieldError[code] ?? P.fieldErrorFallback : undefined
                  const value = form[field.key] ?? ''

                  return (
                    <Field
                      key={field.key}
                      label={fieldLabel(field.key)}
                      htmlFor={id}
                      error={error}
                      style={field.full ? { gridColumn: '1 / -1' } : undefined}
                    >
                      {field.kind === 'textarea' ? (
                        <Textarea
                          id={id}
                          rows={2}
                          value={value}
                          invalid={!!error}
                          placeholder={field.placeholder}
                          onChange={(e) => set(field.key, e.target.value)}
                        />
                      ) : field.kind === 'select' ? (
                        <Select
                          id={id}
                          value={value}
                          invalid={!!error}
                          options={field.options ?? []}
                          onChange={(e) => set(field.key, e.target.value)}
                        />
                      ) : (
                        <Input
                          id={id}
                          type={field.kind === 'number' ? 'number' : field.kind}
                          inputMode={field.kind === 'tel' ? 'numeric' : undefined}
                          min={field.kind === 'number' ? 0 : undefined}
                          value={value}
                          invalid={!!error}
                          placeholder={field.placeholder}
                          onChange={(e) => set(field.key, e.target.value)}
                        />
                      )}
                    </Field>
                  )
                })}
              </div>
            </Card>
          ))}

          {formError && (
            <p className="field-error" role="alert" style={{ marginTop: '12px' }}>
              {formError}
            </p>
          )}

          <Button
            block
            style={{ marginTop: '16px' }}
            disabled={dirtyKeys.length === 0}
            loading={saving}
            onClick={() => void save()}
          >
            {saving ? meScreens.common.saving : meScreens.common.save}
          </Button>
          {dirtyKeys.length === 0 && !saving && (
            <p className="t-muted" style={{ textAlign: 'center', marginTop: '8px' }}>
              {P.noChanges}
            </p>
          )}
        </>
      )}
    </>
  )
}
