# Typography

Three fonts, one loaded `@import` at the top of `src/app/globals.css`:

```
DM Sans            300 400 500 600 700 800, italic 400
Syne               400 500 600 700 800
JetBrains Mono     400 500 600 700
```

## The three roles

| Font | Token | Role |
|---|---|---|
| **DM Sans** | `--font-body`, `--font-dm-sans` | Everything by default. Set on `body`, and inherited by `.btn`, `.input` and `.tabbar button` via explicit `font-family: inherit` — form controls do not inherit fonts on their own |
| **Syne** | `--font-heading`, `--font-syne` | Headings only. Applied by an element selector on `h1`–`h6`, plus `.brand-mark` and `.brand-name` |
| **JetBrains Mono** | `--font-mono` | `code`, `pre`, `.mono`, and `.stat-num` |

Syne is a wide geometric display face. It is doing one job: making a heading unmistakably a heading without needing a large size jump, in a product whose pages are dense with numbers and tables. Its wide, idiosyncratic letterforms lose legibility at small sizes and in running text — that is why it is kept to headings. Do not use it for body copy, labels or buttons.

`body` also sets `-webkit-font-smoothing: antialiased` and `-moz-osx-font-smoothing: grayscale`, which keeps the Syne and DM Sans strokes from looking heavy on macOS.

## The `.t-*` scale

Six classes, all in `globals.css`. Sizes are fixed pixels except `.t-display`, which is fluid.

| Class | Definition | Use |
|---|---|---|
| `.t-display` | `clamp(1.9rem, 4vw, 2.6rem)`, line-height `1.05`, tracking `-0.025em`, weight 700 | Page-level hero text. Rare in-app |
| `.t-h1` | `21px` / 700 | Page title |
| `.t-h2` | `16px` / 700 | Section and card titles. Also the `SlideOver` title |
| `.t-eyebrow` | `11px` / 700, `0.05em` tracking, uppercase, `--text-muted` | The small label above a value — `StatCard`'s label, card section kickers |
| `.t-secondary` | `13.5px`, `--text-secondary` | Supporting body text |
| `.t-muted` | `12.5px`, `--text-muted` | Hints, timestamps, empty-state copy |

Notice the scale is **flat**: 21 / 16 / 13.5 / 12.5 / 11. There is no 32px or 24px step in-app. Hierarchy is carried by weight, colour and the Syne/DM Sans switch rather than by size, because a dashboard with four cards per row has no room for a dramatic type ramp. Resist adding an intermediate step — if a heading is not reading as important enough, the fix is usually spacing or an eyebrow above it, not a bigger number.

`.t-display` is the exception and is fluid because it appears at the top of otherwise-empty pages where the viewport, not the layout, sets the budget.

None of the `.t-*` classes set a font family. `.t-h1` and `.t-h2` are usually put on an `<h1>`/`<h2>`, which picks up Syne from the element selector. Putting `.t-h2` on a `<div>` gives you the size and weight in DM Sans — sometimes what you want inside a card, but be deliberate about it, and prefer a real heading element for anything a screen reader should be able to navigate to.

## `.stat-num` — the numeric style

```css
.stat-num {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 30px;
  letter-spacing: -0.02em;
  color: var(--navy);
}
```

This is the single style for a headline number: attendance counts, present-today, leave balances, asset totals. `StatCard` applies it automatically.

**Why mono for numbers.** JetBrains Mono is tabular by construction — every digit occupies the same advance width. In a `.me-statgrid` row of four tiles, or a column of counts in a `.datatable`, proportional digits make the numbers jitter horizontally as they update and make columns fail to align. Monospaced digits keep a polling dashboard visually still.

The `-0.02em` tracking claws back some of the width monospace costs, so a five-digit number still fits a narrow tile.

### Accents

```css
.stat-num.accent-brand   { color: var(--brand); }
.stat-num.accent-amber   { color: var(--amber); }
.stat-num.accent-danger  { color: var(--danger); }
```

`StatCard`'s `accent` prop applies these, and applies the matching `.dash-ic.accent-*` to the card's corner icon so the number and its icon always agree. Default (no accent) is `--navy`. Use an accent only when the number carries a state — pending approvals in amber, missing check-ins in danger — never for decoration.

### Density override

`.me-statgrid` shrinks the scale for the four-across tiles on the `/me` home screen, where a 30px number would not fit:

```css
.me-statgrid .stat-num  { font-size: 19px; }
.me-statgrid .t-eyebrow { font-size: 9px; letter-spacing: 0.02em; line-height: 1.35; }
.me-statgrid .card      { padding: 12px 6px; text-align: center; }
```

This is the sanctioned pattern for a density variant: a container class that overrides the shared classes inside it, rather than a second set of `.stat-num-sm` classes or per-call-site inline styles.

## Other type-bearing classes

| Class | Size / weight | Where |
|---|---|---|
| `.field-label` | 11.5 / 600, `--text-secondary` | `Field`'s label |
| `.field-hint` | 12.5, `--text-muted` | `Field`'s hint |
| `.field-error` | 12.5, `--danger` | `Field`'s error |
| `.input` | 13.5, inherited family | All three form controls |
| `.btn` | 13.5 / 600 · `.btn-sm` 12.5 | Buttons |
| `.chip` | 11 / 700 | Status pills |
| `.datatable th` | 11 / 700, uppercase, `0.04em` | Table headers |
| `.datatable td` | 13 | Table cells |
| `.navitem` | 13.5 / 500 (700 when active) | `/ws` sidebar |
| `.me-navitem` | 10.5 / 600 | `/me` bottom nav |
| `.panel-title` | 16 / 700 | `Modal`'s title |
| `.wizard-step-label` | 12.5 / 600 | Stepper labels |
| `.avatar` | 12.5 / 700 | Initials |

## Adding type

Do not add a new size. Use an existing `.t-*` class, or — if a whole region genuinely needs to be denser — add a **container** override in the style of `.me-statgrid`. A one-off `fontSize` in a component is both invisible to this scale and a violation of rule 4 in [README.md](./README.md).
