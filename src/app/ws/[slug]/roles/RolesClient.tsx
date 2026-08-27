'use client'

import { useCallback, useState } from 'react'
import { Lock } from 'lucide-react'
import { en } from '@/locales/en'
import { Scope, type PermissionGrid, type Resource, type ResourceDef } from '@/lib/permissions/catalogue'
import PermissionGridEditor from './PermissionGridEditor'

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

  const selected = roles.find((r) => r.id === selectedId) ?? null

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
      setRoles((prev) => prev.map((r) => (r.id === selected.id ? { ...r, ...data.role } : r)))
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
      setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id))
      selectRole(null)
      setRoleToDelete(null)
      reloadRoles()
    } else {
      setError(data.error ?? en.wsRoles.errorDeleteFailed)
    }
    setDialogBusy(false)
  }

  // ── styles ──────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-0)',
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px',
    display: 'block',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '40px',
    padding: '0 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-2)',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontSize: '13px',
    color: 'var(--navy)',
    outline: 'none',
  }
  const btnStyle: React.CSSProperties = {
    height: '44px',
    padding: '0 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--surface-0)',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  }
  const btnPrimaryStyle: React.CSSProperties = {
    ...btnStyle,
    background: 'var(--brand)',
    borderColor: 'var(--brand)',
    color: '#fff',
  }

  const customRoles = roles.filter((r) => !r.isSystem)

  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* ── Role list ─────────────────────────────────────────────────── */}
      <div style={{ ...cardStyle, width: '240px', flexShrink: 0, minWidth: '220px' }}>
        <div style={{ ...labelStyle, padding: '10px 12px 6px', marginBottom: 0 }}>
          {en.wsRoles.listHeading}
        </div>
        {roles.map((r) => {
          const active = r.id === selectedId
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => selectRole(r)}
              style={{
                width: '100%',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '10px 12px',
                background: active ? 'color-mix(in srgb, var(--brand) 8%, transparent)' : 'none',
                border: 'none',
                borderLeft: active ? '3px solid var(--brand)' : '3px solid transparent',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '13px',
                fontWeight: active ? 700 : 500,
                color: 'var(--navy)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                {r.isSystem && <Lock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name}
                </span>
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                {r.memberCount}
              </span>
            </button>
          )
        })}

        {viewer.canWrite && (
          <button
            type="button"
            onClick={() => { setCreateDialogOpen(true); setDuplicateFrom(null); setCreateName(''); setError(null) }}
            style={{
              width: 'calc(100% - 20px)',
              margin: '10px',
              minHeight: '44px',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'none',
              color: 'var(--brand)',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {en.wsRoles.newRoleBtn}
          </button>
        )}

        {customRoles.length === 0 && (
          <p style={{ padding: '0 12px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {en.wsRoles.emptyStateBody}
          </p>
        )}
      </div>

      {/* ── Detail pane ───────────────────────────────────────────────── */}
      {selected && (
        <div style={{ ...cardStyle, flex: 1, minWidth: '300px' }}>
          {selected.isSystem ? (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Lock size={13} style={{ flexShrink: 0 }} />
              {en.wsRoles.systemLockedBanner(selected.name)}
            </div>
          ) : (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, var(--brand) 6%, transparent)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--text-secondary)' }}>
              {selected.memberCount > 0
                ? en.wsRoles.inUseBanner(selected.memberCount)
                : en.wsRoles.unusedBanner}
            </div>
          )}

          <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
              <label style={labelStyle} htmlFor="role-name">{en.wsRoles.fieldName}</label>
              <input
                id="role-name"
                value={draftName}
                disabled={!editable}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder={en.wsRoles.fieldNamePlaceholder}
                style={{ ...inputStyle, opacity: editable ? 1 : 0.7, cursor: editable ? 'text' : 'not-allowed' }}
              />
            </div>
          </div>

          <PermissionGridEditor
            resources={resources}
            value={draftGrid}
            onChange={setDraftGrid}
            readOnly={!editable}
            viewerPermissions={viewer.permissions}
          />

          {error && (
            <p style={{ padding: '10px 12px 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--danger)' }}>
              {error}
            </p>
          )}

          <div style={{ padding: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {viewer.canWrite && (
              <button
                type="button"
                onClick={() => { setCreateDialogOpen(true); setDuplicateFrom(selected.key); setCreateName(`${selected.name} copy`); setError(null) }}
                style={btnStyle}
              >
                {en.wsRoles.duplicateBtn}
              </button>
            )}
            {editable && viewer.canDelete && (
              <button type="button" onClick={() => setRoleToDelete(selected)} style={{ ...btnStyle, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                {en.wsRoles.deleteBtn}
              </button>
            )}
            {editable && (
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                style={{ ...btnPrimaryStyle, opacity: !dirty || saving ? 0.45 : 1, cursor: !dirty || saving ? 'default' : 'pointer' }}
              >
                {saving ? en.wsRoles.savingBtn : en.wsRoles.saveBtn}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Create / duplicate ────────────────────────────────────────── */}
      {createDialogOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ ...cardStyle, padding: '24px', maxWidth: '420px', width: '100%' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', fontWeight: 700, color: 'var(--navy)', marginBottom: '12px' }}>
              {en.wsRoles.createTitle}
            </h2>
            <label style={labelStyle} htmlFor="new-role-name">{en.wsRoles.fieldName}</label>
            <input
              id="new-role-name"
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={en.wsRoles.fieldNamePlaceholder}
              style={{ ...inputStyle, marginBottom: '12px' }}
            />
            {error && (
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--danger)', marginBottom: '10px' }}>{error}</p>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setCreateDialogOpen(false); setError(null) }} style={btnStyle}>
                {en.wsRoles.cancelBtn}
              </button>
              <button type="button" onClick={create} disabled={dialogBusy} style={{ ...btnPrimaryStyle, opacity: dialogBusy ? 0.6 : 1 }}>
                {dialogBusy ? en.wsRoles.creatingSubmit : en.wsRoles.createSubmit}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete ────────────────────────────────────────────────────── */}
      {roleToDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ ...cardStyle, padding: '24px', maxWidth: '440px', width: '100%' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', fontWeight: 700, color: 'var(--navy)', marginBottom: '10px' }}>
              {en.wsRoles.deleteTitle(roleToDelete.name)}
            </h2>
            <div style={{ border: '1px solid var(--border)', background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: '10px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', lineHeight: 1.55 }}>
              {roleToDelete.memberCount > 0
                ? en.wsRoles.deleteBodyWithMembers(roleToDelete.memberCount)
                : en.wsRoles.deleteBodyEmpty}
            </div>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              {en.wsRoles.deleteIrreversible}
            </p>
            {error && (
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'var(--danger)', marginBottom: '10px' }}>{error}</p>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => { setRoleToDelete(null); setError(null) }} style={btnStyle}>
                {en.wsRoles.cancelBtn}
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={dialogBusy}
                style={{ ...btnStyle, background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff', opacity: dialogBusy ? 0.6 : 1 }}
              >
                {dialogBusy ? en.wsRoles.deletingConfirm : en.wsRoles.deleteConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
