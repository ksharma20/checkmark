# Shells

Two page frames, one per product surface. They share the token set and the primitives and nothing else — different widths, different navigation, different density, because they answer different questions.

| | `.shell-me` | `.shell-ws` |
|---|---|---|
| Route | `/me/*` | `/ws/:slug/*` |
| Built by | `src/app/me/layout.tsx` | `src/app/ws/[slug]/layout.tsx` → `src/components/ws/WsLayoutClient.tsx` |
| Posture | Mobile-first | Desktop-first |
| Width | 460px column, centred | 228px sidebar (64px collapsed) + 1180px content |
| Nav | Fixed bottom bar | Collapsible left sidebar → off-canvas drawer under 860px |
| Manifest | `/manifest-me.json` | `/manifest-ws.json` |
| `theme-color` | `#f0faf5` (`--surface-1`) | `#0d2118` (`--header-bg`) |

Both are installable PWAs with separate manifests, so a member and an admin can have both icons on one device.

---

## `.shell-me` — the member surface

```css
.shell-me {
  max-width: 460px; margin: 0 auto; min-height: 100vh;
  display: flex; flex-direction: column; position: relative;
}
.me-topbar  { padding: 20px 20px 6px; }
.me-content { flex: 1; padding: 6px 20px 100px; }
```

Structure: `MeTopbar` → `<main class="me-content">` (wrapping children in `PageTransition`) → `BottomNav`, all inside a `ToastProvider`. The layout sets `background: var(--surface-1)` inline on the shell.

**460px, centred, on every viewport.** It does not expand on a desktop monitor. This surface is one person recording their own presence — a check-in button, a timeline, a leave form. A 1400px-wide version of that would be a worse experience, not a better one, and maintaining a responsive second layout for it would cost more than it returns.

The `100px` bottom padding on `.me-content` is the clearance for the fixed bottom nav. There is no separate spacer element; if you change the nav's height, change this.

### The bottom nav

```css
.me-bottomnav {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 460px; display: flex;
  background: color-mix(in srgb, var(--surface-0) 85%, transparent);
  backdrop-filter: blur(18px); border-top: 1px solid var(--border);
  padding: 8px 6px calc(8px + env(safe-area-inset-bottom)); z-index: 10;
}
```

`position: fixed` plus `left: 50%` / `translateX(-50%)` rather than `margin: auto`, because a fixed element is out of flow and cannot inherit the shell's centring.

The 85%-opaque background with an 18px backdrop blur means content scrolls visibly *under* the nav rather than being clipped by an opaque bar — the standard iOS pattern, and it makes the 460px column feel taller than it is.

`.me-navitem` carries `min-height: 44px` and `justify-content: center` (see [accessibility.md](./accessibility.md)); active items switch to `--brand`.

### The top bar control set

`MeTopbar` is one flex row, `justify-content: space-between`: a **workspace pill on the left** and a **right-hand cluster** of admin-view control → notification bell → avatar.

| Slot | Element | Sizing |
|---|---|---|
| Left | `.ws-pill` — swatch + workspace name + `▾`, opens the switcher `BottomSheet` | `min-width: 0`, name truncates with `text-overflow: ellipsis` |
| Right 1 | Admin-view link — `.icon-btn .icon-btn-plain`, icon only, pill border | `flex-shrink: 0` |
| Right 2 | `NotificationBell` | `flex-shrink: 0` |
| Right 3 | `.avatar`, opens the profile sheet | 34px, `flex-shrink: 0` |

The pill is the flexible one and everything on the right is fixed, so a long workspace name eats its own width rather than pushing the controls off a 460px column. Both the pill and the avatar are real `<button>`s with `aria-haspopup="dialog"`.

**The admin-view control is icon-only and conditional.** It renders only for someone whose role grants the org surface in *at least one* workspace (`hasAnyOrgAccess`, resolved server-side in the layout). It targets `/ws/{slug}` for the active workspace when that workspace grants access, and falls back to the `/ws` picker when it does not — they are an admin, just not here. It lives in the top bar rather than in the switcher sheet because changing *surface* is a different action from changing *workspace*.

**It deliberately has no entry animation.** No `.fx-snap`, no `.fx-spring`. It is a persistent control present on every `/me` page load, and a thing the reader sees constantly must not keep drawing attention to itself by moving. Entry motion is for content that just arrived; chrome that is always there is not that. It still carries `.pressable` — feedback on *your* action is a different tier from unprompted entry motion (see [motion.md](./motion.md)).

### Safe-area insets

Two halves, and both are needed:

```css
html { padding-top:  env(safe-area-inset-top);
       padding-left: env(safe-area-inset-left);
       padding-right:env(safe-area-inset-right); }
body { padding-bottom: env(safe-area-inset-bottom); }
.me-bottomnav  { padding-bottom: calc(8px + env(safe-area-inset-bottom)); }
.me-sheet .panel { padding-bottom: calc(20px + env(safe-area-inset-bottom)); }
```

Top/left/right are handled once on `html`, so nothing in the app has to think about the notch or a landscape cutout. The bottom is handled *per fixed element*, because `body`'s bottom padding does nothing for something that is `position: fixed` — a fixed bottom bar sits on the home indicator unless it adds the inset itself. Any new fixed-to-bottom element needs the same `calc()`.

---

## `.shell-ws` — the org surface

```css
.shell-ws { display: flex; min-height: 100vh; }
.sidebar  { width: 228px; flex-shrink: 0; position: sticky; top: 0; height: 100vh;
            border-right: 1px solid var(--border); padding: 20px 14px; }
.ws-main  { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ws-topbar{ height: 64px; position: sticky; top: 0; z-index: 5;
            backdrop-filter: blur(14px);
            background: color-mix(in srgb, var(--surface-0) 88%, transparent); }
.ws-content { padding: 28px; max-width: 1180px; width: 100%; margin: 0 auto; }
```

**The page scrolls, not an inner div.** The sidebar is `position: sticky; height: 100vh`, so it stays put while the document scrolls underneath it. The alternative — an inner scroll container — would break the topbar's own `position: sticky` and break the browser's scroll restoration on back-navigation. `WsLayoutClient`'s header comment says this explicitly; do not "fix" it into an overflow container.

`min-width: 0` on `.ws-main` (and globally on `*`) is what stops a wide table from forcing the whole flex row wider than the viewport. Flex children default to `min-width: auto`, which means they refuse to shrink below their content.

`.ws-content` caps at 1180px and centres. Wide content that genuinely cannot wrap — `.datatable` — goes inside a `.dash-table-scroll` wrapper that scrolls horizontally on its own (`--table-min`, default 640px). **The page body must never scroll horizontally**; `html` and `body` both set `overflow-x: hidden` as a backstop.

The topbar carries the workspace switcher pill (`.ws-pill`, linking to `/ws`), the role and plan chips, the notification bell, and — below 860px only — the account menu.

#### `.stat-row` — the headline tiles

The row of `StatCard` tiles at the top of a `/ws` screen is a **grid**, not a wrapping flex row:

```css
.stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
@media (max-width: 860px) { .stat-row { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); } }
```

`auto-fit` with a 200px floor seats `n` tracks while `n*200 + (n-1)*14 <= W` — arithmetically the same test a wrapping `flex: 1 1 200px` row applied, so the desktop keeps the tile count and tile width it has always had. What it adds is a **floor you can change at a breakpoint**, which a `flex-basis` written inline could not offer: at 200px a second tile needs 414px, so a 354px phone column fell to one tile per row and stacked 571px of headline numbers above everything else. The 150px floor seats two from 320px up.

The phone override lives beside the base rule in `globals.css`, **not** in the `@media (max-width: 860px)` shell block further up the file. Both selectors are `.stat-row` at equal specificity, so the one written later wins — a copy in the shell block would be silently overridden by the base rule below it.

### The sidebar is generated, not written

`WsSidebar` renders from `visibleScreenGroups()` in `src/lib/permissions/screens.ts`, filtered by the role's readable resources and by workspace feature flags. There is no hardcoded nav array. Two consequences:

- Adding a `/ws` screen means adding a `Screen` enum member and a `SCREEN_DEFS` entry, not editing the sidebar.
- Hiding a tab is a **courtesy**. The matching API route enforces the same permission independently. Never treat sidebar filtering as access control.

Groups are `Workforce` and `Manage`; a group with no visible screens is dropped rather than rendering an empty heading.

### One sidebar, three presentations

**It is a sidebar at every width.** The ≤860px horizontal tab strip is gone. Which of the three presentations is on screen is decided entirely by the breakpoint and two `data-` attributes on `.shell-ws` — `WsSidebar` renders the same markup in all three and contains no responsive JS.

| | ≥861px | ≤860px |
|---|---|---|
| `data-nav="expanded"` | 228px column | drawer, full labels |
| `data-nav="collapsed"` | 64px icon rail | *(no effect)* |
| `data-drawer="open"` | *(no effect)* | drawer slid in, scrim over the content |

The two states are independent and **each is meaningless at the other's width**, which is the whole reason neither component has to measure the viewport. Every rail rule lives inside `@media (min-width: 861px)`; every drawer rule inside `@media (max-width: 860px)`. An overlay has no width to trade back to the content, so "collapsed" says nothing about a drawer; a column is always on screen, so "open" says nothing about a rail.

#### `data-nav` persists, `data-drawer` does not

`data-nav` is written to the **`vnz_nav` cookie** and read by `src/app/ws/[slug]/layout.tsx`, a Server Component, which passes `initialNavCollapsed` down. That is the point of using a cookie rather than `localStorage`: the server has to know the width *before it paints*, or every navigation renders a 228px sidebar and snaps it to 64px once JS boots. Same reasoning, and the same non-httpOnly "UI preference, not a credential" argument, as `vnz_ws` on `/me`.

`data-drawer` is deliberately **not** persisted. A navigation drawer that reopens itself on the next page is a bug, not a preference. It is closed by: a tap on any `.navitem` (`onNavigate`), the scrim, Escape, a render-phase check on `pathname` (which catches browser back/forward), and a `matchMedia` listener crossing to ≥861px.

#### The drawer reuses `useOverlay`

Escape, body-scroll lock with previous-value restore, focus into the panel on open, focus back to the opener on close, **and the focus trap** all come from `src/components/ui/use-overlay.ts` — the same contract `Modal`, `SlideOver` and `BottomSheet` share. The drawer supplies markup and a design-system block, nothing behavioural. It is not portalled (it is part of the shell), so the hook's `mounted` portal guard goes unused.

`SlideOver` was **not** reused: it is right-anchored, 380px, `role="dialog"` with a title. This is a left-anchored full-height `<nav>`.

The `matchMedia` listener is the one piece of responsive JS in the shell and it earns its place: the focus trap is only correct while the sidebar is an overlay. Open the drawer on a phone, rotate past 861px, and without it the trap would hold focus inside a sidebar that has become an ordinary inline column.

#### Two details in the drawer CSS that are load-bearing

**`visibility`, not just `transform`.** A drawer translated off-screen is still in the tab order — a keyboard user would tab into an invisible nav. `visibility: hidden` fixes that, but the transition has to be written as a **delay, not a duration**, in each direction:

```css
.sidebar                          { visibility: hidden;  transition: transform 280ms var(--ease-drawer), visibility 0s linear 280ms; }
[data-drawer="open"] .sidebar     { visibility: visible; transition: transform 280ms var(--ease-drawer), visibility 0s; }
```

Closing holds `visible` for the length of the slide so it is not cut off at frame one. Opening flips immediately — a *duration* there meant the computed value was still `hidden` in the same tick the shell set `data-drawer="open"`, and `useOverlay` focuses the panel in exactly that tick. **Focus on a `visibility: hidden` element is silently refused**, so the drawer opened with focus stranded on `<body>` and the trap holding nothing.

**`position: fixed` needs an ancestor with no transform.** See the `.page-enter` note under [Overlays](#overlays-and-their-surfaces) — this is why the drawer and its scrim are viewport-sized rather than document-sized.

#### What the topbar does below the breakpoint

The **hamburger** (`.nav-drawer-toggle`) appears; the rail toggle hides. `.sidebar-foot` — which holds the account menu in the column — is hidden and `.topbar-account` takes over. One account menu, two positions, no duplicated component; `WsAccountMenu` takes a `variant` prop for this.

The topbar also sheds the **plan** chip. Five controls do not fit beside a workspace name at 360px, and the plan is the one that changes least and is least actionable — it stays in Settings › Billing. The **role** chip stays: it is what tells an admin why their screen differs from a colleague's. `.topbar-actions .chip` is `flex-shrink: 0`, because `.chip` is `white-space: nowrap` — shrinking one does not reflow it, it clips the word.

#### The 64px rail

228 → 64 with 8px gutters, leaving a 48px track — which is what lets a `.navitem` keep the 44px minimum target around an 18px glyph. Four things have to survive the collapse:

- **The accessible name.** `.navitem-label` is hidden with the `.visually-hidden` declarations, never `display: none`. A `title` is added as well, but a tooltip needs hover and the rail starts at 861px, so touch tablets get none — which is why the *icons themselves* must stand alone. See the note in `WsSidebar`: three screens used to share a calendar glyph and two shared a check mark, and label-less they were indistinguishable.
- **The pending-count badges.** `.navbadge` drops `margin-left: auto` and moves onto the glyph as a corner dot. Removing it would take away half the reason to glance at a collapsed nav.
- **The group headings.** No room for the text, but they still separate two groups, so each becomes the 1px rule it was implying — via text-indent image-replacement, so "Workforce" and "Manage" stay in the accessibility tree.
- **The brand.** `/logo.png` is a 16:9 wordmark and does not fit. The rail swaps to `public/icon-192.png`, which is the same pin on its own. Both are always rendered and CSS picks; swapping the `src` would re-request an image on every toggle.

> **Why this replaced the tab strip.** The strip kept the current tab and its neighbours in view, which a hamburger cannot. It also cost the content a permanent band of vertical space on every screen and put every tab past the fold behind a horizontal swipe, and its group headings had no sensible place in a row. The drawer costs the content nothing while shut. That is a real trade, not a strict improvement: one tap now stands between an admin and the next screen.

> `.shell-ws` used to carry `padding-top: 54px` here, documented as clearing "the fixed PWA chrome". It cleared nothing: `PwaInstallPrompt` is anchored `bottom: 0`, and measurement confirmed no element ever painted in that band. It was 54px of blank on every mobile `/ws` screen, and it is gone.

---

## Overlays and their surfaces

Overlays are `position: fixed` and portal to `<body>`, so they escape both shells. Pick by surface, not by preference:

| Overlay | z-index | Enters | Fits |
|---|---|---|---|
| `BottomSheet` (`.me-sheet`) | 60 | From the bottom, `--ease-drawer` | `/me` — thumb-reachable, safe-area aware, `max-height: 80vh` |
| `SlideOver` (`.slideover`) | 50 | From the right, `--ease-spring` | `/ws` — 380px / `max-width: 92vw`, a detail panel beside the list it came from |
| `Modal` (`.modal`) | 120 | Centred, `fxSpring` | Both — a decision that blocks everything else. Highest z-index for a reason |

Toasts sit at 200 (the live inline-styled one at 2000), above all three.

### `position: fixed` and the `.page-enter` trap

`PageTransition` wraps `/ws`, `/me` and the public shell, and its `.page-enter` class animates `transform`. **Any computed transform other than `none` makes an element a containing block for its `position: fixed` descendants** — they then size and scroll against *that* box instead of the viewport.

`.page-enter` used to run with `animation-fill-mode: both`, which holds the final keyframe forever. That alone was enough: every fixed element inside a shell — the nav drawer, its scrim, `PwaInstallPrompt` — anchored to the full document box, so a 390×844 viewport produced a 264×**2010** drawer that scrolled away with the page.

Two things worth knowing if this ever comes back:

1. Changing the last keyframe to `transform: none` **does not fix it.** A transform interpolation resolves `none` to the identity *matrix*, so the filled value is still `matrix(1, 0, 0, 1, 0, 0)` — a transform, and therefore still a containing block. Measured, not assumed.
2. The fix is to drop the fill mode, so the element returns to its own computed style the instant the animation ends. Nothing moves, because the last keyframe already describes that state, and there is no `animation-delay` for the backwards half of `both` to cover.

This is also why the three overlay primitives portal to `<body>` — it sidesteps the problem entirely. The drawer cannot, because the same element is an in-flow column above 861px.
