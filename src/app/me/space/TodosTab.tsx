'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Select,
  Skeleton,
  TabBar,
  type Tab,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import type { TodoFilter, UserTodo } from '@/lib/db/queries/todos'
import { MAX_TODO_TEXT_LEN, TODO_PRIORITIES } from '@/lib/space'
import { meSpace } from '@/locales/en/me-space'
import type { FocusSeed } from './FocusTab'

/**
 * The To-dos tab: quick add, filters, a reorderable list, and a completed pile.
 *
 * REORDERING IS TWO BUTTONS, NOT A DRAG. HTML5 drag-and-drop is what the
 * original spec asked for, and it is unusable with a keyboard, unreliable under
 * a screen reader, and on a touch device competes with the scroll it sits
 * inside - this list lives in a 460px column on a phone. Move-up / move-down are
 * the accessible form of the same operation, they work with a thumb, and they
 * produce exactly the request a drop would: the whole new order, as a list of
 * ids, in one transactional POST.
 *
 * The reorder is OPTIMISTIC and then reconciled. The list is re-rendered in its
 * new order immediately - a button that takes a round trip to move a row reads
 * as broken - and the server's answer replaces it. A refusal reloads, so the
 * screen never keeps an order the database did not accept.
 */

const t = meSpace.todos

const FILTERS: Tab[] = [
  { key: 'all', label: t.filterAll },
  { key: 'today', label: t.filterToday },
  { key: 'pending', label: t.filterPending },
  { key: 'done', label: t.filterDone },
]

/** The browser's calendar day. There is no workspace here to take one from. */
function todayKey(): string {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function TodosTab({ onStartFocus }: { onStartFocus: (seed: FocusSeed) => void }) {
  const { show } = useToast()
  const [filter, setFilter] = useState<TodoFilter>('all')
  const [todos, setTodos] = useState<UserTodo[] | null>(null)
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState('none')
  const [adding, setAdding] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<UserTodo | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async (which: TodoFilter) => {
    try {
      const res = await fetch(`/api/todos?filter=${which}&today=${todayKey()}`)
      if (!res.ok) throw new Error('load')
      const data = (await res.json()) as { todos: UserTodo[] }
      setTodos(data.todos)
    } catch {
      setTodos([])
      show(meSpace.loadFailed, 'error')
    }
  }, [show])

  useEffect(() => { void load(filter) }, [filter, load])

  const open = useMemo(() => (todos ?? []).filter((todo) => todo.done === 0), [todos])
  const done = useMemo(() => (todos ?? []).filter((todo) => todo.done === 1), [todos])

  async function add() {
    const trimmed = text.trim()
    if (!trimmed) return
    setAdding(true)
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmed,
          due_date: due || null,
          priority,
        }),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        show(payload?.error ?? meSpace.saveFailed, 'error')
        return
      }
      setText('')
      setDue('')
      setPriority('none')
      show(t.addedNote, 'success')
      await load(filter)
    } catch {
      show(meSpace.saveFailed, 'error')
    } finally {
      setAdding(false)
    }
  }

  async function patch(todo: UserTodo, body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('patch')
      await load(filter)
    } catch {
      show(meSpace.saveFailed, 'error')
    }
  }

  /**
   * Move one open task one place, then send the WHOLE open order.
   *
   * Sending the whole list rather than the two rows that swapped is what makes
   * the write idempotent and self-correcting: the server writes position =
   * index, so an order that has drifted (a task added in another tab, a failed
   * earlier move) is repaired by the next move rather than compounded by it.
   */
  async function move(index: number, delta: number) {
    const next = [...open]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]

    setTodos([...next, ...done])

    try {
      const res = await fetch('/api/todos/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: next.map((todo) => todo.id) }),
      })
      if (!res.ok) throw new Error('reorder')
    } catch {
      show(meSpace.saveFailed, 'error')
      await load(filter)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/todos/${pendingDelete.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete')
      setPendingDelete(null)
      show(t.deletedNote, 'success')
      await load(filter)
    } catch {
      show(meSpace.saveFailed, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const today = todayKey()
  // Ordering only means something in a list the member arranged. The Done pile
  // is chronological and `today` is a filtered view of it, so the move buttons
  // would be promising a rearrangement the next load throws away.
  const reorderable = filter === 'all' || filter === 'pending'

  function row(todo: UserTodo, index: number) {
    const overdue = todo.done === 0 && todo.due_date !== null && todo.due_date < today
    const isToday = todo.due_date === today

    return (
      <li key={todo.id} className="todo-row" data-priority={todo.priority}>
        <div className="todo-line">
          <label className="todo-check">
            <input
              type="checkbox"
              checked={todo.done === 1}
              aria-label={todo.done === 1 ? t.untoggleLabel(todo.text) : t.toggleLabel(todo.text)}
              onChange={() => void patch(todo, { done: todo.done === 0 })}
            />
          </label>
          <span className={`todo-text${todo.done === 1 ? ' is-done' : ''}`}>{todo.text}</span>
        </div>

        <div className="todo-meta">
          {todo.due_date ? (
            <Chip tone={overdue ? 'none' : isToday ? 'partial' : 'leave'}>
              {overdue ? t.overdue : isToday ? t.dueToday : fmtDate(todo.due_date)}
            </Chip>
          ) : null}
          {todo.priority !== 'none' ? (
            <span className="t-muted">{t.priorityName[todo.priority] ?? todo.priority}</span>
          ) : null}

          <span className="todo-actions">
            {todo.done === 0 && reorderable ? (
              <>
                <IconButton
                  label={t.moveUpLabel(todo.text)}
                  disabled={index === 0}
                  onClick={() => void move(index, -1)}
                  icon={
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                  }
                />
                <IconButton
                  label={t.moveDownLabel(todo.text)}
                  disabled={index === open.length - 1}
                  onClick={() => void move(index, 1)}
                  icon={
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                  }
                />
              </>
            ) : null}
            {todo.done === 0 ? (
              <IconButton
                label={t.focusLabel(todo.text)}
                onClick={() => onStartFocus({ todoId: todo.id, label: todo.text })}
                icon={
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20" /></svg>
                }
              />
            ) : (
              <Button variant="ghost" size="sm" onClick={() => void patch(todo, { done: false })}>
                {t.restoreAction}
              </Button>
            )}
            <IconButton
              variant="decline"
              label={t.deleteLabel(todo.text)}
              onClick={() => setPendingDelete(todo)}
              icon={
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
              }
            />
          </span>
        </div>
      </li>
    )
  }

  return (
    <div className="stack">
      <div className="todo-add">
        <Input
          value={text}
          maxLength={MAX_TODO_TEXT_LEN}
          placeholder={t.addPlaceholder}
          aria-label={t.addPlaceholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add() } }}
        />
        <div className="todo-add-row">
          <Input
            type="date"
            value={due}
            aria-label={t.dueLabel}
            onChange={(e) => setDue(e.target.value)}
          />
          <Select
            value={priority}
            aria-label={t.priorityLabel}
            onChange={(e) => setPriority(e.target.value)}
            options={TODO_PRIORITIES.map((key) => ({
              value: key,
              label: t.priorityName[key] ?? key,
            }))}
          />
          <Button size="sm" loading={adding} disabled={!text.trim()} onClick={() => void add()}>
            {t.addAction}
          </Button>
        </div>
      </div>

      <TabBar
        tabs={FILTERS}
        active={filter}
        onChange={(key) => setFilter(key as TodoFilter)}
        className="space-tabbar"
      />

      {todos === null ? (
        <div className="stack-sm">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={72} radius="var(--radius-lg)" />
          ))}
        </div>
      ) : open.length === 0 && done.length === 0 ? (
        <EmptyState
          title={filter === 'today' ? t.emptyTodayTitle : filter === 'done' ? t.emptyDoneTitle : t.emptyTitle}
          hint={filter === 'today' ? t.emptyTodayHint : filter === 'done' ? t.emptyDoneHint : t.emptyHint}
        />
      ) : (
        <>
          <ul className="todo-list">{open.map(row)}</ul>

          {done.length > 0 ? (
            <div>
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={showCompleted}
                onClick={() => setShowCompleted((value) => !value)}
              >
                {t.completedHeading(done.length)}
              </Button>
              {showCompleted ? (
                <ul className="todo-list space-mt-10">{done.map((todo, i) => row(todo, i))}</ul>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        title={t.deleteTitle}
        body={t.deleteBody}
        note={t.deleteNote}
        confirmLabel={t.deleteConfirm}
        busyLabel={t.deleteBusy}
        cancelLabel={t.deleteCancel}
        loading={deleting}
      />
    </div>
  )
}
