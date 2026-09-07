import { Action, Resource } from '@/lib/permissions/catalogue'
import { EMPLOYEE_STEPS, type EmployeeFormKey } from './employee-form'

/**
 * The person screen's tab catalogue.
 *
 * One screen holds everything about one person in one workspace, and every part
 * of it is separately readable, separately editable and separately permissioned.
 * This file is the contract: which tabs exist, what each one needs in order to
 * work at all, and which resource opens it. The panels themselves own only how
 * they look.
 *
 * It replaces a five-step wizard. The wizard assumed the record is filled in
 * once, in order, by one person in one sitting - which is not how an employee
 * record is actually assembled. HR has the name today, the bank details next
 * week, and the emergency contact whenever the person answers. A record that
 * can only be saved whole is a record that stays empty.
 *
 * The four RECORD tabs are still driven off `EMPLOYEE_STEPS`, deliberately. That
 * table already groups the fields and `validateStep()` already validates by
 * group, so a tab is a group and nothing had to be regrouped. Inventing a second
 * grouping here is how the two drift.
 */

export type PersonTabKey =
  | 'basic'
  | 'employment'
  | 'bank'
  | 'emergency'
  | 'documents'
  | 'leave'
  | 'activity'
  | 'access'

/**
 * What a tab needs in order to have anything to show.
 *
 * This is not a permission - it is a fact about the person. The two are
 * different failure modes and must read differently: "you may not see this" is
 * a hidden tab, "there is nothing here yet because they have not accepted their
 * invitation" is a visible tab with an explicit empty state. Collapsing them
 * leaves an admin wondering which one they are looking at.
 *
 *  - `user`     needs `workspace_members.user_id`. Presence, attendance and
 *               leave are all keyed on a user id, and an invited person who has
 *               not accepted does not have one yet.
 *  - `employee` needs an `employees.id` to address. Documents hang off the
 *               employee record, not the membership.
 *  - `none`     always has something to show.
 */
export type TabRequirement = 'user' | 'employee' | 'none'

export interface PersonTabDef {
  key: PersonTabKey
  /** The resource whose READ grants the tab. `null` = the page's own gate suffices. */
  resource: Resource | null
  /** The resource whose WRITE makes it editable. `null` = not directly editable. */
  writeResource: Resource | null
  requires: TabRequirement
  /**
   * For the four record tabs: the `EMPLOYEE_STEPS` group whose fields this tab
   * owns. **This is the key that gets passed to `buildEmployeeBody`'s
   * `onlyKeys`,** which is what stops a partial save nulling every field the
   * admin has not opened. Absent for tabs that are not employee-record forms.
   */
  stepKey?: string
}

export const PERSON_TABS: readonly PersonTabDef[] = [
  { key: 'basic',      resource: Resource.Employees, writeResource: Resource.Employees, requires: 'employee', stepKey: 'basic' },
  { key: 'employment', resource: Resource.Employees, writeResource: Resource.Employees, requires: 'employee', stepKey: 'employment' },
  { key: 'bank',       resource: Resource.Employees, writeResource: Resource.Employees, requires: 'employee', stepKey: 'bank' },
  { key: 'emergency',  resource: Resource.Employees, writeResource: Resource.Employees, requires: 'employee', stepKey: 'emergency' },
  { key: 'documents',  resource: Resource.Documents, writeResource: Resource.Documents, requires: 'employee' },
  { key: 'leave',      resource: Resource.Leaves,    writeResource: null,               requires: 'user' },
  { key: 'activity',   resource: Resource.Activity,  writeResource: null,               requires: 'user' },
  // Access is unconditional: `members:read` is what opened the page at all, and
  // the controls inside it carry their own separate gates (assign_roles:write,
  // employees:write for the reporting line, members:delete for removal).
  { key: 'access',     resource: null,               writeResource: null,               requires: 'none' },
]

export const PERSON_TAB_KEYS: readonly PersonTabKey[] = PERSON_TABS.map(t => t.key)

export function isPersonTabKey(value: unknown): value is PersonTabKey {
  return typeof value === 'string' && PERSON_TAB_KEYS.includes(value as PersonTabKey)
}

/**
 * The fields a record tab owns. Pass straight to
 * `buildEmployeeBody(form, 'update', fieldsForTab(key))`.
 *
 * Returns `[]` for a non-record tab, and an empty list must never be sent as a
 * PATCH body - an empty `onlyKeys` narrows to nothing but the three NOT NULL
 * columns, which is a no-op write, not a save.
 */
export function fieldsForTab(key: PersonTabKey): readonly EmployeeFormKey[] {
  const def = PERSON_TABS.find(t => t.key === key)
  if (!def?.stepKey) return []
  return EMPLOYEE_STEPS.find(s => s.key === def.stepKey)?.fields ?? []
}

/** The index into `EMPLOYEE_STEPS`, which is what `validateStep()` takes. */
export function stepIndexForTab(key: PersonTabKey): number {
  const def = PERSON_TABS.find(t => t.key === key)
  if (!def?.stepKey) return -1
  return EMPLOYEE_STEPS.findIndex(s => s.key === def.stepKey)
}

export interface TabVisibilityInput {
  can: (resource: Resource, action: Action) => boolean
  hasUser: boolean
  hasEmployeeRecord: boolean
}

/**
 * Which tabs to render, and whether each is merely empty rather than forbidden.
 *
 * A tab the viewer may not read is **omitted**. A tab they may read but which
 * has no subject yet is **present and empty** - hiding it would make an
 * unaccepted invitation look like a permission problem.
 *
 * The one exception is `documents`, which is omitted rather than emptied when
 * there is no employee record: its entire API path is
 * `/employees/<id>/documents`, so without an id there is no request to make and
 * no empty state that means anything.
 */
export function visiblePersonTabs(input: TabVisibilityInput): PersonTabDef[] {
  return PERSON_TABS.filter(def => {
    if (def.resource && !input.can(def.resource, Action.Read)) return false
    if (def.requires === 'employee' && !input.hasEmployeeRecord) return false
    return true
  })
}

/**
 * Whether a visible tab has a subject to talk about. False means render the
 * "they have not accepted their invitation yet" empty state rather than firing
 * a request that returns nothing (presence) or `422 MEMBER_PENDING` (leave).
 */
export function tabHasSubject(def: PersonTabDef, input: TabVisibilityInput): boolean {
  if (def.requires === 'user') return input.hasUser
  if (def.requires === 'employee') return input.hasEmployeeRecord
  return true
}
