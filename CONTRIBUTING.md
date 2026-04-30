# Contributing to CheckMark (Open Source)

We welcome contributors of all levels.

---

## Getting Started

1. **Fork** the repo on GitHub (your fork URL: `https://github.com/YOUR_USERNAME/checkmark`)
2. Clone **your fork**:

```bash
git clone https://github.com/YOUR_USERNAME/checkmark.git
cd checkmark
```

3. Add the upstream remote (do this once):

```bash
git remote add upstream https://github.com/ksharma20/checkmark.git
```

4. Install dependencies:

```bash
npm install
```

5. Migrate DB:

```bash
npm run migrate
```

6. Run project:

```bash
npm run dev
```

---

## How to Contribute

1. **Sync first** (always before starting new work):

```bash
git fetch upstream
git checkout main
git reset --hard upstream/main
git push origin main
```

2. Pick an issue from GitHub, comment _"I'll work on this"_
3. Create a feature branch **off main**:

```bash
git checkout -b fix/issue-name
```

4. Make changes, commit:

```bash
git commit -m "fix: description"
```

5. Push your branch:

```bash
git push origin fix/issue-name
```

6. Open a Pull Request against `main` on `ksharma20/checkmark`

---

## One-Branch OSS Model (Important)

CheckMark OSS uses a single long-lived branch:

- `main` - the source of truth for OSS

All open source contributions land via PRs to `main`.

---

## After your PR is merged

We use **squash merge** - your commits are squashed into one commit on `main`. This means your branch history will diverge from `main` after merge. That's expected.

Sync your fork before starting the next contribution:

```bash
git fetch upstream
git checkout main
git reset --hard upstream/main
git push origin main
```

Then create a fresh branch for the next issue.

> `git reset --hard upstream/main` is safe here because `main` should only ever be used as your sync target - all work goes in feature branches.

---

## Tips

- Start with `good first issue`
- Keep PRs small and focused on one issue
- Ask questions in the issue thread if stuck
- Never commit directly to `main` - always use a feature branch
