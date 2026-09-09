# Accessibility

What the design system guarantees, how it guarantees it, and where it currently falls short.

---

## Touch targets: 44px, uniformly

```css
.btn, .btn-sm, .icon-btn, .dropzone, .me-navitem, .tabbar button { min-height: 44px; }
.icon-btn { min-width: 44px; }
.dropzone.compact { height: auto; min-height: 44px; }
```

**44px, not 24px.** WCAG 2.2 AA sets 24×24 CSS px; this system uses 44, matching Apple HIG and WCAG 2.1 AAA.

**Uniformly, not just on touch devices.** There is no `@media (pointer: coarse)` around this rule. "Desktop" and "mouse" stopped being the same thing: an admin clearing an approvals queue does it on a phone as often as at a desk, and a rule that only applies on some devices is a rule that gets forgotten on the others.

**And it costs something.** `.icon-btn` is styled at 32×32 but floored to 44×44, so `.datatable` rows carrying approve/decline buttons are taller than the original mock. `.btn-sm` is styled 34px tall and floored to 44 — meaning `.btn-sm` is now a *narrower and lighter* button, not a shorter one. That density loss was accepted deliberately; the comment above the rule in `globals.css` says so. Do not "restore" the mock's compactness by overriding it.

Note the mechanism: `min-height` on top of the existing `height`. A later `height:` declaration cannot shrink these below 44px, which is what makes the rule hard to break by accident.

### The one exception: `.toggle`

```css
.toggle { width: 42px; height: 25px; position: relative; }
.toggle::after {
  content: ''; position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 44px; height: 44px;
}
```

The switch keeps a **42×25 visual** and gets its 44×44 target from a transparent `::after` overlay centred on it.

**Why it is exempt from the paint and not from the rule.** A switch is a recognised control with a recognised proportion — a rounded track roughly 1.7× as wide as it is tall, with a knob nearly filling it. Stretch the track to 44px tall and it stops looking like a switch: it becomes a green lozenge with a small circle floating in it, which reads as a rendering bug, not as an on/off control. Users who cannot identify the control do not benefit from being able to hit it.

The rule is about the **hit area**, not the paint. So the paint stays correct and the hit area is satisfied by an invisible overlay that extends ~9px above and below and ~1px to each side. Nothing is lost: a finger anywhere in the 44×44 box toggles the switch.

This is the sanctioned pattern for any future control whose recognisable form is smaller than 44px. Use `::after`, not padding — padding would move the surrounding layout.

---

## Real elements, real semantics

The primitives never fake a control with a `<div onClick>`:

- `Button`, `IconButton`, `Toggle`, `TabBar`, `WizardSteps`' dots, `DropdownMenu` items and interactive `Chip`s are all real `<button>`s. They get keyboard activation, focus, and the correct AT role for nothing.
- `Toggle` is `<button role="switch">` with `aria-checked`, not a styled checkbox.
- `Input`, `Select` and `Textarea` are the real elements with `.input` on them.
- `Chip` renders `<span>` when it is not interactive — a status pill is not a button, and giving it one would put a meaningless stop in the tab order.
- `StageDots` renders `<span>`s while `WizardSteps` renders `<button>`s, for the same reason: a stage is a status, a wizard step is a destination.
- `Divider` carries `role="separator"`; `Progress` carries `role="progressbar"`; `Avatar` carries `role="img"` with an `aria-label`.
- `DeptBars` uses `role="group"`, **not** `role="img"`, because its rows carry real text that a screen reader should read; only the decorative track is `aria-hidden`.

If you need something clickable that is not a button, the answer is a `<button>` with `.rowlink` or `.pressable`, not a div.

## Labels on icon-only controls

`IconButton` makes `label` a **required** prop and applies it as both `aria-label` and `title`:

```tsx
<button aria-label={label} title={label}>
  <span aria-hidden="true">{icon}</span>
</button>
```

The icon itself is `aria-hidden`, so the accessible name is the label and nothing else. Because `label` is required, an unlabelled icon button is a type error rather than an audit finding — that is the point of making it required instead of optional.

`Button` applies the same `aria-hidden` to its optional `icon`, so a button with an icon and text is announced once, not twice.

## Loading and busy states

**No spinners, anywhere.** Two consequences for accessibility, both good:

- `Skeleton` is `aria-hidden`, so a screen reader is not read a placeholder. `SkeletonText` mirrors the shape of the text that is coming — last line at 60% when there is more than one — so the sighted reader sees the eventual layout and the page does not reflow underneath them.
- `Button`'s `loading` prop sets `aria-busy` and dims the label rather than swapping in an animation. The state is announced rather than merely drawn, and there is no infinite animation for a motion-sensitive user to sit through.

## Live regions

The live toast (`src/components/shared/Toast.tsx`) switches by kind: errors get `role="alert"` + `aria-live="assertive"`; everything else gets `role="status"` + `aria-live="polite"`. Errors interrupt; confirmations wait for a pause. Copy that pattern for any new transient message.

`Field`'s error renders with `role="alert"`, so a validation message announces when it appears.

## Focus

`--ring` at `rgba(29,158,117,0.28)` is the focus indicator: `.input:focus` gets `border-color: var(--brand)` plus `box-shadow: 0 0 0 3px var(--ring)`. Invalid fields swap the ring to a danger-tinted one. It is the stronger of the two glow tokens precisely because it has to be seen — see [tokens.md](./tokens.md).

Overlays move focus to the panel on open (`tabIndex={-1}`) and restore it to the trigger on close.

---

## Known gaps

Listed here so nobody has to rediscover them, and so nobody assumes they are handled.

### 1. ~~No overlay implements a focus trap~~ — FIXED

This entry described `Modal`, `SlideOver` and `BottomSheet` setting `aria-modal="true"` over a background that was still fully tabbable. **That is no longer true, and had not been for some time before the doc was corrected.** The trap lives in `useFocusTrap` (`src/components/ui/use-focus-trap.ts`), applied by `useOverlay` as `useFocusTrap(panelRef, open && mounted)` — so all three overlays get it from the one shared implementation, exactly as this entry recommended. The `/ws` navigation drawer reuses the same hook.

Kept rather than deleted because the claim was cited elsewhere: anything still asserting the gap is stale, not describing a regression.

### 2. `Field` does not wire `aria-describedby`

`Field` renders the hint and the error, but does not set `aria-describedby` on the control it wraps. The caller must, or the hint and error are visible but unannounced. Because `Field` does not own the control (it takes `children`), it cannot do this without an id contract; adding one would be a good change.

### 3. `DataTable` rows are not keyboard-operable

If a row needs an action, put a real control in a cell. Do not add a row-level `onClick`.

### 4. `DropdownMenu` has no roving tabindex

It closes on Escape and on outside click, but arrow keys do not move between items. It is also **not portalled**, so it needs a positioned ancestor.

### 5. No component uses `forwardRef`

No form primitive can receive a ref, so imperative `.focus()` on an `Input` is not available. Relevant to error handling: you cannot currently focus the first invalid field after a failed submit.

### 6. Three animations sit outside the reduced-motion guard

`vzToastIn` (`Toast.tsx`), `vnz-progress` (`TopProgressBar.tsx`) and `vnz-pulse` (`src/app/ws/[slug]/members/[memberId]/page.tsx`) are declared inline or in per-component `<style>` blocks, so the `prefers-reduced-motion` block in `globals.css` cannot reach them. See [motion.md](./motion.md).

---

## Checklist for new UI

- Is every interactive thing a real `<button>`, `<a>` or form control?
- Does every icon-only control have an accessible name, with the icon `aria-hidden`?
- Does every hit target clear 44×44 — and if the visual cannot, does an `::after` overlay carry it?
- Does any new decorative animation appear in the reduced-motion guard, in the right category?
- Is loading a skeleton, not a spinner?
- Does a status colour also carry text? Colour is never the only signal — every `Chip` has a label.
- If it is an overlay, does it use one of the three primitives rather than a new one? Fixing the focus-trap gap once should fix it everywhere.
