# Gym Tracker

**Gym Tracker** is a lightweight workout logging application built with React, Vite and Tailwind CSS. It runs entirely in the browser and persists your data locally, so you can plan, log and review workouts without a server or user account. The project includes tools to manage exercises, schedule workouts on specific dates, view your training history and even jot down notes—all in one place.

## Features

- **Plan & Log Workouts** – Create workouts for multiple dates, name them, add exercises and specify up to five sets per exercise. You can adjust weights and reps on the fly, reorder exercises within a workout and save multiple workouts at once.
- **Exercise Management** – Maintain a library of exercises with recommended rep ranges and meta‑information such as main muscle, secondary muscles, type, equipment and force. Rename or delete exercises and see how many workouts each exercise appears in.
- **History View** – Edit past workouts, change dates or names, add or remove exercises and modify individual sets. The history view mirrors the planner interface so editing feels familiar.
- **Exercise History Modal** – Click on an exercise name anywhere in the planner or history to open a modal showing all past workouts containing that exercise. Each entry lists the date, workout name and sets with weight and reps.
- **Calendar View** – Visualise your training schedule in a calendar (month) view. See which days you worked out and click on a date to view all workouts logged for that day.
- **Notepad** – A simple notepad that autosaves content to localStorage. It auto‑expands as you type and allows you to keep training notes or todo items.
- **Data Management Menu** – Export your entire dataset (exercises and workouts) to a JSON file for backup. Import data back into the app in merge or replace mode. All export/import operations are available from a single dropdown in the header.
- **Unit Toggle** – Switch between kilograms and pounds in one click. The UI displays your preferred unit throughout the app.

## Getting Started

### Prerequisites

This project requires **Node.js** (version 14 or later) and **npm**. If you don’t have them installed, download them from [nodejs.org](https://nodejs.org/).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/thinhdp/gym-tracker.git
   cd gym-tracker
Install dependencies:

bash
Copy code
npm install
Running the app
The project uses Vite for development and build. To start a development server with hot reloading:

bash
Copy code
npm run dev
Vite will print a local development URL (typically http://localhost:5173). Open this in your browser to use Gym Tracker.

To build a production bundle:

bash
Copy code
npm run build
The compiled files will be output to the dist directory. You can preview the production build locally with:

bash
Copy code
npm run preview
Project Structure
graphql
Copy code
├── src
│   ├── components        # React components (planner, history, exercise manager, calendar, etc.)
│   ├── data              # Seed data for initial exercises
│   ├── lib               # Helper utilities (storage, backup helpers)
│   ├── index.css         # TailwindCSS base styles
│   └── App.jsx           # Main application component
├── package.json          # Scripts and dependencies
├── postcss.config.js     # PostCSS config for Tailwind
├── tailwind.config.js    # TailwindCSS configuration
└── README.md             # Project documentation (you are here)
Key Components
Component	Description
WorkoutPlanner	Plan or log workouts. Allows adding exercises, specifying sets and reps, reordering exercises and saving multiple workouts.
WorkoutHistory	Edit existing workouts. Similar interface to the planner but operates on previously logged workouts; supports modifying dates/names and viewing past sets.
ExerciseManager	Create, update and delete exercises. Provides a “View history” modal to see all workouts containing an exercise.
CalendarView	Calendar‑based overview of your training sessions.
Notepad	Standalone notepad for any free‑form notes.
DataManagementMenu	Dropdown menu to export/import data.

Data Persistence
Gym Tracker stores all exercises, workouts and notes in your browser’s localStorage using keys defined in src/lib/storage.js. No data is sent to any server. Clearing your browser data will remove your workouts and notes, so be sure to use the export feature to create a backup if needed.

Contributing
Contributions are welcome! If you have ideas for new features, improvements or bug fixes, feel free to open an issue or submit a pull request. When making changes, please ensure that the UI remains consistent and that any new functionality adheres to the existing design patterns.

License
This project is released under the MIT License. See the LICENSE file for details.
