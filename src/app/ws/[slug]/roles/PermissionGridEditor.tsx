'use client'

import { Lock } from 'lucide-react'
import { DataTable } from '@/components/ui'
import type { Column } from '@/components/ui'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-settings'
// The catalogue is data-only and safe to import from a client component, so
// these types come from there rather than being redeclared here - a second
// copy is free to drift from what the server validates against.
import { Action, type PermissionGrid, type Resource, type ResourceDef } from '@/lib/permissions/catalogue'

/** The three action columns, in the order they are rendered. */
const ALL_ACTIONS: Action[] = [Action.Read, Action.Write, Action.Delete]

/**
 * Is read on this resource IMPLIED rather than chosen?
 *
 * Write or delete forces read, so the box is ticked and locked. This mirrors
 * what the server does when normalising a grid on save, so what the user sees
 * matches what gets stored.
 */
function isImpliedRead(granted: Action[], action: Action): boolean {
  return action === Action.Read
    && (granted.includes(Action.Write) || granted.includes(Action.Delete))
}

interface Props {
  resources: ResourceDef[]
  value: PermissionGrid
  onChange: (next: PermissionGrid) => void
  /** System roles render inert - visible, but nothing can be changed. */
  readOnly: boolean
  /**
   * The editor's own grid. Cells beyond it are disabled: you cannot grant a
   * permission you do not hold. guardEscalation enforces this server-side too -
   * this only avoids offering a checkbox that would be rejected.
   */
  viewerPermissions: PermissionGrid
}

export default function PermissionGridEditor({
  resources,
  value,
  onChange,
  readOnly,
  viewerPermissions,
}: Props) {
  function toggle(resourceKey: Resource, action: Action) {
    if (readOnly) return
    const current = value[resourceKey] ?? []
    const has = current.includes(action)

    let next: Action[]
    if (has) {
      next = current.filter((a) => a !== action)
      // Unticking write/delete releases the implied read only if nothing else
      // still implies it.
      if (
        action !== Action.Read &&
        !next.includes(Action.Write) &&
        !next.includes(Action.Delete)
      ) {
        next = next.filter((a) => a !== Action.Read)
      }
    } else {
      next = [...current, action]
      if (action !== Action.Read && !next.includes(Action.Read)) next = [...next, Action.Read]
    }

    const resource = resources.find((r) => r.key === resourceKey)
    const ordered = (resource?.actions ?? ALL_ACTIONS).filter((a) => next.includes(a))

    const out = { ...value }
    if (ordered.length === 0) delete out[resourceKey]
    else out[resourceKey] = ordered
    onChange(out)
  }

  /** Tick every action the viewer can grant on this row, or clear the row. */
  function toggleRow(resource: ResourceDef) {
    if (readOnly) return
    const grantable = resource.actions.filter((a) =>
      (viewerPermissions[resource.key] ?? []).includes(a),
    )
    const current = value[resource.key] ?? []
    const allOn = grantable.every((a) => current.includes(a))

    const out = { ...value }
    if (allOn) delete out[resource.key]
    else out[resource.key] = [...grantable] as Action[]
    onChange(out)
  }

  function actionColumn(action: Action, header: string): Column<ResourceDef> {
    return {
      key: action,
      header,
      width: 76,
      align: 'center',
      render: (resource) => {
        const granted = value[resource.key] ?? []
        const viewerHas = viewerPermissions[resource.key] ?? []
        const supported = resource.actions.includes(action)
        const implied = isImpliedRead(granted, action)
        const checked = granted.includes(action)
        const beyondViewer = !viewerHas.includes(action)
        const disabled = readOnly || implied || beyondViewer

        // The action does not exist for this resource - an em-dash reads as
        // "not a thing", where a greyed box would read as "you aren't allowed".
        if (!supported) {
          return (
            <span className="t-muted" title={en.wsRoles.notApplicable} style={{ fontWeight: 600 }}>
              —
            </span>
          )
        }

        return (
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={() => toggle(resource.key, action)}
            aria-label={en.wsRoles.cellAria(resource.label, action)}
            title={
              implied
                ? en.wsRoles.impliedRead
                : beyondViewer && !readOnly
                  ? en.wsRoles.beyondYourRole
                  : undefined
            }
            style={{
              width: '17px',
              height: '17px',
              accentColor: 'var(--brand)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: implied ? 0.55 : beyondViewer ? 0.3 : 1,
            }}
          />
        )
      },
    }
  }

  const columns: Column<ResourceDef>[] = [
    { key: 'resource', header: en.wsRoles.colResource, render: (r) => r.label },
    actionColumn(Action.Read, en.wsRoles.colRead),
    actionColumn(Action.Write, en.wsRoles.colWrite),
    actionColumn(Action.Delete, en.wsRoles.colDelete),
    {
      key: 'all',
      header: en.wsRoles.colAll,
      width: 64,
      align: 'center',
      render: (resource) =>
        readOnly ? (
          <Lock size={13} className="t-muted" aria-hidden />
        ) : (
          <button
            type="button"
            onClick={() => toggleRow(resource)}
            aria-label={en.wsRoles.toggleRowAria(resource.label)}
            className="pressable"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--brand)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              padding: '4px 8px',
              minHeight: '28px',
            }}
          >
            {wsAdmin.roles.rowAllLabel}
          </button>
        ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={resources}
      rowKey={(resource) => resource.key}
      minWidth={520}
    />
  )
}
