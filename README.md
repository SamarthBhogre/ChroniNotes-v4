# ChroniNotes

ChroniNotes is an offline-first desktop productivity app for students and focused creators.
It unifies tasks, notes, and timer workflows in one local-first workspace.

Your data stays on your machine.

## Privacy Policy

ChroniNotes privacy policy: [PRIVACY_POLICY.md](./PRIVACY_POLICY.md)

## Why This Project

Most productivity tools split notes, tasks, and focus timers into separate apps.
ChroniNotes combines them so context stays together:

- Write notes while planning tasks.
- Run focus sessions without leaving your workspace.
- Keep all data local with no cloud lock-in.

## Core Features

- Task management with `todo`, `doing`, and `done` workflow.
- Rich notes editor with folders/pages and auto-save.
- Pomodoro + stopwatch + custom timer modes with session logging.
- Calendar with events, reminders, and task due dates (month, week, day, and agenda views).
- Syntax-highlighted code blocks in notes with language selection.
- Focus session history with heatmap visualization.
- Contribution streaks across task completions and focus sessions.
- Daily goal tracking with configurable targets for tasks and focus minutes.
- Desktop notification reminders for calendar events with configurable intervals.
- User profile with name, avatar, and status indicator (Learning / Working / Idle).
- Five built-in themes: Midnight Indigo, Steel Blue, Warm Linen, Ember, and Carbon.
- Memory saver mode that unmounts inactive pages to reduce RAM usage.
- In-app update checker with one-click download and install from GitHub Releases.
- Custom frameless window with integrated title bar controls.
- Windows 11-style welcome screen on first launch.
- Local file + SQLite persistence.

## Tech Stack

| Layer | Used | How It Is Used | Why It Is Used |
|---|---|---|---|
| Desktop shell | **Tauri v2** | Rust backend + WebView2 frontend with IPC bridge | Lightweight native shell (~5.8 MB binary, ~26 MB RAM) |
| Backend | **Rust** | Handles all IPC commands, database, file I/O, timers, notifications, updater | Memory-safe, fast, no runtime overhead |
| Frontend | React 19 + TypeScript | SPA renderer for Dashboard/Tasks/Notes/Timer/Calendar | Fast UI development with type safety |
| Build tool | Vite | Dev server + frontend build pipeline | Fast HMR and modern bundling |
| State | Zustand | Lightweight stores for tasks/notes/timer/calendar/theme/user | Simple, predictable state updates |
| Notes editor | TipTap | Rich text editor extensions and commands | Highly extensible editor model |
| Code highlighting | lowlight + TipTap code block extension | Syntax colors in note code blocks | Good language highlighting inside notes |
| Database | **rusqlite** (SQLite) | Stores tasks, calendar events, timer settings, focus sessions, presets | Fast local persistence, no external service |
| Notes storage | JSON files in app data folder | Each note/folder stored as real files | Easy backup, portability, transparency |
| Notifications | tauri-plugin-notification | Desktop reminders for calendar events and timer completions | Native OS notifications without polling |
| Styling | Tailwind CSS + custom CSS vars | Layout + theming + component styling | Rapid UI iteration with consistent theme |

## Architecture

```
ChorniNotes/
├── src-tauri/           ← Rust backend (Tauri v2)
│   ├── src/
│   │   ├── lib.rs       ← App setup, plugin registration, command wiring
│   │   ├── main.rs      ← Entry point
│   │   ├── db.rs        ← SQLite schema, migrations, WAL mode
│   │   ├── updater.rs   ← GitHub release checker, installer download
│   │   ├── notifications.rs ← Background scheduler for calendar reminders
│   │   └── commands/    ← IPC command handlers
│   │       ├── tasks.rs          ← Task CRUD, completion history, due dates
│   │       ├── timer.rs          ← Pomodoro, stopwatch, focus sessions
│   │       ├── notes.rs          ← File-based notes system (JSON files)
│   │       ├── timer_presets.rs  ← Timer preset CRUD
│   │       └── calendar.rs       ← Calendar events CRUD, date queries, reminders
│   ├── Cargo.toml
│   └── tauri.conf.json
├── frontend/            ← React SPA
│   ├── src/
│   │   ├── lib/tauri-bridge.ts   ← IPC compatibility bridge
│   │   ├── store/                ← Zustand stores (tasks, notes, timer, calendar, theme, user)
│   │   ├── pages/                ← Dashboard, Tasks, Notes, Timer, Calendar, Settings, About
│   │   └── components/           ← UI components (heatmap, editor, sidebar, topbar, updater, welcome)
│   └── package.json
└── package.json         ← Root scripts (dev, build)
```

**IPC flow**: Frontend stores call `window.electron.invoke(channel, payload)` → the Tauri bridge (`tauri-bridge.ts`) translates these to `invoke()` from `@tauri-apps/api/core` → Rust command handlers process and return results.

## Quick Install (Just Use the App)

If you just want to **install and use ChroniNotes** without building from source:

1. Go to the [**Releases**](https://github.com/SamarthBhogre/ChroniNotes/releases) page.
2. Download the latest installer:
   - **`ChorniNotes_x.x.x_x64-setup.exe`** — NSIS installer (recommended, ~2.3 MB)
   - **`ChorniNotes_x.x.x_x64_en-US.msi`** — MSI installer (for enterprise/IT deployment)
3. Run the installer and launch ChroniNotes.

> No Rust, Node.js, or any dev tools required. Just download, install, and go.

---

## Build from Source

If you want to develop or build ChroniNotes yourself:

### Prerequisites

- **Rust** (stable toolchain via [rustup](https://rustup.rs/))
- **Node.js** (LTS recommended)
- **npm**
- **Git**

**Windows**: Visual Studio 2022 with **C++ desktop development** workload and **Windows 11 SDK** component (needed for Rust's MSVC linker).

### Setup

**Option 1: Automated setup**

```bash
git clone https://github.com/SamarthBhogre/ChroniNotes.git
cd ChroniNotes

# Windows
setup.bat

# Linux/macOS
chmod +x setup.sh && ./setup.sh
```

The setup script checks all prerequisites and installs dependencies automatically.

**Option 2: Manual setup**

```bash
git clone https://github.com/SamarthBhogre/ChroniNotes.git
cd ChroniNotes
npm install
cd frontend && npm install && cd ..
```

## Running the App

### Development

```bash
npm run dev
```

This starts:
- Vite dev server on `http://localhost:5173`
- Rust backend compiled and launched by Tauri
- Hot reload for frontend changes

> **Windows note**: If `npm run dev` fails with linker errors, use the provided `run-tauri-dev.bat` from a **Developer Command Prompt for VS 2022** to ensure the MSVC environment is set up.

### Production Build

```bash
npm run build
```

Produces:
- **NSIS installer** (`.exe`) — smallest, recommended
- **MSI installer** — for IT/enterprise deployment
- **Standalone binary** — `src-tauri/target/release/chroninotes.exe`

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Run full app (Vite + Tauri dev mode) |
| `npm run build` | Production build with installers |
| `npm run setup` | Install frontend dependencies |

## Data Storage

| Data Type | Storage |
|---|---|
| Tasks, calendar events, timer settings, focus sessions, presets | SQLite (`chroninotes.db`) in app data directory |
| Notes and folders | JSON files under `ChroniNotes/` in app data directory |
| User profile and preferences | LocalStorage in WebView2 |

App data location (Windows):
```
C:\Users\<you>\AppData\Roaming\com.chroninotes.app\
```

## Performance

| Metric | Value |
|---|---|
| Binary size | ~5.8 MB |
| Installer size | ~2.3 MB (NSIS) |
| Rust backend RAM | ~26 MB |
| Total app RAM | ~150–350 MB (includes WebView2 renderer) |
| Cold startup | ~2s |

The Rust backend itself is very lean. The bulk of memory usage comes from WebView2 (Microsoft Edge's renderer engine), which is an inherent cost of any webview-based desktop framework. Memory saver mode can reduce frontend RAM by unmounting inactive pages.

## Troubleshooting

### 1) `cargo` or `rustc` not found

Fix: Install Rust via [rustup.rs](https://rustup.rs/). Restart your terminal after installation.

### 2) Linker errors on Windows (`LNK1181: cannot open kernel32.lib`)

Fix:
- Open **Visual Studio Installer**
- Modify your VS 2022 installation
- Add **Windows 11 SDK** component under "Individual components"
- Run from a **Developer Command Prompt** or use `run-tauri-dev.bat`

### 3) Port `5173` already in use

Fix: Stop other Vite processes, or:
```bash
cd frontend
npm run dev -- --port 5174
```

### 4) Frontend shows blank white screen

Fix: Check browser console (F12) for errors. Most likely an IPC channel mismatch — ensure the Tauri bridge maps all channels correctly.

### 5) Changes not showing

Fix: Tauri dev mode has hot reload for frontend. For Rust changes, the app auto-recompiles. If stuck, `Ctrl+C` and re-run `npm run dev`.

## Future Scope

- Core scheduling engine for study blocks and task calendar planning
- Advanced analytics with focus trend graphs, task velocity charts, and productivity reports
- Goal-based planning with milestones, review cycles, and progress tracking
- Cross-device sync as optional encrypted mode
- Smart insights and reminders based on behavior patterns
- Plugin or extension system for custom workflows
- Export and import of notes, tasks, and calendar data

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit: `git commit -m "feat: add my feature"`
4. Push: `git push origin feat/my-feature`
5. Open a Pull Request

## License

MIT License.
#   C h r o n i N o t e s - v 4  
 