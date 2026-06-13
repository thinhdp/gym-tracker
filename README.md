# Gym Tracker

**Gym Tracker** is a lightweight workout logging application built with React, Vite and Tailwind CSS. It runs entirely in the browser and persists your data locally, so you can plan, log and review workouts without a server or user account. The project includes tools to manage exercises, schedule workouts on specific dates, view your training history, track bodyweight, review weekly/monthly analytics and jot down notes—all in one place.

**Live demo:** https://gym-tracker-ashen.vercel.app

## Features

- **Plan & Log Workouts** – Create workouts for multiple dates, name them, add exercises and specify up to ten sets per exercise. You can adjust weights and reps on the fly, reorder exercises within a workout and save multiple workouts at once.
- **Exercise Management** – Maintain a library of exercises with recommended rep ranges and meta‑information such as main muscle, secondary muscles, type, equipment and force. Rename or delete exercises and see how many workouts each exercise appears in.
- **History View** – Edit past workouts, change dates or names, add or remove exercises and modify individual sets. The history view mirrors the planner interface so editing feels familiar.
- **Exercise History Modal** – Click on an exercise name anywhere in the planner or history to open a modal showing all past workouts containing that exercise. Each entry lists the date, workout name and sets with weight and reps.
- **Calendar View** – Visualise your training schedule in a calendar (month) view. See which days you worked out and click on a date to view all workouts logged for that day.
- **Weight Tracking** – Log your bodyweight on a monthly calendar, see this week's average and the change versus last week, and view a scrollable daily/weekly trend chart.
- **Summary Analytics** – Weekly and monthly dashboards showing workout frequency, total reps/sets, reps & sets per muscle (now vs. last period), and new personal records (PRs). Each week also keeps its own notes.
- **Notepad** – A simple notepad that autosaves content to localStorage. It auto‑expands as you type and allows you to keep training notes or todo items.
- **Data Management Menu** – Export your entire dataset (exercises, workouts, bodyweight logs, notes and preferences) to a JSON file for backup. Import data back into the app in merge or replace mode. All export/import operations are available from a single dropdown in the header.
- **Unit Toggle** – Switch between kilograms and pounds in one click. The UI displays your preferred unit throughout the app, and your choice is remembered.

## Screenshots

> _Coming soon — screenshots of the Workouts, Calendar, Weight and Summary tabs will be added here._

| Workouts             | Calendar             | Weight               | Summary              |
| -------------------- | -------------------- | -------------------- | -------------------- |
| _screenshot pending_ | _screenshot pending_ | _screenshot pending_ | _screenshot pending_ |

## Getting Started

### Prerequisites

This project requires **Node.js** and **npm**. The build tooling (Vite 5) needs **Node 18 or later** (Node 20+ recommended). If you don't have them installed, download them from [nodejs.org](https://nodejs.org/).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/thinhdp/gym-tracker.git
   cd gym-tracker
   ```
2. Install dependencies:

```bash
npm install
```

### Running the app

The project uses Vite for development and build. To start a development server with hot reloading:

```bash
npm run dev
```

Vite will print a local development URL (typically http://localhost:5173). Open this in your browser to use Gym Tracker.
To build a production bundle:

```bash
npm run build
```

The compiled files will be output to the dist directory. You can preview the production build locally with:

```bash
npm run preview
```

## Project Structure

```graphql
├── src
│   ├── components        # React components (planner, history, calendar, weight, summary, etc.)
│   ├── context           # AppContext: shared state (tab, unit, exercises, workouts) + persistence
│   ├── data              # Seed data for initial exercises
│   ├── lib               # Helper utilities (storage, backup, units, date, metrics)
│   ├── index.css         # TailwindCSS base styles
│   ├── main.jsx          # Entry point (mounts App)
│   └── App.jsx           # Main application component
├── package.json          # Scripts and dependencies
├── postcss.config.js     # PostCSS config for Tailwind
├── tailwind.config.js    # TailwindCSS configuration
└── README.md             # Project documentation (you are here)
```

For a deeper walkthrough of the architecture, state model and data shapes, see the [Documentation](#documentation) section below.

## Key Components

| Component          | Description                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WorkoutPlanner     | Plan or log workouts. Allows adding exercises, specifying sets and reps, reordering exercises and saving multiple workouts.                                    |
| WorkoutHistory     | Edit existing workouts. Similar interface to the planner but operates on previously logged workouts; supports modifying dates/names and viewing past sets.     |
| ExerciseManager    | Create, update and delete exercises. Provides a “View history” modal to see all workouts containing an exercise.                                               |
| CalendarView       | Calendar‑based overview of your training sessions; add or view workouts per day.                                                                               |
| WeightTracker      | Log bodyweight on a monthly calendar; shows weekly average, change vs. last week, and a scrollable trend chart (`WeightChart`).                                |
| DashboardSummary   | Weekly/monthly analytics: frequency, total reps/sets, per‑muscle bars (`GroupedMuscleBar`), PRs and per‑week notes (`WeeklyNotes`), rendered as `PeriodCard`s. |
| Notepad            | Standalone notepad for any free‑form notes.                                                                                                                    |
| DataManagementMenu | Dropdown menu to export/import all data (exercises, workouts, weight logs, notes, preferences).                                                                |

## Data Persistence

Gym Tracker stores everything—exercises, workouts, bodyweight logs, notes and preferences—in your browser’s localStorage. The core keys are defined in `src/lib/storage.js`; the full key inventory and object shapes are documented in [docs/DATA-MODEL.md](docs/DATA-MODEL.md). No data is sent to any server. Clearing your browser data will remove your history, so use the export feature in the Data menu to create a backup if needed.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the app is built: state (AppContext), data flow, persistence, build pipeline.
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md) — exact localStorage schema and object shapes.
- [CONTRIBUTING.md](CONTRIBUTING.md) — local setup, conventions, and how to extend the app.

## Contributing

Contributions are welcome! If you have ideas for new features, improvements or bug fixes, feel free to open an issue or submit a pull request. When making changes, please ensure that the UI remains consistent and that any new functionality adheres to the existing design patterns. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and conventions.

## License

This project is intended to be released under the MIT License. _(No `LICENSE` file is currently committed to the repository.)_

---
