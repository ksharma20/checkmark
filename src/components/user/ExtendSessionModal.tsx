'use client'

import { useId, useState } from 'react'
import { Button, Modal } from '@/components/ui'
import { useToast } from '@/components/shared/Toast'
import { fmtTime } from '@/lib/client/format-time'
import { extendSession } from '@/locales/en/notifications'

/**
 * The picker behind the 10h presence push.
 *
 * That push says "check out and go home, or extend if you are still working" and
 * links to `/me?extend=1`; this is the second half of that offer. It exists as a
 * dialog rather than a set of push action buttons because the old warning push
 * carried a fixed `Extend 4h` action - one number, chosen by us, with no way to
 * say "two" or "twelve" and no confirmation of what it actually did.
 *
 * The hours offered here MUST stay in step with `ALLOWED_EXTENSION_H` in
 * `src/app/api/checkin/extend/route.ts`. The server is the authority: an option
 * missing from its allow-list is answered `400 INVALID_EXTENSION`, so a drift
 * shows up as a dead button rather than as an unbounded extension.
 */
const OPTIONS_H = [2, 4, 6, 8, 12]

interface ExtendSessionModalProps {
  open: boolean
  onClose: () => void
  /** The new `scheduled_checkout_at`, so the caller can refresh its countdown. */
  onExtended: (scheduledCheckoutAt: string) => void
}

export default function ExtendSessionModal({
  open,
  onClose,
  onExtended,
}: ExtendSessionModalProps) {
  const toast = useToast()
  const groupName = useId()
  const [hours, setHours] = useState(4)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/checkin/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      })
      const data = await res.json()

      if (res.ok) {
        // Report the time the server settled on, not `hours` — it clamps at the
        // 24h cap, and a toast saying "+12h" after a 3h clamp is a lie.
        onExtended(data.scheduled_checkout_at)
        toast.show(
          extendSession.toastExtended(fmtTime(data.scheduled_checkout_at)),
          'success',
        )
        onClose()
      } else {
        toast.show(data.error || extendSession.toastFailed, 'error')
      }
    } catch {
      toast.show(extendSession.toastNetworkError, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={extendSession.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {extendSession.cancel}
          </Button>
          <Button onClick={submit} loading={saving}>
            {saving ? extendSession.confirming : extendSession.confirm}
          </Button>
        </>
      }
    >
      <p className="t-secondary modal-body">{extendSession.intro}</p>

      {/* A real radio group, so arrow keys move between options and a screen
          reader announces "2 of 5" — `radiogroup` on a plain div would promise
          that behaviour without providing any of it. */}
      <div className="choice-list" role="radiogroup" aria-label={extendSession.title}>
        {OPTIONS_H.map((h) => (
          <label key={h} className={`choice${hours === h ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name={groupName}
              value={h}
              checked={hours === h}
              onChange={() => setHours(h)}
              disabled={saving}
            />
            {extendSession.option(h)}
          </label>
        ))}
      </div>
    </Modal>
  )
}
