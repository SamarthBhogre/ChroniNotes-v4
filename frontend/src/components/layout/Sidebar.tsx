import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import UserProfileCard from "./UserProfileCard"
import SpotifyPlayer from "../SpotifyPlayer"
import { useTasksStore } from "../../store/tasks.store"
import { useHabitsStore } from "../../store/habits.store"

type Page = "dashboard" | "tasks" | "notes" | "timer" | "calendar" | "habits" | "countdown"

interface Props {
  current: Page
  onChange: (page: Page) => void
}

type NavSection = {
  title: string
  items: { id: Page; label: string; icon: string; shortcut?: string }[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "⬡", shortcut: "1" },
      { id: "tasks",     label: "Tasks",     icon: "◈", shortcut: "2" },
      { id: "notes",     label: "Notes",     icon: "◉", shortcut: "3" },
    ],
  },
  {
    title: "Tracking",
    items: [
      { id: "timer",     label: "Timer",     icon: "⊹", shortcut: "4" },
      { id: "calendar",  label: "Calendar",  icon: "▦", shortcut: "5" },
      { id: "habits",    label: "Habits",    icon: "⟡", shortcut: "6" },
      { id: "countdown", label: "Countdown", icon: "⏳", shortcut: "7" },
    ],
  },
]

const ALL_ITEMS = NAV_SECTIONS.flatMap(s => s.items)
const STORAGE_KEY = "chorniNotes-sidebar-collapsed"
const WIDTH_STORAGE_KEY = "chorniNotes-sidebar-width"
const COLLAPSED_WIDTH = 60
const DEFAULT_WIDTH = 240
const MIN_WIDTH = 200
const MAX_WIDTH = 360

function getStoredSidebarWidth() {
  const value = Number(localStorage.getItem(WIDTH_STORAGE_KEY))
  if (!Number.isFinite(value)) return DEFAULT_WIDTH
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value))
}

function useNavEntrance(_count: number) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    refs.current.forEach((el, i) => {
      if (!el) return
      el.style.opacity = "0"
      el.style.transform = "translateX(-8px)"
      setTimeout(() => {
        el.style.transition = "opacity 0.25s ease, transform 0.25s cubic-bezier(0.22,1,0.36,1)"
        el.style.opacity = "1"
        el.style.transform = "translateX(0)"
      }, 60 + i * 45)
    })
  }, [])
  return refs
}

export default function Sidebar({ current, onChange }: Props) {
  const [pressed, setPressed] = useState<Page | null>(null)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === "true")
  const [expandedWidth, setExpandedWidth] = useState(getStoredSidebarWidth)
  const [resizing, setResizing] = useState(false)
  const resizeStartRef = useRef({ x: 0, width: DEFAULT_WIDTH })
  const latestWidthRef = useRef(expandedWidth)
  const navRefs = useNavEntrance(ALL_ITEMS.length)

  // Live stats for badges
  const tasks = useTasksStore(s => s.tasks)
  const habits = useHabitsStore(s => s.habits)
  const todoCount = tasks.filter(t => t.status === "todo" || t.status === "in-progress").length
  const activeHabitCount = habits.filter(h => !h.archived).length

  const handleClick = (id: Page) => {
    setPressed(id)
    setTimeout(() => setPressed(null), 180)
    onChange(id)
  }

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  const startResize = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (collapsed) return
    e.preventDefault()
    resizeStartRef.current = { x: e.clientX, width: expandedWidth }
    latestWidthRef.current = expandedWidth
    setResizing(true)
  }

  useEffect(() => {
    if (!resizing) return

    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartRef.current.x
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStartRef.current.width + delta))
      latestWidthRef.current = next
      setExpandedWidth(next)
    }
    const handleUp = () => {
      setResizing(false)
      localStorage.setItem(WIDTH_STORAGE_KEY, String(latestWidthRef.current))
    }

    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
    return () => {
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }
  }, [resizing])

  // Keyboard shortcuts: Ctrl+1-7
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        const num = parseInt(e.key)
        if (num >= 1 && num <= ALL_ITEMS.length) {
          e.preventDefault()
          handleClick(ALL_ITEMS[num - 1].id)
        }
      }
      // Ctrl+B to toggle sidebar
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === "b") {
        e.preventDefault()
        toggleCollapse()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [collapsed])

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : expandedWidth

  // Get badge for a nav item
  const getBadge = (id: Page): string | null => {
    if (id === "tasks" && todoCount > 0) return String(todoCount)
    if (id === "habits" && activeHabitCount > 0) return String(activeHabitCount)
    return null
  }

  let navIndex = 0

  return (
    <aside className="spatial-sidebar" style={{
      width: `${sidebarWidth}px`, flexShrink: 0,
      marginTop: "40px",
      background: "rgba(255,255,255,0.02)",
      borderRight: "1px solid var(--glass-border)",
      display: "flex", flexDirection: "column",
      position: "relative", zIndex: 20,
      transition: resizing ? "none" : "width 0.2s cubic-bezier(0.4,0,0.2,1)",
      overflow: "hidden",
    }}>
      {/* ── Logo ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: collapsed ? "16px 16px 14px" : "16px 16px 14px",
        borderBottom: "1px solid var(--glass-border)",
        minHeight: "56px",
      }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
          background: "linear-gradient(135deg, var(--glow-a), var(--glow-b))",
          boxShadow: "0 0 12px var(--accent-glow)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "13px", color: "white",
          animation: "floatY 4s ease-in-out infinite",
          cursor: "pointer",
        }}
          onClick={toggleCollapse}
          title={collapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
        >✦</div>
        {!collapsed && (
          <div style={{ whiteSpace: "nowrap", overflow: "hidden" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>ChroniNotes</div>
            <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "0px" }}>Productivity Suite</div>
          </div>
        )}
      </div>

      {/* ── Navigation sections ── */}
      <nav style={{ flex: 1, padding: collapsed ? "8px 6px" : "0 8px", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto", overflowX: "hidden" }}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {/* Section label */}
            {!collapsed && (
              <div style={{
                padding: si === 0 ? "12px 8px 6px" : "16px 8px 6px",
                fontSize: "9px", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "1px",
                color: "var(--text-tertiary)",
                whiteSpace: "nowrap", overflow: "hidden",
              }}>
                {section.title}
              </div>
            )}

            {/* Section divider in collapsed mode */}
            {collapsed && si > 0 && (
              <div style={{
                margin: "8px 8px 6px",
                height: "1px",
                background: "var(--glass-border)",
              }} />
            )}

            {/* Items */}
            {section.items.map(({ id, label, icon, shortcut }) => {
              const itemIndex = navIndex++
              const isActive  = current === id
              const isPressed = pressed === id
              const badge = getBadge(id)

              return (
                <button
                  key={id}
                  ref={el => { navRefs.current[itemIndex] = el }}
                  onClick={() => handleClick(id)}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? `${label}${shortcut ? ` (Ctrl+${shortcut})` : ""}` : undefined}
                  style={{
                    width: "100%", display: "flex", alignItems: "center",
                    gap: collapsed ? "0" : "8px",
                    padding: collapsed ? "8px" : "8px 8px",
                    borderRadius: "8px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    fontSize: "12.5px", fontWeight: isActive ? 600 : 500,
                    color: isActive ? "var(--accent)" : "var(--text-secondary)",
                    background: isActive ? "var(--accent-dim)" : "transparent",
                    border: `1px solid ${isActive ? "var(--accent-border)" : "transparent"}`,
                    boxShadow: isActive ? "0 0 10px var(--accent-glow)" : "none",
                    transform: isPressed ? "scale(0.97)" : "translateX(0)",
                    transition: "color 0.15s, background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.15s cubic-bezier(0.34,1.56,0.64,1)",
                    textAlign: "left", position: "relative", overflow: "hidden",
                  }}
                  onMouseEnter={e => {
                    if (isActive) return
                    e.currentTarget.style.background  = "var(--glass-bg-hover)"
                    e.currentTarget.style.borderColor = "var(--glass-border)"
                    e.currentTarget.style.color       = "var(--text-primary)"
                    if (!collapsed) e.currentTarget.style.transform = "translateX(2px)"
                  }}
                  onMouseLeave={e => {
                    if (isActive) return
                    e.currentTarget.style.background  = "transparent"
                    e.currentTarget.style.borderColor = "transparent"
                    e.currentTarget.style.color       = "var(--text-secondary)"
                    e.currentTarget.style.transform   = "translateX(0)"
                  }}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span style={{
                      position: "absolute", left: 0, top: "25%", bottom: "25%",
                      width: "2.5px", borderRadius: "0 2px 2px 0",
                      background: "var(--accent)", boxShadow: "0 0 8px var(--accent)",
                      animation: "slideInBar 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                    }} />
                  )}

                  {/* Icon */}
                  <span style={{
                    fontSize: collapsed ? "16px" : "14px",
                    width: collapsed ? "auto" : "18px",
                    textAlign: "center", flexShrink: 0,
                    opacity: isActive ? 1 : 0.6, display: "inline-block",
                    transform: isActive ? "scale(1.1)" : "scale(1)",
                    transition: "transform 0.2s, opacity 0.15s, font-size 0.2s",
                    position: "relative",
                  }}>
                    {icon}
                    {/* Badge dot in collapsed mode */}
                    {collapsed && badge && (
                      <span style={{
                        position: "absolute", top: "-3px", right: "-6px",
                        width: "8px", height: "8px", borderRadius: "50%",
                        background: "var(--accent)",
                        boxShadow: "0 0 4px var(--accent-glow)",
                        fontSize: "0",
                      }} />
                    )}
                  </span>

                  {/* Label + Badge (expanded mode) */}
                  {!collapsed && (
                    <>
                      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>

                      {/* Quick stat badge */}
                      {badge && !isActive && (
                        <span style={{
                          fontSize: "9px", fontWeight: 700,
                          padding: "1px 6px", borderRadius: "6px",
                          background: "var(--accent-dim)",
                          border: "1px solid var(--accent-border)",
                          color: "var(--accent)",
                          lineHeight: 1.4,
                          flexShrink: 0,
                        }}>{badge}</span>
                      )}

                      {/* Shortcut hint */}
                      {shortcut && !isActive && !badge && (
                        <span style={{
                          fontSize: "9px", fontWeight: 500, color: "var(--text-tertiary)",
                          opacity: 0.5, padding: "1px 4px", borderRadius: "3px",
                          background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                          fontFamily: "monospace", lineHeight: 1.3,
                          flexShrink: 0,
                        }}>⌃{shortcut}</span>
                      )}
                    </>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── Collapse toggle (bottom of nav, expanded mode only) ── */}
      {!collapsed && (
        <button
          onClick={toggleCollapse}
          title="Collapse sidebar (Ctrl+B)"
          style={{
            margin: "4px 8px 0", padding: "6px 8px", borderRadius: "8px",
            background: "transparent", border: "1px solid transparent",
            color: "var(--text-tertiary)", fontSize: "10px", fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
            transition: "all 0.12s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "var(--glass-bg-hover)"
            e.currentTarget.style.borderColor = "var(--glass-border)"
            e.currentTarget.style.color = "var(--text-secondary)"
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent"
            e.currentTarget.style.borderColor = "transparent"
            e.currentTarget.style.color = "var(--text-tertiary)"
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
          </svg>
          Collapse
        </button>
      )}

      {/* ── Spotify Player ── */}
      <div style={{
        flexShrink: 1,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        display: collapsed ? "none" : "block",
      }}>
        <SpotifyPlayer />
      </div>

      {/* ── Expand button (collapsed mode) ── */}
      {collapsed && (
        <button
          onClick={toggleCollapse}
          title="Expand sidebar (Ctrl+B)"
          style={{
            margin: "auto 0 8px", padding: "8px",
            background: "transparent", border: "none",
            color: "var(--text-tertiary)", fontSize: "12px",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "color 0.12s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)" }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M13 7l5 5-5 5M6 7l5 5-5 5" />
          </svg>
        </button>
      )}

      <UserProfileCard collapsed={collapsed} />

      {!collapsed && (
        <div
          onMouseDown={startResize}
          title="Resize sidebar"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: 8,
            cursor: "col-resize",
            zIndex: 30,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 1,
              background: resizing ? "var(--accent)" : "transparent",
              boxShadow: resizing ? "0 0 10px var(--accent-glow)" : "none",
            }}
          />
        </div>
      )}
    </aside>
  )
}
