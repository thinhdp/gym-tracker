# Gym Tracker

Client-only workout tracker: Vite 5 + React 18, plain JS/JSX (no TypeScript),
Tailwind, all data in localStorage. No backend, no router.

## Commands

```bash
npm run dev          # dev server, http://localhost:5173
npm run test         # Vitest suite (once); test:watch for watch mode
npm run lint         # ESLint
npm run format       # Prettier (write)
npm run check        # lint + format check + tests + build — the pre-push gate
```

## Testing policy

- New `src/lib` helpers require a co-located `*.test.js`; components with
  logic require a co-located `*.test.jsx` (React Testing Library).
- `npm run check` must pass before pushing — a husky pre-push hook enforces it.
- Conventions and RTL patterns: [docs/TESTING.md](docs/TESTING.md).

## Hard invariants

- **Weights are stored in kg.** Convert only at the input/display boundary
  with `toDisplayWeight` / `fromDisplayWeight` (`src/lib/units.js`).
- **Never call `localStorage` directly** — use `loadLS` / `saveLS` from
  `src/lib/storage.js`.
- **Destructive actions** use the `useConfirm()` hook, not `window.confirm`.
- No TypeScript, no CSS files (Tailwind classes inline), no new libraries
  without good reason.

## Pointers

- [ARCHITECTURE.md](ARCHITECTURE.md) — state model, data flow, component tree.
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md) — localStorage keys and shapes.
- [CONTRIBUTING.md](CONTRIBUTING.md) — conventions, manual smoke checklist.
- Use the **add-feature** skill when scaffolding a new component/tab/feature.

## Work tracking

- **GitHub Issues is the only tracker** (adopted 2026-11-02). Every open item is one
  issue, labeled `type:bug`/`type:feature`/`type:polish`/`type:eng` + `P0`–`P3`
  (+ `status:blocked` when blocked, + `phase:N` when it belongs to a backlog phase).
  Never create a markdown backlog, follow-up, or TODO file: open an issue with
  `gh issue create`. Issues are thin hubs: the body states the work or links into
  `docs/` for the real detail, never duplicates spec or plan content. Close the
  issue with the PR or merge SHA when it ships.
- Specs go in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/` (the
  superpowers skill defaults). Agent working files (briefs, reports, reviews) go
  under `.superpowers/sdd/YYYY-MM-DD-<round>/`, which is gitignored and is not docs.
- Every spec and plan starts with `**Status:**` (`draft`, `approved`, `in progress`,
  `shipped`, `superseded`, plus the PR or merge when there is one) and `**Date:**`
  lines under its title.

## Inline work versus the Feature path

- **Docs-only work** (files under `docs/`, any `*.md`, memory, plan handoffs): done
  inline by Fable on a branch, no dispatch, no test run, still a PR. (The husky
  pre-push hook still runs `npm run check` where it is installed; that is fine.)
- **Everything else** (anything under `src/`, tests, config, dependencies) walks the
  Feature path below, and the PR runs `npm run check`.
- Bug reports start with an evidence check (the failing test, the stored shape in
  `docs/DATA-MODEL.md`, the spec) before any fix is designed.
- Skipping or replacing a usual gate (brainstorm, plan review, execution-mode choice)
  gets a one-line announcement at the moment of the decision, then work continues.
  Not a permission request, just visibility.

## Model delegation (bug fixes and plan tasks)

Fable diagnoses the root cause or reads the task, and reviews the result; the
implementation and its test run are delegated to a subagent with a self-contained
prompt (file paths, root cause, exact change, how to verify). **Dispatch by
`subagent_type`, never by bare `model:`**: the project agents in `.claude/agents/`
pin both the model and the effort level, and effort cannot be set any other way on
an Agent dispatch.

| `subagent_type`        | Model      | Effort | Use for                                                                                                                                                                                                                                                            |
| ---------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `opus55-implementer`   | Opus 5.5   | medium | L tasks, localStorage data-model and backup-envelope work, unit conversion, AppContext state, anything without a clear test signal, tricky root causes                                                                                                             |
| `opus55-reviewer`      | Opus 5.5   | low    | Per-task reviews and verify passes on ordinary-risk work                                                                                                                                                                                                           |
| `opus55-reviewer-deep` | Opus 5.5   | medium | Data-model, backup-envelope, unit-conversion and AppContext work, and whole-branch final reviews                                                                                                                                                                   |
| `sonnet55-fixer`       | Sonnet 5.5 | medium | Default for S and M tasks with a clear test signal: known root cause or spec, named files, a test command that proves it. On a server error, re-dispatch the same prompt to `opus55-implementer`. Bad work is not a failure; it goes through the normal fix rounds |
| `haiku-scout`          | Haiku 5.5  | low    | Evidence gathering: search, file and log summaries, call-site lists                                                                                                                                                                                                |

Fable runs at the session effort set in the app: medium for ordinary part-execution
sessions, high for sessions that are mostly diagnosis or spec and plan design. The
agent bodies carry the dispatch rules (scope discipline, deviation gate, no nested
subagents, never call the advisor, mutation-check own guards, foreground test runs,
git hygiene); the dispatch prompt still supplies the full task spec and still quotes
the escalation gate (Feature path step 6). The dispatch prompt names the focused test
command for the task (`npx vitest run <file>`); implementers never run the full
`npm run check`.

Dispatch-prompt rules for Opus 5.5 and Sonnet 5.5: no "double-check" or "verify"
instructions (they self-verify; such lines cause over-verification; still state which
test command proves the fix); add scope discipline (deliver what was asked, finish
the whole task); forbid nested subagents; ask for a brief outcome-first report.
Review agents report every finding with confidence and severity; never say "only
high-severity": Fable filters afterwards.

**Fix rounds resume the implementer.** Rounds 1–3 resume it with `SendMessage`
(deferred; load with `ToolSearch select:SendMessage`), rounds 4–5 dispatch a fresh
`opus55-implementer`. The global resume-discipline hook blocks the second and later
sends to one agent unless the message carries `[resume-ok: <reason>]`; for a
mechanical fix list (file pointers, no judgment) dispatch a fresh agent instead. Fix
briefs carry only the open findings plus the report-file and brief paths, never prior
task history. If a send returns "SendMessage is disabled for this session", fall back
to fresh dispatch every round.

## Feature path (issue to merge)

Every non-docs item walks this path; nothing skips a step without the one-line
announcement above. The **git-workflow** skill covers the branch mechanics (branch
from fresh `main`, rebase before the PR); the **add-feature** skill covers the code
conventions for new components and tabs.

1. **Issue.** `gh issue create`, labeled as in Work tracking. The issue is the hub;
   detail lives in `docs/`.
2. **Brainstorm.** `superpowers:brainstorming` before any design. Explore intent and
   options with the user first.
3. **Spec** in `docs/superpowers/specs/`, user-approved. A new stored key or shape
   updates `docs/DATA-MODEL.md` in the same PR.
4. **Plan** in `docs/superpowers/plans/` via `superpowers:writing-plans`, cut into
   execution parts of 4–7 points, each labeled certain (Opus orchestrator) or
   uncertain (Fable), in waves with the critical path marked (Execution part sizing
   below). User-gate parts come first.
5. **Execute one part per session** via `superpowers:subagent-driven-development` in
   a worktree under `.claude/worktrees/`. Fable dispatches by `subagent_type` (table
   above); each task gets an `opus55-reviewer` pass; data-model, backup, unit and
   AppContext work and the final whole-branch pass get `opus55-reviewer-deep`.
6. **Escalation gate.** Every dispatch prompt quotes it: if anything deviates from
   what the plan or spec states or assumes, the agent stops and reports; no sensible
   defaults. Fable decides routine deviations and asks the user when confidence is
   low (spec intent, user-visible trade-offs, a hard invariant). Documented fallbacks
   in plans are options, not pre-authorizations.
7. **Verify** with one `npm run check` (lint + format check + tests + build), once
   before the PR and once more after a rebase. Then PR via
   `superpowers:finishing-a-development-branch`. The user merges. Close the issue
   with the merge SHA and write the next part's handoff into the plan.

When a session runs on Opus 5.5 (a part the plan labels certain, or Fable is
unavailable), `.claude/workflows/fable-fallback.js` runs the same evidence → plan →
implement → review → fix pipeline with the same dispatch split (by `agentType`; a
server failure on `sonnet55-fixer` re-runs the stage on `opus55-implementer`). Start
that session at **medium** effort: the workflow pins high on its own plan stage and
the project agents pin their own effort. **Decision chain:** a subagent that needs a
decision stops and reports; the Opus orchestrator decides; when it cannot (spec
intent, user-visible trade-offs, low confidence), it consults the Fable advisor; when
the advisor is missing, out of usage, declines, or says it is the user's call, the
run stops for the user. Start Opus sessions with `claude --advisor fable` (or
`/advisor fable`, then `/advisor off` at the end). Subagents never call the advisor
(rule in every `.claude/agents` body).

## Execution part sizing

A plan lists its tasks first, then groups them into execution parts. Part boundaries
follow dependency gates; the rules below decide how many parts those gates are cut
into. **User gates stay front-loaded:** every part containing a user-review gate
comes before every part that has none. **One part per session:** an execution
session runs exactly the part it was asked to run, then stops and writes a handoff
for the next part into the plan's SDD workspace. Never continue into the next part
without the user starting it. **No orphaned steps:** when a part merges with a step
undone, its handoff moves that step into a named later part (task list with a size,
and the parts table row), never "still open" in a Next line.

**Task size.** Every task gets a size from its Files and Steps lines:

| Size | Points | A task is this size when                                                                                                                 |
| ---- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| S    | 1      | One source file plus its test, a known change, no shared state                                                                           |
| M    | 2      | 2–4 files in one view or lib area; one test file proves it                                                                               |
| L    | 4      | 5+ files, or more than one view, or a localStorage key or stored shape, the backup envelope, unit conversion, or AppContext shared state |
| XL   | —      | It needs two separate test signals in different areas. Split it into tasks before grouping.                                              |

**Part size.** A part's points are the sum of its tasks' points, and a part holds
**4 to 7 points**. Above 7: re-cut it. Below 4: merge it into a neighbor, except a
part that holds a user gate, a part that unblocks two or more parallel chains, or an
uncertain part kept apart from certain work. Every part handoff records what the part
cost (session tokens, fix rounds, wall time).

**Certainty and the orchestrator.** Every task is **certain** only if all six hold:
(1) the spec states the exact behavior; (2) the files are named; (3) the ground truth
it needs (spec section, `docs/DATA-MODEL.md` key, `ARCHITECTURE.md` section) is
already written down; (4) a named test proves it; (5) it uses a mechanism the code
already has; (6) no user-visible choice is left open. If any item fails, the task is
**uncertain**, and the plan names the item. A part takes the label of its tasks, and
the label picks the session's orchestrator: **certain parts run on Opus 5.5** (the
`fable-fallback` workflow, session effort medium); **uncertain parts run on Fable**.

- **One label per part.** Move an uncertain task into its own part, even under 4 points.
- **Fable parts stay small.** An uncertain part holds only the tasks that need judgment.
- **Research first.** Where one unknown makes several tasks uncertain, a small Fable
  part settles it first.
- **Gate parts are uncertain.** A user gate leaves a user-visible choice open, so its
  part runs on Fable.
- **An Opus session that meets an unknown runs the decision chain, then stops** if
  the chain ends at the user, writing a handoff that names the open item.

**Waves and the critical path.** Wave 1 is every part that needs nothing, wave 2
every part whose needs are all in wave 1, and so on. The **critical path** is the
longest chain of parts; cut parts to make it short. If two parts in one wave edit the
same file, move the edit into one of them or put them in different waves. Gate parts
stay S or M.

**The parts table** in every plan has these columns:

| Part | Points | Certainty (task: failed item) | Orchestrator | Needs | Wave | Critical path | Gate |
| ---- | ------ | ----------------------------- | ------------ | ----- | ---- | ------------- | ---- |

Beside it, every plan split into parts carries: (a) a dependency table, one row per
part: which parts it needs merged first, what it consumes from them, and which files
it shares with parts it does not need; (b) a small diagram of the chains; (c) which
parts can run at the same time, which one is the clean parallel (new files only),
and where parallel runs would conflict on shared files. Derive the table from each
task's Files and Interfaces lines, not from the part order. Parallel parts still run
one part per session, each in its own worktree, and only when the user starts them.

## Review dispatch standard

Task reviewers must (a) verify claims against primary sources (the spec,
`ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/TESTING.md`, the tests), not the
implementer's report, and (b) mutation-check load-bearing guards: delete or invert
the guard and confirm tests fail.

- **Implementers mutation-check their own guards.** Every dispatch requires: before
  claiming a fix or new pin test, prove the test FAILS against the broken state and
  say so in the report.
- **Stale-read race.** Any value read before an `await` and used after it must be
  re-read after the await, or committed only inside the guarded resolution. Review
  dispatches hunt this class explicitly.
- **No numbers in dispatch briefs.** Dispatch prompts point at spec sections and
  `docs/DATA-MODEL.md` keys, never restate values; restated values drift.
- **Reviewers do not re-run `npm run check`.** The implementer's report carries that
  evidence for the commit under review; the controller re-runs it once before the
  PR. A reviewer runs only the focused test file(s) a mutation check or a specific
  doubt needs.
- **Review reports** go to the report file the brief names under
  `.superpowers/sdd/<round>/`; writing it is required.

## Git and exec gotchas

- Never `--amend` when HEAD may be a merge commit (after `gh pr merge` and pull);
  check `git log -1` first.
- Subagents never create or remove worktrees or touch `node_modules`. Fable creates
  the worktree before dispatch and removes it after merge.
- Inline `node -e`, `python -c` and `tsx -e` one-liners are blocked by a global hook:
  write a script file and run it.
