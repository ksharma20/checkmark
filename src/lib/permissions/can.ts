import {
  Action,
  RESOURCES,
  Resource,
  getResource,
  resourceSupports,
  type PermissionGrid,
} from './catalogue'

/**
 * Does this grid allow the action on the resource?
 *
 * Deliberately a plain array lookup with no implication logic. Read is implied
 * by write/delete at SAVE time (see normalisePermissions), so what is stored is
 * always exactly what is true and this function never has to reason about it.
 * A resource missing from the grid means no access - deny by default.
 */
export function can(
  permissions: PermissionGrid | null | undefined,
  resource: Resource,
  action: Action
): boolean {
  if (!permissions) return false
  const granted = permissions[resource]
  return Array.isArray(granted) && granted.includes(action)
}

/** True when the grid allows any action at all on the resource. */
export function canAny(
  permissions: PermissionGrid | null | undefined,
  resource: Resource
): boolean {
  if (!permissions) return false
  const granted = permissions[resource]
  return Array.isArray(granted) && granted.length > 0
}

/**
 * Does this role grant access to any part of the org surface at /ws/:slug?
 *
 * Used by the post-login redirect, the /ws workspace picker and the workspace
 * layout. A role with an entirely empty grid - which is legal - must land on
 * /me rather than a stripped /ws shell with no navigation.
 */
export function hasAnyOrgAccess(permissions: PermissionGrid | null | undefined): boolean {
  if (!permissions) return false
  return RESOURCES.some((r) => canAny(permissions, r.key))
}

/**
 * Every resource this grid can read. Serialised into the workspace layout so
 * the sidebar can decide which screens to render without shipping the whole
 * grid or the permission logic to the browser.
 */
export function readableResources(permissions: PermissionGrid | null | undefined): Resource[] {
  if (!permissions) return []
  return RESOURCES.filter((r) => can(permissions, r.key, Action.Read)).map((r) => r.key)
}

/**
 * Force read on any resource that has write or delete: if you can edit
 * holidays you can obviously see them. Applied when a grid is SAVED so the
 * stored row never disagrees with reality.
 *
 * Also drops anything the catalogue doesn't recognise, so a hand-crafted
 * request body cannot smuggle in a resource or action that does not exist.
 */
export function normalisePermissions(input: unknown): PermissionGrid {
  const out: PermissionGrid = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out

  for (const [resourceKey, rawActions] of Object.entries(input as Record<string, unknown>)) {
    const resource = getResource(resourceKey)
    if (!resource) continue
    if (!Array.isArray(rawActions)) continue

    const actions = new Set<Action>()
    for (const action of rawActions) {
      if (typeof action !== 'string') continue
      if (!resourceSupports(resourceKey, action)) continue
      actions.add(action as Action)
    }

    if (actions.size === 0) continue

    // write or delete implies read - but only where read actually exists.
    if (
      (actions.has(Action.Write) || actions.has(Action.Delete)) &&
      resourceSupports(resourceKey, Action.Read)
    ) {
      actions.add(Action.Read)
    }

    // Keep the catalogue's declared order so stored grids are stable and diffable.
    out[resource.key] = resource.actions.filter((a) => actions.has(a))
  }

  return out
}

/**
 * Reject a grid that references resources or actions the catalogue doesn't
 * declare, so a bad save fails loudly instead of being silently dropped by
 * normalisePermissions. Returns the offending keys, empty when valid.
 */
export function findUnknownGridKeys(input: unknown): string[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['<not an object>']
  const bad: string[] = []

  for (const [resourceKey, rawActions] of Object.entries(input as Record<string, unknown>)) {
    if (!getResource(resourceKey)) {
      bad.push(resourceKey)
      continue
    }
    if (!Array.isArray(rawActions)) {
      bad.push(`${resourceKey} (not an array)`)
      continue
    }
    for (const action of rawActions) {
      if (typeof action !== 'string' || !resourceSupports(resourceKey, action)) {
        bad.push(`${resourceKey}:${String(action)}`)
      }
    }
  }

  return bad
}

/** Parse the JSON grid stored on a role row. Malformed JSON denies everything. */
export function parsePermissions(raw: string | null | undefined): PermissionGrid {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as PermissionGrid
  } catch {
    return {}
  }
}
