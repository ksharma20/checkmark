'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Lock, Plus, Trash2 } from 'lucide-react'
import {
  Avatar, Button, Card, Chip, DataTable, EmptyState, IconButton, Input,
  Select, SkeletonText,
  type ChipTone, type Column,
} from '@/components/ui'
import { en } from '@/locales/en'
import { wsPeopleUi } from '@/locales/en/ws-people'
import { canManage } from '@/lib/permissions/ranks'
import { personColor } from '@/lib/workspace-color'
import RegularizationRequestsSection from './RegularizationRequests'

/**
 * One row of the workforce directory.
 *
 * Membership and HR in one shape, because this screen is now both. The HR half
 * is optional twice over: `employee_record_id` is null when nobody has filled
 * the record in, and every HR field is absent entirely for a viewer without
 * `employees:read` - the API strips them rather than the table hiding them.
 */
interface Member {
  member_id: string
  email: string
  full_name: string | null
  role: string
  status: string
  added_at: string
  user_id: string | null
  employee_record_id?: string | null
  employee_id?: string | null
  designation?: string | null
  department?: string | null
  work_mode?: string | null
  date_of_joining?: string | null
  probation_end_date?: string | null
  employee_status?: string | null
}

/**
 * What the VIEWER may do, resolved server-side from their role grid. Deny by
 * default until it loads, so an owner-only action never flashes for an admin.
 */
interface ViewerPermissions {
  transferOwnership: boolean
  removeMembers: boolean
  readEmployees: boolean
  writeEmployees: boolean
}

const WM_LABEL: Record<string, string> = {
  office: en.wsPeople.workModeOffice,
  remote: en.wsPeople.workModeRemote,
  hybrid: en.wsPeople.workModeHybrid,
}

/**
 * The status control's options, in the order a reader scans them: the two
 * membership states first (they answer "have they even joined?"), then the
 * employment states. Values match DirectoryStatusFilter on the server.
 */
const STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'invited', label: wsPeopleUi.statusInvited },
  { value: 'declined', label: wsPeopleUi.statusDeclined },
  { value: 'active', label: wsPeopleUi.statusEmployed },
  { value: 'on_leave', label: wsPeopleUi.statusOnLeave },
  { value: 'notice_period', label: wsPeopleUi.statusNoticePeriod },
  { value: 'suspended', label: wsPeopleUi.statusSuspended },
  { value: 'terminated', label: wsPeopleUi.statusTerminated },
]

const EMPLOYEE_STATUS_CHIP: Record<string, { label: string; tone: ChipTone }> = {
  terminated:    { label: wsPeopleUi.statusTerminated,   tone: 'roadmap' },
  suspended:     { label: wsPeopleUi.statusSuspended,    tone: 'partial' },
  on_leave:      { label: wsPeopleUi.statusOnLeave,      tone: 'leave' },
  notice_period: { label: wsPeopleUi.statusNoticePeriod, tone: 'none' },
}

/**
 * The chip in the Status column, resolved in priority order.
 *
 * Membership answers first: somebody who has not accepted is Invited, whatever
 * their HR record says. Then an explicit employment status. Only then the dates,
 * which are derived rather than stored - Onboarding and Probation are display
 * states and deliberately absent from the FILTER, because filtering on them
 * would mean date SQL for something nobody asks for.
 */
function statusChip(m: Member): { label: string; tone: ChipTone } {
  if (m.status === 'pending_consent') return { label: wsPeopleUi.statusInvited, tone: 'partial' }
  if (m.status === 'declined') return { label: wsPeopleUi.statusDeclined, tone: 'none' }

  const explicit = m.employee_status ? EMPLOYEE_STATUS_CHIP[m.employee_status] : undefined
  if (explicit) return explicit

  if (m.employee_record_id) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (m.date_of_joining && new Date(m.date_of_joining) > today) {
      return { label: en.wsPeople.statusOnboarding, tone: 'override' }
    }
    if (m.probation_end_date && new Date(m.probation_end_date) >= today) {
      return { label: en.wsPeople.statusProbation, tone: 'partial' }
    }
  }
  return { label: en.wsPeople.statusActive, tone: 'verified' }
}

function formatDateOfJoining(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props {
  slug: string
  /** The signed-in user, so their own row never offers a remove button. */
  viewerUserId: string
}

/**
 * The workforce directory: every membership row, HR record overlaid where one
 * exists, invited people included.
 *
 * This screen used to be membership only, with a second Employees tab showing
 * the same people from the other table. They disagreed - Employees filtered to
 * active members with an account, so an invited colleague was simply missing
 * from it, and the two headcounts never matched.
 *
 * Row actions are deliberately ONE link. Editing a role from a dropdown in a
 * table row makes a consequential change feel like sorting a column; it now
 * lives on the details page next to the reporting line and the remove button,
 * where the consequence can be spelled out.
 */
export default function PeopleClient({ slug, viewerUserId }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [nextOffset, setNextOffset] = useState<number | null>(null)

  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [departments, setDepartments] = useState<string[]>([])

  const [removingId, setRemovingId] = useState<string | null>(null)
  const [roleNames, setRoleNames] = useState<Record<string, string>>({})
  const [viewerPermissions, setViewerPermissions] = useState<ViewerPermissions>({
    transferOwnership: false, removeMembers: false, readEmployees: false, writeEmployees: false,
  })
  const [viewerRoleKey, setViewerRoleKey] = useState<string>('member')

  // Search runs on the SERVER. A client-side filter over the loaded page would
  // simply fail to find anyone on page two, which is the bug the old Employees
  // screen had before its directory grew past one page.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const fetchPage = useCallback(async (offset: number) => {
    const qs = new URLSearchParams({ limit: '25', offset: String(offset) })
    if (debouncedSearch) qs.set('search', debouncedSearch)
    if (department) qs.set('department', department)
    if (status) qs.set('status', status)
    const res = await fetch(`/api/ws/${slug}/members?${qs.toString()}`)
    if (!res.ok) return null
    return res.json() as Promise<{
      members: Member[]
      total: number
      departments: string[]
      roleNames: Record<string, string>
      viewerRole: { key: string; name: string }
      permissions: ViewerPermissions
      pagination: { nextOffset: number | null }
    }>
  }, [slug, debouncedSearch, department, status])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPage(0)
      if (!data) return
      setMembers(data.members ?? [])
      setTotal(data.total ?? 0)
      setDepartments(data.departments ?? [])
      setRoleNames(data.roleNames ?? {})
      setViewerRoleKey(data.viewerRole?.key ?? 'member')
      setViewerPermissions({
        transferOwnership: data.permissions?.transferOwnership === true,
        removeMembers: data.permissions?.removeMembers === true,
        readEmployees: data.permissions?.readEmployees === true,
        writeEmployees: data.permissions?.writeEmployees === true,
      })
      setNextOffset(data.pagination?.nextOffset ?? null)
    } finally {
      setLoading(false)
    }
  }, [fetchPage])

  useEffect(() => { void load() }, [load])

  async function loadMore() {
    if (nextOffset == null) return
    setLoadingMore(true)
    try {
      const data = await fetchPage(nextOffset)
      if (!data) return
      setMembers(prev => [...prev, ...(data.members ?? [])])
      setTotal(data.total ?? 0)
      setNextOffset(data.pagination?.nextOffset ?? null)
    } finally {
      setLoadingMore(false)
    }
  }

  async function remove(memberId: string) {
    if (!confirm(en.wsPeople.removeConfirm)) return
    setRemovingId(memberId)
    try {
      const res = await fetch(`/api/ws/${slug}/members/${memberId}`, { method: 'DELETE' })
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.member_id !== memberId))
        setTotal(t => Math.max(0, t - 1))
      }
    } finally {
      setRemovingId(null)
    }
  }

  const filtered = debouncedSearch !== '' || department !== '' || status !== ''
  // Department reads a column only an HR record carries, so switching it on
  // necessarily hides everyone without one. Say so rather than letting the list
  // quietly shrink.
  const recordOnlyFilterOn = department !== ''

  const { readEmployees } = viewerPermissions

  const columns: Column<Member>[] = useMemo(() => {
    const cols: Column<Member>[] = [
      {
        key: 'employee',
        header: en.wsPeople.colEmployee,
        render: (m) => {
          const name = m.full_name ?? m.email
          return (
            <div className="row-gap-sm">
              <Avatar name={name} color={personColor(m.user_id ?? m.email)} />
              <div className="min-w-0">
                <p className="t-rowtitle">{name}</p>
                <p className="t-rowsub">{m.employee_id ?? m.email}</p>
              </div>
            </div>
          )
        },
      },
    ]

    if (readEmployees) {
      cols.push(
        {
          key: 'designation',
          header: en.wsPeople.colDesignation,
          render: m => <span className="t-secondary">{m.designation ?? '—'}</span>,
        },
        {
          key: 'department',
          header: en.wsPeople.colDepartment,
          render: m => <span className="t-secondary">{m.department ?? '—'}</span>,
        },
        {
          key: 'work_mode',
          header: en.wsPeople.colWorkMode,
          render: m => <span className="t-secondary">{m.work_mode ? (WM_LABEL[m.work_mode] ?? m.work_mode) : '—'}</span>,
        },
        {
          key: 'joined',
          header: en.wsPeople.colJoined,
          render: m => <span className="t-secondary">{formatDateOfJoining(m.date_of_joining)}</span>,
        },
      )
    }

    cols.push(
      {
        key: 'role',
        // A label, not a control. Reassignment moved to the details page.
        header: en.wsPeople.roleColumn,
        render: (m) => (
          <Chip tone={m.role === 'owner' ? 'owner' : 'leave'}>
            {roleNames[m.role] ?? m.role}
            {m.role === 'owner' && <Lock size={11} aria-hidden />}
          </Chip>
        ),
      },
      {
        key: 'status',
        header: en.wsPeople.colStatus,
        render: (m) => {
          const st = statusChip(m)
          return <Chip tone={st.tone}>{st.label}</Chip>
        },
      },
      {
        key: 'actions',
        header: wsPeopleUi.actionsLabel,
        align: 'right',
        render: (m) => (
          <div className="row-end-sm">
            <Link
              href={`/ws/${slug}/people/${m.member_id}/details`}
              className="btn btn-ghost btn-sm pressable link-plain"
              aria-label={wsPeopleUi.editActionAria(m.full_name ?? m.email)}
            >
              {wsPeopleUi.editAction}
            </Link>
            {/* Two independent conditions, both required: does this viewer hold
                members:delete at all, and does rank let them act on THIS
                person? DELETE re-checks both. */}
            {viewerPermissions.removeMembers &&
              canManage(viewerRoleKey, m.role) &&
              m.user_id !== viewerUserId && (
                <IconButton
                  variant="plain"
                  label={en.wsPeople.removeTitle}
                  icon={<Trash2 size={14} />}
                  disabled={removingId === m.member_id}
                  onClick={() => remove(m.member_id)}
                  className="icon-btn-danger"
                />
              )}
          </div>
        ),
      },
    )

    return cols
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readEmployees, roleNames, viewerPermissions, viewerRoleKey, viewerUserId, removingId, slug])

  return (
    <div>
      <Card padded={false} className="overflow-hidden">
        <div className="filter-bar">
          <Input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={wsPeopleUi.searchPlaceholder}
            aria-label={wsPeopleUi.searchPlaceholder}
            className="filter-search"
          />
          {readEmployees && (
            <Select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              aria-label={wsPeopleUi.departmentLabel}
              className="filter-select"
              options={[
                { value: '', label: wsPeopleUi.departmentAll },
                ...departments.map(d => ({ value: d, label: d })),
              ]}
            />
          )}
          <Select
            value={status}
            onChange={e => setStatus(e.target.value)}
            aria-label={wsPeopleUi.statusLabel}
            className="filter-select"
            options={[{ value: '', label: wsPeopleUi.statusAll }, ...STATUS_OPTIONS]}
          />
        </div>

        {recordOnlyFilterOn && (
          <p className="t-muted filter-note">{wsPeopleUi.recordOnlyFilterNote}</p>
        )}

        <div className="row-between table-head">
          <p className="t-h2">{en.wsPeople.peopleCount(total)}</p>
        </div>

        {loading ? (
          <div className="pad-list"><SkeletonText lines={4} /></div>
        ) : (
          <DataTable
            columns={columns}
            rows={members}
            rowKey={m => m.member_id}
            minWidth={readEmployees ? 1040 : 640}
            empty={
              <EmptyState
                title={filtered ? wsPeopleUi.emptyFilteredTitle : en.wsPeople.emptyTitle}
                hint={filtered ? wsPeopleUi.emptyFilteredHint : en.wsPeople.emptyBody}
              />
            }
          />
        )}
      </Card>

      {nextOffset != null && (
        <Button
          variant="secondary"
          block
          loading={loadingMore}
          onClick={() => void loadMore()}
          className="mt-12"
        >
          {loadingMore ? en.wsPeople.loadingMore : en.wsPeople.viewMore}
        </Button>
      )}

      <RegularizationRequestsSection slug={slug} />
    </div>
  )
}

/** Header action, rendered by the server page beside the title. */
export function AddEmployeeButton({ slug }: { slug: string }) {
  return (
    <Link href={`/ws/${slug}/people/new`} className="btn btn-primary btn-sm pressable link-plain">
      <Plus size={14} aria-hidden />
      {wsPeopleUi.addEmployee}
    </Link>
  )
}
