/**
 * The design-system barrel.
 *
 * These primitives are the shared vocabulary for the /me and /ws surfaces. They
 * render the component classes defined in the "APP DESIGN SYSTEM" section of
 * src/app/globals.css - that stylesheet owns how things look, these files own
 * behaviour and accessibility. Prefer importing from here over reaching for an
 * inline `style` object or re-implementing a modal, skeleton or chip locally.
 *
 * Marketing pages under src/app/(public) keep their own Tailwind-utility styling
 * for layout and section chrome. They DO use this layer for controls - /login is
 * built on Field/Input/Button/Card - so form behaviour and accessibility stay in
 * one place rather than being re-hand-rolled per page.
 */

// ── surfaces ────────────────────────────────────────────────────────────────
export { default as Card } from './Card'
export { default as StatCard } from './StatCard'
export { default as Divider } from './Divider'
export { default as EmptyState } from './EmptyState'
export { default as Skeleton, SkeletonText } from './Skeleton'

// ── data display ────────────────────────────────────────────────────────────
export { default as DataTable, type Column } from './DataTable'
export { default as TabBar, type Tab } from './TabBar'
export { default as Progress } from './Progress'
export { default as SplitBar, type Segment } from './SplitBar'
export { default as WizardSteps, type WizardStep } from './WizardSteps'
export { default as StageDots, type Stage } from './StageDots'

// ── controls ────────────────────────────────────────────────────────────────
export { default as Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button'
export { default as IconButton, type IconButtonProps, type IconButtonVariant } from './IconButton'
export { default as Chip, type ChipProps, type ChipTone, toneForMatchedBy } from './Chip'
export { default as Avatar, type AvatarProps, initials } from './Avatar'
export { default as Logo } from './Logo'
export { default as WorkspaceAvatar } from './WorkspaceAvatar'
export { default as Toggle, type ToggleProps } from './Toggle'
export { default as Dropzone, type DropzoneProps } from './Dropzone'
export { default as DropdownMenu, type DropdownMenuProps, type DropdownMenuItem } from './DropdownMenu'

// ── forms ───────────────────────────────────────────────────────────────────
export { default as Field, type FieldProps } from './Field'
export { default as Input, type InputProps } from './Input'
export { default as Select, type SelectProps, type SelectOption } from './Select'
export { default as Textarea, type TextareaProps } from './Textarea'

// ── overlays ────────────────────────────────────────────────────────────────
export { default as Modal } from './Modal'
export { default as SlideOver } from './SlideOver'
export { default as BottomSheet } from './BottomSheet'

// ── charts (hand-rolled SVG - the project intentionally has no charting lib) ──
export { default as AreaChart, type AreaChartPoint } from './charts/AreaChart'
export { default as BarChart, type BarChartBar } from './charts/BarChart'
export { default as DeptBars, type DeptBarItem } from './charts/DeptBars'
