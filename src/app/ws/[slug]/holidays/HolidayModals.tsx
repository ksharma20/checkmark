'use client'

import { ConfirmDialog } from '@/components/ui'
import { wsAdmin } from '@/locales/en/ws-settings'
import type { Holiday } from './types'

const t = wsAdmin.holidays

export function DeleteModal({ holiday, onConfirm, onCancel }: {
  holiday: Holiday | null
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <ConfirmDialog
      open={holiday !== null}
      onClose={onCancel}
      onConfirm={onConfirm}
      title={t.deleteTitle}
      body={holiday ? t.deleteBody(holiday.name) : ''}
      confirmLabel={t.deleteConfirm}
      cancelLabel={t.cancelBtn}
    />
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
    <ConfirmDialog
      open={open}
      onClose={onCancel}
      onConfirm={onConfirm}
      title={t.bulkDeleteTitle(count)}
      body={t.bulkDeleteBody(count)}
      confirmLabel={t.deleteConfirm}
      busyLabel={t.deletingConfirm}
      cancelLabel={t.cancelBtn}
      loading={deleting}
    />
  )
}
