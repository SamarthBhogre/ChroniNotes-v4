import { useState } from "react"
import BrandLogo from "../components/BrandLogo"
import "../preferences.css"

interface AboutProps {
  onClose: () => void
}

/**
 * APP_VERSION is injected at build time by vite.config.ts from the root
 * package.json.  This is the single authoritative source — it matches
 * tauri.conf.json and Cargo.toml.
 */
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "3.0.0"

/* ── All keyboard shortcuts / commands ── */
const SHORTCUT_SECTIONS = [
  {
    title: "Navigation",
    items: [
      { keys: ["Ctrl", "1"], desc: "Go to Dashboard" },
      { keys: ["Ctrl", "2"], desc: "Go to Tasks" },
      { keys: ["Ctrl", "3"], desc: "Go to Notes" },
      { keys: ["Ctrl", "4"], desc: "Go to Timer" },
      { keys: ["Ctrl", "5"], desc: "Go to Calendar" },
      { keys: ["Ctrl", "6"], desc: "Go to Habits" },
      { keys: ["Ctrl", "7"], desc: "Go to Countdown" },
      { keys: ["Ctrl", "B"], desc: "Toggle sidebar collapse" },
    ],
  },
  {
    title: "Notes",
    items: [
      { keys: ["Ctrl", "F"], desc: "Search notes in sidebar" },
      { keys: ["Double-click"], desc: "Rename a note or folder" },
      { keys: ["Ctrl", "B"], desc: "Bold text in editor" },
      { keys: ["Ctrl", "I"], desc: "Italic text in editor" },
      { keys: ["Ctrl", "U"], desc: "Underline text in editor" },
      { keys: ["Ctrl", "Shift", "X"], desc: "Strikethrough text" },
      { keys: ["Ctrl", "Shift", "7"], desc: "Ordered list" },
      { keys: ["Ctrl", "Shift", "8"], desc: "Bullet list" },
      { keys: ["Ctrl", "Shift", "9"], desc: "Toggle task list" },
      { keys: ["Ctrl", "E"], desc: "Inline code" },
      { keys: ["Ctrl", "Shift", "E"], desc: "Code block" },
      { keys: ["Ctrl", "Z"], desc: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], desc: "Redo" },
    ],
  },
  {
    title: "Calendar",
    items: [
      { keys: ["Double-click"], desc: "Create event on a date" },
      { keys: ["Click"], desc: "Select a date" },
    ],
  },
  {
    title: "Tasks",
    items: [
      { keys: ["Enter"], desc: "Add task (when input focused)" },
      { keys: ["Click ●"], desc: "Advance task status" },
      { keys: ["Hover", "📦"], desc: "Archive a completed task" },
    ],
  },
  {
    title: "Habits",
    items: [
      { keys: ["+ / −"], desc: "Record or remove one habit occurrence" },
      { keys: ["←  →"], desc: "Navigate weeks" },
    ],
  },
  {
    title: "General",
    items: [
      { keys: ["Ctrl", ","], desc: "Open Settings" },
    ],
  },
]

const FEATURES = [
  { icon: "⬡", title: "Dashboard", desc: "Daily progress ring, streaks, heatmap, quick navigation to all modules." },
  { icon: "◈", title: "Kanban Tasks", desc: "Three-column board (To Do → In Progress → Done) with inline add, filter pills, click-to-advance status circles, and task archiving." },
  { icon: "◉", title: "Rich Notes", desc: "Notion-style nested pages and folders with a TipTap rich-text editor — headings, lists, code blocks, task lists, and more." },
  { icon: "⊹", title: "Timer Suite", desc: "Pomodoro timer, countdown timer with custom presets, and a stopwatch — all with session logging and focus history." },
  { icon: "▦", title: "Calendar", desc: "Month, week, day, and agenda views with unified habit/countdown integration. Create events with type-coding and desktop notification reminders." },
  { icon: "⟡", title: "Habits", desc: "Daily habit tracker with streaks, heatmaps, build/break goal types, sections, archiving, and calendar-integrated completion indicators." },
  { icon: "⏳", title: "Countdown", desc: "Visual countdown timers to important dates with progress bars, color-coded cards, and calendar integration." },
  { icon: "🎵", title: "Spotify", desc: "Integrated Spotify playback controls — play/pause, skip, shuffle, repeat modes — right in the sidebar without leaving the app." },
  { icon: "🔔", title: "Reminders", desc: "Configurable desktop notifications for calendar events — 5 min, 15 min, 1 hour, or custom intervals before the event." },
  { icon: "🎨", title: "8 Themes", desc: "Midnight Indigo, Steel Blue, Warm Linen, Ember, Carbon, Black & Red, Smooth Blues, and Warm Red & Blue — each with its own palette." },
  { icon: "⚡", title: "Optimized", desc: "Performance-first design with Memory Saver that unmounts inactive pages to free RAM. Collapsible sidebar for maximum workspace." },
  { icon: "💾", title: "Offline-First", desc: "All data stored locally in SQLite — no cloud, no accounts, no internet required. Your notes and tasks never leave your machine." },
]

const TECH_STACK = [
  "Tauri 2 (Rust backend)",
  "React 19 + TypeScript",
  "TipTap rich text editor",
  "SQLite (rusqlite)",
  "Zustand state management",
  "Vite bundler",
  "CSS custom properties",
  "Glassmorphism design system",
]

export default function About({ onClose }: AboutProps) {
  const [tab, setTab] = useState<"about" | "shortcuts" | "features">("about")

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "pageEnter 0.2s ease",
      }}
    >
      <div className="preferences-panel"
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(620px, calc(100vw - 48px))",
          maxHeight: "calc(100vh - 80px)",
          borderRadius: "var(--radius-xl, 16px)",
          background: "var(--modal-bg, rgba(12,15,30,0.97))",
          border: "1px solid var(--glass-border-strong)",
          backdropFilter: "blur(32px) saturate(180%)",
          WebkitBackdropFilter: "blur(32px) saturate(180%)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
          animation: "aboutEnter 0.22s cubic-bezier(0.34,1.56,0.64,1)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: "20px 24px 0", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              {/* Logo */}
              <BrandLogo size={52} />
              <div>
                <h2 style={{
                  fontSize: "1.2rem", fontWeight: 700, letterSpacing: "-0.3px",
                  color: "var(--text-primary)", margin: 0, lineHeight: 1.2,
                }}>ChroniNotes</h2>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                  <span style={{
                    fontSize: "10px", fontWeight: 600, padding: "2px 7px",
                    borderRadius: "4px", background: "var(--accent-dim)",
                    border: "1px solid var(--accent-border)", color: "var(--accent)",
                  }}>v{APP_VERSION}</span>
                  <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
                    Offline-first productivity suite
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                width: "32px", height: "32px", borderRadius: "8px",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-secondary)",
                background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                transition: "all 0.15s ease", flexShrink: 0, cursor: "pointer",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.color = "var(--text-primary)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--glass-bg)"; e.currentTarget.style.color = "var(--text-secondary)" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* ── Tabs ── */}
          <div style={{
            display: "flex", gap: "2px", padding: "3px",
            borderRadius: "10px", background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
          }}>
            {([
              { id: "about" as const, label: "About" },
              { id: "features" as const, label: "Features" },
              { id: "shortcuts" as const, label: "Shortcuts" },
            ]).map(({ id, label }) => (
              <button key={id} onClick={() => setTab(id)} style={{
                flex: 1, padding: "7px 12px", borderRadius: "7px",
                fontSize: "12px", fontWeight: 600, cursor: "pointer",
                color: tab === id ? "var(--text-primary)" : "var(--text-tertiary)",
                background: tab === id ? "var(--glass-bg-hover)" : "transparent",
                border: `1px solid ${tab === id ? "var(--glass-border-strong)" : "transparent"}`,
                transition: "all 0.15s ease",
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* ── Body (scrollable) ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 24px" }}>

          {/* ══════ ABOUT TAB ══════ */}
          {tab === "about" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Description */}
              <div style={{
                padding: "16px 18px", borderRadius: "12px",
                background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                lineHeight: 1.65,
              }}>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
                  <strong style={{ color: "var(--text-primary)" }}>ChroniNotes</strong> is an offline-first desktop
                  productivity suite built for students. Manage your tasks with a kanban board, write
                  rich notes in a Notion-style editor, stay focused with Pomodoro timers, build daily habits
                  with streak tracking, set countdown timers to important dates, and plan your schedule with
                  an integrated calendar — all with Spotify playback controls and without ever needing an internet connection.
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "10px 0 0" }}>
                  Your data lives in a local SQLite database on your machine. No accounts, no cloud sync,
                  no telemetry. <span style={{ color: "var(--accent)", fontWeight: 600 }}>Your notes are yours.</span>
                </p>
              </div>

              {/* Tech stack */}
              <div>
                <SectionLabel>Built With</SectionLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {TECH_STACK.map(tech => (
                    <span key={tech} style={{
                      padding: "5px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 600,
                      background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                      color: "var(--text-secondary)", transition: "all 0.12s",
                    }}>{tech}</span>
                  ))}
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {[
                  { label: "Themes", value: "8", icon: "🎨" },
                  { label: "Modules", value: "7", icon: "📦" },
                  { label: "Storage", value: "Local", icon: "💾" },
                ].map(({ label, value, icon }) => (
                  <div key={label} style={{
                    padding: "14px 12px", borderRadius: "12px", textAlign: "center",
                    background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                  }}>
                    <div style={{ fontSize: "18px", marginBottom: "6px" }}>{icon}</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "2px" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Temp hide developer detail
              <div style={{
                padding: "14px 18px", borderRadius: "12px",
                background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
              }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--accent)", marginBottom: "4px" }}>Made by</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>Samarth Bhogre</div>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                  Software Developer · © {BUILD_YEAR}
                </div>
              </div>
              */}

              {/* Footer info */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
                padding: "10px 0", fontSize: "10px", color: "var(--text-tertiary)",
              }}>
                <span>ChroniNotes v{APP_VERSION}</span>
                <span style={{ opacity: 0.3 }}>·</span>
                <span>Tauri 2 + React 18</span>
                <span style={{ opacity: 0.3 }}>·</span>
                <span>MIT License</span>
              </div>
            </div>
          )}

          {/* ══════ FEATURES TAB ══════ */}
          {tab === "features" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {FEATURES.map(({ icon, title, desc }) => (
                <div key={title} style={{
                  display: "flex", gap: "12px", padding: "12px 14px",
                  borderRadius: "12px", background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                  transition: "all 0.12s ease",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.borderColor = "var(--glass-border-strong)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--glass-bg)"; e.currentTarget.style.borderColor = "var(--glass-border)" }}
                >
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0,
                    background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px",
                  }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "3px" }}>{title}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)", lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══════ SHORTCUTS TAB ══════ */}
          {tab === "shortcuts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Tip */}
              <div style={{
                padding: "10px 14px", borderRadius: "10px",
                background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
                fontSize: "11px", color: "var(--accent)", fontWeight: 500, lineHeight: 1.5,
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <span style={{ fontSize: "14px" }}>💡</span>
                <span>These keyboard shortcuts work globally within ChroniNotes. Some are context-specific (e.g. editor shortcuts only work when editing a note).</span>
              </div>

              {SHORTCUT_SECTIONS.map(section => (
                <div key={section.title}>
                  <SectionLabel>{section.title}</SectionLabel>
                  <div style={{
                    borderRadius: "12px", overflow: "hidden",
                    border: "1px solid var(--glass-border)",
                  }}>
                    {section.items.map(({ keys, desc }, idx) => (
                      <div key={desc} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "9px 14px",
                        background: idx % 2 === 0 ? "var(--glass-bg)" : "transparent",
                        borderBottom: idx < section.items.length - 1 ? "1px solid var(--glass-border)" : "none",
                      }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{desc}</span>
                        <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                          {keys.map((k, i) => (
                            <span key={i}>
                              <kbd style={{
                                padding: "2px 7px", borderRadius: "5px", fontSize: "10px", fontWeight: 600,
                                fontFamily: "monospace", letterSpacing: "0.3px",
                                background: "var(--glass-bg-hover)", color: "var(--text-primary)",
                                border: "1px solid var(--glass-border-strong)",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                              }}>{k}</kbd>
                              {i < keys.length - 1 && (
                                <span style={{ fontSize: "9px", color: "var(--text-tertiary)", margin: "0 2px" }}>+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes aboutEnter {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: "10px", fontWeight: 700, letterSpacing: "0.6px",
      textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "10px",
    }}>{children}</p>
  )
}
