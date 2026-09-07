'use client'

import { useCallback, useState } from 'react'
import { Lock } from 'lucide-react'
import { Button, Card, Chip, Field, Input, Modal } from '@/components/ui'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-settings'
import { Scope, type PermissionGrid, type Resource, type ResourceDef } from '@/lib/permissions/catalogue'
import PermissionGridEditor from './PermissionGridEditor'

const r = wsAdmin.roles

interface Role {
  id: string
  key: string
  name: string
  description: string | null
  permissions: PermissionGrid
  scope: Scope
  isSystem: boolean
  memberCount: number
}

interface Viewer {
  roleKey: string
  roleName: string
  permissions: PermissionGrid
  canWrite: boolean
  canDelete: boolean
}

interface Props {
  slug: string
  /** Rendered on the server so the grid is correct on first paint. */
  initialRoles: Role[]
  resources: ResourceDef[]
  viewer: Viewer
}

/** A grid is only equal to another if the same actions are on, in any order. */
function gridsEqual(a: PermissionGrid, b: PermissionGrid): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<Resource>
  for (const k of keys) {
    const x = [...(a[k] ?? [])].sort().join(',')
    const y = [...(b[k] ?? [])].sort().join(',')
    if (x !== y) return false
  }
  return true
}

export default function RolesClient({ slug, initialRoles, resources, viewer }: Props) {
  const [roles, setRoles] = useState<Role[]>(initialRoles)
  const [selectedId, setSelectedId] = useState<string | null>(initialRoles[0]?.id ?? null)

  // Draft state for the selected role. Everything is local until Save, so the
  // grid is never half-applied server-side.
  const firstRole = initialRoles[0]
  const [draftName, setDraftName] = useState(firstRole?.name ?? '')
  const [draftDescription, setDraftDescription] = useState(firstRole?.description ?? '')
  const [draftGrid, setDraftGrid] = useState<PermissionGrid>(firstRole?.permissions ?? {})
  const [draftScope, setDraftScope] = useState<Scope>(firstRole?.scope ?? Scope.All)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [duplicateFrom, setDuplicateFrom] = useState<string | null>(null)
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null)
  const [dialogBusy, setDialogBusy] = useState(false)

  /** Re-read the roles list after a mutation changes who holds what. */
  const reloadRoles = useCallback(async () => {
    const res = await fetch(`/api/ws/${slug}/roles`)
    if (!res.ok) return
    const data = await res.json()
    setRoles(data.roles ?? [])
  }, [slug])

  const selected = roles.find((role) => role.id === selectedId) ?? null

  /**
   * Select a role AND seed the draft from it.
   *
   * Done here rather than in an effect keyed on the selection: resetting state
   * from an effect renders once with the previous role's values still showing,
   * which on a permission grid means briefly displaying the wrong permissions.
   */
  const selectRole = useCallback((role: Role | null) => {
    setSelectedId(role?.id ?? null)
    setDraftName(role?.name ?? '')
    setDraftDescription(role?.description ?? '')
    setDraftGrid(role?.permissions ?? {})
    setDraftScope(role?.scope ?? Scope.All)
    setError(null)
  }, [])

  const dirty =
    !!selected &&
    (draftName !== selected.name ||
      draftDescription !== (selected.description ?? '') ||
      draftScope !== selected.scope ||
      !gridsEqual(draftGrid, selected.permissions))

  const editable = !!selected && !selected.isSystem && viewer.canWrite

  async function save() {
    if (!selected) return
    if (!draftName.trim()) { setError(en.wsRoles.errorNameRequired); return }
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/ws/${slug}/roles/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draftName.trim(),
        description: draftDescription.trim() || null,
        permissions: draftGrid,
        scope: draftScope,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setRoles((prev) => prev.map((role) => (role.id === selected.id ? { ...role, ...data.role } : role)))
    } else {
      setError(data.error ?? en.wsRoles.errorSaveFailed)
    }
    setSaving(false)
  }

  async function create() {
    const name = createName.trim()
    if (!name) { setError(en.wsRoles.errorNameRequired); return }
    setDialogBusy(true)
    setError(null)
    const res = await fetch(`/api/ws/${slug}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        duplicateFrom
          ? { name, duplicateFrom }
          : { name, permissions: {}, scope: Scope.All },
      ),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setRoles((prev) => [...prev, data.role])
      selectRole(data.role)
      setCreateDialogOpen(false)
      setCreateName('')
      setDuplicateFrom(null)
    } else {
      setError(data.error ?? en.wsRoles.errorCreateFailed)
    }
    setDialogBusy(false)
  }

  async function remove() {
    if (!roleToDelete) return
    setDialogBusy(true)
    setError(null)
    const res = await fetch(`/api/ws/${slug}/roles/${roleToDelete.id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setRoles((prev) => prev.filter((role) => role.id !== roleToDelete.id))
      selectRole(null)
      setRoleToDelete(null)
      reloadRoles()
    } else {
      setError(data.error ?? en.wsRoles.errorDeleteFailed)
    }
    setDialogBusy(false)
  }

  const customRoles = roles.filter((role) => !role.isSystem)

  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* ── Role list ─────────────────────────────────────────────────── */}
      <Card
        className="fx-spring"
        padded={false}
        style={{ width: '248px', flex: '0 0 auto', minWidth: '220px', overflow: 'hidden' }}
      >
        <p className="t-eyebrow" style={{ padding: '14px 16px 8px' }}>{en.wsRoles.listHeading}</p>

        {roles.map((role) => {
          const active = role.id === selectedId
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => selectRole(role)}
              className="rowlink"
              style={{
                width: '100%',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '10px 16px',
                background: active ? 'color-mix(in srgb, var(--brand) 10%, transparent)' : 'none',
                border: 'none',
                borderLeft: `3px solid ${active ? 'var(--brand)' : 'transparent'}`,
                borderTop: '1px solid var(--border)',
                borderRadius: 0,
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--brand)' : 'var(--text-primary)',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                {role.isSystem && <Lock size={12} className="t-muted" style={{ flexShrink: 0 }} aria-hidden />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {role.name}
                </span>
              </span>
              <span className="mono t-muted" aria-label={r.memberCountAria(role.memberCount)}>
                {role.memberCount}
              </span>
            </button>
          )
        })}

        {viewer.canWrite && (
          <div style={{ padding: '10px' }}>
            <Button
              variant="secondary"
              size="sm"
              block
              onClick={() => { setCreateDialogOpen(true); setDuplicateFrom(null); setCreateName(''); setError(null) }}
            >
              {en.wsRoles.newRoleBtn}
            </Button>
          </div>
        )}

        {customRoles.length === 0 && (
          <p className="t-muted" style={{ padding: '0 16px 14px' }}>{en.wsRoles.emptyStateBody}</p>
        )}
      </Card>

      {/* ── Detail pane ───────────────────────────────────────────────── */}
      {selected ? (
        <Card className="fx-spring" padded={false} style={{ flex: '1 1 320px', minWidth: '300px', overflow: 'hidden' }}>
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              background: selected.isSystem
                ? 'var(--surface-2)'
                : 'color-mix(in srgb, var(--brand) 6%, transparent)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            {selected.isSystem ? (
              <>
                <Chip tone="owner">{r.systemBadge}</Chip>
                <span className="t-secondary">{en.wsRoles.systemLockedBanner(selected.name)}</span>
              </>
            ) : (
              <span className="t-secondary">
                {selected.memberCount > 0
                  ? en.wsRoles.inUseBanner(selected.memberCount)
                  : en.wsRoles.unusedBanner}
              </span>
            )}
          </div>

          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <Field label={en.wsRoles.fieldName} htmlFor="role-name" style={{ maxWidth: '320px' }}>
              <Input
                id="role-name"
                value={draftName}
                disabled={!editable}
                placeholder={en.wsRoles.fieldNamePlaceholder}
                onChange={(e) => setDraftName(e.target.value)}
              />
            </Field>
          </div>

          <div style={{ padding: '14px 16px 4px' }}>
            <p className="t-eyebrow">{r.detailHeading}</p>
            <p className="t-muted" style={{ margin: '6px 0 0' }}>{r.detailHint}</p>
          </div>

          <PermissionGridEditor
            resources={resources}
            value={draftGrid}
            onChange={setDraftGrid}
            readOnly={!editable}
            viewerPermissions={viewer.permissions}
          />

          {error && (
            <p style={{ padding: '10px 16px 0', fontSize: '12px', color: 'var(--danger)' }}>{error}</p>
          )}

          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            {viewer.canWrite && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCreateDialogOpen(true)
                  setDuplicateFrom(selected.key)
                  setCreateName(`${selected.name} copy`)
                  setError(null)
                }}
              >
                {en.wsRoles.duplicateBtn}
              </Button>
            )}
            {editable && viewer.canDelete && (
              <Button variant="danger" size="sm" onClick={() => setRoleToDelete(selected)}>
                {en.wsRoles.deleteBtn}
              </Button>
            )}
            {editable && (
              <Button size="sm" disabled={!dirty} loading={saving} onClick={save}>
                {saving ? en.wsRoles.savingBtn : en.wsRoles.saveBtn}
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="fx-spring" style={{ flex: '1 1 320px', minWidth: '300px' }}>
          <p className="t-secondary">{r.selectPrompt}</p>
        </Card>
      )}

      {/* ── Create / duplicate ────────────────────────────────────────── */}
      <Modal
        open={createDialogOpen}
        onClose={() => { setCreateDialogOpen(false); setError(null) }}
        maxWidth={420}
        title={en.wsRoles.createTitle}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setCreateDialogOpen(false); setError(null) }}>
              {en.wsRoles.cancelBtn}
            </Button>
            <Button size="sm" loading={dialogBusy} onClick={create}>
              {dialogBusy ? en.wsRoles.creatingSubmit : en.wsRoles.createSubmit}
            </Button>
          </>
        }
      >
        <Field label={en.wsRoles.fieldName} htmlFor="new-role-name" error={error ?? undefined}>
          <Input
            id="new-role-name"
            autoFocus
            value={createName}
            placeholder={en.wsRoles.fieldNamePlaceholder}
            onChange={(e) => setCreateName(e.target.value)}
          />
        </Field>
      </Modal>

      {/* ── Delete ────────────────────────────────────────────────────── */}
      <Modal
        open={roleToDelete !== null}
        onClose={() => { setRoleToDelete(null); setError(null) }}
        maxWidth={460}
        title={roleToDelete ? en.wsRoles.deleteTitle(roleToDelete.name) : undefined}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setRoleToDelete(null); setError(null) }}>
              {en.wsRoles.cancelBtn}
            </Button>
            <Button variant="danger" size="sm" loading={dialogBusy} onClick={remove}>
              {dialogBusy ? en.wsRoles.deletingConfirm : en.wsRoles.deleteConfirm}
            </Button>
          </>
        }
      >
        {roleToDelete && (
          <>
            <p className="t-secondary">
              {roleToDelete.memberCount > 0
                ? en.wsRoles.deleteBodyWithMembers(roleToDelete.memberCount)
                : en.wsRoles.deleteBodyEmpty}
            </p>
            <p className="t-muted" style={{ marginTop: '10px' }}>{en.wsRoles.deleteIrreversible}</p>
            {error && <p style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '10px' }}>{error}</p>}
          </>
        )}
      </Modal>
    </div>
  )
}
