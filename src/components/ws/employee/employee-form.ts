/**
 * The one employee form model, shared by the /ws Employees wizard and the
 * per-member setup wizard at /ws/:slug/people/:userId/details.
 *
 * Both screens edit the SAME record through the same validation, so the step
 * list, the field shapes, the client-side rules and the request-body builder
 * live here rather than being written twice and drifting apart. The rules
 * deliberately mirror `src/app/api/ws/[slug]/employees/_validate.ts` - the
 * server is still the authority, this is only the fast local echo of it.
 *
 * Pure data + pure functions: imported by client components, so nothing here
 * may reach for the database, the filesystem or `next/headers`.
 */

import type { EmployeePublic } from '@/lib/types/employees'
import { EmployeeStatus } from '@/lib/constants/employees'
import { wsEmployees } from '@/locales/en/ws-people'

// ─── Shape ────────────────────────────────────────────────────────────────────

/**
 * Every value is a string because it is bound straight to an <input>. The
 * body builder below is what turns blanks into "omit" and numerals into
 * numbers, so the components never have to think about it.
 */
export interface EmployeeFormData {
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
  employee_status: string
  pan: string; aadhaar: string; uan: string; passport_number: string
  bank_account: string; bank_ifsc: string; bank_name: string
  emergency_contact_name: string; emergency_contact_relationship: string
  emergency_contact_phone: string
}

export type EmployeeFormKey = keyof EmployeeFormData

export const EMPTY_EMPLOYEE_FORM: EmployeeFormData = {
  first_name: '', last_name: '', employee_id: '',
  work_email: '', personal_email: '',
  phone: '', alternate_phone: '',
  gender: '', date_of_birth: '',
  marital_status: '', number_of_children: '',
  blood_group: '', current_address: '', permanent_address: '',
  designation: '', department: '',
  employment_type: '', work_mode: '', work_location: '',
  date_of_joining: '', confirmation_date: '', probation_end_date: '',
  source_of_hire: '', total_work_experience: '',
  employee_status: EmployeeStatus.Active,
  pan: '', aadhaar: '', uan: '', passport_number: '',
  bank_account: '', bank_ifsc: '', bank_name: '',
  emergency_contact_name: '', emergency_contact_relationship: '',
  emergency_contact_phone: '',
}

/** Hydrate the form from an existing record; every null collapses to ''. */
export function formFromEmployee(employee: EmployeePublic): EmployeeFormData {
  const num = (v: number | null | undefined) => (v != null ? String(v) : '')
  return {
    ...EMPTY_EMPLOYEE_FORM,
    first_name: employee.first_name ?? '',
    last_name: employee.last_name ?? '',
    employee_id: employee.employee_id ?? '',
    work_email: employee.work_email ?? '',
    personal_email: employee.personal_email ?? '',
    phone: employee.phone ?? '',
    alternate_phone: employee.alternate_phone ?? '',
    gender: employee.gender ?? '',
    date_of_birth: employee.date_of_birth ?? '',
    marital_status: employee.marital_status ?? '',
    number_of_children: num(employee.number_of_children),
    blood_group: employee.blood_group ?? '',
    current_address: employee.current_address ?? '',
    permanent_address: employee.permanent_address ?? '',
    employee_status: employee.employee_status ?? EmployeeStatus.Active,
    designation: employee.employment?.designation ?? '',
    department: employee.employment?.department ?? '',
    employment_type: employee.employment?.employment_type ?? '',
    work_mode: employee.employment?.work_mode ?? '',
    work_location: employee.employment?.work_location ?? '',
    date_of_joining: employee.employment?.date_of_joining ?? '',
    confirmation_date: employee.employment?.confirmation_date ?? '',
    probation_end_date: employee.employment?.probation_end_date ?? '',
    source_of_hire: employee.employment?.source_of_hire ?? '',
    total_work_experience: num(employee.employment?.total_work_experience),
    pan: employee.sensitive?.pan ?? '',
    aadhaar: employee.sensitive?.aadhaar ?? '',
    uan: employee.sensitive?.uan ?? '',
    passport_number: employee.sensitive?.passport_number ?? '',
    bank_account: employee.sensitive?.bank_account ?? '',
    bank_ifsc: employee.sensitive?.bank_ifsc ?? '',
    bank_name: employee.sensitive?.bank_name ?? '',
    emergency_contact_name: employee.emergency_contact_name ?? '',
    emergency_contact_relationship: employee.emergency_contact_relationship ?? '',
    emergency_contact_phone: employee.emergency_contact_phone ?? '',
  }
}

// ─── Steps ────────────────────────────────────────────────────────────────────

export interface EmployeeStep {
  key: string
  label: string
  subtitle: string
  /** Fields shown on this step - also drives the read-only detail sections. */
  fields: readonly EmployeeFormKey[]
}

/**
 * Review is the last step and carries no fields of its own, so both the detail
 * view and the wizard summary iterate `EMPLOYEE_STEPS.slice(0, -1)`.
 */
export const EMPLOYEE_STEPS: readonly EmployeeStep[] = [
  {
    key: 'basic',
    label: wsEmployees.stepBasic,
    subtitle: wsEmployees.stepBasicSub,
    fields: [
      'first_name', 'last_name', 'work_email', 'personal_email',
      'phone', 'alternate_phone', 'gender', 'date_of_birth',
      'marital_status', 'number_of_children', 'blood_group',
      'current_address', 'permanent_address',
    ],
  },
  {
    key: 'employment',
    label: wsEmployees.stepEmployment,
    subtitle: wsEmployees.stepEmploymentSub,
    fields: [
      'employee_id', 'designation', 'department', 'employment_type',
      'work_mode', 'work_location', 'date_of_joining', 'confirmation_date',
      'probation_end_date', 'source_of_hire', 'total_work_experience',
      'employee_status',
    ],
  },
  {
    key: 'bank',
    label: wsEmployees.stepBank,
    subtitle: wsEmployees.stepBankSub,
    fields: ['pan', 'aadhaar', 'uan', 'passport_number', 'bank_account', 'bank_ifsc', 'bank_name'],
  },
  {
    key: 'emergency',
    label: wsEmployees.stepEmergency,
    subtitle: wsEmployees.stepEmergencySub,
    fields: ['emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone'],
  },
  {
    key: 'review',
    label: wsEmployees.stepReview,
    subtitle: wsEmployees.stepReviewSub,
    fields: [],
  },
]

// ─── Field labels and option lists ────────────────────────────────────────────

export const FIELD_LABELS: Record<EmployeeFormKey, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  employee_id: 'Employee ID',
  work_email: 'Work email',
  personal_email: 'Personal email',
  phone: 'Phone',
  alternate_phone: 'Alternate phone',
  gender: 'Gender',
  date_of_birth: 'Date of birth',
  marital_status: 'Marital status',
  number_of_children: 'No. of children',
  blood_group: 'Blood group',
  current_address: 'Current address',
  permanent_address: 'Permanent address',
  designation: 'Designation',
  department: 'Department',
  employment_type: 'Employment type',
  work_mode: 'Work mode',
  work_location: 'Work location',
  date_of_joining: 'Date of joining',
  confirmation_date: 'Confirmation date',
  probation_end_date: 'Probation end date',
  source_of_hire: 'Source of hire',
  total_work_experience: 'Total experience (years)',
  employee_status: 'Employment status',
  pan: 'PAN',
  aadhaar: 'Aadhaar',
  uan: 'UAN',
  passport_number: 'Passport number',
  bank_account: 'Bank account number',
  bank_ifsc: 'Bank IFSC',
  bank_name: 'Bank name',
  emergency_contact_name: 'Contact name',
  emergency_contact_relationship: 'Relationship',
  emergency_contact_phone: 'Phone',
}

export const GENDER_LABELS: Record<string, string> = {
  male: 'Male', female: 'Female', non_binary: 'Non-binary', prefer_not_to_say: 'Prefer not to say',
}
export const MARITAL_LABELS: Record<string, string> = {
  single: 'Single', married: 'Married', divorced: 'Divorced', widowed: 'Widowed', separated: 'Separated',
}
export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', intern: 'Intern', consultant: 'Consultant',
}
export const WORK_MODE_LABELS: Record<string, string> = {
  office: 'Office', remote: 'Remote', hybrid: 'Hybrid',
}
export const SOURCE_OF_HIRE_LABELS: Record<string, string> = {
  direct: 'Direct', referral: 'Referral', job_portal: 'Job portal', consultancy: 'Consultancy', campus: 'Campus',
}
export const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  [EmployeeStatus.Active]: wsEmployees.statusActive,
  [EmployeeStatus.Terminated]: wsEmployees.statusTerminated,
  [EmployeeStatus.Suspended]: wsEmployees.statusSuspended,
  [EmployeeStatus.OnLeave]: wsEmployees.statusOnLeave,
  [EmployeeStatus.NoticePeriod]: wsEmployees.statusNoticePeriod,
}

const ENUM_LABELS: Partial<Record<EmployeeFormKey, Record<string, string>>> = {
  gender: GENDER_LABELS,
  marital_status: MARITAL_LABELS,
  employment_type: EMPLOYMENT_TYPE_LABELS,
  work_mode: WORK_MODE_LABELS,
  source_of_hire: SOURCE_OF_HIRE_LABELS,
  employee_status: EMPLOYEE_STATUS_LABELS,
}

/** The stored value rendered as a human label; falls through for free text. */
export function displayValue(key: EmployeeFormKey, value: string): string {
  const map = ENUM_LABELS[key]
  return (map && map[value]) || value
}

/**
 * Fields whose value must never be shown in full on a read-only screen.
 *
 * PAN, UAN and passport are identifiers an admin has to read back to a payroll
 * form, so they stay visible; Aadhaar and the bank account are the two an
 * over-the-shoulder screenshot actually costs someone, and the mock masks
 * exactly these two.
 */
const MASKED_FIELDS: ReadonlySet<string> = new Set(['aadhaar', 'bank_account'])

/** Replace everything but the last four characters with a bullet. */
export function maskIfSensitive(key: string, value: string): string {
  if (!value || !MASKED_FIELDS.has(key)) return value
  return value.replace(/\S(?=\S{4})/g, '•')
}

// ─── Validation ───────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^@]+@[^@]+\.[^@]+$/
// Separators are allowed because real payroll ids carry them - and because this
// field's own placeholder is `e.g. EMP-001`, which the previous alphanumeric-only
// pattern rejected. A UI that demonstrates a value its validator refuses reads as
// a dead button, which is exactly how it was reported. Must still START
// alphanumeric, so a leading '-' or space is refused; the '-' sits last in the
// class so it is a literal, not a range. Keep in step with `_validate.ts`.
const EMPLOYEE_ID_RE = /^[A-Z0-9][A-Z0-9 _-]*$/i
const NAME_RE = /^[A-Za-z\s]+$/
const PHONE_RE = /^[6-9]\d{9}$/
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const AADHAAR_RE = /^\d{12}$/
const UAN_RE = /^\d{12}$/
const PASSPORT_RE = /^[A-Z][0-9]{7}$/
const BANK_ACCT_RE = /^\d{9,18}$/

export const ERR_MSG: Record<string, string> = {
  REQUIRED: 'This field is required',
  INVALID_EMAIL: 'Enter a valid email address',
  INVALID_FORMAT: 'Invalid format',
  INVALID_NAME: 'Only letters and spaces allowed',
  INVALID_PHONE: 'Must be 10 digits starting with 6, 7, 8, or 9',
  MUST_BE_BEFORE_TODAY: 'Date must be in the past',
  MUST_BE_NON_NEGATIVE: 'Must be 0 or more',
  MUST_BE_18_OR_OLDER: 'Employee must be at least 18 years old',
  MUST_BE_AFTER_DOJ: 'Must be on or after the date of joining',
  INVALID_EMPLOYEE_ID: 'Only letters and numbers, no spaces',
  INVALID_PAN: 'Must be 10 chars: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)',
  INVALID_AADHAAR: 'Must be exactly 12 digits',
  INVALID_UAN: 'Must be exactly 12 digits',
  INVALID_PASSPORT: 'Format: 1 letter followed by 7 digits (e.g. A1234567)',
  INVALID_BANK_ACCOUNT: 'Must be 9–18 digits, numbers only',
  DUPLICATE: 'Already used by another employee',
}

export type FieldErrors = Partial<Record<EmployeeFormKey, string>>

/**
 * Validate one wizard step. Steps are validated as the user leaves them so an
 * error is raised beside the field that caused it, not on the review screen
 * four steps later.
 */
export function validateStep(step: number, form: EmployeeFormData): FieldErrors {
  const today = new Date().toISOString().slice(0, 10)
  const errs: FieldErrors = {}

  if (step === 0) {
    if (!form.first_name.trim()) errs.first_name = ERR_MSG.REQUIRED
    else if (!NAME_RE.test(form.first_name.trim())) errs.first_name = ERR_MSG.INVALID_NAME

    if (!form.last_name.trim()) errs.last_name = ERR_MSG.REQUIRED
    else if (!NAME_RE.test(form.last_name.trim())) errs.last_name = ERR_MSG.INVALID_NAME

    if (!form.work_email.trim()) errs.work_email = ERR_MSG.REQUIRED
    else if (!EMAIL_RE.test(form.work_email.trim())) errs.work_email = ERR_MSG.INVALID_EMAIL

    if (form.personal_email.trim() && !EMAIL_RE.test(form.personal_email.trim())) {
      errs.personal_email = ERR_MSG.INVALID_EMAIL
    }

    if (form.date_of_birth) {
      if (!DATE_RE.test(form.date_of_birth)) {
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
    if (phone && !PHONE_RE.test(phone)) errs.phone = ERR_MSG.INVALID_PHONE

    const altPhone = form.alternate_phone.replace(/\s+/g, '')
    if (altPhone && !PHONE_RE.test(altPhone)) errs.alternate_phone = ERR_MSG.INVALID_PHONE

    if (form.number_of_children) {
      const n = Number(form.number_of_children)
      if (isNaN(n) || n < 0) errs.number_of_children = ERR_MSG.MUST_BE_NON_NEGATIVE
    }
  }

  if (step === 1) {
    if (form.employee_id.trim() && !EMPLOYEE_ID_RE.test(form.employee_id.trim())) {
      errs.employee_id = ERR_MSG.INVALID_EMPLOYEE_ID
    }

    // Format only - a joining date in the FUTURE is not an error here. This
    // screen exists to enter someone before they start (the record is created
    // first, the invitation offered second), so refusing a future date made
    // pre-boarding a new hire impossible. `date_of_birth` above still refuses
    // the future, which is why `today` is still needed.
    if (form.date_of_joining && !DATE_RE.test(form.date_of_joining)) {
      errs.date_of_joining = ERR_MSG.INVALID_FORMAT
    }

    if (form.confirmation_date && !DATE_RE.test(form.confirmation_date)) {
      errs.confirmation_date = ERR_MSG.INVALID_FORMAT
    }
    if (form.probation_end_date && !DATE_RE.test(form.probation_end_date)) {
      errs.probation_end_date = ERR_MSG.INVALID_FORMAT
    }

    if (form.total_work_experience) {
      const n = Number(form.total_work_experience)
      if (isNaN(n) || n < 0) errs.total_work_experience = ERR_MSG.MUST_BE_NON_NEGATIVE
    }
  }

  if (step === 2) {
    const pan = form.pan.trim().toUpperCase()
    if (pan && !PAN_RE.test(pan)) errs.pan = ERR_MSG.INVALID_PAN

    const aadhaar = form.aadhaar.replace(/[\s-]/g, '')
    if (aadhaar && !AADHAAR_RE.test(aadhaar)) errs.aadhaar = ERR_MSG.INVALID_AADHAAR

    if (form.uan.trim() && !UAN_RE.test(form.uan.trim())) errs.uan = ERR_MSG.INVALID_UAN

    const passport = form.passport_number.trim().toUpperCase()
    if (passport && !PASSPORT_RE.test(passport)) errs.passport_number = ERR_MSG.INVALID_PASSPORT

    if (form.bank_account.trim() && !BANK_ACCT_RE.test(form.bank_account.trim())) {
      errs.bank_account = ERR_MSG.INVALID_BANK_ACCOUNT
    }
  }

  if (step === 3) {
    const phone = form.emergency_contact_phone.replace(/\s+/g, '')
    if (phone && !PHONE_RE.test(phone)) errs.emergency_contact_phone = ERR_MSG.INVALID_PHONE
  }

  return errs
}

/** Every step's errors at once - what a straight-to-Review submit must pass. */
export function validateAll(form: EmployeeFormData): FieldErrors {
  return { ...validateStep(0, form), ...validateStep(1, form), ...validateStep(2, form), ...validateStep(3, form) }
}

// ─── Request body ─────────────────────────────────────────────────────────────

const NUMERIC_KEYS: readonly EmployeeFormKey[] = ['number_of_children', 'total_work_experience']

/**
 * Turn the form into the JSON the employees API expects.
 *
 * `mode: 'create'` omits blanks entirely, because POST treats an absent key as
 * "not supplied". `mode: 'update'` sends blanks as null instead, because PATCH
 * has to be able to CLEAR a field the admin emptied - dropping it would
 * silently keep the old value.
 *
 * `onlyKeys` NARROWS the body to those keys, and exists for the wizard's
 * per-step autosave. **Without it, a step-by-step PATCH destroys data.** In
 * `update` mode every blank becomes an explicit `null`, so a PATCH built from
 * the whole form while the admin is standing on step 2 would send
 * `pan: null, bank_account: null, emergency_contact_name: null…` and wipe every
 * step they have not reached yet. Narrowing to the step's own fields is what
 * makes "save as you go" safe.
 *
 * The three NOT NULL columns are always included: PATCH validation treats a
 * supplied blank as REQUIRED rather than as a clear, and the API needs them to
 * identify the row regardless of which step is being saved.
 */
export function buildEmployeeBody(
  form: EmployeeFormData,
  mode: 'create' | 'update',
  onlyKeys?: readonly EmployeeFormKey[],
): Record<string, unknown> {
  const allowed = onlyKeys ? new Set<EmployeeFormKey>(onlyKeys) : null

  const body: Record<string, unknown> = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    work_email: form.work_email.trim(),
  }

  for (const key of Object.keys(form) as EmployeeFormKey[]) {
    if (key === 'first_name' || key === 'last_name' || key === 'work_email') continue
    if (allowed && !allowed.has(key)) continue
    const raw = form[key].trim()

    if (NUMERIC_KEYS.includes(key)) {
      if (raw === '') {
        if (mode === 'update') body[key] = null
        continue
      }
      const n = Number(raw)
      if (!isNaN(n)) body[key] = n
      continue
    }

    if (raw === '') {
      // employee_status has a NOT NULL default; clearing it is not meaningful.
      if (mode === 'update' && key !== 'employee_status') body[key] = null
      continue
    }

    body[key] = key === 'pan' || key === 'passport_number' ? raw.toUpperCase() : raw
  }

  return body
}

/** Map a server `fields` map of error CODES onto the messages above. */
export function serverFieldErrors(fields: Record<string, string> | undefined): FieldErrors {
  if (!fields) return {}
  const out: FieldErrors = {}
  for (const [key, code] of Object.entries(fields)) {
    out[key as EmployeeFormKey] = ERR_MSG[code] ?? ERR_MSG.INVALID_FORMAT
  }
  return out
}
