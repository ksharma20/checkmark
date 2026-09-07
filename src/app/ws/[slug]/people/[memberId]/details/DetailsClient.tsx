'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import {
  Avatar, Button, Card, Chip, EmptyState, Field, Select, TabBar,
  type ChipTone, type Tab,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import type { EmployeePublic } from '@/lib/types/employees'
import EmployeeSectionTab from '@/components/ws/employee/EmployeeSectionTab'
import EmployeeDocuments from '@/components/ws/employee/EmployeeDocuments'
import EmployeeLeaveTab from '@/components/ws/employee/EmployeeLeaveTab'
import EmployeeActivityTab from '@/components/ws/employee/EmployeeActivityTab'
import EmployeeFormHost from '@/components/ws/employee/EmployeeFormHost'
import {
  tabHasSubject, visiblePersonTabs,
  type PersonTabKey, type TabVisibilityInput,
} from '@/components/ws/employee/person-tabs'
import { displayValue } from '@/components/ws/employee/employee-form'
import { en } from '@/locales/en'
import { wsEmployees, wsPeopleUi } from '@/locales/en/ws-people'
import { can } from '@/lib/permissions/can'
import { Action, Resource, type PermissionGrid } from '@/lib/permissions/catalogue'
import { canManage } from '@/lib/permissions/ranks'
import { personColor } from '@/lib/workspace-color'
import TransferOwnershipModal from '../../TransferOwnershipModal'

interface MemberSummary {
  member_id: string
  user_id: string | null
  email: string
  full_name: string | null
  role: string
  status: string
}

interface ManagerOption { userId: string; name: string; email: string }
interface RoleOption { key: string; name: string; restricted: boolean }

interface Props {
  slug: string
  /** `?tab=`, already validated against `isPersonTabKey` on the server. */
  initialTab?: PersonTabKey
  viewerUserId: string
  viewerRoleKey: string
  /** The viewer's whole grid - see the note where the server passes it. */
  permissions: PermissionGrid
  member: MemberSummary
  employee: EmployeePublic | null
  canTransferOwnership: boolean
  assignableRoles: RoleOption[]
  roleNames: Record<string, string>
  /** Already excludes this person and their own subtree, so no option can loop. */
  managerOptions: ManagerOption[]
  currentManagerUserId: string | null
}

const STATUS_TONE: Record<string, ChipTone> = {
  active: 'verified',
  notice_period: 'none',
  on_leave: 'leave',
  suspended: 'partial',
  terminated: 'roadmap',
}

const TAB_LABELS: Record<PersonTabKey, string> = {
  basic: wsPeopleUi.tabBasic,
  employment: wsPeopleUi.tabEmployment,
  bank: wsPeopleUi.tabBank,
  emergency: wsPeopleUi.tabEmergency,
  documents: wsPeopleUi.tabDocuments,
  leave: wsPeopleUi.tabLeave,
  activity: wsPeopleUi.tabActivity,
  access: wsPeopleUi.tabAccess,
}

/** The four tabs that are a slice of the employee record, in edit form. */
const RECORD_TABS: ReadonlySet<PersonTabKey> = new Set<PersonTabKey>([
  'basic', 'employment', 'bank', 'emergency',
])

/**
 * Everything about one person, in eight tabs.
 *
 * There is no edit MODE here any more. The screen used to have a read-only
 * profile and a button that swapped the whole page for a five-step wizard, and
 * that shape lost every time: an HR record is not assembled in one sitting by
 * one person, so a form that can only be saved whole is a form that stays
 * empty. Each tab now owns its own fields and its own Save, and a tab nobody
 * opened is a tab nobody can accidentally blank.
 *
 * Which tabs exist, what each needs, and which resource opens it are all in
 * `person-tabs.ts` - deliberately not here, so the tab strip and the routes
 * behind it read the same table.
 */
export default function DetailsClient({
  slug, initialTab, viewerUserId, viewerRoleKey, permissions, member, employee,
  canTransferOwnership, assignableRoles, roleNames,
  managerOptions, currentManagerUserId,
}: Props) {
  const router = useRouter()
  const { show: toast } = useToast()

  const [record, setRecord] = useState<EmployeePublic | null>(employee)
  const [creating, setCreating] = useState(false)

  const canWriteEmployees = can(permissions, Resource.Employees, Action.Write)
  const canWriteDocuments = can(permissions, Resource.Documents, Action.Write)
  const canRemoveMembers = can(permissions, Resource.Members, Action.Delete)
  const canInviteMembers = can(permissions, Resource.Members, Action.Write)

  const ask = useCallback(
    (resource: Resource, action: Action) => can(permissions, resource, action),
    [permissions],
  )

  const visibility: TabVisibilityInput = {
    can: ask,
    hasUser: !!member.user_id,
    hasEmployeeRecord: !!record,
  }
  const tabDefs = visiblePersonTabs(visibility)
  const tabs: Tab[] = tabDefs.map(d => ({ key: d.key, label: TAB_LABELS[d.key] }))

  // `access` is unconditional in the catalogue, so the fallback always resolves;
  // the `?? 'access'` is there because the compiler cannot know that.
  const fallback: PersonTabKey = tabDefs[0]?.key ?? 'access'
  const [tab, setTab] = useState<PersonTabKey>(initialTab ?? fallback)

  // A tab can disappear between renders - creating the HR record adds five of
  // them, and permissions are re-resolved on every refresh. Without this a
  // stale key renders an empty panel under a tab strip that no longer has it.
  const active = tabDefs.some(d => d.key === tab) ? tab : fallback
  const activeDef = tabDefs.find(d => d.key === active)

  /**
   * Write the tab into the URL so it is linkable and survives a refresh.
   *
   * `replace`, not `push`: clicking through four tabs should not cost four
   * presses of the back button to leave the person. The membership id is used
   * rather than the current segment because the approvals queue deep-links this
   * route by EMPLOYEE id - both resolve, and normalising means a copied link is
   * always the canonical one.
   */
  function switchTab(key: PersonTabKey) {
    setTab(key)
    router.replace(`/ws/${slug}/people/${member.member_id}/details?tab=${key}`, { scroll: false })
  }

  const name = record
    ? `${record.first_name} ${record.last_name}`.trim() || record.work_email
    : member.full_name ?? member.email

  return (
    <div>
      <Link
        href={`/ws/${slug}/people`}
        className="btn btn-ghost btn-sm pressable link-plain btn-flush"
      >
        <ArrowLeft size={14} aria-hidden />
        {wsPeopleUi.detailsBack}
      </Link>

      <Card className="person-header">
        <Avatar
          name={name}
          size={64}
          color={personColor(member.user_id ?? member.email)}
        />
        <div className="person-header-main">
          <div className="person-header-titles">
            <h1 className="t-h1 person-header-name">{name}</h1>
            <Chip tone={member.role === "owner" ? "owner" : "leave"}>
              {roleNames[member.role] ?? member.role}
            </Chip>
          </div>
          <p className="t-secondary person-header-sub">
            {record
              ? [record.employment.designation, record.employment.department]
                  .filter(Boolean)
                  .join(" · ") || wsEmployees.noValue
              : wsEmployees.noValue}
          </p>
          <p className="t-muted person-header-meta">
            {[member.email, record?.employee_id].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="person-header-side">
          {member.status === "pending_consent" ? (
            <Chip tone="partial">{wsPeopleUi.statusInvited}</Chip>
          ) : member.status === "declined" ? (
            <Chip tone="none">{wsPeopleUi.statusDeclined}</Chip>
          ) : member.status === "no_access" ? (
            <Chip tone="leave">{wsPeopleUi.statusNoAccess}</Chip>
          ) : record ? (
            <Chip tone={STATUS_TONE[record.employee_status] ?? "leave"}>
              {displayValue("employee_status", record.employee_status)}
            </Chip>
          ) : (
            <Chip tone="verified">{en.wsPeople.statusActive}</Chip>
          )}

          {/* Under the status, not in a card of its own. Somebody with no HR
              record is still a member in good standing - the page should say
              so plainly and offer one action, rather than leading with a
              banner about what is missing. */}
          {!record && !creating && canWriteEmployees && (
            <Button
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => setCreating(true)}
            >
              {wsPeopleUi.createRecordButton}
            </Button>
          )}
        </div>
      </Card>

      {/* Only while actually creating. The four record tabs and Documents are
          keyed on an `employees.id`, so `visiblePersonTabs` omits them until
          there is one - and the tab strip is hidden here too, because a
          half-finished create is a focused task and the tabs behind it lead
          nowhere useful yet. */}
      {creating && (
        <Card className="mt-16 form-narrow">
          <p className="t-eyebrow mb-8">{wsPeopleUi.noRecordTitle}</p>
          <p className="t-muted mb-12">{wsPeopleUi.noRecordHint}</p>
          <EmployeeFormHost
            slug={slug}
            member={{
              userId: member.user_id,
              email: member.email,
              fullName: member.full_name,
            }}
            onCancel={() => setCreating(false)}
            onSaved={(saved) => {
              setRecord(saved);
              setCreating(false);
              setTab("basic");
              router.refresh();
            }}
          />
        </Card>
      )}

      {!creating && (
        <>
          <div className="mt-16">
            <TabBar
              tabs={tabs}
              active={active}
              onChange={(k) => switchTab(k as PersonTabKey)}
            />
          </div>

          {/* A tab the viewer may READ but which has no subject yet. Not an error
          and not a permission problem - Leave and Activity are both keyed on a
          user id, and an invitation nobody has accepted has none. The request is
          not fired at all: it would return an empty timeline or a 422 that reads
          like a bug. */}
          {activeDef && !tabHasSubject(activeDef, visibility) ? (
            <Card className="mt-16">
              <EmptyState
                title={wsPeopleUi.noSubjectTitle}
                hint={wsPeopleUi.noSubjectHint}
              />
            </Card>
          ) : (
            <>
              {RECORD_TABS.has(active) && record && (
                <EmployeeSectionTab
                  // Remount on a tab change: each section refetches and reseeds, so
                  // one component instance never carries another tab's draft.
                  key={active}
                  slug={slug}
                  employeeId={record.id}
                  tabKey={active}
                  employee={record}
                  canWrite={canWriteEmployees}
                  onSaved={(saved) => {
                    setRecord(saved);
                    router.refresh();
                  }}
                />
              )}

              {active === "documents" && record && (
                <EmployeeDocuments
                  slug={slug}
                  employeeId={record.id}
                  canWrite={canWriteDocuments}
                />
              )}

              {/* THE ID TRAP: `/api/ws/[slug]/members/[memberId]/*` is two id spaces.
              `.../timeline` and `.../employee` take a users.id; `.../role`,
              `.../leave-balances` and DELETE take a workspace_members.id. This
              route's own segment is the latter, so `userId` must come off the
              member row and never from the URL. */}
              {active === "leave" && member.user_id && (
                <EmployeeLeaveTab
                  slug={slug}
                  memberId={member.member_id}
                  userId={member.user_id}
                />
              )}

              {active === "activity" && member.user_id && (
                <EmployeeActivityTab slug={slug} userId={member.user_id} />
              )}

              {active === "access" && (
                <AccessPanel
                  slug={slug}
                  member={member}
                  viewerUserId={viewerUserId}
                  viewerRoleKey={viewerRoleKey}
                  canWriteEmployees={canWriteEmployees}
                  canRemoveMembers={canRemoveMembers}
                  canInviteMembers={canInviteMembers}
                  canTransferOwnership={canTransferOwnership}
                  assignableRoles={assignableRoles}
                  roleNames={roleNames}
                  managerOptions={managerOptions}
                  currentManagerUserId={currentManagerUserId}
                  onChanged={() => router.refresh()}
                  onRemoved={() => router.push(`/ws/${slug}/people`)}
                  toast={toast}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Access ───────────────────────────────────────────────────────────────────

/**
 * Role, reporting line, the invitation, and removal.
 *
 * Four writes, four endpoints, four permissions - deliberately not one "save"
 * button. They land in different tables (`workspace_members.role`,
 * `workspace_members.manager_user_id`, a consent invitation, and a DELETE), and
 * each one already has its own server-side guard. A single form would have to
 * invent a combined success state for four things that can fail independently.
 */
function AccessPanel({
  slug, member, viewerUserId, viewerRoleKey, canWriteEmployees, canRemoveMembers,
  canInviteMembers, canTransferOwnership, assignableRoles, roleNames, managerOptions,
  currentManagerUserId, onChanged, onRemoved, toast,
}: {
  slug: string
  member: MemberSummary
  viewerUserId: string
  viewerRoleKey: string
  canWriteEmployees: boolean
  canRemoveMembers: boolean
  canInviteMembers: boolean
  canTransferOwnership: boolean
  assignableRoles: RoleOption[]
  roleNames: Record<string, string>
  managerOptions: ManagerOption[]
  currentManagerUserId: string | null
  onChanged: () => void
  onRemoved: () => void
  toast: (message: string, tone?: 'success' | 'error') => void
}) {
  const [managerUserId, setManagerUserId] = useState(currentManagerUserId ?? '')
  const [savingManager, setSavingManager] = useState(false)
  const [roleDraft, setRoleDraft] = useState(member.role)
  const [savingRole, setSavingRole] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)

  const isSelf = !!member.user_id && member.user_id === viewerUserId
  const canReassignRole =
    assignableRoles.length > 0 &&
    member.status === 'active' &&
    !isSelf &&
    member.role !== 'owner'

  /**
   * Offer the invitation to anyone who is not already in or already asked.
   *
   * `POST /members` refuses `active` with ALREADY_MEMBER and `pending_consent`
   * with INVITE_PENDING, so offering it there would be a button whose only
   * outcome is an error. Everyone else - `no_access`, `declined`, `revoked` -
   * is someone an invitation can actually reach.
   */
  const canOfferInvite =
    canInviteMembers && member.status !== 'active' && member.status !== 'pending_consent'

  async function saveRole(next: string) {
    // Ownership is a TRANSFER, not an assignment: it swaps two rows and demotes
    // the person doing it, so it goes through the OTP flow. PATCH .../role
    // rejects 'owner' outright, so this is the only path.
    if (next === 'owner') {
      if (canTransferOwnership) setTransferOpen(true)
      setRoleDraft(member.role)
      return
    }
    setSavingRole(true)
    setRoleError(null)
    try {
      const res = await fetch(`/api/ws/${slug}/members/${member.member_id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast(en.wsPeople.roleConfirmButton, 'success')
        onChanged()
      } else {
        setRoleDraft(member.role)
        setRoleError(data.error ?? en.wsPeople.roleChangeFailed)
      }
    } finally {
      setSavingRole(false)
    }
  }

  async function saveManager(next: string) {
    setSavingManager(true)
    try {
      const res = await fetch(`/api/ws/${slug}/hierarchy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.user_id, managerUserId: next || null }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast(wsPeopleUi.accessManagerSaved, 'success')
        onChanged()
      } else {
        setManagerUserId(currentManagerUserId ?? '')
        toast(data.error ?? wsPeopleUi.accessManagerFailed, 'error')
      }
    } finally {
      setSavingManager(false)
    }
  }

  async function sendInvite() {
    setInviting(true)
    try {
      const res = await fetch(`/api/ws/${slug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: member.email }),
      })
      const data = await res.json().catch(() => ({})) as { error?: string; code?: string }

      if (res.ok) {
        toast(wsPeopleUi.inviteSent(member.email), 'success')
      } else if (data.code === 'DOMAIN_AUTO_ENROL') {
        // Not a failure. Their domain is verified, so they join on signup and an
        // invitation would be noise - say the good news rather than an error.
        toast(wsPeopleUi.inviteAutoEnrol, 'success')
      } else if (data.code === 'ALREADY_MEMBER' || data.code === 'INVITE_PENDING') {
        toast(data.error ?? wsPeopleUi.inviteFailed, 'success')
      } else {
        toast(data.error ?? wsPeopleUi.inviteFailed, 'error')
        return
      }
      onChanged()
    } finally {
      setInviting(false)
    }
  }

  async function remove() {
    if (!confirm(en.wsPeople.removeConfirm)) return
    setRemoving(true)
    try {
      const res = await fetch(`/api/ws/${slug}/members/${member.member_id}`, { method: 'DELETE' })
      if (res.ok) onRemoved()
      else toast(wsPeopleUi.accessRemoveFailed, 'error')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card className="mt-16 access-section">
      {transferOpen && (
        <TransferOwnershipModal
          slug={slug}
          target={member}
          onDone={() => setTransferOpen(false)}
          onCancel={() => setTransferOpen(false)}
        />
      )}

      <p className="t-h2">{wsPeopleUi.accessTitle}</p>
      <p className="t-secondary page-subtitle">{wsPeopleUi.accessHint}</p>

      {/* The invitation offer, which used to be a modal on /people/new. It
          follows the record rather than preceding it: a cancelled dialog must
          not throw away what HR typed, and there is nothing here that expires. */}
      {canOfferInvite && (
        <div className="mb-12">
          <p className="t-eyebrow mb-12">{wsPeopleUi.inviteTitle}</p>
          <p className="t-secondary">{wsPeopleUi.inviteBody(member.email)}</p>
          <p className="t-muted field-note">{wsPeopleUi.inviteNote}</p>
          <Button
            size="sm"
            className="mt-12"
            loading={inviting}
            onClick={() => void sendInvite()}
          >
            {inviting ? wsPeopleUi.inviteSending : wsPeopleUi.inviteSend}
          </Button>
        </div>
      )}

      <Field label={wsPeopleUi.accessRoleLabel} error={roleError ?? undefined}>
        <Select
          value={roleDraft}
          disabled={!canReassignRole || savingRole}
          onChange={(e) => {
            const next = e.target.value;
            if (next === roleDraft) return;
            setRoleDraft(next);
            void saveRole(next);
          }}
          aria-label={en.wsPeople.roleSelectAria}
          options={
            canReassignRole
              ? assignableRoles.map((r) => ({
                  value: r.key,
                  // A native <option> cannot host an SVG, so the padlock on the
                  // restricted entry is a text glyph.
                  label: r.restricted
                    ? en.wsPeople.restrictedRoleOption(r.name)
                    : r.name,
                }))
              : [
                  {
                    value: member.role,
                    label: roleNames[member.role] ?? member.role,
                  },
                ]
          }
        />
      </Field>

      {/* Reporting line. Hidden entirely for an invitation that has not been
          accepted: setManager filters on an active membership with a user id,
          so offering the control would only ever produce NOT_A_MEMBER. */}
      {canWriteEmployees && (
        <Field
          className=""
          label={wsPeopleUi.accessManagerLabel}
          hint={
            member.user_id
              ? wsPeopleUi.accessManagerHint
              : wsPeopleUi.accessManagerPendingHint
          }
        >
          <Select
            value={managerUserId}
            disabled={!member.user_id || savingManager}
            onChange={(e) => {
              const next = e.target.value;
              setManagerUserId(next);
              void saveManager(next);
            }}
            options={[
              { value: "", label: wsPeopleUi.accessManagerNone },
              ...managerOptions.map((m) => ({
                value: m.userId,
                label: m.name === m.email ? m.email : `${m.name} — ${m.email}`,
              })),
            ]}
          />
        </Field>
      )}

      {/* Two independent conditions, both required: does this viewer hold
          members:delete at all, and does rank let them act on THIS person?
          DELETE re-checks both. */}
      {canRemoveMembers && canManage(viewerRoleKey, member.role) && !isSelf && (
        <>
          <p className="t-eyebrow mt-16">{wsPeopleUi.accessRemoveTitle}</p>
          <p className="t-muted field-note">{wsPeopleUi.accessRemoveHint}</p>
          <Button
            variant="danger"
            size="sm"
            className="mt-12"
            loading={removing}
            onClick={() => void remove()}
          >
            {wsPeopleUi.accessRemoveButton}
          </Button>
        </>
      )}
    </Card>
  );
}
