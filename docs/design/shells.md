# Shells

Two page frames, one per product surface. They share the token set and the primitives and nothing else — different widths, different navigation, different density, because they answer different questions.

| | `.shell-me` | `.shell-ws` |
|---|---|---|
| Route | `/me/*` | `/ws/:slug/*` |
| Built by | `src/app/me/layout.tsx` | `src/app/ws/[slug]/layout.tsx` → `src/components/ws/WsLayoutClient.tsx` |
| Posture | Mobile-first | Desktop-first |
| Width | 460px column, centred | 228px sidebar + 1180px content |
| Nav | Fixed bottom bar | Sticky left sidebar → tab strip under 860px |
| Manifest | `/manifest-me.json` | `/manifest-ws.json` |
| `theme-color` | `#F8FAFC` (`--surface-1`) | `#0D1B2A` (`--header-bg`) |

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

### The sidebar is generated, not written

`WsSidebar` renders from `visibleScreenGroups()` in `src/lib/permissions/screens.ts`, filtered by the role's readable resources and by workspace feature flags. There is no hardcoded nav array. Two consequences:

- Adding a `/ws` screen means adding a `Screen` enum member and a `SCREEN_DEFS` entry, not editing the sidebar.
- Hiding a tab is a **courtesy**. The matching API route enforces the same permission independently. Never treat sidebar filtering as access control.

Groups are `Workforce` and `Manage`; a group with no visible screens is dropped rather than rendering an empty heading.

### The 860px collapse

```css
@media (max-width: 860px) {
  .shell-ws { flex-direction: column; padding-top: 54px; }
  .sidebar  { width: 100%; height: auto; position: static; flex-direction: row;
              align-items: center; overflow-x: auto; padding: 10px 12px;
              border-right: none; border-bottom: 1px solid var(--border); gap: 2px; }
  .sidebar-brand { padding: 4px 12px 4px 2px; flex-shrink: 0; }
  .navitem       { flex-shrink: 0; white-space: nowrap; }
  .sidebar-foot  { display: none; }
  .topbar-account{ display: block; }
  .ws-content    { padding: 18px; }
}
```

The sidebar becomes a **horizontally scrolling tab strip** across the top. Same DOM, same `.navitem` elements, same generated list — only the flex direction and overflow change.

Why a scroll strip and not a hamburger menu: this workspace can have a dozen screens depending on the role, and a hamburger hides all of them behind a tap. A strip keeps the current screen and its neighbours visible, and admins on a phone are usually moving between two or three screens repeatedly. The cost is that screens past the fold need a swipe to reach; that is the accepted trade.

`.navitem` gets `flex-shrink: 0` and `white-space: nowrap` so items keep their width and the strip scrolls, instead of squashing into unreadable columns.

`.sidebar-foot` — which holds the account menu in the desktop layout — is hidden, and `.topbar-account` (`display: none` by default) takes over in the topbar. One account menu, two positions, no duplicated component. `WsAccountMenu` takes a `variant` prop for this.

The `padding-top: 54px` on `.shell-ws` clears the fixed PWA chrome in this mode.

---

## Overlays and their surfaces

Overlays are `position: fixed` and portal to `<body>`, so they escape both shells. Pick by surface, not by preference:

| Overlay | z-index | Enters | Fits |
|---|---|---|---|
| `BottomSheet` (`.me-sheet`) | 60 | From the bottom, `--ease-drawer` | `/me` — thumb-reachable, safe-area aware, `max-height: 80vh` |
| `SlideOver` (`.slideover`) | 50 | From the right, `--ease-spring` | `/ws` — 380px / `max-width: 92vw`, a detail panel beside the list it came from |
| `Modal` (`.modal`) | 120 | Centred, `fxSpring` | Both — a decision that blocks everything else. Highest z-index for a reason |

Toasts sit at 200 (the live inline-styled one at 2000), above all three.
