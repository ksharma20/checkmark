# Status semantics

Status in this product is not decoration — it is the product. CheckMark's whole claim is that a check-in is *verified*, and the chip is where that claim is made visible. So the tones are typed against the domain rather than chosen per screen.

## The tones

Seven, all defined in `globals.css` as `.chip-${tone}` and typed as `ChipTone` in `src/components/ui/Chip.tsx`.

| Tone | Fill / text | Meaning |
|---|---|---|
| `verified` | `--brand` at 14% / `--brand` | All configured signals matched |
| `partial` | `--amber` at 16% / `#9a6200` | Some configured signals matched, not all |
| `none` | `--danger` at 14% / `--danger` | No signal matched, or a trust flag is present |
| `override` | `--info` at 14% / `--info` | An admin bypassed signal matching |
| `owner` | `--navy` at 14% / `--navy` | Identity, not verification — role names |
| `leave` | `--surface-2` / `--text-secondary` | Neutral. Leave, "not in", plain metadata |
| `roadmap` | `--surface-2` / `--text-muted`, weight 600 | "Coming soon" markers |

Every fill is a `color-mix(… 14–16%, transparent)` of its own text colour, except the two neutrals. That is why the chips read as a set: the fill is always a wash of the label.

`partial` is the one hand-picked value — `#9a6200` instead of `--amber` — because `--amber` (`#F59E0B`) on a 16% amber wash fails contrast. The darker brown keeps the amber *identity* while staying legible. If you add an amber-family chip, copy that pair; do not use `--amber` as a text colour on a light fill.

## The first four are `MatchedBy`

```ts
// src/lib/signals.ts
export type MatchedBy = 'verified' | 'partial' | 'none' | 'override'
```

```ts
// src/components/ui/Chip.tsx
export function toneForMatchedBy(m: MatchedBy): ChipTone {
  return m
}
```

The function is an identity function, and that is deliberate. The four tone names were chosen to be exactly the four `MatchedBy` values, and `MatchedBy` is **imported** from `lib/signals` rather than redeclared, so the compiler enforces that they stay aligned. Rename a `MatchedBy` variant and this file stops compiling — which is the point.

Always route through `toneForMatchedBy()` rather than writing `tone={event.matched_by as ChipTone}`. It costs nothing and it is what keeps the coupling checkable.

### Why `override` is violet

`--info` (`#8B5CF6`) is the only deliberately off-brand semantic colour in the app. An admin override is neither a success nor a failure — it is a human decision that *bypassed* signal matching entirely (CLAUDE.md invariant 7: overrides live in `admin_overrides` and never modify the event). Brand blue would claim the signals matched when they did not. Red would claim something went wrong when nothing did. Violet says "a different kind of thing happened here", which is exactly right, and it makes overridden rows scannable in a table of otherwise blue and amber ones.

## `PresenceChip` — the one place presence becomes a chip

`src/components/ws/PresenceChip.tsx` is the single renderer for a member's presence, used by the Overview's recent-activity list and by the Attendance roster, so those two surfaces can never label the same person differently.

Its precedence, top to bottom:

1. **Trust flags present** → `none`, labelled "Suspicious". Surfaced above everything because a trust flag is the reason an admin is looking at the row at all.
2. **`matched_by === 'override'`** → `override`. An override wins over signal matching, per invariant 7.
3. Otherwise → `resolvePresenceTag()` in `src/lib/client/presence.ts` maps to a `PresenceTag`, and:

```ts
const TONE_FOR_TAG: Record<PresenceTag, ChipTone> = {
  in_office: 'verified',
  remote:    'partial',
  not_in:    'leave',
}
```

**`not_in` is `leave`, not `none`.** Not having checked in yet is not a failed verification, and colouring it red would turn "it's 9am and half the team hasn't arrived" into a wall of alarm. `none` means a check-in happened and could not be verified; that is a genuinely different — and much rarer — event.

`resolvePresenceTag` folds `verified` and `override` together into `in_office`, and both `partial` and `none` into `remote`. That is the *tag* layer, which answers "where is this person"; the chip tone layer answers "how much do we trust it". Do not collapse the two.

## Attendance is day-level, not event-level

A related trap. Chips describe one event; **attendance figures describe a day**. Anywhere WFO/WFH/Leave or office/remote/absent is shown, use `src/lib/attendance-summary.ts`:

- **WFO / office** — at least one event that day is `verified` or `override`
- **WFH / remote** — events exist that day, none verified or overridden
- **Leave / absent** — no event for that workspace-local workday

Multiple events on one day count once, with WFO taking priority. Never compute these by counting chips.

## Adding a tone

Only if it names something the domain already distinguishes. Before adding one, check that an existing tone is not the honest answer — most "we need a new colour" moments are really "this state is neutral", which is `leave`.

If you do add one:
1. Add `.chip-<name>` to `globals.css`, following the `color-mix(… 14%, transparent)` pattern.
2. Add it to `ChipTone` in `Chip.tsx`.
3. Check contrast on the wash. Anything in the amber/yellow family needs a hand-darkened text colour, as `partial` does.
4. Add a row above, saying what it means — not what it looks like.
