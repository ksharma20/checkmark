'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import type { MemberWithUser } from '@/lib/db/queries/workspaces'
import type { EmployeePublic } from '@/lib/types/employees'

interface Props {
  slug: string
  member: MemberWithUser
  employee: EmployeePublic | null
}

type FormData = {
  first_name: string; last_name: string; employee_id: string
  work_email: string; personal_email: string
  phone: string; alternate_phone: string
  gender: string; date_of_birth: string
  marital_status: string; number_of_children: string
  blood_group: string; current_address: string; permanent_address: string
  designation: string; department: string
  employment_type: string; work_mode: string; work_location: string
  date_of_joining: string; confirmation_date: string; probation_end_date: string
  source_of_hire: string; total_work_experience: string
  pan: string; aadhaar: string; uan: string; passport_number: string
  bank_account: string; bank_ifsc: string; bank_name: string
  emergency_contact_name: string; emergency_contact_relationship: string
  emergency_contact_phone: string
}

const STEPS = [
  { label: 'Basic details',  subtitle: 'Personal and contact information' },
  { label: 'Employment',     subtitle: 'Job and employment details' },
  { label: 'Bank & IDs',    subtitle: 'Financial and statutory identifiers' },
  { label: 'Emergency',     subtitle: 'Emergency contact information' },
  { label: 'Review',        subtitle: 'Review and submit' },
]

// ─── Validation ───────────────────────────────────────────────────────────────

const DATE_RE_C      = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE_C     = /^[^@]+@[^@]+\.[^@]+$/
const EMPLOYEE_ID_RE_C = /^[A-Z0-9]+$/i
const NAME_RE_C      = /^[A-Za-z\s]+$/
const PHONE_RE_C     = /^[6-9]\d{9}$/
const PAN_RE_C       = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const AADHAAR_RE_C   = /^\d{12}$/
const UAN_RE_C       = /^\d{12}$/
const PASSPORT_RE_C  = /^[A-Z][0-9]{7}$/
const BANK_ACCT_RE_C = /^\d{9,18}$/

const ERR_MSG: Record<string, string> = {
  REQUIRED:                  'This field is required',
  INVALID_EMAIL:             'Enter a valid email address',
  INVALID_FORMAT:            'Invalid format',
  INVALID_NAME:              'Only letters and spaces allowed',
  INVALID_PHONE:             'Must be 10 digits starting with 6, 7, 8, or 9',
  MUST_BE_BEFORE_TODAY:      'Date must be in the past',
  MUST_BE_NON_NEGATIVE:      'Must be 0 or more',
  MUST_BE_18_OR_OLDER:       'Employee must be at least 18 years old',
  INVALID_EMPLOYEE_ID:       'Only letters and numbers, no spaces',
  INVALID_PAN:               'Must be 10 chars: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)',
  INVALID_AADHAAR:           'Must be exactly 12 digits',
  INVALID_UAN:               'Must be exactly 12 digits',
  INVALID_PASSPORT:          'Format: 1 letter followed by 7 digits (e.g. A1234567)',
  INVALID_BANK_ACCOUNT:      'Must be 9–18 digits, numbers only',
}

// ─── Shared field components ─────────────────────────────────────────────────

const iStyle: React.CSSProperties = {
  width: '100%', height: '42px', padding: '0 12px',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
  fontSize: '14px', fontFamily: 'DM Sans, sans-serif',
  background: 'var(--surface-2)', color: 'var(--text-primary)',
  outline: 'none', boxSizing: 'border-box',
}

const taStyle: React.CSSProperties = {
  ...iStyle, height: '80px', padding: '10px 12px', resize: 'vertical',
}

const labelSt: React.CSSProperties = {
  fontFamily: 'DM Sans, sans-serif', fontSize: '13px',
  fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block',
}

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelSt}>
        {label}{required && <span style={{ color: 'var(--danger)', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
      {error && (
        <span style={{
          fontFamily: 'DM Sans, sans-serif', fontSize: '12px',
          color: 'var(--danger)', marginTop: '4px',
        }}>{error}</span>
      )}
    </div>
  )
}

function FormInput({ value, onChange, type = 'text', placeholder, required, maxLength }: {
  value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean; maxLength?: number
}) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} maxLength={maxLength} style={iStyle} />
}

function FormSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={iStyle}>{children}</select>
}

function FormTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={taStyle} />
}

function SensitiveFormInput({ value, onChange, placeholder, maxLength }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number
}) {
  const [reveal, setReveal] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={reveal ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        style={{ ...iStyle, paddingRight: '38px' }}
      />
      <button
        type="button"
        onClick={() => setReveal(r => !r)}
        style={{
          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
        }}
        tabIndex={-1}
        aria-label={reveal ? 'Hide' : 'Show'}
      >
        {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

// ─── Step bar ─────────────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {STEPS.map((s, i) => {
        const done = i < current; const active = i === current
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? '1' : 'none' }}>
            <div
              title={s.label}
              style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: (done || active) ? 'var(--brand)' : 'var(--surface-0)',
                border: (done || active) ? '2px solid var(--brand)' : '2px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              {done ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7l3 3 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '12px', fontWeight: 600, color: active ? '#fff' : 'var(--text-muted)' }}>{i + 1}</span>
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: '2px', background: done ? 'var(--brand)' : 'var(--border)', margin: '0 8px' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Review section ───────────────────────────────────────────────────────────

function ReviewSection({ title, items }: { title: string; items: [string, string][] }) {
  const filled = items.filter(([, v]) => v?.trim())
  if (!filled.length) return null
  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>{title}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {filled.map(([label, value]) => (
          <div key={label}>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</p>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DetailsClient({ slug, member, employee }: Props) {
  const router = useRouter()
  const isEdit = employee !== null

  const parts = (member.full_name ?? '').trim().split(/\s+/)

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<FormData>({
    first_name:                   employee?.first_name                          ?? parts[0] ?? '',
    last_name:                    employee?.last_name                           ?? parts.slice(1).join(' '),
    employee_id:                  employee?.employee_id                         ?? '',
    work_email:                   employee?.work_email                          ?? member.email,
    personal_email:               employee?.personal_email                      ?? '',
    phone:                        employee?.phone                               ?? '',
    alternate_phone:              employee?.alternate_phone                     ?? '',
    gender:                       employee?.gender                              ?? '',
    date_of_birth:                employee?.date_of_birth                       ?? '',
    marital_status:               employee?.marital_status                      ?? '',
    number_of_children:           employee?.number_of_children != null ? String(employee.number_of_children) : '',
    blood_group:                  employee?.blood_group                         ?? '',
    current_address:              employee?.current_address                     ?? '',
    permanent_address:            employee?.permanent_address                   ?? '',
    designation:                  employee?.employment?.designation             ?? '',
    department:                   employee?.employment?.department              ?? '',
    employment_type:              employee?.employment?.employment_type         ?? '',
    work_mode:                    employee?.employment?.work_mode               ?? '',
    work_location:                employee?.employment?.work_location           ?? '',
    date_of_joining:              employee?.employment?.date_of_joining         ?? '',
    confirmation_date:            employee?.employment?.confirmation_date       ?? '',
    probation_end_date:           employee?.employment?.probation_end_date      ?? '',
    source_of_hire:               employee?.employment?.source_of_hire         ?? '',
    total_work_experience:        employee?.employment?.total_work_experience != null ? String(employee.employment.total_work_experience) : '',
    pan:                          employee?.sensitive?.pan                      ?? '',
    aadhaar:                      employee?.sensitive?.aadhaar                  ?? '',
    uan:                          employee?.sensitive?.uan                      ?? '',
    passport_number:              employee?.sensitive?.passport_number          ?? '',
    bank_account:                 employee?.sensitive?.bank_account             ?? '',
    bank_ifsc:                    employee?.sensitive?.bank_ifsc                ?? '',
    bank_name:                    employee?.sensitive?.bank_name                ?? '',
    emergency_contact_name:       employee?.emergency_contact_name              ?? '',
    emergency_contact_relationship: employee?.emergency_contact_relationship    ?? '',
    emergency_contact_phone:      employee?.emergency_contact_phone             ?? '',
  })

  const set = (k: keyof FormData) => (v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    if (fieldErrors[k]) setFieldErrors(e => { const n = { ...e }; delete n[k]; return n })
  }

  function validateCurrentStep(): Record<string, string> {
    const today = new Date().toISOString().slice(0, 10)
    const errs: Record<string, string> = {}

    if (step === 0) {
      if (!form.first_name.trim()) errs.first_name = ERR_MSG.REQUIRED
      else if (!NAME_RE_C.test(form.first_name.trim())) errs.first_name = ERR_MSG.INVALID_NAME

      if (!form.last_name.trim()) errs.last_name = ERR_MSG.REQUIRED
      else if (!NAME_RE_C.test(form.last_name.trim())) errs.last_name = ERR_MSG.INVALID_NAME

      if (!form.work_email.trim()) errs.work_email = ERR_MSG.REQUIRED
      else if (!EMAIL_RE_C.test(form.work_email.trim())) errs.work_email = ERR_MSG.INVALID_EMAIL

      if (form.personal_email.trim() && !EMAIL_RE_C.test(form.personal_email.trim()))
        errs.personal_email = ERR_MSG.INVALID_EMAIL

      if (form.date_of_birth) {
        if (!DATE_RE_C.test(form.date_of_birth)) {
          errs.date_of_birth = ERR_MSG.INVALID_FORMAT
        } else if (form.date_of_birth >= today) {
          errs.date_of_birth = ERR_MSG.MUST_BE_BEFORE_TODAY
        } else {
          const cutoff = new Date()
          cutoff.setFullYear(cutoff.getFullYear() - 18)
          if (new Date(form.date_of_birth) > cutoff) errs.date_of_birth = ERR_MSG.MUST_BE_18_OR_OLDER
        }
      }

      const phone = form.phone.replace(/\s+/g, '')
      if (phone && !PHONE_RE_C.test(phone)) errs.phone = ERR_MSG.INVALID_PHONE

      const altPhone = form.alternate_phone.replace(/\s+/g, '')
      if (altPhone && !PHONE_RE_C.test(altPhone)) errs.alternate_phone = ERR_MSG.INVALID_PHONE

      if (form.number_of_children) {
        const n = Number(form.number_of_children)
        if (isNaN(n) || n < 0) errs.number_of_children = ERR_MSG.MUST_BE_NON_NEGATIVE
      }
    }

    if (step === 1) {
      // Employee ID — optional, alphanumeric no spaces
      if (form.employee_id.trim() && !EMPLOYEE_ID_RE_C.test(form.employee_id.trim()))
        errs.employee_id = ERR_MSG.INVALID_EMPLOYEE_ID

      if (form.date_of_joining && !DATE_RE_C.test(form.date_of_joining))
        errs.date_of_joining = ERR_MSG.INVALID_FORMAT
      else if (form.date_of_joining && form.date_of_joining > today)
        errs.date_of_joining = ERR_MSG.MUST_BE_BEFORE_TODAY

      if (form.confirmation_date && !DATE_RE_C.test(form.confirmation_date))
        errs.confirmation_date = ERR_MSG.INVALID_FORMAT

      if (form.probation_end_date && !DATE_RE_C.test(form.probation_end_date))
        errs.probation_end_date = ERR_MSG.INVALID_FORMAT

      if (form.total_work_experience) {
        const n = Number(form.total_work_experience)
        if (isNaN(n) || n < 0) errs.total_work_experience = ERR_MSG.MUST_BE_NON_NEGATIVE
      }
    }

    if (step === 2) {
      // PAN — force uppercase, then validate format
      const pan = form.pan.trim().toUpperCase()
      if (pan && !PAN_RE_C.test(pan))
        errs.pan = ERR_MSG.INVALID_PAN

      // Aadhaar — 12 digits (server will also run Verhoeff checksum)
      const aadhaar = form.aadhaar.replace(/[\s-]/g, '')
      if (aadhaar && !AADHAAR_RE_C.test(aadhaar))
        errs.aadhaar = ERR_MSG.INVALID_AADHAAR

      // UAN — 12 digits
      if (form.uan.trim() && !UAN_RE_C.test(form.uan.trim()))
        errs.uan = ERR_MSG.INVALID_UAN

      // Passport
      const passport = form.passport_number.trim().toUpperCase()
      if (passport && !PASSPORT_RE_C.test(passport))
        errs.passport_number = ERR_MSG.INVALID_PASSPORT

      // Bank account — numeric, 9–18 digits
      if (form.bank_account.trim() && !BANK_ACCT_RE_C.test(form.bank_account.trim()))
        errs.bank_account = ERR_MSG.INVALID_BANK_ACCOUNT
    }

    if (step === 3) {
      const phone = form.emergency_contact_phone.replace(/\s+/g, '')
      if (phone && !PHONE_RE_C.test(phone))
        errs.emergency_contact_phone = ERR_MSG.INVALID_PHONE
    }

    return errs
  }

  function handleNext() {
    const errs = validateCurrentStep()
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})
    setStep(s => s + 1)
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        work_email: form.work_email.trim(),
      }
      const s = (k: keyof FormData) => { if (form[k].trim()) body[k] = form[k].trim() }
      const n = (k: keyof FormData) => { const v = Number(form[k]); if (form[k] && !isNaN(v)) body[k] = v }
      s('employee_id'); s('personal_email'); s('phone'); s('alternate_phone')
      s('gender'); s('date_of_birth'); s('marital_status')
      n('number_of_children'); s('blood_group')
      s('current_address'); s('permanent_address')
      s('designation'); s('department')
      s('employment_type'); s('work_mode'); s('work_location')
      s('date_of_joining'); s('confirmation_date'); s('probation_end_date')
      s('source_of_hire'); n('total_work_experience')
      s('pan'); s('aadhaar'); s('uan')
      s('passport_number'); s('bank_account'); s('bank_ifsc'); s('bank_name')
      s('emergency_contact_name'); s('emergency_contact_relationship'); s('emergency_contact_phone')

      const res = await fetch(`/api/ws/${slug}/members/${member.user_id}/employee`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/ws/${slug}/people`)
      } else {
        setError(data.error ?? 'Something went wrong')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const g2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }

  function renderStep() {
    switch (step) {
      case 0: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={g2}>
            <Field label="First name" required error={fieldErrors.first_name}><FormInput value={form.first_name} onChange={set('first_name')} required /></Field>
            <Field label="Last name" required error={fieldErrors.last_name}><FormInput value={form.last_name} onChange={set('last_name')} required /></Field>
          </div>
          <div style={g2}>
            <Field label="Work email" required error={fieldErrors.work_email}><FormInput type="email" value={form.work_email} onChange={set('work_email')} placeholder="name@company.in" required /></Field>
            <Field label="Personal email" error={fieldErrors.personal_email}><FormInput type="email" value={form.personal_email} onChange={set('personal_email')} /></Field>
          </div>
          <div style={g2}>
            <Field label="Phone" error={fieldErrors.phone}><FormInput type="tel" value={form.phone} onChange={set('phone')} placeholder="+91" maxLength={10} /></Field>
            <Field label="Alternate phone" error={fieldErrors.alternate_phone}><FormInput type="tel" value={form.alternate_phone} onChange={set('alternate_phone')} maxLength={10} /></Field>
          </div>
          <div style={g2}>
            <Field label="Gender">
              <FormSelect value={form.gender} onChange={set('gender')}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non_binary">Non-binary</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </FormSelect>
            </Field>
            <Field label="Date of birth" error={fieldErrors.date_of_birth}><FormInput type="date" value={form.date_of_birth} onChange={set('date_of_birth')} /></Field>
          </div>
          <div style={g2}>
            <Field label="Marital status">
              <FormSelect value={form.marital_status} onChange={set('marital_status')}>
                <option value="">Select</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
                <option value="separated">Separated</option>
              </FormSelect>
            </Field>
            <Field label="No. of children" error={fieldErrors.number_of_children}><FormInput type="number" value={form.number_of_children} onChange={set('number_of_children')} placeholder="0" /></Field>
          </div>
          <Field label="Blood group">
            <FormSelect value={form.blood_group} onChange={set('blood_group')}>
              <option value="">Select</option>
              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => <option key={g} value={g}>{g}</option>)}
            </FormSelect>
          </Field>
          <Field label="Current address"><FormTextarea value={form.current_address} onChange={set('current_address')} placeholder="Street, City, State, PIN" /></Field>
          <Field label="Permanent address"><FormTextarea value={form.permanent_address} onChange={set('permanent_address')} placeholder="Same as current or different" /></Field>
        </div>
      )

      case 1: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={g2}>
            <Field label="Employee ID"><FormInput value={form.employee_id} onChange={set('employee_id')} placeholder="e.g. EMP-001" /></Field>
            <Field label="Designation"><FormInput value={form.designation} onChange={set('designation')} placeholder="e.g. Software Engineer" /></Field>
          </div>
          <div style={g2}>
            <Field label="Department"><FormInput value={form.department} onChange={set('department')} placeholder="e.g. Engineering" /></Field>
            <Field label="Employment type">
              <FormSelect value={form.employment_type} onChange={set('employment_type')}>
                <option value="">Select</option>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
                <option value="consultant">Consultant</option>
              </FormSelect>
            </Field>
          </div>
          <div style={g2}>
            <Field label="Work mode">
              <FormSelect value={form.work_mode} onChange={set('work_mode')}>
                <option value="">Select</option>
                <option value="office">Office</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </FormSelect>
            </Field>
            <Field label="Work location"><FormInput value={form.work_location} onChange={set('work_location')} placeholder="e.g. Mumbai HQ" /></Field>
          </div>
          <div style={g2}>
            <Field label="Date of joining" error={fieldErrors.date_of_joining}><FormInput type="date" value={form.date_of_joining} onChange={set('date_of_joining')} /></Field>
            <Field label="Confirmation date" error={fieldErrors.confirmation_date}><FormInput type="date" value={form.confirmation_date} onChange={set('confirmation_date')} /></Field>
          </div>
          <div style={g2}>
            <Field label="Probation end date" error={fieldErrors.probation_end_date}><FormInput type="date" value={form.probation_end_date} onChange={set('probation_end_date')} /></Field>
            <Field label="Source of hire">
              <FormSelect value={form.source_of_hire} onChange={set('source_of_hire')}>
                <option value="">Select</option>
                <option value="direct">Direct</option>
                <option value="referral">Referral</option>
                <option value="job_portal">Job portal</option>
                <option value="consultancy">Consultancy</option>
                <option value="campus">Campus</option>
              </FormSelect>
            </Field>
          </div>
          <div style={g2}>
            <Field label="Total experience (years)" error={fieldErrors.total_work_experience}><FormInput type="number" value={form.total_work_experience} onChange={set('total_work_experience')} placeholder="0" /></Field>
          </div>
        </div>
      )

      case 2: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={g2}>
            <Field label="PAN" error={fieldErrors.pan}><SensitiveFormInput value={form.pan} onChange={set('pan')} placeholder="ABCDE1234F" /></Field>
            <Field label="Aadhaar" error={fieldErrors.aadhaar}><SensitiveFormInput value={form.aadhaar} onChange={set('aadhaar')} placeholder="12-digit number" /></Field>
          </div>
          <div style={g2}>
            <Field label="UAN" error={fieldErrors.uan}><SensitiveFormInput value={form.uan} onChange={set('uan')} placeholder="Universal Account Number" /></Field>
            <Field label="Passport number" error={fieldErrors.passport_number}><SensitiveFormInput value={form.passport_number} onChange={set('passport_number')} placeholder="A1234567" /></Field>
          </div>
          <Field label="Bank account number" error={fieldErrors.bank_account}><SensitiveFormInput value={form.bank_account} onChange={set('bank_account')} placeholder="Account number" /></Field>
          <div style={g2}>
            <Field label="Bank IFSC" error={fieldErrors.bank_ifsc}><SensitiveFormInput value={form.bank_ifsc} onChange={set('bank_ifsc')} placeholder="IFSC code" /></Field>
            <Field label="Bank name" error={fieldErrors.bank_name}><SensitiveFormInput value={form.bank_name} onChange={set('bank_name')} placeholder="e.g. HDFC Bank" /></Field>
          </div>
        </div>
      )

      case 3: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Field label="Contact name"><FormInput value={form.emergency_contact_name} onChange={set('emergency_contact_name')} placeholder="Full name" /></Field>
          <div style={g2}>
            <Field label="Relationship"><FormInput value={form.emergency_contact_relationship} onChange={set('emergency_contact_relationship')} placeholder="e.g. Spouse, Parent" /></Field>
            <Field label="Phone" error={fieldErrors.emergency_contact_phone}><FormInput type="tel" value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} placeholder="10-digit mobile number" maxLength={10} /></Field>
          </div>
        </div>
      )

      case 4: {
        const EL: Record<string,string> = { full_time:'Full-time', part_time:'Part-time', contract:'Contract', intern:'Intern', consultant:'Consultant' }
        const WL: Record<string,string> = { office:'Office', remote:'Remote', hybrid:'Hybrid' }
        const GL: Record<string,string> = { male:'Male', female:'Female', non_binary:'Non-binary', prefer_not_to_say:'Prefer not to say' }
        const ML: Record<string,string> = { single:'Single', married:'Married', divorced:'Divorced', widowed:'Widowed', separated:'Separated' }
        const SL: Record<string,string> = { direct:'Direct', referral:'Referral', job_portal:'Job portal', consultancy:'Consultancy', campus:'Campus' }
        return (
          <div>
            <ReviewSection title="Basic details" items={[
              ['First name', form.first_name], ['Last name', form.last_name],
              ['Work email', form.work_email], ['Personal email', form.personal_email],
              ['Phone', form.phone], ['Alternate phone', form.alternate_phone],
              ['Gender', GL[form.gender] ?? form.gender], ['Date of birth', form.date_of_birth],
              ['Marital status', ML[form.marital_status] ?? form.marital_status],
              ['No. of children', form.number_of_children], ['Blood group', form.blood_group],
              ['Employee ID', form.employee_id],
            ]} />
            <ReviewSection title="Employment" items={[
              ['Designation', form.designation], ['Department', form.department],
              ['Employment type', EL[form.employment_type] ?? form.employment_type],
              ['Work mode', WL[form.work_mode] ?? form.work_mode],
              ['Work location', form.work_location], ['Date of joining', form.date_of_joining],
              ['Confirmation date', form.confirmation_date], ['Probation end date', form.probation_end_date],
              ['Source of hire', SL[form.source_of_hire] ?? form.source_of_hire],
              ['Total experience (yrs)', form.total_work_experience],
            ]} />
            <ReviewSection title="Bank & IDs" items={[
              ['PAN', form.pan ? '●●●●●●●●●●' : ''],
              ['Aadhaar', form.aadhaar ? '●●●● ●●●● ' + form.aadhaar.slice(-4) : ''],
              ['UAN', form.uan], ['Passport', form.passport_number],
              ['Bank account', form.bank_account ? '●●●●●●● ' + form.bank_account.slice(-4) : ''],
              ['IFSC', form.bank_ifsc], ['Bank name', form.bank_name],
            ]} />
            <ReviewSection title="Emergency contact" items={[
              ['Name', form.emergency_contact_name],
              ['Relationship', form.emergency_contact_relationship],
              ['Phone', form.emergency_contact_phone],
            ]} />
            {error && (
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '13px', color: 'var(--danger)', marginTop: '8px' }}>{error}</p>
            )}
          </div>
        )
      }
    }
  }

  const isLast = step === STEPS.length - 1

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-1)', padding: '24px 20px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Back link */}
        <Link
          href={`/ws/${slug}/people`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontFamily: 'DM Sans, sans-serif', fontSize: '13px',
            color: 'var(--text-secondary)', textDecoration: 'none',
            marginBottom: '20px',
          }}
        >
          <ArrowLeft size={14} />
          People
        </Link>

        {/* Page heading */}
        <h1 style={{
          fontFamily: 'Syne, sans-serif', fontSize: '22px', fontWeight: 700,
          color: 'var(--navy)', marginBottom: '4px',
        }}>
          {isEdit ? 'Edit employee profile' : 'Set up employee profile'}
        </h1>
        <p style={{
          fontFamily: 'DM Sans, sans-serif', fontSize: '13px',
          color: 'var(--text-secondary)', marginBottom: '24px',
        }}>
          {member.full_name ?? member.email}
        </p>

        {/* Card */}
        <div style={{
          background: 'var(--surface-0)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden',
        }}>
          {/* Step bar */}
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
            <p style={{
              fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700,
              color: 'var(--navy)', marginBottom: '2px',
            }}>{STEPS[step].label}</p>
            <p style={{
              fontFamily: 'DM Sans, sans-serif', fontSize: '13px',
              color: 'var(--text-muted)', marginBottom: '16px',
            }}>{STEPS[step].subtitle}</p>
            <StepBar current={step} />
          </div>

          {/* Form body */}
          <div style={{ padding: '24px' }}>
            {renderStep()}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px', borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
          }}>
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              style={{
                height: '44px', padding: '0 20px',
                background: 'var(--surface-0)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: 500,
                color: 'var(--text-secondary)',
                cursor: step === 0 ? 'not-allowed' : 'pointer', opacity: step === 0 ? 0.4 : 1,
              }}
            >
              Back
            </button>

            {isLast ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  height: '44px', padding: '0 28px',
                  background: 'var(--brand)', border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: 600,
                  color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create profile'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                style={{
                  height: '44px', padding: '0 28px',
                  background: 'var(--brand)', border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'DM Sans, sans-serif', fontSize: '14px', fontWeight: 600,
                  color: '#fff', cursor: 'pointer', opacity: 1,
                }}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
