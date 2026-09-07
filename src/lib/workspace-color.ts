/**
 * Deterministic swatch tint. The same workspace always gets the same colour on
 * every device without storing one, which is what makes the pill recognisable
 * at a glance in the switcher.
 *
 * Extracted from `MeTopbar` so the workspace pill and the workspace badge on a
 * unified notification row agree. Two copies of this function would drift the
 * moment either palette is touched, and a badge whose colour disagrees with the
 * pill is worse than no badge at all: it teaches the wrong association.
 *
 * Always seed on the workspace **id**, never the slug - a workspace can be
 * renamed (and re-slugged); its id is stable, so its colour is too.
 */
export const SWATCH_COLORS = [
  '#1B4DFF', '#0EA5E9', '#8B5CF6', '#F59E0B',
  '#EC4899', '#06B6D4', '#4F46E5', '#10B981',
]

export function swatchColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h)
  return SWATCH_COLORS[Math.abs(h) % SWATCH_COLORS.length]
}

/**
 * The same trick for PEOPLE, deliberately on a different palette.
 *
 * Separate function, same file: colouring a person and colouring a workspace
 * are different jobs and must not converge on one palette - a member avatar
 * that happens to match the workspace pill reads as a relationship that is not
 * there. What was NOT acceptable is the previous state, where this hash existed
 * inline in two directory screens and drifted independently.
 *
 * Seed on the user id where there is one, and the email otherwise, so an
 * invited person keeps the same colour after they accept.
 */
export const PERSON_COLORS = [
  '#4F46E5', '#0EA5E9', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4',
]

export function personColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h)
  return PERSON_COLORS[Math.abs(h) % PERSON_COLORS.length]
}
