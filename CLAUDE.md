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
