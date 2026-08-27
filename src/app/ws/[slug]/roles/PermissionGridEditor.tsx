'use client'

import { Lock } from 'lucide-react'
import { en } from '@/locales/en'
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

  const thStyle: React.CSSProperties = {
    padding: '8px 10px',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)',
    background: 'var(--surface-2)',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '460px' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'left' }}>{en.wsRoles.colResource}</th>
            <th style={{ ...thStyle, textAlign: 'center', width: '76px' }}>{en.wsRoles.colRead}</th>
            <th style={{ ...thStyle, textAlign: 'center', width: '76px' }}>{en.wsRoles.colWrite}</th>
            <th style={{ ...thStyle, textAlign: 'center', width: '76px' }}>{en.wsRoles.colDelete}</th>
            <th style={{ ...thStyle, textAlign: 'center', width: '56px' }}>{en.wsRoles.colAll}</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => {
            const granted = value[resource.key] ?? []
            const viewerHas = viewerPermissions[resource.key] ?? []

            return (
              <tr key={resource.key}>
                <td
                  style={{
                    padding: '10px',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '13px',
                    color: 'var(--navy)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {resource.label}
                </td>

                {ALL_ACTIONS.map((action) => {
                  const supported = resource.actions.includes(action)
                  const implied = isImpliedRead(granted, action)
                  const checked = granted.includes(action)
                  const beyondViewer = !viewerHas.includes(action)
                  const disabled = readOnly || implied || beyondViewer

                  return (
                    <td
                      key={action}
                      style={{
                        padding: '10px',
                        textAlign: 'center',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {!supported ? (
                        // The action does not exist for this resource - an
                        // em-dash reads as "not a thing", where a greyed box
                        // would read as "you aren't allowed".
                        <span
                          title={en.wsRoles.notApplicable}
                          style={{ color: 'var(--text-muted)', fontWeight: 600 }}
                        >
                          —
                        </span>
                      ) : (
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
                      )}
                    </td>
                  )
                })}

                <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                  {readOnly ? (
                    <Lock size={13} style={{ color: 'var(--text-muted)' }} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleRow(resource)}
                      aria-label={en.wsRoles.toggleRowAria(resource.label)}
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
                      ▸
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
