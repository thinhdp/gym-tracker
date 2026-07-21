---
name: git-workflow
description: The branch-and-PR workflow for gym-tracker. Use whenever starting a new feature, enhancement, fix, or any change that will become a PR — to branch from fresh main at the start and rebase onto main before opening the PR. Trigger before writing code for any non-trivial change, and again when preparing to push or open the PR.
---

# Git workflow for Gym Tracker

`main` is the integration branch and the base for every PR. Never commit
feature work directly to `main`, and never let a feature branch drift behind
`main`. Two checkpoints enforce this: **branch from fresh main at the start**,
and **rebase onto main before the PR**.

## 1. Starting a feature / enhancement / fix

Before writing any code, get onto a fresh feature branch built off the latest
`main`:

```bash
git switch main
git pull --ff-only origin main        # latest main, no merge commit
git switch -c <type>/<short-slug>      # e.g. feat/goals-tab, fix/kg-rounding
```

- If the working tree is dirty, stop and resolve it first (commit, stash, or
  discard) — do not branch on top of unrelated uncommitted changes.
- Branch naming: `feat/…`, `fix/…`, `chore/…`, `docs/…` + a short kebab slug.
- One branch per logical change. Don't pile unrelated work onto one branch.

## 2. While working

- Commit in focused, working increments with clear messages.
- If `main` moves and you need the latest, rebase rather than merge to keep
  history linear (see §3).

## 3. Before opening the PR — rebase onto main

Bring the branch up to date with `main` so the PR is a clean fast-forward and
conflicts are resolved on your branch, not in the PR:

```bash
git fetch origin
git rebase origin/main
# resolve any conflicts, then: git add <files> && git rebase --continue
```

After the rebase, **re-run the quality gate** — the rebase may have pulled in
changes that interact with yours:

```bash
npm run check    # lint + format check + tests + build — the pre-push gate
```

Then push (force-with-lease is required after a rebase, since history was
rewritten):

```bash
git push --force-with-lease origin <branch>     # first push: add -u
```

Open the PR against `main`.

## Quick reference

| When                        | Do                                                                      |
| --------------------------- | ----------------------------------------------------------------------- |
| Start of any change         | `pull --ff-only` main, then `switch -c` a feature branch                |
| Working tree dirty at start | Resolve it before branching — never branch on unrelated WIP             |
| Before the PR               | `rebase origin/main`, re-run `npm run check`, `push --force-with-lease` |
| PR base                     | Always `main`                                                           |

## Notes

- Prefer rebase over merge for keeping a feature branch current — linear history.
- `--force-with-lease` (not `--force`) protects against clobbering remote work
  you haven't seen.
- The husky pre-push hook runs `npm run check`; a green local `check` keeps the
  push from being rejected.
