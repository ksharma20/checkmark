'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  Skeleton,
  Textarea,
} from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import type { UserNote } from '@/lib/db/queries/notes'
import {
  MAX_NOTE_CONTENT_LEN,
  MAX_NOTE_TITLE_LEN,
  NOTE_COLORS,
  type NoteColor,
} from '@/lib/space'
import { meSpace } from '@/locales/en/me-space'

/**
 * The Notes tab: a board of cards, and one modal that both creates and edits.
 *
 * `UserNote` is imported as a TYPE ONLY. `import type` is erased at compile
 * time, so the row shape crosses into this client component without dragging
 * `lib/db/index.ts`, better-sqlite3 and libSQL into the browser bundle - the
 * failure `src/lib/space.ts` exists to prevent, and the reason every runtime
 * value here (the colours, the lengths) comes from that pure module instead.
 *
 * THE EDITOR SAVES ON A BUTTON, NOT ON A DEBOUNCE. A note is free text a member
 * is mid-thought in, and the reminder-time field on `/me/settings` has already
 * paid for the alternative: a debounce cannot tell an interrupted edit from a
 * deliberate clear, and overlapping PATCHes let a failed one revert a value the
 * member had already replaced. An explicit Save is the same fix as that field's
 * commit-on-blur, spelled in the way a modal makes obvious.
 */

const t = meSpace.notes

interface Draft {
  /** null = this is a new note that has never been saved. */
  id: string | null
  title: string
  content: string
  pinned: boolean
  color: NoteColor
}

function draftFrom(note: UserNote): Draft {
  return {
    id: note.id,
    title: note.title ?? '',
    content: note.content,
    pinned: note.pinned === 1,
    color: (NOTE_COLORS as readonly string[]).includes(note.color)
      ? (note.color as NoteColor)
      : 'default',
  }
}

const EMPTY_DRAFT: Draft = { id: null, title: '', content: '', pinned: false, color: 'default' }

/** The card's one-line stand-in when a note has no title. */
function cardHeading(note: UserNote): string {
  const title = note.title?.trim()
  if (title) return title
  const firstLine = note.content.split('\n').find((line) => line.trim())
  return firstLine?.trim() || t.untitled
}

export default function NotesTab() {
  const { show } = useToast()
  const [notes, setNotes] = useState<UserNote[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<UserNote | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notes')
      if (!res.ok) throw new Error('load')
      const data = (await res.json()) as { notes: UserNote[] }
      setNotes(data.notes)
    } catch {
      setNotes([])
      show(meSpace.loadFailed, 'error')
    }
  }, [show])

  useEffect(() => { void load() }, [load])

  async function save() {
    if (!draft) return
    setSaving(true)
    setError(null)

    const body = {
      title: draft.title.trim() || null,
      content: draft.content,
      pinned: draft.pinned,
      color: draft.color,
    }

    try {
      const res = await fetch(draft.id ? `/api/notes/${draft.id}` : '/api/notes', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        // The route's own sentence, which is the one written for this refusal;
        // the generic fallback only covers a response that carries none.
        const payload = (await res.json().catch(() => null)) as { error?: string } | null
        setError(payload?.error ?? meSpace.saveFailed)
        return
      }
      setDraft(null)
      show(t.savedNote, 'success')
      await load()
    } catch {
      setError(meSpace.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/notes/${pendingDelete.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete')
      setPendingDelete(null)
      setDraft(null)
      show(t.deletedNote, 'success')
      await load()
    } catch {
      show(meSpace.saveFailed, 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (notes === null) {
    return (
      <div className="note-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={116} radius="var(--radius-lg)" />
        ))}
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="row-between">
        <span className="t-eyebrow">{meSpace.tabNotes}</span>
        <Button size="sm" onClick={() => { setError(null); setDraft(EMPTY_DRAFT) }}>
          {t.newAction}
        </Button>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          hint={t.emptyHint}
        />
      ) : (
        <div className="note-grid">
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              className="note-card pressable"
              data-color={note.color}
              onClick={() => { setError(null); setDraft(draftFrom(note)) }}
            >
              {note.pinned === 1 ? (
                <span className="note-pin" aria-label={t.pinnedBadge} title={t.pinnedBadge}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="17" x2="12" y2="22" />
                    <path d="M5 17h14l-1.5-4V5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v8z" />
                  </svg>
                </span>
              ) : null}
              <span className="note-card-title">{cardHeading(note)}</span>
              {note.content.trim() ? (
                <span className="note-card-body">{note.content.slice(0, 140)}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {/* The editor steps ASIDE for the confirm rather than sitting under it.
          Two live overlays means two Escape handlers and two focus traps, so one
          Escape would dismiss the confirm and throw the unsaved draft away with
          it. The draft stays in state, so cancelling the delete returns to the
          editor exactly as it was. */}
      <Modal
        open={draft !== null && pendingDelete === null}
        onClose={() => setDraft(null)}
        title={draft?.id ? t.editTitle : t.createTitle}
        maxWidth={560}
        footer={
          <>
            {draft?.id ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  const note = notes.find((n) => n.id === draft.id)
                  if (note) setPendingDelete(note)
                }}
              >
                {t.deleteAction}
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={() => setDraft(null)}>
              {t.closeAction}
            </Button>
            <Button size="sm" loading={saving} onClick={() => void save()}>
              {saving ? t.savingAction : t.saveAction}
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="stack-sm">
            <Field label={t.titleLabel} htmlFor="note-title">
              <Input
                id="note-title"
                value={draft.title}
                maxLength={MAX_NOTE_TITLE_LEN}
                placeholder={t.titlePlaceholder}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>

            <Field label={t.contentLabel} htmlFor="note-content">
              <Textarea
                id="note-content"
                rows={8}
                value={draft.content}
                maxLength={MAX_NOTE_CONTENT_LEN}
                placeholder={t.contentPlaceholder}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              />
            </Field>

            <fieldset className="swatch-row">
              <legend className="field-label">{t.colorLabel}</legend>
              {NOTE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`swatch${draft.color === color ? ' is-active' : ''}`}
                  data-color={color}
                  aria-pressed={draft.color === color}
                  aria-label={t.colorName[color] ?? color}
                  title={t.colorName[color] ?? color}
                  onClick={() => setDraft({ ...draft, color })}
                />
              ))}
            </fieldset>

            <div>
              <Button
                variant={draft.pinned ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={draft.pinned}
                onClick={() => setDraft({ ...draft, pinned: !draft.pinned })}
              >
                {draft.pinned ? t.pinnedAction : t.pinAction}
              </Button>
            </div>

            {error ? <p className="field-error" role="alert">{error}</p> : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        title={t.deleteTitle}
        body={t.deleteBody}
        confirmLabel={t.deleteConfirm}
        busyLabel={t.deleteBusy}
        cancelLabel={t.deleteCancel}
        loading={deleting}
      />
    </div>
  )
}
