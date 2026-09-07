# Motion

All app motion is CSS. There is no animation library, no Framer Motion, no JS tween loop. Everything below is a keyframe or a transition in `src/app/globals.css`.

---

## The four easing curves

| Token | Curve | Character | Where |
|---|---|---|---|
| `--ease-out` | `cubic-bezier(0.23,1,0.32,1)` | Leaves immediately, settles slowly | The default. `.pressable` press, hovers, all scrims, `.fx-snap`, `.progress` bar growth, `.wizard-step-dot`, `.ci-dot`, `.ci-fade-target` |
| `--ease-inout` | `cubic-bezier(0.77,0,0.175,1)` | Slow out, fast middle, slow in | Long symmetric moves. Only `.ci-ring` / `.ci-ring.r2` |
| `--ease-spring` | `cubic-bezier(0.34,1.56,0.64,1)` | Overshoots past the target and settles back | `.toggle .knob`, `.modal .panel`, `.slideover .panel`, `.toast`, `.fx-spring`, `.ci-badge` |
| `--ease-drawer` | `cubic-bezier(0.32,0.72,0,1)` | Very fast start, very long tail, no overshoot | `.me-sheet .panel` only |

**How to choose.**

`--ease-out` is the default because most UI motion is a *response* to something the user just did. The user already knows the action happened; the animation only has to not feel abrupt. Starting fast keeps it feeling instant.

`--ease-spring` overshoots — the `1.56` control point takes the value past 1 before returning. That is a physical cue: it says the thing has mass and just arrived. Use it for objects that appear (modal, toast) or snap between two states (the toggle knob). **Never use it on something that has to land precisely against an edge**, because the overshoot will visibly push past that edge.

`--ease-drawer` exists for exactly that reason. A bottom sheet travels the full height of the screen and has to stop flush with the bottom edge; a spring would bounce it off-screen and back. The `0.32,0.72,0,1` curve covers most of the distance immediately and then decelerates for a long time, which reads as weight without any overshoot.

`--ease-inout` is symmetric, so it suits a motion with no clear "start" gesture — the check-in rings expand outward from nothing and fade, and neither end is an arrival.

---

## The three motion tiers

Entrance animation is standardised into three classes. Pick by how much the thing being revealed matters.

### `.fx-snap` — 150ms

```css
.fx-snap { animation: fxSnap 150ms var(--ease-out) both; }
@keyframes fxSnap { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
```

For small, immediate things: page titles and header rows on the `/ws` screens, and `.dropdown-menu`, which reuses the `fxSnap` keyframe directly. 150ms is under the ~200ms threshold at which motion starts to feel like latency, so it softens the appearance without ever making the user wait.

### `.fx-spring` — 480ms

```css
.fx-spring { animation: fxSpring 480ms cubic-bezier(0.34,1.56,0.64,1) both; }
@keyframes fxSpring {
  0%   { opacity: 0; transform: scale(0.82) translateY(6px); }
  60%  { opacity: 1; transform: scale(1.035) translateY(0); }
  100% { transform: scale(1) translateY(0); }
}
```

For a **section arriving** — a dashboard card, a settings panel, a modal (`.modal .panel` reuses this keyframe at 320ms). The overshoot to `1.035` at 60% is small enough to read as liveliness rather than bounce.

Used across `/me`, `/ws`, and most of the `/ws/[slug]/settings/*` tabs.

### `.fx-spring-stagger` — 420ms, cascading

```css
.fx-spring-stagger > * { animation: fxSpring 420ms cubic-bezier(0.34,1.56,0.64,1) both; }
/* :nth-child(1..8) → 0, 40, 80, 120, 160, 200, 240, 280ms */
/* :nth-child(n+9)  → 320ms, all together */
```

Put it on a **container**; the children animate in sequence. For a grid of stat tiles or a list of cards, where a cascade reads as the page composing itself rather than snapping into place.

The `n+9` clamp is the important detail: past eight children every remaining item shares a 320ms delay. Without it, a 40-row table would take 1.6 seconds to finish appearing and the last rows would arrive long after the user started reading the first ones. **A stagger must have a ceiling.** If you write a new stagger, clamp it.

Each child animates slightly faster than a lone `.fx-spring` (420 vs 480ms) so the whole cascade still completes quickly.

### Related, not a tier

`.page-enter` (`0.38s cubic-bezier(0.22,1,0.36,1)`, opacity + 16px rise) is the route-transition animation, applied by `PageTransition` inside both shells. `.reveal` / `.reveal.visible` is a scroll-triggered marketing pattern, not app UI.

---

## Interaction feedback

Three layers, all global, all in `globals.css`:

1. **Press scale** — `.pressable`, `.navitem`, `.rowlink` transition transform/background/border/shadow/opacity at 140–160ms `--ease-out`, and `:active` applies `scale(0.97)`.
2. **Brightness dip** — every `button:not([disabled])` and `a[href]` dims to `brightness(0.86)` on `:active` over 70ms, easing back over 180ms. Fast in, slow out: the dip must land within the same frame as the finger, the recovery can be leisurely. Both selectors also set `-webkit-tap-highlight-color: transparent` to kill the mobile Safari grey box.
3. **Ripple** — `RippleProvider` (mounted in the root layout) listens for `pointerdown` on `document`, finds the nearest `button` or `a[href]`, and injects a `<span class="click-ripple">` sized to cover the control from the tap point. It picks a white or blue-tinted fill by measuring the control's background luminance, and temporarily sets `position: relative` / `overflow: hidden` so the circle clips. Opt out with `data-no-ripple`.

Because the ripple is delegated at the document level, **every button in the app gets it for free** — including ones inside third-party or ad-hoc markup. That is also why it needs special handling under reduced motion (below).

---

## The check-in celebration — `.ci-*`

The one bespoke animation in the app, in `src/components/user/CheckinButtons.tsx`. It fires once, after a successful check-in, inside a fixed-height `.ci-stage` (180px) so nothing below it reflows while it plays.

| Class | Timing | What it does |
|---|---|---|
| `.ci-ring.play` | `ciRing` 900ms `--ease-inout` | A 96px ring expands to `scale(2.1)` and fades from 0.75 to 0 |
| `.ci-ring.play.r2` | `ciRing2` 1100ms, 120ms delay | A second, fainter ring (0.45) expands further, to `scale(2.6)` |
| `.ci-badge.play` | `ciBadge` 640ms `--ease-spring` | The 88px tick badge scales `0.4 → 1.22 → 0.94 → 1` while rotating `-10° → 4° → -2° → 0°` |
| `.ci-dot.play` | `ciDot` 750ms `--ease-out`, 280ms delay | Particles scatter to per-dot `--dx` / `--dy` and shrink to `scale(0.3)` while fading |
| `.ci-fade-target` | 220ms transition | Surrounding content fades and rises 4px into place once the badge has landed |

The staging is the point. The badge's overshoot peaks at 55% of 640ms (~350ms); the dots do not start until 280ms; the rings run long and faint underneath. Everything is choreographed around the badge landing, so the sequence reads as one event rather than four animations that happen to run at once.

Radial offsets come in as `--dx` / `--dy` custom properties per dot — one shared class, per-instance values, no inline `animation`.

---

## The reduced-motion contract

`globals.css` ends with a `@media (prefers-reduced-motion: reduce)` block that is a **comprehensive guard, not a sample**. The comment above it says so:

> Every decorative animation in this stylesheet is listed; add new ones here when introduced.

**If you add a decorative animation, you add its selector to that block in the same change.** A user who has asked their OS not to animate things has usually asked because motion makes them ill. An animation missing from the guard is not a cosmetic oversight.

There is also a second, older guard higher up the file covering `.fx-spring` and `.fx-spring-stagger > *`; the main block covers them again. That is harmless duplication, not two competing rules.

### Category 1 — kill completely

```css
.fx-snap, .fx-spring, .fx-spring-stagger > *,
.ci-ring, .ci-badge, .ci-dot, .ci-fade-target,
.skeleton, .progress > div, .livedot, .signal-row.pulse .dot,
.slideover .scrim, .slideover .panel,
.modal .scrim, .modal .panel,
.me-sheet .scrim, .me-sheet .panel,
.toast, .dropdown-menu,
.page-enter, .reveal {
  animation: none !important;
  transition: none !important;
  opacity: 1 !important;
  transform: none !important;
}
```

These are entrances and ambience. Forcing `opacity: 1; transform: none` puts each element straight into its final state, which is exactly where the animation would have ended. A modal still appears — it just appears instantly.

Note what this catches that is easy to forget: the **skeleton shimmer**, the **progress bar's grow-in**, the **live dot pulse** and the **pulsing signal dot**. Those are infinite loops. An infinite loop is the worst offender for a motion-sensitive user, and all three are purely decorative — the skeleton still reads as a placeholder without shimmering, and the live dot still reads as live because it is brand blue.

### Category 2 — transition only, transform preserved

```css
/* Transition-only: these carry a MEANINGFUL transform in their end state. */
.toggle .knob, .bar { transition: none !important; }
```

`.toggle .knob` is positioned at `left: 2px` and moves to the "on" position with `transform: translateX(17px)`. `.bar` (the chart column) has its height animated by a `transition: height`.

If these were in category 1, `transform: none !important` would **strand the toggle knob at the off position while the track is blue** — a switch that says on and looks off. The transform is not decoration here; it *is* the state.

So only the easing is removed. The knob still moves, it just moves instantly. That is the correct reduced-motion behaviour anyway: reduced motion means no animation, not no state change.

**The test to apply:** does the element's final `transform` (or transitioned property) carry information? If yes, remove only the `transition` / `animation`. If it is purely a starting offset the element animates *away from*, category 1 is right.

### Category 3 — remove from the page entirely

```css
/* Purely decorative and injected at runtime by RippleProvider. Forcing
   opacity/transform would leave a permanent visible circle, so remove it. */
.click-ripple { display: none !important; }
```

`.click-ripple` is a `<span>` that `RippleProvider` appends to a control at `pointerdown`. Its base style is `transform: scale(0)` — invisible — and the `click-ripple` keyframe scales it up and fades it out, after which an `animationend` listener removes the node.

Category 1 would be catastrophic here. `opacity: 1 !important; transform: none !important` resolves to a full-size, fully-opaque circle sitting on the button. Worse, killing the animation means `animationend` never fires, so the cleanup listener never runs and the node never leaves — the fallback `setTimeout` removes it after 700ms, but the user still sees a solid disc flash over every control they touch.

`display: none` is the only correct answer: the element is decoration with no end state worth preserving, so it should not render at all.

**The test to apply:** is this element injected at runtime and defined *entirely* by its animation? Then `display: none` — do not try to freeze it into a final frame it does not have.

### Marketing

```css
.animate-float, .animate-marquee { animation: none !important; }
```

The Hero's floating blobs and the logo marquee. Both are infinite loops with no end state that matters.

### Known gap

`vzToastIn`, the keyframe used by the live `ToastProvider` in `src/components/shared/Toast.tsx`, is applied as an **inline style** and therefore is not reachable from the guard's selector list. It is a 0.28s fade-and-rise, so the impact is small, but it is a live example of why rule 4 in [README.md](./README.md) exists: a style that is not in the stylesheet cannot be governed by the stylesheet. The same applies to `cm-progress` in `TopProgressBar.tsx` and `cm-pulse` in `src/app/ws/[slug]/members/[memberId]/page.tsx`.

---

## Checklist for new motion

1. Can an existing tier do it? `.fx-snap`, `.fx-spring`, `.fx-spring-stagger` cover almost every entrance.
2. Pick an existing `--ease-*` token. A new curve needs a reason the four cannot express.
3. Keep it short. 150ms for a response, ~400–500ms for an arrival, and nothing over ~1s that is not a one-shot celebration.
4. If it staggers, clamp the delay.
5. **Add it to the reduced-motion guard**, in the right category — and put a comment explaining the choice if it is not category 1.
6. Never write an inline `animation:`. It cannot be guarded.
