'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Button, Card, Chip, ConfirmDialog, Divider, Field, Input, Skeleton } from '@/components/ui'
import { en } from '@/locales/en'
import { meSettings } from '@/locales/en/me-settings'
/**
 * The ladder's bounds, imported from the PURE module rather than from the query
 * file that owns the table. This is a client component: a runtime import from
 * `src/lib/db/**` would pull better-sqlite3 and libSQL into the browser bundle
 * and fail the build with a long `Can't resolve 'fs'` trace that names none of
 * that. `src/lib/presence-ladder.ts` exists precisely so this import is safe.
 */
import {
  DEFAULT_PRESENCE_PREFS,
  MAX_AUTO_CHECKOUT_H,
  MAX_RUNG_H,
  MIN_AUTO_CHECKOUT_H,
  MIN_REPEAT_H,
  MIN_RUNG_H,
  type MemberPresencePrefs,
} from '@/lib/presence-ladder'
import { useWorkspaceScope } from '../workspace-scope'

const t = meSettings.settings
const n = t.notifications

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="t-h2" style={{ color: 'var(--navy)', margin: '0 0 14px' }}>{title}</h2>
      {children}
    </Card>
  )
}

type Status = { text: string; ok: boolean } | null

function StatusMsg({ msg }: { msg: Status }) {
  if (!msg) return null
  return (
    <p
      role="status"
      className={msg.ok ? 'field-hint' : 'field-error'}
      style={{ color: msg.ok ? 'var(--teal)' : undefined }}
    >
      {msg.text}
    </p>
  )
}

/** Read-only "label above value" pair, used where a field isn't being edited. */
function ReadonlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <p className="t-secondary" style={{ margin: 0 }}>{value}</p>
    </div>
  )
}

// ─── Profile section ──────────────────────────────────────────────────────────

function ProfileSection({ initialName, email }: { initialName: string; email: string }) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [savedName, setSavedName] = useState(initialName)

  useEffect(() => {
    setName(initialName)
    setSavedName(initialName)
  }, [initialName])

  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  async function handleSave() {
    setLoading(true); setStatus(null)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { setSavedName(name); setIsEditing(false); setStatus({ text: t.profile.saved, ok: true }) }
      else { setStatus({ text: data.error ?? t.profile.saveError, ok: false }) }
    } finally { setLoading(false) }
  }

  function handleCancel() { setName(savedName); setIsEditing(false); setStatus(null) }

  return (
    <SectionCard title={t.profile.title}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
          <ReadonlyValue label={t.profile.emailLabel} value={email} />

          {isEditing ? (
            <Field label={t.profile.nameLabel} htmlFor="profile-name">
              <Input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
          ) : (
            <ReadonlyValue label={t.profile.nameLabel} value={savedName || t.profile.nameEmpty} />
          )}
        </div>

        {!isEditing && (
          <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
            {t.profile.edit}
          </Button>
        )}
      </div>

      {isEditing && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <Button loading={loading} onClick={handleSave}>{t.profile.save}</Button>
          <Button variant="secondary" onClick={handleCancel}>{t.profile.cancel}</Button>
        </div>
      )}

      <StatusMsg msg={status} />
    </SectionCard>
  )
}

// ─── Email change section ──────────────────────────────────────────────────────

function EmailSection() {
  const [step, setStep] = useState<'idle' | 'otp'>('idle')
  const [newEmail, setNewEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  async function requestOtp() {
    setStatus(null)
    setLoading(true)
    try {
      const res = await fetch('/api/me/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail }),
      })
      const data = await res.json()
      if (res.ok) {
        setStep('otp')
        setStatus({ text: t.email.codeSent(newEmail), ok: true })
      } else {
        setStatus({ text: data.error || t.email.sendError, ok: false })
      }
    } finally {
      setLoading(false)
    }
  }

  async function confirmChange() {
    setStatus(null)
    setLoading(true)
    try {
      const res = await fetch('/api/me/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail, code }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus({ text: t.email.updated, ok: true })
        setTimeout(() => { window.location.href = '/login' }, 1500)
      } else {
        setStatus({ text: data.error || t.email.verifyError, ok: false })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionCard title={t.email.title}>
      <div className="stack">
        <Field label={t.email.newLabel} htmlFor="new-email">
          <Input
            id="new-email"
            type="email"
            value={newEmail}
            placeholder={t.email.newPlaceholder}
            onChange={(e) => { setNewEmail(e.target.value); setStep('idle'); setStatus(null) }}
          />
        </Field>

        {step === 'idle' && (
          <div>
            <Button loading={loading} onClick={requestOtp}>{t.email.sendCode}</Button>
          </div>
        )}

        {step === 'otp' && (
          <>
            <Field label={t.email.codeLabel} htmlFor="email-otp">
              <Input
                id="email-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                placeholder={t.email.codePlaceholder}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button loading={loading} onClick={confirmChange}>{t.email.confirm}</Button>
              <Button
                variant="secondary"
                onClick={() => { setStep('idle'); setCode(''); setStatus(null) }}
              >
                {t.email.resend}
              </Button>
            </div>
          </>
        )}
      </div>

      <StatusMsg msg={status} />
    </SectionCard>
  )
}

// ─── Password section ─────────────────────────────────────────────────────────

function PasswordSection() {
  const [isEditing, setIsEditing] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  function handleCancel() { setCurrent(''); setNext(''); setConfirm(''); setIsEditing(false); setStatus(null) }

  async function handleSave() {
    if (next.length < 8) { setStatus({ text: t.password.tooShort, ok: false }); return }
    if (next !== confirm) { setStatus({ text: t.password.mismatch, ok: false }); return }
    setLoading(true); setStatus(null)
    try {
      const res = await fetch('/api/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { handleCancel(); setStatus({ text: t.password.updated, ok: true }) }
      else { setStatus({ text: data.error ?? t.password.saveError, ok: false }) }
    } finally { setLoading(false) }
  }

  return (
    <SectionCard title={t.password.title}>
      {!isEditing && (
        <div className="row-between">
          <p className="t-secondary" style={{ margin: 0 }}>{t.password.masked}</p>
          <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
            {t.password.edit}
          </Button>
        </div>
      )}

      {isEditing && (
        <div className="stack">
          <Field label={t.password.currentLabel} htmlFor="pw-current">
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label={t.password.newLabel} htmlFor="pw-new">
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label={t.password.confirmLabel} htmlFor="pw-confirm">
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button loading={loading} onClick={handleSave}>{t.password.save}</Button>
            <Button variant="secondary" onClick={handleCancel}>{t.password.cancel}</Button>
          </div>
        </div>
      )}

      <StatusMsg msg={status} />
    </SectionCard>
  )
}

// ─── API Tokens section ───────────────────────────────────────────────────────

interface ApiToken {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
}

function TokensSection() {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [pendingRevoke, setPendingRevoke] = useState<ApiToken | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>(null)

  useEffect(() => {
    fetch('/api/tokens')
      .then((r) => r.json())
      .then((d) => setTokens(d.tokens ?? []))
      .catch(() => {})
  }, [])

  async function create() {
    if (!newName.trim()) return
    setCreating(true)
    setStatus(null)
    setNewToken(null)
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setTokens((prev) => [data.token, ...prev])
        setNewToken(data.plain_token)
        setNewName('')
      } else {
        setStatus({ text: data.error || t.tokens.createError, ok: false })
      }
    } finally {
      setCreating(false)
    }
  }

  async function confirmRevoke() {
    if (!pendingRevoke) return
    const id = pendingRevoke.id
    setRevoking(true)
    setRevokeError(null)
    try {
      const res = await fetch(`/api/tokens/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTokens((prev) => prev.filter((token) => token.id !== id))
        setPendingRevoke(null)
      } else {
        setRevokeError(t.tokens.revokeError)
      }
    } catch {
      setRevokeError(t.tokens.revokeError)
    } finally {
      setRevoking(false)
    }
  }

  return (
    <SectionCard title={t.tokens.title}>
      <p className="t-secondary" style={{ margin: '0 0 14px' }}>{t.tokens.intro}</p>

      {/* The plaintext token, shown exactly once. */}
      {newToken && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--teal) 10%, transparent)',
            border: '1px solid var(--teal)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            marginBottom: '16px',
          }}
        >
          <p className="t-muted" style={{ color: 'var(--teal)', margin: '0 0 6px' }}>
            {t.tokens.revealWarning}
          </p>
          <code
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-primary)',
              wordBreak: 'break-all',
            }}
          >
            {newToken}
          </code>
        </div>
      )}

      <Field label={t.tokens.nameLabel} htmlFor="token-name">
        <div style={{ display: 'flex', gap: '8px' }}>
          <Input
            id="token-name"
            type="text"
            value={newName}
            placeholder={t.tokens.namePlaceholder}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create() }}
          />
          <Button loading={creating} disabled={!newName.trim()} onClick={create}>
            {t.tokens.create}
          </Button>
        </div>
      </Field>

      <StatusMsg msg={status} />

      {tokens.length === 0 ? (
        <p className="t-muted" style={{ margin: '14px 0 0' }}>{t.tokens.empty}</p>
      ) : (
        <>
          <Divider />
          <div className="stack-sm">
            {tokens.map((token) => (
              <div key={token.id} className="row-between">
                <div style={{ minWidth: 0 }}>
                  <p className="t-secondary" style={{ margin: 0, fontWeight: 600 }}>{token.name}</p>
                  <p
                    className="t-muted"
                    style={{ margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                  >
                    {t.tokens.created(new Date(token.created_at).toLocaleDateString())}
                    {token.last_used_at &&
                      ` · ${t.tokens.lastUsed(new Date(token.last_used_at).toLocaleDateString())}`}
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => { setRevokeError(null); setPendingRevoke(token) }}
                >
                  {t.tokens.revoke}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={pendingRevoke !== null}
        onClose={() => { setPendingRevoke(null); setRevokeError(null) }}
        onConfirm={() => void confirmRevoke()}
        title={t.tokens.revokeTitle}
        body={t.tokens.revokeConfirm}
        confirmLabel={t.tokens.revokeConfirmAction}
        busyLabel={t.tokens.revokeBusy}
        cancelLabel={t.tokens.revokeCancel}
        loading={revoking}
        error={revokeError}
      />
    </SectionCard>
  )
}

// ─── Notifications section ────────────────────────────────────────────────────

/**
 * Two schedules and a device registration. No category switches.
 *
 * Notification control is split by WHO the message is for. The two categories
 * left in the catalogue - `approvals` and `announcements` - are the
 * organisation talking to its members, configured on
 * `/ws/[slug]/settings › Notifications`, and neither is `memberMutable`: a
 * person is entitled to hear what happened to a request they filed, and an
 * announcement is the one class that cannot afford to be missed. So there is
 * nothing on this screen to toggle and no locked row to render either - a
 * disabled switch only invites a member to throw it and be told no.
 *
 * What IS here is the nudges addressed to one person about their own working
 * day, and they are SCHEDULES rather than categories. Having a value set is the
 * opt-in; there is no separate on/off flag anywhere in the feature, because two
 * representations of "is this live" drift and nothing can then arbitrate
 * between them.
 */

type Load = 'loading' | 'ready' | 'error'

const rt = n.reminderTimes
const sl = n.sessionLadder

/** The same refusal panel for both blocks - neither paints a form it cannot fill. */
function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert">
      <p className="field-error mt-0 mb-12">{n.loadFailed}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {n.loadFailedRetry}
      </Button>
    </div>
  )
}

function GroupHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <p className="switch-row-title mb-8">{title}</p>
      <p className="t-muted mb-12">{hint}</p>
    </>
  )
}

// ── Reminder times · per workspace ────────────────────────────────────────────

type ReminderKind = 'checkinAt' | 'checkoutAt'
type ReminderTimes = Record<ReminderKind, string>

const REMINDER_KINDS: readonly ReminderKind[] = ['checkinAt', 'checkoutAt']

/**
 * What `<input type="time">` yields on a browser that implements it: 'HH:MM',
 * or '' when cleared. Checked anyway, because Firefox on some platforms and
 * older Safari fall back to a plain text box and will happily hand over
 * '9am' - which the route would answer with a 400 the member cannot read.
 */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const EMPTY_TIMES: ReminderTimes = { checkinAt: '', checkoutAt: '' }

/** The contract's nullable time, as the '' this form uses for "off". */
function readTime(value: unknown): string {
  return typeof value === 'string' && TIME_RE.test(value) ? value : ''
}

/**
 * One reminder time, its stated on/off state, and the workspace's old value.
 *
 * TWO values arrive, and the split is the whole point of this component:
 * `value` is the DRAFT sitting in the box, `saved` is what the server last
 * confirmed. The badge, the Turn off button and the suggestion all read
 * `saved`, because they describe what will actually be delivered - and during
 * an edit the box and the schedule genuinely disagree. Letting the box speak
 * for the schedule is how an empty field mid-retype comes to look like a
 * reminder that has been turned off.
 */
function TimeField({
  id,
  label,
  hint,
  value,
  saved,
  suggestion,
  onEdit,
  onBlur,
  onCommit,
}: {
  id: string
  label: string
  hint: string
  /** What is in the box right now, saved or not. */
  value: string
  /** What the server last confirmed, which is what is actually scheduled. */
  saved: string
  /** The workspace's legacy time, or '' when it has none. */
  suggestion: string
  /** Draft only - never a network write. */
  onEdit: (next: string) => void
  /** The member has left the field: commit whatever they left in it. */
  onBlur: () => void
  /** A deliberate one-tap choice, committed immediately without waiting for blur. */
  onCommit: (next: string) => void
}) {
  const on = saved !== ''
  const dirty = value !== saved
  return (
    <Field label={label} htmlFor={id} hint={hint} className="field-row-item">
      <Input
        id={id}
        type="time"
        value={value}
        onChange={(e) => onEdit(e.target.value)}
        onBlur={onBlur}
        /*
          Enter is "I am done with this field" on a block that has no submit
          button. It deliberately does not write directly - it blurs, and blur
          is the single commit path, so there is one place a PATCH can start
          from rather than two that can disagree.
        */
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
        }}
      />

      {/* "Empty means off" is stated rather than inferred from an empty box. */}
      <div className="field-state-row">
        <Chip tone={on ? 'verified' : 'leave'}>{on ? rt.onBadge(saved) : rt.offBadge}</Chip>
        {on && (
          <Button
            variant="ghost"
            size="sm"
            aria-label={rt.clearAria(label)}
            onClick={() => onCommit('')}
          >
            {rt.clearButton}
          </Button>
        )}
      </div>

      {/* The badge is telling the truth about the schedule while the box shows
          something else; that gap is named rather than left to look like a bug. */}
      {dirty && <p className="field-hint">{rt.pendingHint}</p>}

      {/*
        A SUGGESTION, never a pre-filled value. The workspace's old
        admin-configured time is offered only where the member has none of
        their own, and it is offered - not adopted. Silently seeding the input
        with it would tell somebody they are already covered when nothing is
        being sent on their account, and pressing Save would then opt every
        member back into the reminder this change exists to make opt-in.

        Withdrawn the moment the box holds a draft: offering a starting value to
        somebody who has already typed one is noise.
      */}
      {!on && !dirty && suggestion !== '' && (
        <>
          <p className="field-hint">{rt.suggestion(suggestion)}</p>
          <div className="field-state-row">
            <Button variant="secondary" size="sm" onClick={() => onCommit(suggestion)}>
              {rt.suggestionApply}
            </Button>
          </div>
        </>
      )}
    </Field>
  )
}

/**
 * The per-workspace half. Scoped to the active workspace from the top-bar pill -
 * there is deliberately no picker here and the workspace is deliberately not
 * named: the pill above already answers "which one", and repeating it inside
 * content it already scopes is noise.
 *
 * Each time commits ON BLUR, and there is still no Save button and no on/off
 * switch beside either field: the stored value IS the switch (invariant 29), so
 * the only question this block ever has to answer is WHEN a typed value counts
 * as the member's answer. Blur is that moment. See `edit` below for why a
 * debounce is not, and `commit` for why a response that arrives late is ignored
 * rather than believed.
 */
function ReminderTimesBlock() {
  const { slug } = useWorkspaceScope()
  const [times, setTimes] = useState<ReminderTimes>(EMPTY_TIMES)
  const [timezone, setTimezone] = useState('')
  const [suggestion, setSuggestion] = useState<ReminderTimes>(EMPTY_TIMES)
  /**
   * Tri-state, and it matters more here than on a switchboard of toggles.
   *
   * The initial client state is "no times set", which paints both fields empty -
   * i.e. OFF. Rendering before the load resolves would therefore show a member
   * the exact opposite of a schedule they had already saved, and because this
   * block commits each field on blur, one edit to the other field would write that
   * phantom "off" over the real value. So the form is withheld until the
   * server's answer is in hand.
   */
  const [load, setLoad] = useState<Load>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [status, setStatus] = useState<Status>(null)

  /**
   * What the server last confirmed. Mirrored into state because the badge and
   * the Turn off button render from it - they describe the SCHEDULE, not the
   * box - and held in a ref as well because the commit path has to read the
   * current confirmed value without re-creating itself on every change.
   */
  const [saved, setSaved] = useState<ReminderTimes>(EMPTY_TIMES)
  const savedRef = useRef<ReminderTimes>(EMPTY_TIMES)

  /**
   * The draft a field is holding that has not been sent yet, per kind, or
   * `null` for "nothing outstanding".
   *
   * This is what makes an edit survive a navigation that never blurs the input
   * - a tab close, a PWA backgrounding, this block unmounting because the
   * workspace pill changed. It is also what stops a failed PATCH reverting the
   * box over a NEWER value the member has since typed.
   */
  const pending = useRef<Record<ReminderKind, string | null>>({ checkinAt: null, checkoutAt: null })

  /**
   * A per-kind request counter, and the answer to out-of-order responses.
   *
   * Overlapping PATCHes for one field resolve in whatever order the network
   * hands them back, so "the response that arrived last" and "the request that
   * was sent last" are different things. Every commit takes a ticket; a
   * response whose ticket is no longer the current one is dropped entirely -
   * it writes no confirmed value, no status and no revert. Only the newest
   * request for a field is allowed to decide anything about it.
   */
  const seq = useRef<Record<ReminderKind, number>>({ checkinAt: 0, checkoutAt: 0 })

  /**
   * The value of the newest commit for each field - stored if it has landed,
   * still in flight if it has not. This, not `savedRef`, is what "nothing to
   * do" is measured against.
   *
   * The difference bites in one sequence: with 09:00 stored, type 10:00, leave
   * the field, then come back and put 09:00 in again before the first PATCH
   * has answered. Measured against `savedRef` the second commit looks like a
   * no-op and is skipped - and the 10:00 already in flight then lands as the
   * final state, which is the value the member just took back.
   */
  const latest = useRef<ReminderTimes>(EMPTY_TIMES)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoad('loading')
    fetch(`/api/me/ws/${slug}/reminder-times`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`reminder-times responded ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const next: ReminderTimes = {
          checkinAt: readTime(data?.checkinAt),
          checkoutAt: readTime(data?.checkoutAt),
        }
        // A load is the newest word on both fields, so it retires every
        // outstanding ticket: a PATCH still in flight when this landed belongs
        // to an older question (often to the previous workspace) and must not
        // get to overwrite the answer.
        seq.current = { checkinAt: seq.current.checkinAt + 1, checkoutAt: seq.current.checkoutAt + 1 }
        pending.current = { checkinAt: null, checkoutAt: null }
        savedRef.current = next
        latest.current = next
        setSaved(next)
        setTimes(next)
        setTimezone(typeof data?.timezone === 'string' ? data.timezone : '')
        setSuggestion({
          checkinAt: readTime(data?.workspaceSuggestion?.checkinAt),
          checkoutAt: readTime(data?.workspaceSuggestion?.checkoutAt),
        })
        setLoad('ready')
      })
      .catch(() => { if (!cancelled) setLoad('error') })
    return () => { cancelled = true }
  }, [slug, reloadKey])

  /**
   * Write one time. The ONLY network path in this block.
   *
   * PATCH carries only the field that changed - the contract reads an omitted
   * key as "leave it alone" - so a failure on one time can never disturb the
   * other.
   *
   * `keepalive` because the flush below fires from `pagehide` and from this
   * component's unmount, where an ordinary fetch is cancelled with the
   * document. The body is two short strings, nowhere near the 64 KB ceiling
   * that option carries.
   */
  const commit = useCallback(
    async (kind: ReminderKind, next: string) => {
      // Whatever happens from here, this draft is no longer outstanding.
      pending.current[kind] = null
      if (!slug) return
      if (next !== '' && !TIME_RE.test(next)) {
        setStatus({ text: rt.invalidTime, ok: false })
        return
      }
      if (next === latest.current[kind]) return

      const ticket = ++seq.current[kind]
      latest.current = { ...latest.current, [kind]: next }
      setStatus({ text: rt.saving, ok: true })
      try {
        const res = await fetch(`/api/me/ws/${slug}/reminder-times`, {
          method: 'PATCH',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [kind]: next === '' ? null : next }),
        })
        if (!res.ok) throw new Error(`PATCH reminder-times responded ${res.status}`)
        // Superseded while in flight: a newer request for this field is the one
        // entitled to say what is stored. Saying nothing is the correct answer.
        if (ticket !== seq.current[kind]) return
        savedRef.current = { ...savedRef.current, [kind]: next }
        setSaved(savedRef.current)
        // The box is NOT re-set from the response. The member may have typed on
        // since; the confirmed value belongs to the badge, not to the input.
        setStatus({ text: next === '' ? rt.savedOff : rt.saved, ok: true })
      } catch {
        if (ticket !== seq.current[kind]) return
        // Nothing landed, so the newest intent is the stored value again -
        // otherwise re-committing the same time would be skipped as a no-op and
        // the member could never retry it.
        latest.current = { ...latest.current, [kind]: savedRef.current[kind] }
        // Put the box back to what is actually stored - but only if the member
        // has not moved on. Reverting over a newer draft is how a failed save
        // resurrects a value they had already replaced.
        if (pending.current[kind] === null) {
          setTimes((prev) => ({ ...prev, [kind]: savedRef.current[kind] }))
        }
        setStatus({ text: rt.saveError, ok: false })
      }
    },
    [slug],
  )

  /**
   * Typing. Draft only - deliberately no network, no timer.
   *
   * A `<input type="time">` hands over a complete, valid-looking value on every
   * segment keystroke, and is transiently EMPTY the moment somebody clears it
   * to retype. Empty is not a neutral intermediate here: it is the value that
   * turns the reminder off. A debounce only narrows the window in which a
   * half-finished edit is mistaken for a deliberate silence - it does not close
   * it, because "cleared it, then got interrupted" and "cleared it to turn it
   * off" are the same keystrokes and differ only in what happens next.
   *
   * Leaving the field is what happens next. So blur, not a timer, is the
   * commit: it is the member saying they are done with this box, and it is the
   * one signal that actually separates the two intentions.
   */
  const edit = useCallback((kind: ReminderKind, next: string) => {
    pending.current[kind] = next
    setTimes((prev) => ({ ...prev, [kind]: next }))
  }, [])

  /**
   * Send anything a field is still holding.
   *
   * Blur covers every ordinary way of leaving a field, including tapping a link
   * or a bottom-nav tab - the pointer moves focus first, so the commit is
   * already away before the route changes. This is the rest: the tab being
   * closed, the PWA being backgrounded, and this block unmounting because the
   * workspace pill moved. An edit is never lost for want of a blur.
   */
  const flushPending = useCallback(() => {
    for (const kind of REMINDER_KINDS) {
      const draft = pending.current[kind]
      if (draft !== null) void commit(kind, draft)
    }
  }, [commit])

  useEffect(() => {
    // `pagehide` rather than `beforeunload`: it is the one that fires on iOS
    // when a PWA is backgrounded, which is where a phone edit actually goes.
    const onHide = () => flushPending()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      // The cleanup runs with the closure that captured the OUTGOING slug, so a
      // workspace switch flushes to the workspace the member was editing.
      flushPending()
    }
  }, [flushPending])

  let body: React.ReactNode
  if (!slug) {
    body = <p className="t-muted">{n.noWorkspace}</p>
  } else if (load === 'loading') {
    // Two blocks sharing `.field-row` exactly as the two real fields do, so the
    // row does not reflow when they resolve.
    body = (
      <div className="field-row">
        <Skeleton className="field-row-item" height={104} radius="var(--radius-md)" />
        <Skeleton className="field-row-item" height={104} radius="var(--radius-md)" />
      </div>
    )
  } else if (load === 'error') {
    body = <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
  } else {
    body = (
      <>
        <div className="field-row">
          <TimeField
            id={rt.fieldIds.checkin}
            label={rt.checkinLabel}
            hint={rt.checkinHint}
            value={times.checkinAt}
            saved={saved.checkinAt}
            suggestion={suggestion.checkinAt}
            onEdit={(next) => edit('checkinAt', next)}
            onBlur={() => void commit('checkinAt', times.checkinAt)}
            onCommit={(next) => { edit('checkinAt', next); void commit('checkinAt', next) }}
          />
          <TimeField
            id={rt.fieldIds.checkout}
            label={rt.checkoutLabel}
            hint={rt.checkoutHint}
            value={times.checkoutAt}
            saved={saved.checkoutAt}
            suggestion={suggestion.checkoutAt}
            onEdit={(next) => edit('checkoutAt', next)}
            onBlur={() => void commit('checkoutAt', times.checkoutAt)}
            onCommit={(next) => { edit('checkoutAt', next); void commit('checkoutAt', next) }}
          />
        </div>

        {/* The workspace's timezone, not the phone's - invisible until somebody
            travels and is reminded at 04:00, so it is said up front. */}
        {timezone !== '' && <p className="field-hint">{rt.timezoneNote(timezone)}</p>}
        <p className="field-hint">{rt.approximateNote}</p>

        <StatusMsg msg={status} />
      </>
    )
  }

  return (
    <>
      <GroupHeading title={rt.title} hint={rt.hint} />
      {body}
    </>
  )
}

// ── Session ladder · account level ────────────────────────────────────────────

type LadderField = 'halfDay' | 'fullDay' | 'repeat' | 'autoCheckout'
type LadderDraft = Record<LadderField, string>
type LadderErrors = Partial<Record<LadderField, string>>

/**
 * The server's refusal codes, as the member-facing sentence for each.
 *
 * The client mirrors every one of these rules below, so in practice none of
 * them should arrive - but the server is the authority, and a save it rejects
 * has to say why rather than shrug. `OUT_OF_RANGE` cannot name its field over
 * the wire, so it renders the rung range; `INVALID_BODY` and anything
 * unrecognised fall through to the generic failure.
 */
const SERVER_ERROR: Record<string, string> = {
  OUT_OF_RANGE: sl.errorRange(MIN_RUNG_H, MAX_RUNG_H),
  NOT_ASCENDING: sl.errorAscending,
  REPEAT_NEEDS_FULL_DAY: sl.errorRepeatNeedsFullDay,
  AFTER_CLOSE: sl.errorAfterClose,
}

const EMPTY_DRAFT: LadderDraft = { halfDay: '', fullDay: '', repeat: '', autoCheckout: '' }

/** `''` → null (this rung is off); a number → itself; anything else → undefined. */
function parseRung(raw: string): number | null | undefined {
  const value = raw.trim()
  if (value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

function readHours(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** GET/PATCH both answer with the full object; this is the defensive reader. */
function readPrefs(data: unknown): MemberPresencePrefs {
  const d = (data ?? {}) as Record<string, unknown>
  return {
    halfDayAfterH: readHours(d.halfDayAfterH),
    fullDayAfterH: readHours(d.fullDayAfterH),
    repeatEveryH: readHours(d.repeatEveryH),
    // Never null in the contract, and never null here either - an open session
    // has to close or the day's attendance is computed from a row that never
    // ends. The default is the module's, not a literal invented at this call.
    autoCheckoutAfterH: readHours(d.autoCheckoutAfterH) ?? DEFAULT_PRESENCE_PREFS.autoCheckoutAfterH,
  }
}

function draftFrom(prefs: MemberPresencePrefs): LadderDraft {
  return {
    halfDay: prefs.halfDayAfterH === null ? '' : String(prefs.halfDayAfterH),
    fullDay: prefs.fullDayAfterH === null ? '' : String(prefs.fullDayAfterH),
    repeat: prefs.repeatEveryH === null ? '' : String(prefs.repeatEveryH),
    autoCheckout: String(prefs.autoCheckoutAfterH),
  }
}

/** The draft as prefs, or null when any field is not a number this form can send. */
function prefsFromDraft(draft: LadderDraft): MemberPresencePrefs | null {
  const half = parseRung(draft.halfDay)
  const full = parseRung(draft.fullDay)
  const repeat = parseRung(draft.repeat)
  const close = parseRung(draft.autoCheckout)
  if (half === undefined || full === undefined || repeat === undefined) return null
  if (typeof close !== 'number') return null
  return {
    halfDayAfterH: half,
    fullDayAfterH: full,
    repeatEveryH: repeat,
    autoCheckoutAfterH: close,
  }
}

/**
 * The server's validation, mirrored - so the member gets the answer before a
 * round trip rather than after one. The bounds are the constants from
 * `src/lib/presence-ladder.ts`, which the route validates against too;
 * restating a number here is how a form ends up promising a range the route
 * refuses.
 *
 * This is a mirror, not the authority. A save is still sent, still checked, and
 * a code that comes back is still rendered - see `SERVER_ERROR`.
 */
function validateDraft(draft: LadderDraft): LadderErrors {
  const errors: LadderErrors = {}
  const half = parseRung(draft.halfDay)
  const full = parseRung(draft.fullDay)
  const repeat = parseRung(draft.repeat)
  const close = parseRung(draft.autoCheckout)

  const rungs: [LadderField, number | null | undefined][] = [
    ['halfDay', half],
    ['fullDay', full],
  ]
  for (const [field, value] of rungs) {
    if (value === undefined || (value !== null && (value < MIN_RUNG_H || value > MAX_RUNG_H))) {
      errors[field] = sl.errorRange(MIN_RUNG_H, MAX_RUNG_H)
    }
  }

  // No upper bound mirrored for the repeat - the module names a floor and no
  // ceiling, and inventing one here is exactly the drift the comment above
  // warns about. An over-long interval comes back as OUT_OF_RANGE.
  if (repeat === undefined || (repeat !== null && repeat < MIN_REPEAT_H)) {
    errors.repeat = sl.errorRepeatRange(MIN_REPEAT_H)
  }

  if (
    typeof close !== 'number' ||
    close < MIN_AUTO_CHECKOUT_H ||
    close > MAX_AUTO_CHECKOUT_H
  ) {
    errors.autoCheckout = sl.errorAutoCheckoutRange(MIN_AUTO_CHECKOUT_H, MAX_AUTO_CHECKOUT_H)
  }

  if (!errors.halfDay && !errors.fullDay && typeof half === 'number' && typeof full === 'number' && full <= half) {
    errors.fullDay = sl.errorAscending
  }

  if (!errors.repeat && typeof repeat === 'number' && full === null) {
    errors.repeat = sl.errorRepeatNeedsFullDay
  }

  // A rung at or past the close would never arrive - the session is already
  // shut by then, and one landing exactly on it would be delivered alongside
  // the auto-checkout notice.
  if (typeof close === 'number') {
    if (!errors.halfDay && typeof half === 'number' && half >= close) errors.halfDay = sl.errorAfterClose
    if (!errors.fullDay && typeof full === 'number' && full >= close) errors.fullDay = sl.errorAfterClose
  }

  return errors
}

/** One hour count, with its unit, its error and - for a rung - its off switch. */
function HoursField({
  id,
  label,
  hint,
  error,
  value,
  min,
  max,
  clearable,
  onChange,
}: {
  id: string
  label: string
  hint: string
  error?: string
  value: string
  min: number
  max: number
  /** Auto-checkout is the one field with no off state - see its hint. */
  clearable: boolean
  onChange: (next: string) => void
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} className="field-row-item">
      <div className="input-affix">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.5"
          min={min}
          max={max}
          placeholder={clearable ? sl.offPlaceholder : undefined}
          value={value}
          invalid={Boolean(error)}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="t-muted">{sl.unitSuffix}</span>
      </div>
      {clearable && value !== '' && (
        <div className="field-state-row">
          <Button
            variant="ghost"
            size="sm"
            aria-label={sl.clearAria(label)}
            onClick={() => onChange('')}
          >
            {sl.clearButton}
          </Button>
        </div>
      )}
    </Field>
  )
}

/**
 * The account half: the four numbers in `member_presence_prefs`.
 *
 * No slug, and that follows from the data rather than from a preference -
 * `presence_events` has no `workspace_id` and deliberately never will, so a
 * member of two workspaces has ONE check-in session and there is no workspace
 * to key these on.
 *
 * Saved with a button rather than on change, unlike the reminder times above.
 * These four are interdependent - ascending, a repeat that needs a full-day
 * mark, nothing at or past the close - and a number input emits a value on
 * every keystroke, so committing as you type would send a stream of states the
 * member never meant and reject most of them.
 */
function SessionLadder() {
  const [prefs, setPrefs] = useState<MemberPresencePrefs>(DEFAULT_PRESENCE_PREFS)
  const [draft, setDraft] = useState<LadderDraft>(EMPTY_DRAFT)
  const [errors, setErrors] = useState<LadderErrors>({})
  /** Errors are withheld until a save is attempted - typing "1" on the way to
      "10" is not a mistake to shout about. The one exception is below. */
  const [touched, setTouched] = useState(false)
  /**
   * Same tri-state, same reason as the reminder times: the initial state is
   * `DEFAULT_PRESENCE_PREFS`, i.e. every rung off, so painting the form before
   * the load resolves would show a member silence they had not chosen and let
   * one Save write it.
   */
  const [load, setLoad] = useState<Load>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  useEffect(() => {
    let cancelled = false
    setLoad('loading')
    fetch('/api/me/presence-prefs')
      .then(async (res) => {
        if (!res.ok) throw new Error(`presence-prefs responded ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const next = readPrefs(data)
        setPrefs(next)
        setDraft(draftFrom(next))
        setTouched(false)
        setErrors({})
        setLoad('ready')
      })
      .catch(() => { if (!cancelled) setLoad('error') })
    return () => { cancelled = true }
  }, [reloadKey])

  function edit(field: LadderField, next: string) {
    setStatus(null)
    setDraft((prev) => ({ ...prev, [field]: next }))
  }

  async function save() {
    // Unreachable from the UI - the form is not rendered unless the real values
    // are in hand - but stated here so it can never become reachable by accident.
    if (load !== 'ready') return
    const found = validateDraft(draft)
    setTouched(true)
    setErrors(found)
    setStatus(null)
    if (Object.keys(found).length > 0) return

    const next = prefsFromDraft(draft)
    if (!next) return

    setSaving(true)
    try {
      const res = await fetch('/api/me/presence-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const code = typeof (data as { code?: unknown })?.code === 'string'
          ? (data as { code: string }).code
          : ''
        setStatus({ text: SERVER_ERROR[code] ?? sl.saveError, ok: false })
        return
      }
      const confirmed = readPrefs(data)
      setPrefs(confirmed)
      setDraft(draftFrom(confirmed))
      setTouched(false)
      setErrors({})
      setStatus({ text: sl.saved, ok: true })
    } catch {
      setStatus({ text: sl.saveError, ok: false })
    } finally {
      setSaving(false)
    }
  }

  let body: React.ReactNode
  if (load === 'loading') {
    // Four, matching the four fields that land. A skeleton promising more than
    // resolves is a layout jump, not a loading state.
    body = (
      <div className="field-row">
        <Skeleton className="field-row-item" height={104} radius="var(--radius-md)" />
        <Skeleton className="field-row-item" height={104} radius="var(--radius-md)" />
        <Skeleton className="field-row-item" height={104} radius="var(--radius-md)" />
        <Skeleton className="field-row-item" height={104} radius="var(--radius-md)" />
      </div>
    )
  } else if (load === 'error') {
    body = <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
  } else {
    const shown: LadderErrors = touched ? { ...errors } : {}
    // The one message shown before a save: a repeat with nothing to repeat
    // after is silently dropped by `resolveLadder()`, so leaving the member to
    // discover that at save time would mean rendering a schedule that never runs.
    if (!shown.repeat && typeof parseRung(draft.repeat) === 'number' && parseRung(draft.fullDay) === null) {
      shown.repeat = sl.repeatNeedsFullDay
    }

    // Live where the draft parses, so the line describes what is on screen
    // rather than what was last saved; it falls back to the saved prefs while
    // a field is mid-edit and unparseable.
    const summaryPrefs = prefsFromDraft(draft) ?? prefs

    body = (
      <>
        <div className="field-row">
          <HoursField
            id={sl.fieldIds.halfDay}
            label={sl.halfDayLabel}
            hint={sl.halfDayHint}
            error={shown.halfDay}
            value={draft.halfDay}
            min={MIN_RUNG_H}
            max={MAX_RUNG_H}
            clearable
            onChange={(next) => edit('halfDay', next)}
          />
          <HoursField
            id={sl.fieldIds.fullDay}
            label={sl.fullDayLabel}
            hint={sl.fullDayHint}
            error={shown.fullDay}
            value={draft.fullDay}
            min={MIN_RUNG_H}
            max={MAX_RUNG_H}
            clearable
            onChange={(next) => edit('fullDay', next)}
          />
          <HoursField
            id={sl.fieldIds.repeat}
            label={sl.repeatLabel}
            hint={sl.repeatHint}
            error={shown.repeat}
            value={draft.repeat}
            min={MIN_REPEAT_H}
            max={MAX_AUTO_CHECKOUT_H}
            clearable
            onChange={(next) => edit('repeat', next)}
          />
          <HoursField
            id={sl.fieldIds.autoCheckout}
            label={sl.autoCheckoutLabel}
            hint={sl.autoCheckoutHint}
            error={shown.autoCheckout}
            value={draft.autoCheckout}
            min={MIN_AUTO_CHECKOUT_H}
            max={MAX_AUTO_CHECKOUT_H}
            clearable={false}
            onChange={(next) => edit('autoCheckout', next)}
          />
        </div>

        {/* The whole schedule on one line, so the member can see what they built
            without doing the arithmetic across four fields. */}
        <p className="field-hint mt-10">{sl.summary(summaryPrefs)}</p>

        <div className="form-actions">
          <Button loading={saving} onClick={() => void save()}>
            {saving ? sl.saving : sl.save}
          </Button>
        </div>

        <StatusMsg msg={status} />
      </>
    )
  }

  return (
    <>
      <GroupHeading title={sl.title} hint={sl.hint} />
      {body}
    </>
  )
}

// ── Push registration · this browser ──────────────────────────────────────────

/**
 * The browser's own push registration. Unrelated to either schedule above and
 * kept exactly as it was: this is the only unsubscribe control in the product,
 * and without it a member has no way to hand the permission back.
 */
function DevicePush() {
  const [status, setStatus] = useState<Status>(null)
  const [unsubscribing, setUnsubscribing] = useState(false)

  /**
   * Drop this browser's push registration.
   *
   * The server row goes first: once it is gone nothing can be sent here, so a
   * failure at the browser step leaves an unreachable local subscription rather
   * than a live server row pushing to a browser that thinks it opted out. The
   * mirror of the document delete order, for the same reason.
   *
   * `SwRegister` has always subscribed silently on load and nothing ever undid
   * it. It is also why the copy says re-opening the app registers it back: the
   * honest fix for "stop messaging me" is the schedules above, not this.
   */
  async function unsubscribeDevice() {
    setStatus(null)
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus({ text: n.pushUnsupported, ok: false })
      return
    }
    setUnsubscribing(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (!sub) {
        setStatus({ text: n.pushNotSubscribed, ok: true })
        return
      }
      const res = await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })
      if (!res.ok) throw new Error(`DELETE /api/push/subscribe responded ${res.status}`)
      await sub.unsubscribe()
      setStatus({ text: n.pushUnsubscribed, ok: true })
    } catch {
      setStatus({ text: n.pushError, ok: false })
    } finally {
      setUnsubscribing(false)
    }
  }

  return (
    <>
      <GroupHeading title={n.pushTitle} hint={n.pushBody} />
      <Button variant="secondary" size="sm" loading={unsubscribing} onClick={() => void unsubscribeDevice()}>
        {n.pushUnsubscribe}
      </Button>
      <StatusMsg msg={status} />
    </>
  )
}

function NotificationsSection() {
  return (
    <SectionCard title={n.title}>
      <div className="switch-group">
        <ReminderTimesBlock />
      </div>

      <div className="switch-group">
        <SessionLadder />
      </div>

      <div className="switch-group">
        <Divider />
        <DevicePush />
      </div>
    </SectionCard>
  )
}

// ─── Organisation features section ────────────────────────────────────────────

function OrgSection() {
  const [activeWs, setActiveWs] = useState<{ id: string; slug: string; name: string }[] | null>(null)

  useEffect(() => {
    fetch('/api/workspace')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setActiveWs(d.active ?? []) })
      .catch(() => setActiveWs([]))
  }, [])

  // Still loading - render nothing to avoid flash
  if (activeWs === null) return null

  // Has active workspace - don't show "Switch" prompt
  if (activeWs.length > 0) return null

  return (
    <SectionCard title={t.org.title}>
      <p className="t-secondary" style={{ margin: '0 0 14px' }}>{t.org.body}</p>
      <Link href="/ws" className="btn btn-primary pressable" style={{ textDecoration: 'none' }}>
        {t.org.cta}
      </Link>
    </SectionCard>
  )
}

// ─── Logout section ───────────────────────────────────────────────────────────

function LogoutSection() {
  const [loading, setLoading] = useState(false)

  async function logout() {
    setLoading(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <SectionCard title={t.session.title}>
      <p className="t-secondary" style={{ margin: '0 0 14px' }}>{en.auth.sessionLogoutText}</p>
      <Button variant="secondary" loading={loading} onClick={logout}>
        {t.session.signOut}
      </Button>
    </SectionCard>
  )
}

// ─── Danger zone (collapsed accordion) ────────────────────────────────────────

function DeactivateCard() {
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [blockedBy, setBlockedBy] = useState<{ slug: string; name: string }[] | null>(null)

  async function deactivateAccount() {
    setLoading(true)
    setBlockedBy(null)
    try {
      const res = await fetch('/api/me', { method: 'DELETE' })
      if (res.ok) {
        window.location.href = '/login'
      } else if (res.status === 409) {
        // Sole admin of at least one active workspace - the server lists them.
        const data = await res.json()
        setBlockedBy(data.workspaces ?? [])
        setConfirming(false)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        background: 'color-mix(in srgb, var(--danger) 4%, transparent)',
      }}
    >
      <p className="t-h2" style={{ margin: '0 0 4px', fontSize: '13.5px' }}>
        {t.danger.deactivateTitle}
      </p>
      <p className="t-secondary" style={{ margin: '0 0 12px' }}>{t.danger.deactivateBody}</p>

      {/* Sole-admin blocker */}
      {blockedBy && blockedBy.length > 0 && (
        <div
          role="alert"
          style={{
            background: 'color-mix(in srgb, var(--amber) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            marginBottom: '12px',
          }}
        >
          <p className="t-secondary" style={{ margin: '0 0 4px', fontWeight: 700 }}>
            {t.danger.blockedTitle(blockedBy.length)}
          </p>
          <p className="t-secondary" style={{ margin: '0 0 8px' }}>{t.danger.blockedBody}</p>

          <div className="stack-sm">
            {blockedBy.map((ws) => (
              <div key={ws.slug} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <a href={`/ws/${ws.slug}/people`} className="t-muted" style={{ color: 'var(--brand)' }}>
                  {t.danger.blockedPromote(ws.name)}
                </a>
                <span className="t-muted">{t.danger.blockedOr}</span>
                <a href={`/ws/${ws.slug}/settings`} className="t-muted">
                  {t.danger.blockedArchive}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {!confirming ? (
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          {t.danger.deactivateCta}
        </Button>
      ) : (
        <div className="stack-sm">
          <p className="field-error" style={{ margin: 0 }}>{t.danger.confirmPrompt}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              size="sm"
              loading={loading}
              onClick={deactivateAccount}
              style={{ background: 'var(--danger)', color: '#fff' }}
            >
              {loading ? t.danger.confirmBusy : t.danger.confirmYes}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              {t.danger.confirmNo}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function DangerSection() {
  const [open, setOpen] = useState(false)

  return (
    <div>
      {/* Accordion trigger - intentionally quiet */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? t.danger.collapse : t.danger.expand}
        className="pressable"
        style={{
          width: '100%',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: open ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}
      >
        <span>{t.danger.title}</span>
        <span
          aria-hidden
          style={{
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 160ms var(--ease-out)',
            display: 'inline-block',
            lineHeight: 1,
            color: 'var(--text-muted)',
          }}
        >
          ›
        </span>
      </button>

      {open && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderTop: 'none',
            borderRadius: '0 0 var(--radius-md) var(--radius-md)',
            padding: '14px',
            background: 'var(--surface-0)',
          }}
        >
          <DeactivateCard />
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => {
        setProfileName(d.user?.full_name ?? '')
        setProfileEmail(d.user?.email ?? '')
      })
      .catch(() => {})
  }, [])

  return (
    <div className="stack">
      <h1 className="t-h1" style={{ color: 'var(--navy)', margin: 0 }}>{t.title}</h1>

      <div>
        <ProfileSection initialName={profileName} email={profileEmail} />
        <EmailSection />
        <PasswordSection />
        <NotificationsSection />
        <TokensSection />
        <OrgSection />
        <LogoutSection />
      </div>

      <DangerSection />
    </div>
  )
}
