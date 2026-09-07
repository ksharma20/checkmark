'use client'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'

export interface Column<T> {
  /** Stable id for the column; also the row field read when `render` is absent. */
  key: string
  header: ReactNode
  width?: number | string
  align?: 'left' | 'center' | 'right'
  render?: (row: T) => ReactNode
}

interface DataTableProps<T> extends Omit<ComponentPropsWithoutRef<'table'>, 'children'> {
  columns: Column<T>[]
  rows: T[]
  /** Must be stable across renders - never the array index. */
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  /** When set, the table is wrapped in `.dash-table-scroll` and holds this min width. */
  minWidth?: number | string
  /** Rendered in place of the body when `rows` is empty. */
  empty?: ReactNode
}

function cellValue<T>(row: T, key: string): ReactNode {
  const value = (row as Record<string, unknown>)[key]
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number') return value
  return String(value)
}

/**
 * `table.datatable` from the design system, generic over the row type.
 * Column widths/alignment are per-column inline because the stylesheet only
 * defines the table's typography and gutters, not its layout.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  minWidth,
  empty,
  className,
  style,
  ...rest
}: DataTableProps<T>) {
  const classes = ['datatable', className].filter(Boolean).join(' ')
  const width = typeof minWidth === 'number' ? `${minWidth}px` : minWidth

  const table = (
    <table className={classes} style={style} {...rest}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              style={{
                width: typeof col.width === 'number' ? `${col.width}px` : col.width,
                textAlign: col.align ?? 'left',
              }}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && empty ? (
          <tr>
            <td colSpan={columns.length} style={{ padding: 0 }}>{empty}</td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? 'rowlink' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} style={{ textAlign: col.align ?? 'left' }}>
                  {col.render ? col.render(row) : cellValue(row, col.key)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )

  // `.dash-table-scroll > table` reads `--table-min`, so the min width is
  // declared once on the wrapper instead of on every table element.
  return width ? (
    <div className="dash-table-scroll" style={{ ['--table-min' as string]: width }}>
      {table}
    </div>
  ) : (
    table
  )
}
