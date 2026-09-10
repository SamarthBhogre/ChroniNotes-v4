import { lazy, Suspense, useEffect, useCallback, useState } from "react"
import Topbar from "./components/layout/Topbar"
import Sidebar from "./components/layout/Sidebar"
import WelcomeScreen from "./components/WelcomeScreen"
import Settings from "./pages/Settings"
import About from "./pages/About"
import UpdateChecker from "./components/UpdateChecker"
import BrandLogo from "./components/BrandLogo"
import { useThemeStore } from "./store/theme.store"

import "./store/theme.store"
import "./workspace.css"

const Dashboard = lazy(() => import("./pages/Dashboard"))
const Tasks     = lazy(() => import("./pages/Tasks"))
const Notes     = lazy(() => import("./pages/Notes"))
const Timer     = lazy(() => import("./pages/Timer"))
const Calendar  = lazy(() => import("./pages/Calendar"))
const Habits    = lazy(() => import("./pages/Habits"))
const Countdown = lazy(() => import("./pages/Countdown"))

type Page = "dashboard" | "tasks" | "notes" | "timer" | "calendar" | "habits" | "countdown"

function PageSkeleton() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", color: "var(--text-tertiary)" }}>
      <BrandLogo variant="gradient" size={44} animate />
      <div style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11px" }}>
        <div style={{ width: "13px", height: "13px", borderRadius: "50%", border: "2px solid var(--glass-border-strong)", borderTopColor: "var(--accent)", animation: "spin 0.7s linear infinite" }} />
        Loading…
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const PAGES: Page[] = ["dashboard", "tasks", "notes", "timer", "calendar", "habits", "countdown"]

export default function App() {
  const [page, setPage]                 = useState<Page>("dashboard")
  const [showWelcome, setShowWelcome]   = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout]       = useState(false)
  const { memorySaver } = useThemeStore()

  const [visited, setVisited] = useState<Set<Page>>(new Set<Page>(["dashboard"]))

  const navigate = useCallback((target: Page) => {
    setPage(target)
    setVisited(prev => {
      if (prev.has(target)) return prev
      const next = new Set(prev)
      next.add(target)
      return next
    })
  }, [])

  /* ── Global keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+, → Settings
      if (e.ctrlKey && e.key === ",") {
        e.preventDefault()
        setShowSettings(prev => !prev)
        setShowAbout(false)
        return
      }

      // Escape → close modals
      if (e.key === "Escape") {
        if (showSettings) { setShowSettings(false); e.preventDefault(); return }
        if (showAbout)    { setShowAbout(false);    e.preventDefault(); return }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [showSettings, showAbout])

  return (
    <div className="spatial-app flex h-screen overflow-hidden"
      style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}>

      {showWelcome && <WelcomeScreen onFinished={() => setShowWelcome(false)} />}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showAbout && <About onClose={() => setShowAbout(false)} />}
      {!showWelcome && <UpdateChecker />}

      <Topbar
        onOpenSettings={() => setShowSettings(true)}
        onOpenAbout={() => setShowAbout(true)}
      />

      <Sidebar current={page} onChange={navigate} />

      <main className="relative z-10 flex-1 flex flex-col"
        style={{ minWidth: 0, marginTop: "40px", overflow: "hidden" }}>
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, var(--accent-border), transparent)" }} />

        <div className="h-full" style={{ position: "relative" }}>
          {PAGES.map(p => {
            const isActive   = p === page
            const hasVisited = visited.has(p)
            if (!hasVisited) return null
            if (memorySaver && !isActive) return null

            return (
              <div key={p} inert={!isActive} aria-hidden={!isActive} style={{
                position: "absolute", inset: 0,
                opacity: isActive ? 1 : 0,
                pointerEvents: isActive ? "auto" : "none",
                animation: isActive ? "pageEnter 0.25s ease" : "none",
                overflow: p === "notes" ? "hidden" : "auto",
                display: "flex", flexDirection: "column",
              }}>
                <Suspense fallback={<PageSkeleton />}>
                  {p === "dashboard" && <Dashboard onNavigate={navigate} />}
                  {p === "tasks"     && <Tasks />}
                  {p === "notes"     && <Notes />}
                  {p === "timer"     && <Timer />}
                  {p === "calendar"  && <Calendar />}
                  {p === "habits"    && <Habits />}
                  {p === "countdown" && <Countdown />}
                </Suspense>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}