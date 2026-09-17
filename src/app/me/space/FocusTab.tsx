'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Field, Input, Select } from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import type { UserTodo } from '@/lib/db/queries/todos'
import {
  DEFAULT_FOCUS_SETTINGS,
  FOCUS_DURATION_OPTIONS,
  FOCUS_SETTINGS_STORAGE_KEY,
  LONG_BREAK_OPTIONS,
  MAX_FOCUS_LABEL_LEN,
  SESSIONS_BEFORE_LONG_BREAK_OPTIONS,
  SHORT_BREAK_OPTIONS,
  parseFocusSettings,
  type FocusSettings,
} from '@/lib/space'
import { meSpace } from '@/locales/en/me-space'

/**
 * The Focus tab: a pomodoro timer that runs entirely in this tab.
 *
 * THERE IS NO SERVER-SIDE TIMER AND NO ROW UNTIL A SESSION ENDS. Nothing has to
 * be kept alive between start and finish, so there is nothing for a start
 * endpoint to do, and a row written at start would stay open forever for every
 * session the member abandoned - with no cron to close it, since sub-project E
 * puts a server-side timer out of scope. A session nobody finished leaving no
 * row is the honest record.
 *
 * THE COUNTDOWN IS ANCHORED ON A DEADLINE, NOT ACCUMULATED FROM TICKS.
 * `setInterval(fn, 1000)` is throttled to once a minute in a background tab and
 * stops entirely while a phone is locked, so counting "one second per tick"
 * loses minutes the member actually spent - a 25-minute session would report
 * eleven. The deadline is a timestamp and every tick simply re-reads the clock,
 * so a tab that was asleep catches up in one frame and the recorded duration is
 * the real one.
 */

const t = meSpace.focus

/** What a to-do hands over when the member presses play on it. */
export interface FocusSeed {
  todoId: string
  label: string
}

type Mode = 'focus' | 'short' | 'long'

function minutesOf(mode: Mode, settings: FocusSettings): number {
  if (mode === 'short') return settings.shortBreakMin
  if (mode === 'long') return settings.longBreakMin
  return settings.focusMin
}

function clock(seconds: number): string {
  const safe = Math.max(0, seconds)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

/**
 * A short tone at the end of a session, built from an oscillator.
 *
 * No audio file: one `<audio>` asset is a network request, a cache entry and a
 * 404 waiting to happen for half a second of beep. Wrapped because an
 * `AudioContext` is refused outright in some browsers until the page has been
 * interacted with - it always has been here, since the member pressed Start, but
 * a throw would take the completion handler down with it and lose the session.
 */
function chime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 440
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
    osc.onended = () => void ctx.close()
  } catch { /* a missing beep is not worth a broken session */ }
}

interface Stats {
  sessions_today: number
  total_minutes_today: number
  sessions_completed: number
}

export default function FocusTab({
  seed,
  onSeedUsed,
}: {
  seed: FocusSeed | null
  onSeedUsed: () => void
}) {
  const { show } = useToast()
  const [settings, setSettings] = useState<FocusSettings>(DEFAULT_FOCUS_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [mode, setMode] = useState<Mode>('focus')
  const [remaining, setRemaining] = useState(DEFAULT_FOCUS_SETTINGS.focusMin * 60)
  const [running, setRunning] = useState(false)
  const [completedInSet, setCompletedInSet] = useState(0)
  const [label, setLabel] = useState('')
  const [todoId, setTodoId] = useState('')
  const [todos, setTodos] = useState<UserTodo[]>([])
  const [stats, setStats] = useState<Stats | null>(null)

  // The wall-clock instant the current run ends. A ref, not state: it is read
  // by the interval and must not schedule a render when it changes.
  const deadlineRef = useRef<number | null>(null)

  // ── settings, from this device ─────────────────────────────────────────────
  useEffect(() => {
    const stored = parseFocusSettings(window.localStorage.getItem(FOCUS_SETTINGS_STORAGE_KEY))
    setSettings(stored)
    setRemaining(stored.focusMin * 60)
  }, [])

  const updateSettings = useCallback((patch: Partial<FocusSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      window.localStorage.setItem(FOCUS_SETTINGS_STORAGE_KEY, JSON.stringify(next))
      // Changing a length mid-run would move a deadline the member is watching,
      // so it only re-arms the clock while the timer is stopped.
      if (deadlineRef.current === null) setRemaining(minutesOf(mode, next) * 60)
      return next
    })
  }, [mode])

  // ── the task hand-off from the To-dos tab ──────────────────────────────────
  useEffect(() => {
    if (!seed) return
    setTodoId(seed.todoId)
    setLabel(seed.label.slice(0, MAX_FOCUS_LABEL_LEN))
    onSeedUsed()
  }, [seed, onSeedUsed])

  const loadTodos = useCallback(async () => {
    try {
      const res = await fetch('/api/todos?filter=pending')
      if (!res.ok) return
      const data = (await res.json()) as { todos: UserTodo[] }
      setTodos(data.todos.slice(0, 20))
    } catch { /* the picker is a convenience; a session needs no task */ }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      const res = await fetch(`/api/focus/stats?tz=${encodeURIComponent(tz)}`)
      if (!res.ok) return
      setStats((await res.json()) as Stats)
    } catch { /* leaving the tile blank beats a toast nobody asked for */ }
  }, [])

  useEffect(() => { void loadTodos(); void loadStats() }, [loadTodos, loadStats])

  /**
   * Record a finished focus session.
   *
   * Only `focus` sessions are recorded - a break is not work, and filing one
   * would put "5 min focused" into a tile that claims the opposite. The duration
   * is rounded to whole minutes because the column is whole minutes; a session
   * under half a minute rounds to 0 and is dropped rather than stored, since a
   * row saying somebody focused for no time is noise in their own history.
   */
  const record = useCallback(async (kind: 'complete' | 'interrupt', elapsedSec: number) => {
    const actual = Math.round(elapsedSec / 60)
    if (actual <= 0) return
    try {
      const res = await fetch(`/api/focus/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planned_duration_min: settings.focusMin,
          actual_duration_min: actual,
          label: label.trim() || null,
          todo_id: todoId || null,
        }),
      })
      if (!res.ok) throw new Error('record')
      show(kind === 'complete' ? t.recordedNote : t.stoppedNote, 'success')
      await loadStats()
    } catch {
      show(meSpace.saveFailed, 'error')
    }
  }, [settings.focusMin, label, todoId, show, loadStats])

  // ── the tick ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return

    const id = window.setInterval(() => {
      const deadline = deadlineRef.current
      if (deadline === null) return
      const left = Math.ceil((deadline - Date.now()) / 1000)

      if (left > 0) { setRemaining(left); return }

      // Reached zero. Stop first, so nothing can fire twice while the POST is
      // in flight.
      deadlineRef.current = null
      setRunning(false)
      setRemaining(0)
      chime()

      if (mode === 'focus') {
        void record('complete', minutesOf('focus', settings) * 60)
        const nextCount = completedInSet + 1
        const long = nextCount >= settings.setLength
        setCompletedInSet(long ? 0 : nextCount)
        setMode(long ? 'long' : 'short')
        setRemaining(minutesOf(long ? 'long' : 'short', settings) * 60)
      } else {
        setMode('focus')
        setRemaining(minutesOf('focus', settings) * 60)
      }
    }, 1000)

    return () => window.clearInterval(id)
  }, [running, mode, settings, completedInSet, record])

  function start() {
    deadlineRef.current = Date.now() + remaining * 1000
    setRunning(true)
  }

  function pause() {
    deadlineRef.current = null
    setRunning(false)
  }

  function stop() {
    const total = minutesOf(mode, settings) * 60
    const elapsed = total - remaining
    deadlineRef.current = null
    setRunning(false)
    if (mode === 'focus') void record('interrupt', elapsed)
    setMode('focus')
    setRemaining(minutesOf('focus', settings) * 60)
  }

  const modeLabel = mode === 'focus' ? t.modeFocus : mode === 'short' ? t.modeShortBreak : t.modeLongBreak
  const paused = !running && deadlineRef.current === null && remaining < minutesOf(mode, settings) * 60

  return (
    <div className="stack">
      <Card className="focus-card">
        <div className="focus-clock" aria-live="off">{clock(remaining)}</div>
        <div className="t-eyebrow focus-mode">{modeLabel}</div>

        <div className="focus-dots" aria-label={t.setsLabel(completedInSet, settings.setLength)}>
          {Array.from({ length: settings.setLength }, (_, i) => (
            <span key={i} className={`focus-dot${i < completedInSet ? ' is-done' : ''}`} />
          ))}
        </div>

        <div className="focus-controls">
          {running ? (
            <>
              <Button variant="secondary" size="sm" onClick={pause}>{t.pauseAction}</Button>
              <Button variant="danger" size="sm" onClick={stop}>{t.stopAction}</Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={start}>{paused ? t.resumeAction : t.startAction}</Button>
              {paused ? (
                <Button variant="danger" size="sm" onClick={stop}>{t.stopAction}</Button>
              ) : null}
            </>
          )}
        </div>

        <p className="t-muted focus-stats">
          {stats && stats.sessions_today > 0
            ? t.statsToday(stats.sessions_today, stats.total_minutes_today)
            : t.statsEmpty}
        </p>
      </Card>

      <Card>
        <Field label={t.labelPlaceholder} htmlFor="focus-label">
          <Input
            id="focus-label"
            value={label}
            maxLength={MAX_FOCUS_LABEL_LEN}
            placeholder={t.labelPlaceholder}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>

        <div className="space-mt-10">
          <Field label={t.linkLabel} htmlFor="focus-todo">
            <Select
              id="focus-todo"
              value={todoId}
              onChange={(e) => {
                setTodoId(e.target.value)
                const picked = todos.find((todo) => todo.id === e.target.value)
                if (picked && !label.trim()) setLabel(picked.text.slice(0, MAX_FOCUS_LABEL_LEN))
              }}
              options={[
                { value: '', label: t.linkNone },
                ...todos.map((todo) => ({ value: todo.id, label: todo.text })),
              ]}
            />
          </Field>
        </div>

        <p className="t-muted space-mt-10">{t.runningHint}</p>
      </Card>

      <Card>
        <div className="row-between">
          <span className="t-eyebrow">{t.settingsLabel}</span>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showSettings}
            onClick={() => setShowSettings((value) => !value)}
          >
            {showSettings ? meSpace.notes.closeAction : t.settingsLabel}
          </Button>
        </div>

        {showSettings ? (
          <div className="stack-sm space-mt-10">
            <Field label={t.focusLengthLabel} htmlFor="focus-len">
              <Select
                id="focus-len"
                value={String(settings.focusMin)}
                onChange={(e) => updateSettings({ focusMin: Number(e.target.value) })}
                options={FOCUS_DURATION_OPTIONS.map((n) => ({ value: String(n), label: t.minutes(n) }))}
              />
            </Field>
            <Field label={t.shortBreakLabel} htmlFor="focus-short">
              <Select
                id="focus-short"
                value={String(settings.shortBreakMin)}
                onChange={(e) => updateSettings({ shortBreakMin: Number(e.target.value) })}
                options={SHORT_BREAK_OPTIONS.map((n) => ({ value: String(n), label: t.minutes(n) }))}
              />
            </Field>
            <Field label={t.longBreakLabel} htmlFor="focus-long">
              <Select
                id="focus-long"
                value={String(settings.longBreakMin)}
                onChange={(e) => updateSettings({ longBreakMin: Number(e.target.value) })}
                options={LONG_BREAK_OPTIONS.map((n) => ({ value: String(n), label: t.minutes(n) }))}
              />
            </Field>
            <Field label={t.setLengthLabel} htmlFor="focus-set" hint={t.settingsHint}>
              <Select
                id="focus-set"
                value={String(settings.setLength)}
                onChange={(e) => updateSettings({ setLength: Number(e.target.value) })}
                options={SESSIONS_BEFORE_LONG_BREAK_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
              />
            </Field>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
