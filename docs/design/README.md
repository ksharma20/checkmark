# CheckMark Design System

Everything visual in the two app surfaces — `/me/*` and `/ws/:slug/*` — comes from two places and only two:

1. **`src/app/globals.css`** — the design tokens and the shared class vocabulary.
2. **`src/components/ui/`** — 28 files exporting 29 React primitives that own *behaviour and accessibility*, and almost no styling of their own.

That split is the whole system. The stylesheet decides what things look like; the components decide what things do. A primitive's job is to put the right class on the right element and get the semantics right — real `<button>`s, correct ARIA, keyboard handling — not to carry a `style={{}}` object.

## Read these in order

| File | What it answers |
|---|---|
| [tokens.md](./tokens.md) | Every custom property, its value, and when to reach for it |
| [typography.md](./typography.md) | The `.t-*` scale, the three fonts, `.stat-num` |
| [components.md](./components.md) | All 29 primitives, their classes, props and client/server split |
| [motion.md](./motion.md) | The three motion tiers, the four easing curves, the reduced-motion contract |
| [shells.md](./shells.md) | `.shell-me` and `.shell-ws` — the two page frames |
| [status.md](./status.md) | Chip tones and how they map to `MatchedBy` |
| [accessibility.md](./accessibility.md) | Touch targets, semantics, labels, and the known focus-trap gap |

## The five rules, and why each exists

Rules stated without a reason get violated by the next person who has a good local argument. Each of these has one.

### 1. No shadows on inline surfaces. Elevation is for overlays only.

Cards, inputs, chips, table rows and list items are separated by `--border` — a flat slate grey — and nothing else. `--shadow-sm` and `--shadow-md` appear on exactly six things: `.modal .panel`, `.slideover .panel`, `.me-sheet .panel`, `.dropdown-menu`, `.toast`, and the active `.tabbar` pill.

**Why:** shadow is the only signal the interface uses for "this floats above the page and the page behind it is inert". A dashboard is mostly cards; if cards cast shadows, the signal is spent and a modal no longer reads as modal. The active tab pill is the one inline exception, and it is the exception that proves the rule — it is a small object that genuinely sits *on top of* its track.

A shadow on a card is a bug. A shadow on a modal is the design.

### 2. Touch targets are 44px, everywhere, on every device.

`.btn`, `.btn-sm`, `.icon-btn`, `.tabbar button`, `.dropzone` and `.me-navitem` all carry `min-height: 44px`; `.icon-btn` also carries `min-width: 44px`.

**Why:** stricter than WCAG 2.2 AA (24px), matching Apple HIG and WCAG 2.1 AAA. Applied uniformly rather than only on touch devices, because "desktop" and "touch" are not the same axis any more: an admin clearing an approvals queue does it on a phone. This deliberately costs table density — `.icon-btn` went 32px → 44px, so `.datatable` rows are taller than the original mock. That cost was accepted on purpose.

`.toggle` is the single exception; [accessibility.md](./accessibility.md) explains it.

### 3. No spinners. Skeletons.

`Skeleton` / `SkeletonText` for anything loading. `Button` has a `loading` prop that sets `aria-busy` and dims the label — it deliberately renders no spinner.

**Why:** a spinner tells you nothing except that you are waiting. A skeleton tells you the shape of what is coming, so the page does not reflow under the reader when it lands, and perceived latency drops.

### 4. Styling lives in `globals.css` or in a primitive. Never a `<style>` block, never an ad-hoc inline object.

**Why this is mechanical, not aesthetic:** the reduced-motion guard, the 44px rule and the elevation rule are all written as *selector lists* in `globals.css`. A style declared anywhere else is invisible to them, and therefore silently exempt from all three. An inline `animation:` cannot be switched off by `prefers-reduced-motion`. An inline `height: 32px` cannot be raised to 44. If a primitive needs a class the stylesheet does not have, add the class.

Known exceptions, all pre-dating the rule and all worth fixing when touched: `src/components/shared/Toast.tsx` (inline styles plus the `vzToastIn` keyframe, which is also missing from the reduced-motion guard) and `src/components/shared/TopProgressBar.tsx`. The marketing components (`src/components/Hero.tsx` and the other landing sections, `src/app/(public)/for-teams|for-you|pricing|open-source|privacy|terms`) are outside the app design system by design and keep their own Tailwind and style-object layout.

**`/login`, `/join` and `/consent` are no longer in that exemption.** They are product screens that happen to sit under `(public)`, not marketing, and they now render through `.auth-*` classes and `AuthShell` — see [shells.md](./shells.md#auth-shell--the-way-in). The exemption covers pages that sell the product, not the door into it.

One thing the exemption never covered, on either side of that line: **a font family written as a literal string**. `fontFamily: 'Syne, sans-serif'` resolved while the fonts came from Google and resolves to nothing now they are self-hosted under a generated name — silently, in the system sans. Always `var(--font-heading)` / `var(--font-body)` / `var(--font-mono)`.

Note that `globals.css` already defines a `.toast` class that nothing currently uses — the live toast is the inline-styled one above. Prefer the class if you rework it.

### 5. Every decorative animation appears in the reduced-motion guard.

[motion.md](./motion.md) covers this in full, including the two categories that are handled *differently* on purpose.

## Where the vocabulary came from

The `APP DESIGN SYSTEM` block in `globals.css` was lifted from an approved revamp mock. A second block near the end of the file — labelled *gap-fill* — holds the classes the primitives needed that the mock never named (`.field-hint`, `.stack`, `.row-between`, `.icon-btn-plain`, `.tabbar .tab-badge`, and so on). Each of those replaced an inline style that would otherwise have been repeated at every call site. When you find yourself writing the same inline style twice, that block is where the third one goes.

Marketing pages are explicitly **not** part of this system. They keep their own Tailwind-utility styling, their own gradients and their own ambient animation, and changing the app design system should not touch them.
