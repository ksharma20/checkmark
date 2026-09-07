'use client'

import { Button, Modal } from '@/components/ui'
import { wsAdmin } from '@/locales/en/ws-settings'
import type { Holiday } from './types'

const t = wsAdmin.holidays

export function DeleteModal({ holiday, onConfirm, onCancel }: {
  holiday: Holiday | null
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      open={holiday !== null}
      onClose={onCancel}
      title={t.deleteTitle}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onCancel}>{t.cancelBtn}</Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>{t.deleteConfirm}</Button>
        </>
      }
    >
      {holiday && <p className="t-secondary">{t.deleteBody(holiday.name)}</p>}
    </Modal>
  )
}

export function BulkDeleteModal({ open, count, onConfirm, onCancel, deleting }: {
  open: boolean
  count: number
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={t.bulkDeleteTitle(count)}
      footer={
        <>
          <Button variant="secondary" size="sm" disabled={deleting} onClick={onCancel}>
            {t.cancelBtn}
          </Button>
          <Button variant="danger" size="sm" loading={deleting} onClick={onConfirm}>
            {deleting ? t.deletingConfirm : t.deleteConfirm}
          </Button>
        </>
      }
    >
      <p className="t-secondary">{t.bulkDeleteBody(count)}</p>
    </Modal>
  )
}
