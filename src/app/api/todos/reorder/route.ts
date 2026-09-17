import { NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { TodoOwnershipError, reorderTodos } from '@/lib/db/queries/todos'
import { MAX_REORDER_IDS } from '@/lib/space'
import { bad, readJsonObject, unauthorized } from '@/lib/space-api'
import { meSpace } from '@/locales/en/me-space'

/**
 * `POST /api/todos/reorder` - write a whole new ordering in one transaction.
 *
 * A static segment beside `[id]`, which Next resolves in favour of the literal,
 * so there is no ambiguity with `PATCH /api/todos/reorder`-shaped ids.
 *
 * The ordering is sent as a LIST OF IDS rather than as a list of
 * `{ id, order }` pairs, and that is the contract doing work: a position is
 * then the index, so the client cannot send two tasks claiming position 3, or a
 * negative one, or skip 5. There is no invalid ordering to validate because
 * none can be expressed.
 *
 * OWNERSHIP IS PROVED BY THE WRITE, NOT BY A PRE-READ. `reorderTodos()` puts
 * `AND user_id = ?` on every UPDATE inside one transaction; a row that is not
 * the caller's matches nothing, the row count then disagrees with the list
 * length, and the transaction is thrown away as `TodoOwnershipError`. Checking
 * first and writing second would be two statements with a gap in between, and
 * would leak the same existence oracle a 403 does.
 */

const t = meSpace.todos

export async function POST(request: Request) {
  const user = await getServerUser()
  if (!user) return unauthorized()

  const parsed = await readJsonObject(request)
  if (!parsed.ok) return parsed.response

  const raw = parsed.body.orderedIds
  if (!Array.isArray(raw)) return bad(meSpace.saveFailed, 'INVALID_BODY')
  if (raw.length > MAX_REORDER_IDS) {
    return bad(t.errorTooManyIds(MAX_REORDER_IDS), 'TOO_MANY_IDS')
  }
  if (!raw.every((id): id is string => typeof id === 'string' && id.length > 0)) {
    return bad(meSpace.saveFailed, 'INVALID_BODY')
  }

  // A duplicate id would make `changed` smaller than the list length for an
  // entirely legitimate-looking request, so it is refused by name rather than
  // left to be reported as "not yours".
  if (new Set(raw).size !== raw.length) return bad(meSpace.saveFailed, 'DUPLICATE_IDS')

  try {
    const changed = await reorderTodos(user.userId, raw)
    return NextResponse.json({ ok: true, reordered: changed })
  } catch (err) {
    if (err instanceof TodoOwnershipError) return bad(t.errorBadOrder, 'INVALID_ORDER')
    throw err
  }
}
