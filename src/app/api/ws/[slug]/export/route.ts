import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireWsAdmin } from '@/lib/ws-admin'
import { queryWorkspaceEvents } from '@/lib/signals'
import { getActiveMembersWithDetails } from '@/lib/db/queries/workspaces'
import { getWorkspaceSignals } from '@/lib/db/queries/signals'
import { listHolidayDatesInRange } from '@/lib/db/queries/holidays'
import { getLeaveRequestsInRange } from '@/lib/db/queries/leaves'
import { getPlanLimits } from '@/lib/plans'
import {
  summarizeAttendanceDays,
  countWorkdays,
  dateKeyInTimezone,
  nextDateKey,
} from '@/lib/attendance-summary'
import { localMidnightToUtc, todayInTz } from '@/lib/timezone'

interface Props { params: Promise<{ slug: string }> }

const COLOR = {
  office:   'FF86EFAC',
  remote:   'FFFDE68A',
  absent:   'FFFCA5A5',
  holiday:  'FFE9D5FF',
  leave:    'FFBAE6FD',
  weekend:  'FFE2E8F0',
  header:   'FF1B4DFF',
} as const

function fill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function cellValue(status: string | undefined, isWeekend: boolean): string | number {
  if (isWeekend) return ''
  switch (status) {
    case 'office':  return 1
    case 'remote':  return 'WFH'
    case 'holiday': return 'Holiday'
    case 'leave':   return 'Leave'
    case 'absent':  return 0
    case 'future':  return ''
    default:        return 0
  }
}

function cellFill(status: string | undefined, isWeekend: boolean): ExcelJS.Fill | undefined {
  if (isWeekend) return fill(COLOR.weekend)
  switch (status) {
    case 'office':  return fill(COLOR.office)
    case 'remote':  return fill(COLOR.remote)
    case 'holiday': return fill(COLOR.holiday)
    case 'leave':   return fill(COLOR.leave)
    case 'absent':  return fill(COLOR.absent)
    default:        return undefined
  }
}

export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params
  const ctx = await requireWsAdmin(request, slug)
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { workspace } = ctx
  const url = new URL(request.url)
  const tz = workspace.display_timezone
  const todayStr = todayInTz(tz)
  const [defaultYear, defaultMonth] = todayStr.split('-').map(Number)

  const year  = parseInt(url.searchParams.get('year')  ?? String(defaultYear),  10)
  const month = parseInt(url.searchParams.get('month') ?? String(defaultMonth), 10)

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year/month' }, { status: 400 })
  }

  const planLimits = getPlanLimits(workspace.plan)
  if (!planLimits.csvExport) {
    return NextResponse.json({ error: 'CSV export requires Starter or Growth plan', code: 'PLAN_GATE' }, { status: 402 })
  }
  if (planLimits.historyMonths !== null) {
    const gateDate = new Date()
    gateDate.setMonth(gateDate.getMonth() - planLimits.historyMonths)
    if (new Date(year, month - 1, 1) < gateDate) {
      return NextResponse.json({ error: 'Date range outside plan history window', code: 'PLAN_HISTORY_GATE' }, { status: 402 })
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const monthStr    = String(month).padStart(2, '0')
  const startDate   = `${year}-${monthStr}-01`
  const endDate     = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`
  const startUtc    = localMidnightToUtc(startDate, tz)
  const endUtc      = localMidnightToUtc(nextDateKey(endDate), tz)

  const [allEvents, memberDetails, workspaceSignals, holidayDates, leaveRequests] = await Promise.all([
    queryWorkspaceEvents(workspace.id, workspace.plan, { startDate: startUtc, endDate: endUtc }),
    getActiveMembersWithDetails(workspace.id),
    getWorkspaceSignals(workspace.id),
    listHolidayDatesInRange(workspace.id, startDate, endDate),
    getLeaveRequestsInRange(workspace.id, startDate, endDate),
  ])

  const signalsConfigured = workspaceSignals.length > 0
  const holidaySet = new Set(holidayDates)
  const effectiveEndDate = endDate > todayStr ? todayStr : endDate
  const workingDayNums: number[] = (() => {
    try { return JSON.parse(ctx.workspace.working_days ?? '[1,2,3,4,5]') } catch { return [1, 2, 3, 4, 5] }
  })()
  const orgWorkingDays   = countWorkdays(startDate, effectiveEndDate, holidaySet, workingDayNums)

  const byUser = new Map<string, typeof allEvents>()
  for (const ev of allEvents) {
    const arr = byUser.get(ev.user_id) ?? []
    arr.push(ev)
    byUser.set(ev.user_id, arr)
  }

  const leaveByUser = new Map<string, Set<string>>()
  for (const { user_id, start_date, end_date } of leaveRequests) {
    const leaveDates = leaveByUser.get(user_id) ?? new Set<string>()
    for (
      let d = new Date(`${start_date}T00:00:00Z`);
      d <= new Date(`${end_date}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const key = d.toISOString().split('T')[0]
      if (key >= startDate && key <= endDate) leaveDates.add(key)
    }
    leaveByUser.set(user_id, leaveDates)
  }

  const rows = memberDetails.map((member) => {
    const joinedLocal = dateKeyInTimezone(member.added_at, tz)
    const memberStart = joinedLocal > startDate ? joinedLocal : startDate
    const summary     = summarizeAttendanceDays({
      events: byUser.get(member.user_id) ?? [],
      startDate: memberStart,
      endDate,
      timezone: tz,
      todayDate: todayStr,
      holidayDates,
      workingDays: workingDayNums,
    })
    const leaveDays = leaveByUser.get(member.user_id)
    const days: Record<string, string> = { ...summary.days }
    if (leaveDays) {
      for (const key of leaveDays) {
        if (days[key] === 'absent') days[key] = 'leave'
      }
    }
    return { member, summary, days }
  })
  rows.sort((a, b) =>
    (a.member.full_name ?? a.member.email).localeCompare(b.member.full_name ?? b.member.email)
  )

  const workbook  = new ExcelJS.Workbook()
  const monthName = new Date(year, month - 1, 1).toLocaleString('en', { month: 'long' })
  const sheet     = workbook.addWorksheet(`${monthName} ${year}`)

  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => {
    const dayOfMonth  = i + 1
    const dayOfWeek   = new Date(year, month - 1, dayOfMonth).getDay()
    return {
      label: `${String(dayOfMonth).padStart(2, '0')}-${monthStr}-${year}`,
      isWeekend: !workingDayNums.includes(dayOfWeek),
    }
  })

  const headerRow = sheet.addRow([
    'Employee ID', 'Email', 'Name',
    ...dayHeaders.map((h) => h.label),
    'Total Office Days',
    endDate > todayStr ? `Working Days (till ${todayStr})` : 'Working Days (month)',
  ])
  headerRow.height = 32
  headerRow.eachCell((cell, colNumber) => {
    const dayIdx  = colNumber - 4
    const isWeekend  = colNumber >= 4 && colNumber <= 3 + daysInMonth && dayHeaders[dayIdx]?.isWeekend
    cell.fill      = fill(isWeekend ? COLOR.weekend : COLOR.header)
    cell.font      = { bold: true, color: { argb: isWeekend ? 'FF64748B' : 'FFFFFFFF' }, size: 10 }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border    = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
  })

  for (const { member, summary, days } of rows) {
    const rowData: (string | number)[] = [
      member.member_id,
      member.email,
      member.full_name ?? member.email,
    ]

    for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth++) {
      const dateStr   = `${year}-${monthStr}-${String(dayOfMonth).padStart(2, '0')}`
      const isWeekend    = dayHeaders[dayOfMonth - 1].isWeekend
      const rawStatus = days[dateStr]
      const status    = !rawStatus && holidaySet.has(dateStr) ? 'holiday' : rawStatus
      rowData.push(cellValue(status, isWeekend))
    }

    rowData.push(summary.officeDays)
    rowData.push(orgWorkingDays)

    const dataRow = sheet.addRow(rowData)
    dataRow.height = 20

    for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth++) {
      const cell      = dataRow.getCell(3 + dayOfMonth)
      const dateStr   = `${year}-${monthStr}-${String(dayOfMonth).padStart(2, '0')}`
      const isWeekend    = dayHeaders[dayOfMonth - 1].isWeekend
      const rawStatus = days[dateStr]
      const status    = !rawStatus && holidaySet.has(dateStr) ? 'holiday' : rawStatus
      const f         = cellFill(status, isWeekend)
      if (f) cell.fill = f
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.font      = { size: 9 }
    }

    dataRow.getCell(1).font = { size: 9, color: { argb: 'FF64748B' } }
    dataRow.getCell(2).font = { size: 9 }
    dataRow.getCell(3).font = { size: 10, bold: true }
    const totalCell = dataRow.getCell(4 + daysInMonth)
    totalCell.font      = { bold: true, size: 10 }
    totalCell.alignment = { horizontal: 'center', vertical: 'middle' }
    const workingDaysCell = dataRow.getCell(5 + daysInMonth)
    workingDaysCell.font      = { bold: true, size: 10 }
    workingDaysCell.alignment = { horizontal: 'center', vertical: 'middle' }
  }

  sheet.getColumn(1).width = 18
  sheet.getColumn(2).width = 28
  sheet.getColumn(3).width = 20
  for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth++) {
    sheet.getColumn(3 + dayOfMonth).width = dayHeaders[dayOfMonth - 1].isWeekend ? 5 : 8
  }
  sheet.getColumn(4 + daysInMonth).width = 14
  sheet.getColumn(5 + daysInMonth).width = 20

  const legend = workbook.addWorksheet('Legend')
  const legendRows: [string, string][] = [
    ['', signalsConfigured ? 'Office (verified on-site)' : 'Present'],
    ['', signalsConfigured ? 'WFH / Remote' : ''],
    ['', 'Absent'],
    ['', 'On Leave'],
    ['', 'Public Holiday'],
    ['', 'Weekend'],
  ]
  const legendFills = [COLOR.office, COLOR.remote, COLOR.absent, COLOR.leave, COLOR.holiday, COLOR.weekend]
  const legendHeader = legend.addRow(['Color', 'Meaning'])
  legendHeader.getCell(1).font = { bold: true }
  legendHeader.getCell(2).font = { bold: true }
  legendRows.forEach(([, label], i) => {
    const r = legend.addRow(['', label])
    r.getCell(1).fill = fill(legendFills[i])
  })
  legend.getColumn(1).width = 6
  legend.getColumn(2).width = 32

  const buffer   = await workbook.xlsx.writeBuffer()
  const filename = `attendance-${slug}-${year}-${monthStr}.xlsx`

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
