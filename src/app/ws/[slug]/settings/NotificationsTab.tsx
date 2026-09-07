'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Chip, Field, Input, Skeleton, Toggle } from '@/components/ui'
import { en } from '@/locales/en'
import { wsAdmin } from '@/locales/en/ws-settings'
import { wsReminders } from '@/locales/en/ws-reminders'
import {
  ALL_CATEGORIES,
  CATEGORY_DEFS,
  isNotificationCategory,
  type NotificationCategory,
} from '@/lib/notifications/categories'

const t = en.wsSettings
const s = wsAdmin.settings
const r = wsReminders.settings

/**
 * Everything this workspace sends, in one place.
 *
 * The reminder times used to live in Org details next to the timezone, which is
 * where they are *computed* from - but an admin looking for "why is my team
 * getting pushes" reads the tab called Notifications, not the one called Org
 * details. Times and categories are the same question asked twice, so they save
 * through one button and one PATCH.
 *
 * Gated on `Resource.Settings`, deliberately not a resource of its own: adding
 * one means rewriting every seeded grid in `system-roles.json` (invariant 12)
 * for a distinction nobody has asked for.
 */

interface ReminderFieldProps {
  label: string
  hint: string
  id: string
  value: string
  onChange: (next: string) => void
  disabled: boolean
}

/**
 * One reminder time. `<input type="time">` yields '' when cleared, and ''
 * means the reminder is off - so the state below is stated explicitly rather
 * than left to be inferred from an empty box.
 *
 * Moved here verbatim from `OrgTab`, inline styles included, so the diff reads
 * as a move rather than a rewrite. Those three inline style objects predate
 * invariant 15 and are the only ones left in this file - everything below was
 * written against `globals.css`. Rewriting them means changing the appearance
 * of a control nobody has rendered on this branch yet, so it waits for the
 * UI walkthrough. Registered in `docs/known-gaps.md`.
 */
function ReminderField({ label, hint, id, value, onChange, disabled }: ReminderFieldProps) {
  const on = value !== ''
  return (
    <Field label={label} htmlFor={id} hint={hint} style={{ flex: '1 1 200px', minWidth: '200px' }}>
      <Input
        id={id}
        type="time"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
        <Chip tone={on ? 'verified' : 'leave'}>{on ? r.onBadge(value) : r.offBadge}</Chip>
        {on && !disabled && (
          <button
            type="button"
            aria-label={r.clearAria(label)}
            onClick={() => onChange('')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              fontSize: '12px',
              color: 'var(--brand)',
              cursor: 'pointer',
            }}
          >
            {r.clearButton}
          </button>
        )}
      </div>
    </Field>
  )
}

/** Why a switch is disabled, from the catalogue rather than from a guess here. */
function lockedReasonFor(key: NotificationCategory): string {
  const reason = CATEGORY_DEFS[key].lockedReason
  const table: Record<string, string> = s.notifLockedReasons
  return (reason && table[reason]) || s.notifLockedAccountScope
}

export default function NotificationsTab({ slug, canWrite }: { slug: string; canWrite: boolean }) {
  // '' means the reminder is off - the same value an emptied time input sends.
  const [checkinReminderAt, setCheckinReminderAt] = useState('')
  const [checkoutReminderAt, setCheckoutReminderAt] = useState('')
  /** The DISABLED set, mirroring the column. Empty means everything is on. */
  const [off, setOff] = useState<Set<NotificationCategory>>(new Set())
  /**
   * Same tri-state as Org details, for the same reason: the state above is a
   * set of defaults ("nothing off, no reminders"), not this workspace's
   * configuration. Painting the form on a failed load would let one Save wipe
   * the reminder times and switch every category back on.
   */
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoad('loading')
    fetch(`/api/ws/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET /api/ws/${slug} responded ${res.status}`)
        const body = await res.json()
        if (!body || typeof body !== 'object') throw new Error('GET /api/ws/[slug] returned no workspace')
        return body
      })
      .then((data) => {
        if (cancelled) return
        setCheckinReminderAt(data.checkin_reminder_at ?? '')
        setCheckoutReminderAt(data.checkout_reminder_at ?? '')
        setOff(
          new Set(
            Array.isArray(data.notification_categories_off)
              ? data.notification_categories_off.filter(isNotificationCategory)
              : [],
          ),
        )
        setLoad('ready')
      })
      .catch(() => { if (!cancelled) setLoad('error') })
    return () => { cancelled = true }
  }, [slug, reloadKey])

  function setCategoryOn(key: NotificationCategory, on: boolean) {
    setOff((prev) => {
      const next = new Set(prev)
      if (on) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function save() {
    // Unreachable from the UI - the form is not rendered unless the real values
    // are in hand - but stated here so it can never become reachable by accident.
    if (load !== 'ready') return
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/ws/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkinReminderAt: checkinReminderAt || null,
          checkoutReminderAt: checkoutReminderAt || null,
          notificationCategoriesOff: [...off],
        }),
      })
      setStatus(res.ok ? { text: t.saveSuccess, ok: true } : { text: t.saveError, ok: false })
    } finally {
      setSaving(false)
    }
  }

  if (load === 'loading') {
    return (
      <Card className="fx-spring">
        <div className="stack">
          <Skeleton height={42} radius="var(--radius-md)" />
          <Skeleton height={42} radius="var(--radius-md)" />
          <Skeleton height={64} radius="var(--radius-md)" />
          <Skeleton height={64} radius="var(--radius-md)" />
          <Skeleton height={64} radius="var(--radius-md)" />
        </div>
      </Card>
    )
  }

  if (load === 'error') {
    return (
      <Card className="fx-spring">
        <div role="alert">
          <p className="t-eyebrow text-danger mb-8">
            {s.notifLoadFailedTitle}
          </p>
          <p className="t-muted mb-12">{s.notifLoadFailedBody}</p>
        </div>
        <Button variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
          {s.notifLoadFailedRetry}
        </Button>
      </Card>
    )
  }

  return (
    <Card className="fx-spring">
      <p className="t-eyebrow mb-8">{r.sectionTitle}</p>
      <p className="t-muted mb-12">{r.sectionHint}</p>
      <div className="field-row mb-8">
        <ReminderField
          label={r.checkinLabel}
          hint={r.checkinHint}
          id={r.fieldIds.checkin}
          value={checkinReminderAt}
          onChange={setCheckinReminderAt}
          disabled={!canWrite}
        />
        <ReminderField
          label={r.checkoutLabel}
          hint={r.checkoutHint}
          id={r.fieldIds.checkout}
          value={checkoutReminderAt}
          onChange={setCheckoutReminderAt}
          disabled={!canWrite}
        />
      </div>
      <p className="t-muted mb-16">{r.approximateNote}</p>

      <p className="t-eyebrow mb-8">{s.notifPageTitle}</p>
      <p className="t-muted mb-12">{s.notifPageHint}</p>

      {/* Every category, including the ones that cannot be switched off. Hiding
          those would leave an admin unable to see that the decision was made
          for them - a disabled switch with its reason says so. */}
      <div className="mb-16">
        {ALL_CATEGORIES.map((key) => {
          const def = CATEGORY_DEFS[key]
          const copy = s.notifCategories[key]
          const locked = !def.workspaceSwitchable
          const on = locked || !off.has(key)
          return (
            <div key={key} className={locked ? 'switch-row is-locked' : 'switch-row'}>
              <div className="switch-row-body">
                <p className="switch-row-title">{copy.label}</p>
                <p className="t-muted">{locked ? lockedReasonFor(key) : copy.hint}</p>
              </div>
              <Toggle
                label={copy.label}
                checked={on}
                disabled={locked || !canWrite}
                onChange={(next) => setCategoryOn(key, next)}
              />
            </div>
          )
        })}
      </div>

      {canWrite && (
        <Button onClick={save} loading={saving}>
          {t.saveButton}
        </Button>
      )}

      {status && (
        <p role="status" className={status.ok ? 'form-status is-ok' : 'form-status is-error'}>
          {status.text}
        </p>
      )}
    </Card>
  )
}
