# Testing

Gym Tracker uses **Vitest** (with **jsdom**) for unit tests and **React Testing
Library** for component tests. The suite, linting, formatting, and the
production build together form the quality gate that runs before every push.

## Running tests

```bash
npm run test          # run the whole suite once (CI mode)
npm run test:watch    # watch mode while developing
npx vitest run src/lib/units.test.js   # run a single file
npm run check         # full quality gate: lint + format check + tests + build
```

`npm run check` is exactly what the husky **pre-push hook** runs — if it fails
locally it will also block your push. (`git push --no-verify` bypasses the
hook; only do that deliberately.)

## Stack and configuration

| Piece                  | Where                                                               |
| ---------------------- | ------------------------------------------------------------------- |
| Vitest config          | `test` block in [vite.config.js](../vite.config.js)                 |
| Global setup           | [src/test/setup.js](../src/test/setup.js)                           |
| DOM environment        | jsdom (real `localStorage`, focus, keyboard events)                 |
| Matchers               | `@testing-library/jest-dom` (`toBeInTheDocument`, `toHaveValue`, …) |
| Interaction simulation | `@testing-library/user-event`                                       |

`globals: true` is enabled, so `describe` / `it` / `expect` / `vi` are
available without imports (ESLint knows about them via the test-file override
in `eslint.config.js`).

## Conventions

- **Co-locate tests with the code**: `src/lib/foo.js` → `src/lib/foo.test.js`;
  components get `src/components/Foo.test.jsx`.
- One `describe` block per exported function (or per component behavior area).
- Prefer testing observable behavior over implementation details.

### localStorage

jsdom provides a real `localStorage`, and [setup.js](../src/test/setup.js)
clears it **after every test** — never rely on state leaking between tests.
Seed data inside the test itself, using the app's own helpers:

```js
import { saveLS, K_WO } from "../lib/storage";
saveLS(K_WO, [myWorkout]);
```

### React Testing Library patterns

- Query by role or visible text (`getByRole("spinbutton")`, `getByText("Delete")`),
  not by class names or test ids unless there is no accessible handle.
- Use `userEvent.setup()` and `await user.click(...)` / `user.type(...)` —
  not `fireEvent` — so focus/blur side effects (e.g. `NumberInputAutoClear`)
  behave like a real browser.
- Anything that calls `useConfirm()` must be wrapped in `<ConfirmProvider>`;
  anything that calls `useApp()` must be wrapped in `<AppProvider>`.
- For controlled components (e.g. `WorkoutExerciseEditor`), render a small
  stateful harness that applies `onChange` patches back to state — see
  [WorkoutExerciseEditor.test.jsx](../src/components/WorkoutExerciseEditor.test.jsx).

## What needs tests

When adding or changing code:

- **Every new `src/lib` helper gets a co-located unit test.** Pure functions
  are cheap to test — cover the happy path, the empty/null inputs, and any
  boundary the function exists to handle (dates, rounding, truncation).
- **Components with logic get an RTL test**: state transitions, unit
  conversion at the input boundary, confirm flows, persistence effects.
- **Pure presentational Tailwind wrappers** (like `ui/Badge`) don't need tests.

High-value invariants the suite pins — don't break these:

- **kg storage**: set weights are stored in kilograms; `toDisplayWeight` /
  `fromDisplayWeight` round-trip exactly at the display boundary.
- **Week/month bucketing**: Monday-start weeks, year-crossing weeks stay in
  one bucket, leap-year February.
- **Backup merge**: importing never overwrites non-blank exercise fields and
  never silently drops a workout on id collision.

## Manual smoke test

Automated tests don't cover visual layout or real mobile behavior. After UI
changes, also run the manual checklist in
[CONTRIBUTING.md → Testing](../CONTRIBUTING.md#testing).
