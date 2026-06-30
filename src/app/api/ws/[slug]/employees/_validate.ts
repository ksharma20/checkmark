import {
  Gender,
  MaritalStatus,
  BloodGroup,
  WorkMode,
  EmploymentType,
  EmployeeStatus,
  SourceOfHire,
} from '@/lib/constants/employees'

// ─── Regex constants ──────────────────────────────────────────────────────────

const DATE_RE        = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE       = /^[^@]+@[^@]+\.[^@]+$/
const EMPLOYEE_ID_RE = /^[A-Z0-9]+$/i          // alphanumeric, no spaces
const NAME_RE        = /^[A-Za-z\s]+$/          // alphabets + space only
const PHONE_RE       = /^[6-9]\d{9}$/           // 10 digits, starts 6–9
const PAN_RE         = /^[A-Z]{5}[0-9]{4}[A-Z]$/ // e.g. ABCDE1234F
const AADHAAR_RE     = /^\d{12}$/
const UAN_RE         = /^\d{12}$/
const PASSPORT_RE    = /^[A-Z][0-9]{7}$/        // e.g. A1234567
const BANK_ACCT_RE   = /^\d{9,18}$/             // 9–18 numeric digits

const PHONE_FIELDS = ['phone', 'alternate_phone', 'emergency_contact_phone'] as const

function validateEmail(value: unknown, skipIfEmpty = false): string | null {
  if (typeof value !== 'string' || !value.trim()) return skipIfEmpty ? null : FieldErrorCode.INVALID_EMAIL
  return EMAIL_RE.test(value.trim()) ? null : FieldErrorCode.INVALID_EMAIL
}

function validatePhone(value: unknown, skipIfEmpty = false): string | null {
  const digits = typeof value === 'string' ? value.replace(/\s+/g, '') : ''
  if (!digits) return skipIfEmpty ? null : FieldErrorCode.REQUIRED
  return PHONE_RE.test(digits) ? null : FieldErrorCode.INVALID_PHONE
}


// ─── Error codes ──────────────────────────────────────────────────────────────

export const FieldErrorCode = {
  REQUIRED:             'REQUIRED',
  INVALID_FORMAT:       'INVALID_FORMAT',
  INVALID_EMAIL:        'INVALID_EMAIL',
  INVALID_ENUM:         'INVALID_ENUM',
  INVALID_NAME:         'INVALID_NAME',
  INVALID_PHONE:        'INVALID_PHONE',
  MUST_BE_BEFORE_TODAY: 'MUST_BE_BEFORE_TODAY',
  MUST_BE_AFTER_DOJ:    'MUST_BE_AFTER_DOJ',
  MUST_BE_NON_NEGATIVE: 'MUST_BE_NON_NEGATIVE',
  MUST_BE_18_OR_OLDER:  'MUST_BE_18_OR_OLDER',
} as const

export type FieldErrors = Record<string, string>

// ─── Main validator ───────────────────────────────────────────────────────────

export function validateEmployeeFields(
  body: Record<string, unknown>,
  opts: { existingDoj?: string | null } = {},
): FieldErrors {
  const fields: FieldErrors = {}
  const today = new Date().toISOString().slice(0, 10)

  // ── employee_id: alphanumeric, no spaces ──────────────────────────────────
  if (body.employee_id != null) {
    const trimmed = String(body.employee_id).trim()
    if (!trimmed) {
      fields.employee_id = FieldErrorCode.REQUIRED
    } else if (!EMPLOYEE_ID_RE.test(trimmed)) {
      fields.employee_id = FieldErrorCode.INVALID_FORMAT
    }
  }

  // ── first_name / last_name: alphabets + space ─────────────────────────────
  if (body.first_name) {
    const trimmed = String(body.first_name).trim()
    if (!trimmed) fields.first_name = FieldErrorCode.REQUIRED
    else if (!NAME_RE.test(trimmed)) fields.first_name = FieldErrorCode.INVALID_NAME
  }
  if (body.last_name) {
    const trimmed = String(body.last_name).trim()
    if (!trimmed) fields.last_name = FieldErrorCode.REQUIRED
    else if (!NAME_RE.test(trimmed)) fields.last_name = FieldErrorCode.INVALID_NAME
  }

  // ── date_of_birth: past date, age ≥ 18 ───────────────────────────────────
  if (body.date_of_birth !== undefined && body.date_of_birth !== null) {
    const dob = body.date_of_birth
    if (typeof dob !== 'string' || !DATE_RE.test(dob)) {
      fields.date_of_birth = FieldErrorCode.INVALID_FORMAT
    } else if (dob >= today) {
      fields.date_of_birth = FieldErrorCode.MUST_BE_BEFORE_TODAY
    } else {
      const cutoff = new Date()
      cutoff.setFullYear(cutoff.getFullYear() - 18)
      if (new Date(dob) > cutoff) fields.date_of_birth = FieldErrorCode.MUST_BE_18_OR_OLDER
    }
  }

  // ── phone fields: 10 digits, starts 6–9 ─────────────────────────────────
  for (const key of PHONE_FIELDS) {
    const val = body[key]
    if (val !== undefined && val !== null) {
      const err = validatePhone(val, true)
      if (err) fields[key] = err
    }
  }

  // ── email fields ──────────────────────────────────────────────────────────
  if (body.work_email !== undefined) {
    const err = validateEmail(body.work_email)
    if (err) fields.work_email = err
  }
  if (body.personal_email !== undefined && body.personal_email !== null) {
    const err = validateEmail(body.personal_email, true)
    if (err) fields.personal_email = err
  }

  // ── date_of_joining ───────────────────────────────────────────────────────
  if (body.date_of_joining !== undefined) {
    const doj = body.date_of_joining
    if (typeof doj !== 'string' || !DATE_RE.test(doj)) {
      fields.date_of_joining = FieldErrorCode.INVALID_FORMAT
    } else if (doj > today) {
      fields.date_of_joining = FieldErrorCode.MUST_BE_BEFORE_TODAY
    }
  }

  // ── exit_date: compare against body doj first, then existing doj ──────────
  if (body.exit_date !== undefined && body.exit_date !== null) {
    const exitDate = body.exit_date
    if (typeof exitDate !== 'string' || !DATE_RE.test(exitDate)) {
      fields.exit_date = FieldErrorCode.INVALID_FORMAT
    } else {
      const doj =
        typeof body.date_of_joining === 'string' && DATE_RE.test(body.date_of_joining)
          ? body.date_of_joining
          : (opts.existingDoj ?? null)
      if (doj && exitDate < doj) fields.exit_date = FieldErrorCode.MUST_BE_AFTER_DOJ
    }
  }

  // ── PAN: AAAAA9999A, normalize to uppercase ───────────────────────────────
  if (body.pan !== undefined && body.pan !== null) {
    const normalized = typeof body.pan === 'string' ? body.pan.trim().toUpperCase() : ''
    if (normalized && !PAN_RE.test(normalized)) fields.pan = FieldErrorCode.INVALID_FORMAT
  }

  // ── Aadhaar: 12 numeric digits ───────────────────────────────────────────
  if (body.aadhaar !== undefined && body.aadhaar !== null) {
    const raw = typeof body.aadhaar === 'string' ? body.aadhaar.replace(/[\s-]/g, '') : ''
    if (!AADHAAR_RE.test(raw)) fields.aadhaar = FieldErrorCode.INVALID_FORMAT
  }

  // ── UAN: 12 numeric digits ────────────────────────────────────────────────
  if (body.uan !== undefined && body.uan !== null) {
    if (typeof body.uan !== 'string' || !UAN_RE.test(body.uan)) {
      fields.uan = FieldErrorCode.INVALID_FORMAT
    }
  }

  // ── Passport: A1234567 ────────────────────────────────────────────────────
  if (body.passport_number !== undefined && body.passport_number !== null) {
    const normalized = typeof body.passport_number === 'string' ? body.passport_number.trim().toUpperCase() : ''
    if (normalized && !PASSPORT_RE.test(normalized)) fields.passport_number = FieldErrorCode.INVALID_FORMAT
  }

  // ── Bank account: numeric, 9–18 digits ───────────────────────────────────
  if (body.bank_account !== undefined && body.bank_account !== null) {
    const trimmed = typeof body.bank_account === 'string' ? body.bank_account.trim() : ''
    if (trimmed && !BANK_ACCT_RE.test(trimmed)) fields.bank_account = FieldErrorCode.INVALID_FORMAT
  }

  // ── total_work_experience ─────────────────────────────────────────────────
  if (body.total_work_experience !== undefined && body.total_work_experience !== null) {
    if (typeof body.total_work_experience !== 'number' || body.total_work_experience < 0) {
      fields.total_work_experience = FieldErrorCode.MUST_BE_NON_NEGATIVE
    }
  }

  // ── Enum fields ───────────────────────────────────────────────────────────
  const enumCheck = <T extends readonly string[]>(key: string, allowed: T) => {
    const value = body[key]
    if (value !== undefined && value !== null && !allowed.includes(value as string)) {
      fields[key] = FieldErrorCode.INVALID_ENUM
    }
  }
  enumCheck('gender',          Object.values(Gender))
  enumCheck('marital_status',  Object.values(MaritalStatus))
  enumCheck('blood_group',     Object.values(BloodGroup))
  enumCheck('work_mode',       Object.values(WorkMode))
  enumCheck('employment_type', Object.values(EmploymentType))
  enumCheck('employee_status', Object.values(EmployeeStatus))
  enumCheck('source_of_hire',  Object.values(SourceOfHire))

  return fields
}
