# GitHub Setup for Venzio (Company Fork vs Open Source)

This document explains the GitHub settings for the company fork and personal OSS repo.

---

## Overview

| Aspect | Company Fork | Personal OSS |
|--------|--------------|--------------|
| **Purpose** | Production deployment + internal development | Open source reference, external contributions |
| **Contributors** | Company team (direct collaborators) | Global community (forks) |
| **Merge Strategy** | Squash (feature branch → `develop` → OSS `main`) | Squash |
| **Deployments** | Staging + Production | None (reference only) |
| **Sync Direction** | Company → OSS (periodic, manual) | - |

---

## Company Fork Setup

### Settings → General
- **Repository visibility:** Private (if company-only) or Public (if referencing OSS)
- **Default branch:** `main`

### Settings → Collaborators and teams
- Add company developers as **Collaborators** (no fork needed)
- Assign permissions: **Maintain** or **Push** (depending on approval rights)

Example:
```
john@company.ai → Maintain (can approve PRs)
jane@company.ai → Push (can create/merge PRs)
```

### Settings → Branches → Branch protection rules

#### Main branch protection
- **Require a pull request before merging:** ✓
- **Require code reviews:** ✓ (1 approval minimum)
- **Require status checks to pass:** ✓
- **Allow squash merging:** ✓ (ONLY option enabled)
- **Allow merge commits:** ☐ (disabled)
- **Allow rebase merging:** ☐ (disabled)

**Why:** The flow is squash the whole way — feature branch --squash--> company `develop` --squash--> OSS `main`. One commit per PR keeps `main` readable, and it is what lets the nightly rebuild recover its cut point by matching trees.

#### `develop` branch protection
- Same as `main`

#### Both `main` and `develop` are rewritten by automation

`.github/workflows/sync_oss_fork.yaml` runs nightly and **force-pushes both branches**: it hard-resets `main` from OSS `main`, then rebuilds `develop` on top of it (`git rebase --onto`, then `git push --force-with-lease`).

So on **both** branches, one of these must be true:

- Force-push protection is **not** enabled at all, or
- The GitHub Actions token is **allowed to bypass it** — Settings → Branches → rule → *Allow force pushes* → **Specify who can force push** → add the `github-actions` app (and grant it bypass on any linear-history or required-PR rule on the same branches)

**What breaks if it is not:** the nightly push is refused with **403**, the step fails, and `origin/develop` is left at yesterday's tip with nothing on the PR surface to say so. `develop` silently stops tracking `main`, and each further night compounds the divergence the rebuild exists to remove.

**Humans still may not force-push either branch.** The bypass is for the workflow token alone; a hand force-push races the nightly run and defeats the `--force-with-lease` guard that makes it safe.

---

## Personal OSS Repo Setup

### Settings → General
- **Repository visibility:** Public
- **Default branch:** `main`

### Settings → Collaborators and teams
- No internal team needed (external contributors use forks)
- Maintainer (you) is the owner

### Settings → Branches → Branch protection rules

#### Main branch protection
- **Require a pull request before merging:** ✓
- **Require code reviews:** ✓ (1-2 approvals, your discretion)
- **Require status checks to pass:** ✓
- **Allow squash merging:** ✓ (ONLY option enabled)
- **Allow merge commits:** ☐ (disabled)
- **Allow rebase merging:** ☐ (disabled)

**Why:** Same as the company fork — one commit per PR, and the company→OSS sync squashes too, so both repos' histories stay comparable.

---

## Merge Workflow

### Company developers → Company fork

```
1. Developer creates branch: feature/xyz
2. Developer pushes to company fork
3. Developer opens PR (company fork: feature/xyz → develop)
4. Maintainer reviews & approves
5. Developer clicks "Squash and merge" (the only option enabled)
   → One commit on `develop`, closes PR, deletes branch
6. Preview/staging deployment triggered (CI/CD)
7. That commit is squashed onward to OSS `main` (see below)
8. The nightly sync mirrors OSS `main` onto company `main`
   → Production deployment triggered
```

### Company → OSS (periodic sync)

```
1. Maintainer reviews company `develop` for stable features
2. Automation opens PR: company-fork/develop → personal-repo/main
   - Title: "Sync: company contributions (week-of-2026-04-26)"
   - Body: Link to company fork roadmap, sprint details
3. GitHub merges it with "Squash and merge" → one commit on OSS `main`
4. Personal OSS updated, external contributors can sync
5. That squash is what the nightly rebuild matches on: OSS `main`'s tree
   now equals the develop commit it was squashed from
```

### External contributors → Personal OSS

```
1. Contributor forks personal-repo
2. Contributor creates branch: feature/xyz on their fork
3. Contributor opens PR (personal-repo: their-fork/feature → main)
4. Maintainer reviews & approves
5. GitHub merges with "Squash and merge" → one commit on OSS `main`
6. External contributor syncs their fork (if desired)
```

---

## Important Notes

### Why squash everywhere?

- **One squashed commit per PR is what the nightly rebuild prefers.** Company `main`
  is a squash of `develop`, so at squash time the two trees are equal — which is how
  `.github/workflows/sync_oss_fork.yaml` recovers its cut point, by scanning
  `origin/develop --first-parent` for the newest commit whose tree matches
  `origin/main^{tree}`. Where that finds nothing it falls back to the merge base of the
  two branches, so an external PR merged straight into OSS `main` no longer stops the
  rebuild — but that fallback is only correct while `develop` stays linear, and it
  refuses outright when the carry set holds merge commits
- **It keeps company and OSS history comparable** — the same change is one commit on
  company `develop`, one commit on OSS `main`, and one commit on the company `main`
  mirrored back from it
- **Merge commits** put a PR's intermediate commits on the shared branch, so the
  first-parent line stops being one-commit-per-PR and the tree match above is lost
- **Rebase merging** does the same and additionally hides which commits arrived together

### Syncing forks

External contributors can sync their fork without issues:

```bash
git fetch upstream
git checkout main
git merge upstream/main  # Fast-forward or merge, not squash
git push origin main
```

No force-pushes needed: OSS `main` only ever gets squash commits appended, so a fork fast-forwards.

### Deployments

- **Company fork:** Vercel auto-deploys on push to `main` and `develop`
- **Personal OSS:** No deployments (reference only)

Configure Vercel to:
- Deploy `develop` → preview/staging environment
- Deploy `main` → production environment

---

## Checklist

- [ ] Company fork: Set collaborators (Settings → Collaborators)
- [ ] Company fork: Enable branch protection on `main`
  - [ ] Require PR, reviews, status checks
  - [ ] Enable squash merging only (disable merge commits/rebase)
- [ ] Company fork: Enable branch protection on `develop`
- [ ] Company fork: Allow the `github-actions` token to force-push `main` and `develop`
      (or leave force-push protection off on both) — the nightly rebuild 403s otherwise
- [ ] Personal OSS: Enable branch protection on `main`
  - [ ] Require PR, reviews, status checks
  - [ ] Enable squash merging only (disable merge commits/rebase)
- [ ] Vercel: Configure deployments
  - [ ] `develop` → preview/staging environment
  - [ ] `main` → production environment
- [ ] Document in internal wiki/handbook

---

## Questions?

Contact the project maintainer.
