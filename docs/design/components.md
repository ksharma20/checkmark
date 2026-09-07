# Component catalogue

`src/components/ui/` — 28 files exporting **29 components**, plus 2 helper functions and 25 types, all re-exported from the barrel `src/components/ui/index.ts`.

Import from the barrel:

```ts
import { Button, Card, Chip, Modal, toneForMatchedBy } from '@/components/ui'
```

**The stylesheet owns the visuals; these files own behaviour and accessibility.** Their classes are defined in the `APP DESIGN SYSTEM` block of `src/app/globals.css`. A primitive that needs a new look needs a new class there, not a `style={{}}`.

---

## The catalogue

| Component | Root class(es) | Required props | Notes |
|---|---|---|---|
| `Card` | `.card` (+`.card-fixed-h`) | — | `padded={false}` sets inline `padding: 0` |
| `StatCard` | `.card` (+`.rowlink` when `onClick`) | `label`, `value` | `accent` drives `.stat-num.accent-*` and `.dash-ic.accent-*` together; `position: relative` is set only when an `icon` is present |
| `Divider` | `.divider` (+`.inset`) | — | `role="separator"`; a numeric `inset` becomes inline margins |
| `EmptyState` | `.empty` | `title` | Title renders `.t-h2`, hint renders `.t-muted` |
| `Skeleton` | `.skeleton` | — | `aria-hidden`; default height 14 |
| `SkeletonText` | `.stack-sm` | — | Named export from `Skeleton.tsx`; when `lines > 1` the last line is 60% width, so a paragraph block does not read as a solid rectangle |
| `DataTable` | `table.datatable` | `columns`, `rows`, `rowKey` | `minWidth` sets `--table-min` on the `.dash-table-scroll` wrapper. **Rows are not keyboard-operable** — put a real control in a cell if the row needs an action |
| `TabBar` | `.tabbar` | `tabs`, `active`, `onChange` | `role="tablist"` / `role="tab"`; badge is `.tab-badge` and is hidden entirely at 0 rather than rendering a `0` |
| `Progress` | `.progress` | `percent` | Clamped 0–100, `NaN` → 0; `role="progressbar"`; recolour via the `--progress-fill` variable |
| `SplitBar` | `.split-bar` | `segments` | A zero total renders an empty track rather than dividing by zero |
| `WizardSteps` | `.wizard-steps` | `steps`, `currentIndex` | Dots are real `<button disabled={!onStepClick}>`; `aria-current="step"` |
| `StageDots` | `.stage-steps` | `stages`, `currentIndex` | `<span>`s, not buttons — a stage is a status, not a control. Reuses `.wizard-step-label` |
| `Button` | `.btn .btn-*` `.pressable` | — | Variants `primary` `secondary` `ghost` `danger`; sizes `md` `sm`. **No spinner by design**: `loading` sets `aria-busy` and dims the label |
| `IconButton` | `.icon-btn .icon-btn-*` | `label`, `icon` | Variants `approve` `decline` `plain` (default `plain`). `label` becomes both `aria-label` and `title` |
| `Chip` | `.chip .chip-${tone}` | `tone`, `children` | Renders `<button>` when `onClick` is given, `<span>` otherwise. Also exports `toneForMatchedBy(MatchedBy)` |
| `Avatar` | `.avatar` | `name` | `role="img"` + `aria-label`; exports `initials()`. Inline style only when `size !== 34` or a colour is given |
| `Toggle` | `.toggle` (+`.on`) | `checked`, `onChange`, `label` | A real `<button role="switch">`. Bails if `event.defaultPrevented`, so a parent row handler cannot double-fire |
| `Dropzone` | `.dropzone` (+`.compact`) | `onFile`, `label` | State lives in `data-dragging` / `data-disabled` **attributes**, not classes. Uses a drag **depth counter** so moving over a child element does not flicker the highlight. Resets the input value so re-picking the same file fires again |
| `DropdownMenu` | `.dropdown-menu` (+`.below`) | `open`, `onClose`, `items` | **Not portalled** — it needs a positioned ancestor. Closes on outside click and Escape. No roving tabindex |
| `Field` | none (`w-full`) | `label`, `children` | Hint renders only when `hint && !error`; error carries `role="alert"`. **Does not set `aria-describedby` on the control** — the caller must |
| `Input` / `Select` / `Textarea` | `.input` | `Select`: `options` | `aria-invalid` is simultaneously the a11y signal and the style hook (`.input[aria-invalid="true"]`). No `forwardRef` |
| `Modal` | `.modal > .scrim + .panel` | `open`, `onClose` | Title `.panel-title`, footer `.panel-actions` |
| `SlideOver` | `.slideover > .scrim + .panel` | `open`, `onClose` | Title uses `.t-h2`, not `.panel-title` — the only structural difference from `Modal` |
| `BottomSheet` | `.me-sheet > .scrim + .panel + .handle` | `open`, `onClose` | Deliberately unlabelled: the content supplies its own heading. Handle is decorative — there is no drag-to-dismiss |
| `AreaChart` | svg, `w-full` | `points`, `label` | `viewBox` 900×282; gridlines spread evenly over `[0, yMax]`; guards the single-point case |
| `BarChart` | `.bar-wrap` (+`.bar-wrap-lg`) | `bars`, `label` | Bar heights are a percentage of the wrapper, so any wrapper height works; `height === 150` picks the `-lg` class |
| `DeptBars` | `.stack` | `items`, `label` | `role="group"`, **not** `role="img"` — the rows carry real text, so a screen reader should read them, not a summary. The track is `aria-hidden` |

Charts live in `src/components/ui/charts/`.

---

## Cross-cutting contracts

### Client vs server

**`'use client'`:** `Button`, `IconButton`, `Chip`, `Toggle`, `Dropzone`, `DropdownMenu`, `TabBar`, `WizardSteps`, `DataTable`, `Modal`, `SlideOver`, `BottomSheet`.

**Server-renderable:** `Card`, `StatCard`, `Divider`, `EmptyState`, `Skeleton`, `Progress`, `SplitBar`, `StageDots`, `Field`, `Input`, `Select`, `Textarea`, and all three charts.

That split is worth preserving. The default in this codebase is a Server Component, and the reason half these primitives stay server-renderable is so a page made of cards, stats and charts ships no JavaScript for its chrome. Adding an `onClick` to `Card` or `StatCard` to save a wrapper would drag every dashboard into the client bundle.

`StatCard` is the interesting case: it takes an `onClick` and adds `.rowlink`, but the *component* is still server-renderable because the handler is passed in by whatever client component is rendering it.

### No `forwardRef`, anywhere

No primitive forwards a ref, so **no form primitive can receive one**. That rules out imperative `.focus()` on an `Input`, and rules out drop-in use with libraries that need a ref (react-hook-form's `register`, most of Radix). Forms in this repo are controlled and validated by hand. If you need focus management, add `forwardRef` to that one primitive deliberately rather than reaching around it with a DOM query.

### The overlay contract

`Modal`, `SlideOver` and `BottomSheet` share one implementation shape:

- Portal to `document.body`
- SSR guard via **`useSyncExternalStore`**, not `useState` + `useEffect` — the latter trips this repo's `react-hooks/set-state-in-effect` lint rule
- Escape closes, with `stopPropagation` so a nested overlay closes only itself
- `document.body` gets `overflow: hidden`, and the **previous value is restored** on close — so opening a modal from inside a slide-over does not leave the page permanently unscrollable when the inner one closes
- Focus moves to the panel on open (`tabIndex={-1}`) and returns to the trigger on close
- `role="dialog"`, `aria-modal="true"`
- Clicking the scrim closes

**None of the three implements a focus trap.** Tab can walk out of an open overlay into the page behind it. See [accessibility.md](./accessibility.md).

### Miscellaneous invariants

- `useId` is used in exactly three places: `Modal` and `SlideOver` (title id) and `Dropzone` (input id).
- `.pressable` is applied by `Button` and `IconButton` always, and by `Chip` only when it is interactive. It supplies the `scale(0.97)` press and the transition; a control that can be pressed should have it.
- **No spinners anywhere.** Forbidden by the design rules.
- **A utility class on `Select` or `Textarea` silently loses.** `globals.css` declares the
  base as `.input, select.input, textarea.input`, so on a `<select>` the winning rule is
  `select.input` at specificity **0,1,1**. A bare `.my-width` class is 0,1,0 and never
  applies — the control keeps `width: 100%` and nothing tells you. Scope it to a parent
  (`.filter-bar > .filter-select`, 0,2,0) or qualify it (`select.my-width`). This broke the
  People filter bar into three stacked rows; the search `<input>` in the same bar escaped
  only because `flex: 1` zeroes `flex-basis`, which beats `width` in flex layout.
- Most props interfaces are **not** exported — `Card`, `StatCard`, `Divider`, `EmptyState`, `Skeleton`, `DataTable`, `TabBar`, `Progress`, `SplitBar`, `WizardSteps`, `StageDots`, `Modal`, `SlideOver`, `BottomSheet` and the charts all keep theirs internal. Export one only when a caller genuinely needs to name the type.

---

## Adding a primitive

1. Check the catalogue above first. `Chip` covers most badges; `Card` + `.stack` + `.row-between` covers most layouts.
2. Put the visuals in `globals.css`, in the gap-fill block near the end of the file, with a comment saying which inline style it replaces.
3. Keep it server-renderable unless it needs state, a browser API or an event handler.
4. Get the semantics right: a real `<button>`, an `aria-label` if it is icon-only, `role`/`aria-*` where the element does not carry the meaning on its own.
5. Export it from `index.ts`. **That file is shared by every surface** — see the Task Boundaries section in `AGENTS.md` before editing it alongside other agents.
6. Update this table.
