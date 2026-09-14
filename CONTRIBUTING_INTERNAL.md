# Contributing to Venzio (Company Repo)

This guide is for **company developers** working in the company repo.

The key idea:

- **OSS `main` is the source of truth**
- **Company `main` is a protected mirror of OSS `main`** (no human merges)
- **Company `develop` is the only human PR target** (preview/staging)
- Company changes flow **Company `develop` → OSS `main` → Company `main` → Company `develop`**

---

## Getting Started

1. **No fork needed** - You'll be added as a direct collaborator to the company repo

2. Clone the company fork:

```bash
git clone https://github.com/company-account/venzio.git
cd venzio
```

3. Install dependencies:

```bash
npm install
```

4. Migrate DB:

```bash
npm run migrate
```

5. Run project:

```bash
npm run dev
```

---

## Branch Model (Company)

### `main` (mirror-only)
- Production deploy branch
- **No direct PRs / no human merges**
- Updated only by the OSS sync automation (fast-forward or hard-reset mirror)

### `develop` (preview/staging)
- Preview/staging deploy branch
- **All human PRs target `develop`**
- **Rebuilt nightly from `main`** by the OSS sync automation: `develop` is reset to `main`, then the
  commits pushed to `develop` since the last squash are replayed on top, and the result is force-pushed
- Because it is rebuilt rather than merged, **the SHAs on `develop` change on every nightly sync** -
  even when not one byte of code did. See “After a nightly sync”.

---

## Development Workflow (Company)

### 1. Create a feature branch

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

Use descriptive names: `feature/signal-verification-fix`, `fix/dashboard-counts`, etc.

### 2. Make commits

Write clear commit messages:

```bash
git commit -m "Signal verification: hide location badge for unverified events

- Update EventCard.tsx to filter by matched_by
- Fix dashboard office count to exclude 'none' status
- Add Remote badge for partial/none signal states"
```

### 3. Push and open PR

```bash
git push origin feature/your-feature-name
```

Then open a PR in GitHub (company repo).

### 4. Code review

- Team reviews your PR
- Address feedback
- Force-pushes to the shared branches (`main`, `develop`) are **automation only** - the nightly sync
  rewrites both. **Humans never force-push them.** Force-push your own feature branch freely, with
  `--force-with-lease`.

### 5. Merge

- Merge the PR into `develop`
- Prefer **Squash & merge** for small, focused PRs (keeps `develop` readable)

---

## After a nightly sync

The nightly sync **rewrites `develop`'s history**. `git pull` cannot cope with that: it tries to reconcile
your old history with the new one and answers with either a merge commit - re-creating the exact divergence
the rebuild removes - or a wall of conflicts. Use the commands below instead.

### Your local `develop`, with no local commits of your own

```bash
git fetch origin
git checkout develop
git reset --hard origin/develop      # NOT git pull
```

### A feature branch cut from the old `develop`

Rebase it onto the new `develop` **using the pre-rewrite tip**, which is exactly what `backup/develop/<ts>`
is for:

```bash
git fetch origin
BACKUP=$(git branch -r --list 'origin/backup/develop/*' | sort | tail -1 | tr -d ' ')
OLD=$(git merge-base feature/your-branch "$BACKUP")
git rebase --onto origin/develop "$OLD" feature/your-branch
git push origin feature/your-branch --force-with-lease
```

**A plain `git rebase origin/develop` is wrong here.** Your branch point is no longer an ancestor of
`develop`, so the merge-base falls far back and rebase replays `develop`'s own pre-rewrite commits into your
branch as duplicates. `--onto` with the real branch point is the only correct spelling.
`git merge-base --is-ancestor origin/main HEAD` tells you which case you are in: it exits 1
here, and 0 while a plain `git rebase origin/develop` is still correct. See "Before Pushing".

### Once per clone

So a stale pull fails loudly instead of quietly merging:

```bash
git config pull.ff only
```

### An open PR into `develop`

Rebase the branch as above and force-push it; the PR updates in place. Left alone, its diff grows to include
everything `develop` rewrote.

### Undo, if a rebuild went wrong

The `origin/` prefix is required: the backup exists only as a
remote-tracking ref in your clone, so the bare branch name does not resolve.

```bash
git fetch origin
git push origin origin/backup/develop/<ts>:develop --force
```

---

## Before Pushing

```bash
# Fetch latest from company fork
git fetch origin

# Which case are you in? `develop` is rebuilt on `main`, so a branch cut since the last
# rebuild already contains `origin/main`. Exit 0 = your branch point is still on
# `origin/develop`, nothing was rewritten under you. Exit 1 = a rebuild landed since you
# branched; use the `rebase --onto` recipe in "After a nightly sync" instead.
git merge-base --is-ancestor origin/main HEAD

# Keep your feature branch current (optional) - correct ONLY when the check above exits 0
git rebase origin/develop

# Test your changes
npm run dev
npm run build  # (optional, check for build errors)
```

---

## Deployments

- **Preview/Staging:** Merges to `develop` auto-deploy
- **Production:** `main` auto-deploy (mirror of OSS `main`)

Production releases happen when OSS `main` is updated (see “Syncing with OSS”).

---

## Syncing with Open Source

### Company → OSS (automatic PR)
We use **fully-automatic upstreaming** with one exception to avoid “echo loops” from sync merges.

Automation opens/updates a PR to **OSS `main`** for **any merged PR** into company `develop`,
except PRs labeled:

- `sync` (branch sync bookkeeping only)

- You review/merge that PR in OSS
- OSS `main` remains the single source of truth

#### Maintainers: one-time setup (company repo)
To enable automation in the company fork, add this secret in the **company repo**:

- `OSS_UPSTREAM_PAT`: a GitHub Personal Access Token with access to the OSS repo (`ksharma20/venzio`)

> Do not put tokens directly in workflow files. Anything committed to git is readable by anyone with repo access.

The company repo uses the workflow template:

- `.github/workflows/upstream_company_develop_to_oss.yaml`

Enable GitHub Actions on the company fork, then add the secret above.

### OSS → Company (automatic sync)
When OSS `main` changes, automation syncs company `main` to match OSS `main`.

### Company `main` → Company `develop` (automatic rebuild)
After company `main` updates, automation **rebuilds** company `develop` on top of it:

1. Find the cut point, two ways. First the **tree match**: scan `origin/develop --first-parent` for the
   newest commit whose tree equals `origin/main^{tree}`. Company `main` is a squash of `develop`, so at
   squash time the trees are equal. If nothing matches - `main` has gained something no `develop` commit
   has, such as a PR merged straight into OSS `main`, or review edits applied on top of the squash - it
   falls back to the **merge base** of `main` and `develop`, which is the `main` commit `develop` was last
   rebuilt onto. The fallback is refused if the carry set contains merge commits, because that means
   `develop` is not in its rebuilt shape and the merge base would replay work `main` already has.
2. Push the current `develop` tip to `backup/develop/<UTC-timestamp>`
   (e.g. `backup/develop/20260912T000217Z`), pruned after 30 days.
3. Reset `develop` to `origin/main`, then replay the commits pushed since the cut point with
   `git rebase --onto`.
4. Force-push `develop`.

This replaced a merge PR from `main` into `develop`, which is what left the two branches carrying two
different histories of identical code.

**On conflict, nothing is rewritten.** `origin/develop` is left untouched, the partial replay is pushed as
`sync/develop-rebuild`, and a PR titled `DO NOT MERGE — …` labeled `sync` is opened into `develop` as a
notification. The maintainer resolves it; do not merge that PR.

You don't need to do anything to the branches themselves - but a rewritten `develop` does affect your clone.
See “After a nightly sync”.

---

## Questions?

Reach out to the team or open an issue in the company fork.
