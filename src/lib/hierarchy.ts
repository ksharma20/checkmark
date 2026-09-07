/**
 * The reporting tree, in memory.
 *
 * Built from one flat query of (user_id, manager_user_id) pairs and walked in
 * JavaScript rather than with a recursive CTE. A workspace's hierarchy is small
 * - a 500-person company is 500 tiny rows - and doing it here means the walk
 * behaves identically on better-sqlite3 in development and libSQL in
 * production, with no dialect differences to get subtly wrong.
 *
 * PURE: no database access, no imports from the query layer. Callers fetch the
 * pairs and hand them in, which also makes this trivially testable.
 */

/** One row of the org chart. `managerUserId` null means "not assigned". */
export interface ReportingPair {
  userId: string
  managerUserId: string | null
}

export interface ReportingTree {
  /** Effective parent of each member, owner roll-up already applied. */
  parentOf: Map<string, string | null>
  /** Direct reports of each member. */
  childrenOf: Map<string, string[]>
  ownerUserId: string | null
}

/**
 * Guard against a cycle that reached the database despite the write-time check
 * - a direct SQL edit, or a bug in setManager. A cycle would otherwise spin
 * forever and hang the request rather than failing.
 *
 * Deep enough that no real org hits it: 64 levels of management is not a
 * hierarchy, it is corruption.
 */
const MAX_DEPTH = 64

/**
 * Build the tree, applying the unassigned roll-up.
 *
 * A member with no manager reports to the OWNER. That is resolved here rather
 * than stored, so an ownership transfer does not require rewriting every
 * unassigned row, and "never assigned" stays distinguishable from "deliberately
 * reports to the owner" in the data.
 *
 * The owner is the ROOT and has no parent - their own `manager_user_id` is also
 * null, so without this the roll-up would make the owner their own manager and
 * every walk would loop.
 */
export function buildReportingTree(
  pairs: ReportingPair[],
  ownerUserId: string | null,
): ReportingTree {
  const known = new Set(pairs.map((p) => p.userId))
  const parentOf = new Map<string, string | null>()
  const childrenOf = new Map<string, string[]>()

  for (const { userId, managerUserId } of pairs) {
    let parent: string | null = managerUserId

    // A manager who is no longer a member of this workspace is treated as
    // absent, so their reports roll up rather than dangling off a ghost.
    if (parent !== null && !known.has(parent)) parent = null
    // Nobody may be their own manager, whatever the column says.
    if (parent === userId) parent = null
    // Unassigned rolls up to the owner - but the owner is the root.
    if (parent === null && ownerUserId && userId !== ownerUserId) {
      parent = ownerUserId
    }

    parentOf.set(userId, parent)
    if (parent !== null) {
      const siblings = childrenOf.get(parent)
      if (siblings) siblings.push(userId)
      else childrenOf.set(parent, [userId])
    }
  }

  return { parentOf, childrenOf, ownerUserId }
}

/**
 * The user plus everyone beneath them, at any depth.
 *
 * This is what `Scope.Subtree` resolves to. Self is always included: a manager
 * who could not see their own attendance would be a strange kind of manager.
 */
export function subtreeOf(tree: ReportingTree, userId: string): string[] {
  const seen = new Set<string>([userId])
  const queue: Array<{ id: string; depth: number }> = [{ id: userId, depth: 0 }]

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (depth >= MAX_DEPTH) continue
    for (const child of tree.childrenOf.get(id) ?? []) {
      // `seen` doubles as the cycle guard: a node already visited is not
      // enqueued again, so a loop terminates instead of spinning.
      if (seen.has(child)) continue
      seen.add(child)
      queue.push({ id: child, depth: depth + 1 })
    }
  }

  return [...seen]
}

/**
 * Everyone above the user, nearest first. Excludes the user.
 *
 * Drives notification fan-out: to find who should hear about a request, walk UP
 * from the requester rather than computing every manager's subtree and testing
 * for membership.
 */
export function ancestorsOf(tree: ReportingTree, userId: string): string[] {
  const chain: string[] = []
  const seen = new Set<string>([userId])

  let current = tree.parentOf.get(userId) ?? null
  let depth = 0
  while (current !== null && depth < MAX_DEPTH) {
    if (seen.has(current)) break // cycle - stop rather than loop
    seen.add(current)
    chain.push(current)
    current = tree.parentOf.get(current) ?? null
    depth++
  }

  return chain
}

/**
 * Would pointing `userId` at `newManagerUserId` create a cycle?
 *
 * Checked BEFORE writing. Walks up from the proposed manager: if we reach the
 * user being re-parented, the edge would close a loop. Also rejects pointing
 * someone at themselves.
 *
 * Uses the CURRENT tree, which is correct - the proposed edge is the only one
 * that would change, and it is the one we are testing.
 */
export function wouldCreateCycle(
  tree: ReportingTree,
  userId: string,
  newManagerUserId: string | null,
): boolean {
  if (newManagerUserId === null) return false
  if (newManagerUserId === userId) return true

  const seen = new Set<string>()
  let current: string | null = newManagerUserId
  let depth = 0

  while (current !== null && depth < MAX_DEPTH) {
    if (current === userId) return true
    if (seen.has(current)) break // pre-existing cycle; not caused by this edge
    seen.add(current)
    current = tree.parentOf.get(current) ?? null
    depth++
  }

  return false
}

/** Direct reports only - used by the org chart's collapsible levels. */
export function directReportsOf(tree: ReportingTree, userId: string): string[] {
  return tree.childrenOf.get(userId) ?? []
}

/** Members whose manager was never set, excluding the owner. */
export function unassignedMembers(
  pairs: ReportingPair[],
  ownerUserId: string | null,
): string[] {
  return pairs
    .filter((p) => p.managerUserId === null && p.userId !== ownerUserId)
    .map((p) => p.userId)
}
