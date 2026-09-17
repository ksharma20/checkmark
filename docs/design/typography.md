# Typography

## How the fonts load

Three families, **self-hosted by `next/font/google` in `src/app/layout.tsx`**:

```ts
const syne          = Syne({ subsets: ["latin"], display: "swap", variable: "--ff-syne" })
const dmSans        = DM_Sans({ subsets: ["latin"], display: "swap", variable: "--ff-dm-sans" })
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--ff-mono" })
```

They used to come from a `@import url("https://fonts.googleapis.com/...")` at the
top of `globals.css`, and **in production none of them ever loaded**. The CSS
build hoists and strips a remote `@import`, so every deployed page rendered in
the system sans — silently, because text still appears, just in the wrong face.
Never put a font `@import` back in that file.

`next/font` downloads the files at build time, serves them from our own origin,
and generates a size-adjusted local fallback, so there is no request to a third
party at runtime and no layout shift when the real face arrives. It also means
the privacy policy no longer lists Google Fonts as a service the browser
contacts, because it does not.

**No `weight` is passed**, on purpose. All three are variable fonts, so one file
per family carries the whole axis:

```
Syne             400–800   (no italic axis at all)
DM Sans          100–1000
JetBrains Mono   100–800
```

Two consequences worth knowing before you write a class:

- **A weight past the axis clamps, it is not synthesised.** `font-black` (900) on
  a Syne heading renders Syne 800. Spell the weight that exists — `font-extrabold`
  — so the markup says what renders.
- **Syne has no italic.** `font-syne italic` produced a synthetic oblique: the
  browser shearing upright glyphs, which is exactly the smear a type designer
  draws a real italic to avoid. The marketing headings that used it now carry
  `not-italic` on the `<em>`. Do not set `italic` on anything in Syne.

### The variable names

next/font writes `--ff-syne` / `--ff-dm-sans` / `--ff-mono` onto `<html>`. The
semantic tokens are built on those in a plain `@theme` block in `globals.css`:

```css
@theme {
  --font-heading:  var(--ff-syne), sans-serif;
  --font-body:     var(--ff-dm-sans), sans-serif;
  --font-mono:     var(--ff-mono), ui-monospace, monospace;
}
```

`@theme`, not `@theme inline`: it has to emit `--font-heading` into `:root` as
well as generate the `font-heading` utility, because around a hundred call sites
read `var(--font-heading)` directly. And the two layers are deliberately named
differently — a theme key and the raw family sharing one name would be circular.

**Never write a family name as a literal.** `fontFamily: 'Syne, sans-serif'` in a
style object resolved fine while the font came from Google and resolves to
nothing now that it is self-hosted under a generated name — and it fails
silently, in the system sans. Use `var(--font-heading)` / `var(--font-body)` /
`var(--font-mono)`, or the Tailwind `font-heading` / `font-body` / `font-mono`
utilities.

## The three roles

| Font | Token | Role |
|---|---|---|
| **DM Sans** | `--font-body` | Everything by default. Set on `body`, and inherited by `.btn`, `.input` and `.tabbar button` via explicit `font-family: inherit` — form controls do not inherit fonts on their own |
| **Syne** | `--font-heading` | Headings only. Applied by an element selector on `h1`–`h6`, plus `.brand-mark`, `.brand-name` and `.auth-title` |
| **JetBrains Mono** | `--font-mono` | `code`, `pre`, `.mono`, and `.stat-num` |

The `--font-syne` and `--font-dm-sans` aliases are **gone**. They existed so the
landing components could spell the family rather than the role, and those call
sites now use `font-heading` / `font-body` like everything else.

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
