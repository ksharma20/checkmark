# CheckMark — Architecture Documentation

> Comprehensive technical reference for the CheckMark presence intelligence platform.
> All diagrams use [Mermaid](https://mermaid.js.org/) — rendered automatically on GitHub.

---

## Documents

| Document | What it covers |
|----------|---------------|
| [HLD.md](./HLD.md) | System context, application architecture, DB schema ERD, key design decisions, request lifecycle |
| [auth-flow.md](./auth-flow.md) | Login/register state machine, OTP flow, forgot password, session lifecycle, API token auth |
| [signal-matching.md](./signal-matching.md) | AND semantics deep-dive, MatchedBy values, queryWorkspaceEvents() internals, admin overrides, WiFi privacy |
| [checkin-flow.md](./checkin-flow.md) | Check-in/checkout sequences, notification timer scheduling, auto-checkout, V1 API, what gets stored |
| [notification-flow.md](./notification-flow.md) | Web Push subscription, client-side timers, SW push handler, in-app toasts, sound, notification deduplication |
| [workspace-flow.md](./workspace-flow.md) | Workspace creation, member invite + consent, domain verification, signal config, dashboard query, analytics |

---

## Quick Reference — Current State (post overhaul)

### Signal Matching
- **AND semantics** — ALL configured signal types must match. Partial matches don't count.
- `MatchedBy`: `verified` | `partial` | `none` | `override`
- `eventCountsAsOfficePresence()` — also requires no checkout location mismatch

### Auth
- JWT (HS256, 30d) in `cm_session` httpOnly SameSite=Lax cookie
- OTP: 6 digits, 10-min expiry, 5 attempts max, 3 sends per 15 min
- Password reset: OTP-gated via `cm_otp_ok` cookie — never trust client-side `otpVerified`
- API tokens: O(1) prefix lookup (`token_prefix` column + index)

### Notifications
- Stale reminders at 4h, 8h, 12h, 16h, 18h, 20h, 22h from check-in
- Auto-checkout at **T+12h** from check-in (stored in `scheduled_checkout_at`)
- Web Push (VAPID) for reliable delivery when app is closed
- Web Audio API chime plays regardless of OS notification mode

### Rate Limits
- Login: 10 requests per IP per 15 minutes
- Check-in: 10 per user per hour
- Stored in `rate_limit_log` table (sliding window)

### DB New Tables (added in overhaul)
- `push_subscriptions` — VAPID endpoint per user/device
- `rate_limit_log` — sliding-window rate limiting

### DB New Columns (added in overhaul)
- `presence_events.scheduled_checkout_at` — T+12h from check-in
- `presence_events.checkout_location_mismatch` — distance in metres
- `user_api_tokens.token_prefix` — first 8 chars for O(1) lookup

---

## Planned / Future Work

| Area | What | Notes |
|------|------|-------|
| Server-push triggers | Cron-based midnight push from server | `sendPushToUser()` exists, needs a scheduler |
| WiFi signal performance | Replace bcrypt with HMAC-SHA256 for O(1) WiFi comparison | Tracked in `lib/signals.ts` comment |
| Analytics export | CSV download per date range | Gated by plan (`starter`+) |
| Multi-workspace analytics | Cross-workspace rollup for holding companies | Not yet designed |
| Insights charts | Time-bucketed presence visualisation | `/ws/:slug/insights` exists, frontend WIP |
