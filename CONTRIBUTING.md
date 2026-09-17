# Contributing to CheckMark

Thanks for your interest in CheckMark - a simple open-source project by Kabir
Innovations, licensed under Apache 2.0. Contributions of every size are welcome:
bug reports, docs fixes, and code.

---

## Workflow

CheckMark has one long-lived branch, `main`. Every change lands through a pull
request into it.

1. **Fork** [`ksharma20/checkmark`](https://github.com/ksharma20/checkmark) on GitHub.
2. **Clone your fork** and add the original repository as `upstream`:

   ```bash
   git clone https://github.com/YOUR_USERNAME/checkmark.git
   cd checkmark
   git remote add upstream https://github.com/ksharma20/checkmark.git
   ```

3. **Branch from an up-to-date `main`:**

   ```bash
   git fetch upstream
   git checkout -b fix/short-description upstream/main
   ```

4. Make your change, run the [checks](#checks), and commit.
5. **Push** the branch to your fork and open a pull request **into `main`**.

Keep a pull request to one issue or one logical change. For anything larger than
a small fix, open an issue first so the approach can be agreed before you build it.

Pull requests are squash-merged, so your branch history does not need to be
tidy - but the PR title becomes the commit subject, so follow the
[commit style](#commit-style) there.

---

## Local setup

Requires **Node.js 20+** and npm.

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`. At minimum, generate your own secrets - never reuse one:

```bash
# JWT_SECRET and CRON_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# FIELD_ENCRYPTION_KEY - must be exactly 64 hex characters
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Leave the `TURSO_*` variables unset to use a local SQLite file. Without
`RESEND_API_KEY`, one-time sign-in codes are printed to the server console
instead of emailed.

Create the schema and start the dev server:

```bash
node scripts/migrate.js
npm run dev
```

The app runs at http://localhost:3000. `scripts/migrate.js` is safe to re-run.

---

## Checks

Run all three before opening a pull request, and make sure they pass:

```bash
npx tsc --noEmit   # type check
npm run lint       # ESLint
npm run build      # production build
```

---

## Commit style

One line, no body:

- a type prefix such as `feat:`, `fix:`, `docs:`, `refactor:` or `chore:`
- imperative mood, lower-case after the prefix, no trailing period
- 72 characters or fewer

```text
feat: add holiday import from xlsx
fix: keep reminder time when the field is cleared mid-edit
```

---

## Project rules

CheckMark has a set of invariants - things that must stay true however the
code changes. Read them before making a non-trivial change:

- [`CLAUDE.md`](CLAUDE.md) - product rules, architecture, and the numbered
  **Key Invariants** and **What NOT to Do** lists
- [`AGENTS.md`](AGENTS.md) - code conventions and patterns
- [`docs/`](docs) - architecture notes (`docs/architecture/`) and the design
  system (`docs/design/`)

A few that catch most first contributions:

- All database access goes through `src/lib/db/queries/` - never raw SQL in a route.
- The user ID always comes from the session, never from the request body.
- User-facing strings go in a `src/locales/en/<area>.ts` module, not inline.
- App styling lives in `src/app/globals.css` or a `src/components/ui/` primitive -
  no inline style objects or `<style>` blocks.
- `scripts/migrate.js` is the only schema definition; a schema change goes there.

If your change alters documented behaviour, update the matching docs in the same
pull request.

---

## Reporting issues

- **Bugs and feature requests:** open a
  [GitHub issue](https://github.com/ksharma20/checkmark/issues) using the templates.
- **Security vulnerabilities:** do **not** open a public issue - follow
  [`SECURITY.md`](SECURITY.md).
- **Anything else:** email kabir.innovate@gmail.com.

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](LICENSE).
