import { useEffect, useMemo, useState, useCallback } from "react"
import { useHabitsStore } from "../store/habits.store"
import type { Habit, GoalType, HabitFrequency } from "../store/habits.store"
import { habitWeekStart } from "../lib/scheduling"
import { habitDayComplete } from "../lib/habit-progress"
import StudioHeader from "../components/StudioHeader"
import "../studios.css"
import "../tracking.css"

const COLORS = ["#818cf8", "#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c", "#ef4444", "#2dd4bf", "#e879f9"]
const ICONS = ["✦", "💪", "📖", "🏃", "💧", "🧘", "🎯", "💤", "🍎", "✍️", "🎵", "🌱", "🧠", "🚫", "⏰", "🏋️"]

/* ── Date helpers ── */
function todayStr() {
  const d = new Date()
  return fmtDate(d)
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function getWeekDates(offset = 0): string[] {
  const dates: string[] = []
  const today = new Date()
  today.setDate(today.getDate() + offset * 7)
  const startOfWeek = habitWeekStart(today)
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    dates.push(fmtDate(d))
  }
  return dates
}

function getMonthDates(year: number, month: number): string[] {
  const dates: string[] = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    dates.push(fmtDate(d))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { weekday: "short" })
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function weekRangeLabel(dates: string[]): string {
  if (dates.length === 0) return ""
  return `${shortDate(dates[0])} – ${shortDate(dates[dates.length - 1])}`
}

/* ── Main Component ── */
export default function Habits() {
  const {
    habits, archivedHabits, logs, streaks, error,
    loadHabits, loadArchivedHabits, loadLogs, loadAllStreaks,
    updateHabit, archiveHabit, restoreHabit, deleteHabit,
    logHabit, clearError,
  } = useHabitsStore()

  const [showCreate, setShowCreate] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [view, setView] = useState<"week" | "month">("week")
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const [today, setToday] = useState(todayStr)
  useEffect(() => {
    const refresh = () => setToday(todayStr())
    const timer = window.setInterval(refresh, 15000)
    window.addEventListener("focus", refresh)
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh) }
  }, [])
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset, today])
  const monthDates = useMemo(() => getMonthDates(monthDate.year, monthDate.month), [monthDate])

  useEffect(() => {
    loadHabits()
  }, [])

  // Load logs whenever date range changes
  useEffect(() => {
    if (view === "week") {
      loadLogs(weekDates[0], weekDates[weekDates.length - 1])
    } else {
      loadLogs(fmtDate(habitWeekStart(new Date(`${monthDates[0]}T12:00:00`))), monthDates[monthDates.length - 1])
    }
  }, [weekDates, monthDates, view, loadLogs])

  // Load streaks once habits are loaded
  useEffect(() => {
    if (habits.length > 0) loadAllStreaks()
  }, [habits, today, loadAllStreaks])

  const getLogCount = useCallback((habitId: number, date: string) => {
    return logs.find(l => l.habit_id === habitId && l.date === date)?.count || 0
  }, [logs])

  const getWeekTotal = useCallback((habitId: number) => {
    const start = weekDates[0]
    const end = weekDates[weekDates.length - 1]
    return logs
      .filter(l => l.habit_id === habitId && l.date >= start && l.date <= end)
      .reduce((s, l) => s + l.count, 0)
  }, [logs, weekDates])

  const handleToggle = async (habitId: number, date: string) => {
    const habit = habits.find(h => h.id === habitId)
    if (!habit || date > today || date < (habit.start_date || habit.created_at?.slice(0, 10) || today)) return
    await logHabit(habitId, date)
  }

  // Group habits by section
  const sections = useMemo(() => {
    const map = new Map<string, Habit[]>()
    for (const h of habits) {
      const sec = h.section || "Uncategorized"
      if (!map.has(sec)) map.set(sec, [])
      map.get(sec)!.push(h)
    }
    return Array.from(map.entries())
  }, [habits])

  const toggleSection = (sec: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(sec)) next.delete(sec)
      else next.add(sec)
      return next
    })
  }

  return (
    <div className="tracking-page" style={{ height: "100%", color: "var(--text-primary)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <StudioHeader eyebrow="BUILD YOUR RHYTHM" title="Small steps. Lasting momentum." description="Track occurrences honestly, one day at a time."
        stats={[{ label: "Habits", value: habits.length }, { label: "Weekly goals", value: habits.filter(h => h.frequency === "weekly").length }]} />
      <p className="tracking-note">+ records one occurrence; − removes one. Weekly goals use Monday–Sunday totals; results appear on Sunday. Limit goals finalize after the period closes. Missing logs count as zero. Reminders check in daily at the configured local time while the app is open; OS notifications must be allowed.</p>

      {/* Error toast */}
      {error && (
        <div style={{
          position: "fixed", top: 50, right: 20, zIndex: 999,
          padding: "10px 16px", borderRadius: "10px",
          background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
          color: "#ef4444", fontSize: "11px", maxWidth: 320,
          display: "flex", alignItems: "center", gap: 8,
          animation: "slideDown 0.2s ease",
        }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={clearError} style={{
            background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: 0,
          }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: "18px 28px 14px", borderBottom: "1px solid var(--glass-border)",
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "10px",
            background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", color: "var(--accent)",
          }}>⟡</div>
          <div>
            <h1 style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.3px", lineHeight: 1.2, margin: 0 }}>Habits</h1>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "1px" }}>
              {habits.length} habit{habits.length !== 1 ? "s" : ""} tracked
              {Object.values(streaks).some(s => s.current_streak > 0) && (
                <span style={{ marginLeft: 6, color: "var(--accent)" }}>
                  🔥 {Math.max(...Object.values(streaks).map(s => s.current_streak))}d best active
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* View toggle */}
          <div style={{
            display: "flex", borderRadius: "8px", overflow: "hidden",
            border: "1px solid var(--glass-border)",
          }}>
            {(["week", "month"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: "5px 12px", fontSize: "10px", fontWeight: 600,
                background: view === v ? "var(--accent-dim)" : "var(--glass-bg)",
                border: "none",
                color: view === v ? "var(--accent)" : "var(--text-tertiary)",
                cursor: "pointer", textTransform: "capitalize",
              }}>{v}</button>
            ))}
          </div>

          {/* Archive button */}
          <button
            onClick={() => { setShowArchive(!showArchive); if (!showArchive) loadArchivedHabits() }}
            title="View archived habits"
            style={{
              padding: "6px 12px", borderRadius: "8px",
              background: showArchive ? "var(--accent-dim)" : "var(--glass-bg)",
              border: `1px solid ${showArchive ? "var(--accent-border)" : "var(--glass-border)"}`,
              color: showArchive ? "var(--accent)" : "var(--text-tertiary)",
              fontSize: "10px", fontWeight: 600, cursor: "pointer",
            }}
          >📦 Archive</button>

          {/* Create button */}
          <button
            onClick={() => setShowCreate(!showCreate)}
            style={{
              padding: "8px 16px", borderRadius: "10px",
              background: showCreate ? "var(--glass-bg)" : "var(--accent)",
              border: showCreate ? "1px solid var(--glass-border)" : "none",
              color: showCreate ? "var(--text-secondary)" : "white",
              fontSize: "11px", fontWeight: 700, cursor: "pointer",
              boxShadow: showCreate ? "none" : "0 0 12px var(--accent-glow)",
              transition: "all 0.15s",
            }}
          >
            {showCreate ? "Cancel" : "+ New Habit"}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateHabitForm
          onCreated={() => { setShowCreate(false); loadLogs(weekDates[0], weekDates[weekDates.length - 1]) }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Archive panel */}
      {showArchive && (
        <ArchivePanel
          habits={archivedHabits}
          onRestore={restoreHabit}
          onDelete={deleteHabit}
          onClose={() => setShowArchive(false)}
        />
      )}

      {/* Navigation for week/month */}
      <div style={{
        padding: "10px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--glass-border)", flexShrink: 0,
      }}>
        {view === "week" ? (
          <>
            <button onClick={() => setWeekOffset(w => w - 1)} style={navBtnStyle}>←</button>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
              {weekRangeLabel(weekDates)}
              {weekOffset === 0 && <span style={{ fontSize: "9px", color: "var(--accent)", marginLeft: 6 }}>This week</span>}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)} style={{ ...navBtnStyle, fontSize: "9px", padding: "3px 8px" }}>Today</button>
              )}
              <button onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}
                style={{ ...navBtnStyle, opacity: weekOffset >= 0 ? 0.3 : 1 }}>→</button>
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setMonthDate(m => {
              const d = new Date(m.year, m.month - 1)
              return { year: d.getFullYear(), month: d.getMonth() }
            })} style={navBtnStyle}>←</button>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
              {new Date(monthDate.year, monthDate.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </div>
            <button onClick={() => {
              const now = new Date()
              const isCurrentMonth = monthDate.year === now.getFullYear() && monthDate.month === now.getMonth()
              if (!isCurrentMonth) {
                setMonthDate(m => {
                  const d = new Date(m.year, m.month + 1)
                  return { year: d.getFullYear(), month: d.getMonth() }
                })
              }
            }} style={{
              ...navBtnStyle,
              opacity: (monthDate.year === new Date().getFullYear() && monthDate.month === new Date().getMonth()) ? 0.3 : 1,
            }}>→</button>
          </>
        )}
      </div>

      {/* Habits grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 28px 20px" }}>
        {habits.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-tertiary)" }}>
            <div style={{ fontSize: "40px", marginBottom: "16px", opacity: 0.15 }}>⟡</div>
            <div style={{ fontSize: "14px", marginBottom: "8px", fontWeight: 600 }}>No habits yet</div>
            <div style={{ fontSize: "11px", maxWidth: 300, margin: "0 auto", lineHeight: 1.5 }}>
              Create a habit to start tracking your daily progress. You can organize them into sections, set goals, and monitor streaks.
            </div>
          </div>
        ) : view === "week" ? (
          <WeekView
            sections={sections}
            weekDates={weekDates}
            today={today}
            getLogCount={getLogCount}
            getWeekTotal={getWeekTotal}
            streaks={streaks}
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
            onToggle={handleToggle}
            onArchive={archiveHabit}
            onDelete={deleteHabit}
            onEdit={setEditingHabit}
            onDetail={setDetailHabit}
          />
        ) : (
          <MonthView
            habits={habits}
            monthDates={monthDates}
            today={today}
            getLogCount={getLogCount}
            streaks={streaks}
            monthDate={monthDate}
          />
        )}
      </div>

      {/* Edit modal */}
      {editingHabit && (
        <EditHabitModal
          habit={editingHabit}
          onSave={async (updates) => {
            await updateHabit(editingHabit.id, updates)
            setEditingHabit(null)
          }}
          onClose={() => setEditingHabit(null)}
        />
      )}

      {/* Detail/Stats modal */}
      {detailHabit && (
        <HabitDetailModal
          habit={detailHabit}
          streak={streaks[detailHabit.id]}
          onClose={() => setDetailHabit(null)}
        />
      )}
    </div>
  )
}

/* ── Week View ── */
function WeekView({
  sections, weekDates, today, getLogCount, getWeekTotal, streaks,
  collapsedSections, onToggleSection, onToggle, onArchive, onDelete, onEdit, onDetail,
}: {
  sections: [string, Habit[]][]
  weekDates: string[]
  today: string
  getLogCount: (id: number, d: string) => number
  getWeekTotal: (id: number) => number
  streaks: Record<number, { current_streak: number; best_streak: number }>
  collapsedSections: Set<string>
  onToggleSection: (s: string) => void
  onToggle: (id: number, d: string) => void
  onArchive: (id: number) => void
  onDelete: (id: number) => void
  onEdit: (h: Habit) => void
  onDetail: (h: Habit) => void
}) {
  return (
    <div className="tracking-habit-week" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {/* Week header row */}
      <div style={{
        display: "grid", gridTemplateColumns: "minmax(160px, 1fr) repeat(7, 44px) 60px",
        gap: "4px", padding: "0 0 8px", borderBottom: "1px solid var(--glass-border)",
        position: "sticky", top: 0, background: "var(--bg-base)", zIndex: 2,
      }}>
        <div />
        {weekDates.map(d => (
          <div key={d} style={{
            textAlign: "center", fontSize: "9px", fontWeight: 600,
            color: d === today ? "var(--accent)" : "var(--text-tertiary)",
          }}>
            <div>{dayLabel(d)}</div>
            <div style={{ fontSize: "8px", opacity: 0.7 }}>{shortDate(d)}</div>
          </div>
        ))}
        <div style={{ textAlign: "center", fontSize: "9px", fontWeight: 600, color: "var(--text-tertiary)" }}>
          Week
        </div>
      </div>

      {/* Section groups */}
      {sections.map(([section, sectionHabits]) => (
        <div key={section}>
          {/* Section header */}
          {sections.length > 1 && (
            <button
              onClick={() => onToggleSection(section)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 4px", margin: "4px 0 2px",
                background: "none", border: "none", cursor: "pointer",
                fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)",
                textTransform: "uppercase", letterSpacing: "0.5px", width: "100%",
              }}
            >
              <span style={{
                transform: collapsedSections.has(section) ? "rotate(-90deg)" : "rotate(0deg)",
                transition: "transform 0.15s", fontSize: "8px", display: "inline-block",
              }}>▼</span>
              {section}
              <span style={{ fontSize: "9px", fontWeight: 400, opacity: 0.6 }}>({sectionHabits.length})</span>
            </button>
          )}

          {/* Habit rows */}
          {!collapsedSections.has(section) && sectionHabits.map(habit => (
            <HabitRow
              key={habit.id}
              habit={habit}
              weekDates={weekDates}
              today={today}
              getLogCount={getLogCount}
              weekTotal={getWeekTotal(habit.id)}
              streak={streaks[habit.id]}
              onToggle={onToggle}
              onArchive={onArchive}
              onDelete={onDelete}
              onEdit={onEdit}
              onDetail={onDetail}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/* ── Habit Row ── */
function HabitRow({
  habit, weekDates, today, getLogCount, weekTotal, streak,
  onToggle, onArchive, onDelete, onEdit, onDetail,
}: {
  habit: Habit
  weekDates: string[]
  today: string
  getLogCount: (id: number, d: string) => number
  weekTotal: number
  streak?: { current_streak: number; best_streak: number }
  onToggle: (id: number, d: string) => void
  onArchive: (id: number) => void
  onDelete: (id: number) => void
  onEdit: (h: Habit) => void
  onDetail: (h: Habit) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const trackingStart = habit.start_date || habit.created_at?.slice(0, 10) || today
  const scheduledDates = weekDates.filter(date => date >= trackingStart)
  const weekGoal = habit.target_count * (habit.frequency === "weekly" ? 1 : scheduledDates.length)
  const weekComplete = scheduledDates.length > 0 && (habit.frequency === "weekly"
    ? habitDayComplete(habit, weekDates[6], today, date => getLogCount(habit.id, date))
    : scheduledDates.every(date => habitDayComplete(habit, date, today, d => getLogCount(habit.id, d))))
  const isBreakHabit = habit.goal_type === "at_most"

  return (
    <div className="tracking-habit-row"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowMenu(false) }}
      style={{
        display: "grid", gridTemplateColumns: "minmax(160px, 1fr) repeat(7, 44px) 60px",
        gap: "4px", alignItems: "center",
        padding: "8px 0", borderRadius: "8px",
        transition: "background 0.1s",
      }}
    >
      {/* Habit info */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, position: "relative" }}>
        <span
          onClick={() => onDetail(habit)}
          style={{
            width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
            background: `${habit.color}20`, border: `1px solid ${habit.color}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", cursor: "pointer",
          }}
        >{habit.icon}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            onClick={() => onDetail(habit)}
            style={{
              fontSize: "12px", fontWeight: 600, color: "var(--text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              cursor: "pointer",
            }}
            title={habit.name}
          >{habit.name}</div>
          <div style={{ fontSize: "9px", color: "var(--text-tertiary)", display: "flex", gap: "6px", alignItems: "center" }}>
            <span>{isBreakHabit ? `≤${habit.target_count}×` : `${habit.target_count}×`}/{habit.frequency === "weekly" ? "wk" : "day"}</span>
            {streak && streak.current_streak > 0 && (
              <span style={{ color: habit.color }}>🔥 {streak.current_streak}{habit.frequency === "weekly" ? "w" : "d"}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        {hovered && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{
                padding: "2px 6px", borderRadius: "4px", background: "none",
                border: "none", color: "var(--text-tertiary)", cursor: "pointer",
                fontSize: "12px",
              }}
            >⋯</button>
            {showMenu && (
              <div style={{
                position: "absolute", top: "100%", right: 0, zIndex: 50,
                background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                borderRadius: "8px", padding: "4px", minWidth: "110px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                backdropFilter: "blur(16px)",
              }}>
                <MenuBtn label="📊 Stats" onClick={() => { onDetail(habit); setShowMenu(false) }} />
                <MenuBtn label="✏️ Edit" onClick={() => { onEdit(habit); setShowMenu(false) }} />
                <MenuBtn label="📦 Archive" onClick={() => { onArchive(habit.id); setShowMenu(false) }} />
                <div style={{ height: 1, background: "var(--glass-border)", margin: "2px 4px" }} />
                <MenuBtn label="🗑️ Delete" onClick={() => { if (confirm(`Delete "${habit.name}" and all its logs?`)) { onDelete(habit.id); setShowMenu(false) } }} danger />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Day cells */}
      {weekDates.map(d => {
        const count = getLogCount(habit.id, d)
        const completed = habitDayComplete(habit, d, today, date => getLogCount(habit.id, date))
        const partial = count > 0 && !completed
        const isToday = d === today

        return (
          <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <button
            aria-label={`Record ${habit.name} on ${d}; ${count} occurrences`}
            disabled={d > today || d < (habit.start_date || habit.created_at?.slice(0, 10) || today)}
            onClick={() => onToggle(habit.id, d)}
            style={{
              width: "36px", height: "36px", borderRadius: "8px", margin: "0 auto",
              background: completed
                ? (isBreakHabit ? "#34d399" : habit.color)
                : partial
                  ? (isBreakHabit ? `${habit.color}30` : `${habit.color}30`)
                  : isToday ? "var(--glass-bg-hover)" : "var(--glass-bg)",
              border: `1.5px solid ${completed
                ? (isBreakHabit ? "#34d399" : habit.color)
                : isToday ? "var(--accent-border)" : "var(--glass-border)"}`,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: completed ? "12px" : "10px", fontWeight: 700,
              color: completed ? "white" : partial ? habit.color : "var(--text-tertiary)",
              transition: "all 0.15s",
              boxShadow: completed ? `0 0 8px ${isBreakHabit ? "#34d39960" : habit.color + "60"}` : "none",
              transform: completed ? "scale(1.05)" : "scale(1)",
              padding: 0,
            }}
          >
            {habit.frequency === "weekly" || isBreakHabit ? `${count}+` : completed ? "✓" : count > 0 ? count : "+"}
          </button>
          <button aria-label={`Remove one ${habit.name} occurrence on ${d}`} disabled={count === 0 || d > today}
            onClick={() => useHabitsStore.getState().unlogHabit(habit.id, d)}
            style={{ minWidth: 32, minHeight: 24, borderRadius: 6, color: "var(--text-secondary)", background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>−</button>
          </div>
        )
      })}

      {/* Week total */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: "12px", fontWeight: 700,
          color: weekComplete ? habit.color : "var(--text-secondary)",
        }}>
          {weekTotal}
        </div>
        <div style={{ fontSize: "8px", color: "var(--text-tertiary)" }}>
          /{weekGoal}
        </div>
      </div>
    </div>
  )
}

/* ── Month View (Heatmap) ── */
function MonthView({
  habits, monthDates, today, getLogCount, streaks, monthDate,
}: {
  habits: Habit[]
  monthDates: string[]
  today: string
  getLogCount: (id: number, d: string) => number
  streaks: Record<number, { current_streak: number; best_streak: number; completion_rate: number; total_completions: number }>
  monthDate: { year: number; month: number }
}) {
  // Build calendar grid — start from Monday
  const firstDay = new Date(monthDate.year, monthDate.month, 1).getDay()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1 // Monday=0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {habits.map(habit => {
        const streak = streaks[habit.id]

        return (
          <div key={habit.id} style={{
            background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
            borderRadius: "12px", padding: "14px 16px",
          }}>
            {/* Habit header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{
                width: 24, height: 24, borderRadius: 6,
                background: `${habit.color}20`, border: `1px solid ${habit.color}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12,
              }}>{habit.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{habit.name}</span>
              {streak && (
                <span style={{ fontSize: 9, color: "var(--text-tertiary)", marginLeft: "auto" }}>
                  {streak.current_streak > 0 && <span style={{ color: habit.color, marginRight: 8 }}>🔥 {streak.current_streak}{habit.frequency === "weekly" ? "w" : "d"}</span>}
                  {streak.completion_rate > 0 && <span>{Math.round(streak.completion_rate * 100)}% rate</span>}
                </span>
              )}
            </div>

            {/* Calendar grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
              {/* Day labels */}
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 8, color: "var(--text-tertiary)", fontWeight: 600, padding: "2px 0" }}>{d}</div>
              ))}
              {/* Empty cells before first day */}
              {Array.from({ length: startOffset }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {/* Day cells */}
              {monthDates.map(d => {
                const count = getLogCount(habit.id, d)
                const isFuture = d > today
                const completed = habitDayComplete(habit, d, today, date => getLogCount(habit.id, date))
                const intensity = completed ? 1 : count > 0 ? 0.4 : 0

                return (
                  <div key={d} title={`${shortDate(d)}: ${count}/${habit.target_count}`} style={{
                    aspectRatio: "1", borderRadius: 4,
                    background: isFuture
                      ? "transparent"
                      : intensity === 1
                        ? habit.color
                        : intensity > 0
                          ? `${habit.color}40`
                          : "var(--glass-bg-hover)",
                    border: d === today ? `2px solid var(--accent)` : `1px solid ${intensity > 0 ? "transparent" : "var(--glass-border)"}`,
                    opacity: isFuture ? 0.2 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 7, color: completed ? "white" : "var(--text-tertiary)", fontWeight: 600,
                    cursor: isFuture ? "default" : "pointer",
                  }}>
                    {new Date(d + "T00:00:00").getDate()}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Create Habit Form ── */
function CreateHabitForm({
  onCreated,
}: {
  onCreated: () => void
  onCancel: () => void
}) {
  const { createHabit } = useHabitsStore()
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("✦")
  const [color, setColor] = useState("#818cf8")
  const [target, setTarget] = useState(1)
  const [frequency, setFrequency] = useState<HabitFrequency>("daily")
  const [goalType, setGoalType] = useState<GoalType>("at_least")
  const [section, setSection] = useState("")
  const [reminderTime, setReminderTime] = useState("")
  const [notes, setNotes] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    await createHabit({
      name: name.trim(),
      icon,
      color,
      frequency,
      target_count: target,
      goal_type: goalType,
      section: section.trim() || undefined,
      reminder_time: reminderTime || undefined,
      notes: notes.trim() || undefined,
    })
    onCreated()
  }

  return (
    <div style={{
      padding: "16px 28px", borderBottom: "1px solid var(--glass-border)",
      background: "var(--glass-bg)", display: "flex", flexDirection: "column", gap: "12px",
      animation: "slideDown 0.2s ease",
    }}>
      {/* Row 1: Name + Goal + Create */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleCreate()}
          placeholder="Habit name…"
          autoFocus
          style={{
            flex: 1, padding: "8px 14px",
            background: "var(--bg-base)", border: "1.5px solid var(--glass-border)",
            borderRadius: "10px", color: "var(--text-primary)", fontSize: "12px", outline: "none",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "var(--accent-border)")}
          onBlur={e => (e.currentTarget.style.borderColor = "var(--glass-border)")}
        />

        {/* Goal type toggle */}
        <div style={{
          display: "flex", borderRadius: "8px", overflow: "hidden",
          border: "1px solid var(--glass-border)",
        }}>
          <button onClick={() => setGoalType("at_least")} style={{
            padding: "5px 10px", fontSize: "9px", fontWeight: 600,
            background: goalType === "at_least" ? "var(--accent-dim)" : "transparent",
            border: "none", color: goalType === "at_least" ? "var(--accent)" : "var(--text-tertiary)",
            cursor: "pointer",
          }} title="Build a habit (at least X times)">Build ≥</button>
          <button onClick={() => setGoalType("at_most")} style={{
            padding: "5px 10px", fontSize: "9px", fontWeight: 600,
            background: goalType === "at_most" ? "rgba(239,68,68,0.15)" : "transparent",
            border: "none", color: goalType === "at_most" ? "#ef4444" : "var(--text-tertiary)",
            cursor: "pointer",
          }} title="Break a bad habit (at most X times)">Break ≤</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>Goal:</span>
          <input
            type="number" value={target} min={1} max={99}
            onChange={e => setTarget(Math.max(1, +e.target.value))}
            style={{
              width: "44px", padding: "6px 8px", textAlign: "center",
              background: "var(--bg-base)", border: "1px solid var(--glass-border)",
              borderRadius: "8px", color: "var(--text-primary)", fontSize: "11px", outline: "none",
            }}
          />
          <select value={frequency} onChange={e => setFrequency(e.target.value as HabitFrequency)} style={{
            padding: "5px 8px", borderRadius: "8px", fontSize: "10px",
            background: "var(--bg-base)", border: "1px solid var(--glass-border)",
            color: "var(--text-primary)", outline: "none",
          }}>
            <option value="daily">/day</option>
            <option value="weekly">/week</option>
          </select>
        </div>

        <button onClick={handleCreate} disabled={!name.trim()} style={{
          padding: "8px 16px", borderRadius: "10px",
          background: name.trim() ? "var(--accent)" : "var(--glass-bg)",
          border: "none", color: name.trim() ? "white" : "var(--text-tertiary)",
          fontSize: "11px", fontWeight: 700, cursor: name.trim() ? "pointer" : "default",
        }}>Create</button>
      </div>

      {/* Row 2: Icon & Color pickers */}
      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        <div>
          <span style={{ fontSize: "9px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Icon</span>
          <div style={{ display: "flex", gap: "4px", marginTop: "4px", flexWrap: "wrap", maxWidth: 280 }}>
            {ICONS.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)} style={{
                width: "28px", height: "28px", borderRadius: "7px", fontSize: "14px",
                background: icon === ic ? "var(--accent-dim)" : "var(--bg-base)",
                border: `1px solid ${icon === ic ? "var(--accent-border)" : "var(--glass-border)"}`,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>{ic}</button>
            ))}
          </div>
        </div>
        <div>
          <span style={{ fontSize: "9px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Color</span>
          <div style={{ display: "flex", gap: "4px", marginTop: "4px", flexWrap: "wrap" }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: "24px", height: "24px", borderRadius: "6px",
                background: c, border: `2px solid ${color === c ? "white" : "transparent"}`,
                cursor: "pointer", boxShadow: color === c ? `0 0 8px ${c}` : "none",
              }} />
            ))}
          </div>
        </div>

        <button onClick={() => setShowAdvanced(!showAdvanced)} style={{
          marginLeft: "auto", alignSelf: "center",
          padding: "4px 10px", borderRadius: "6px", fontSize: "9px", fontWeight: 600,
          background: "none", border: "1px solid var(--glass-border)",
          color: "var(--text-tertiary)", cursor: "pointer",
        }}>{showAdvanced ? "− Less" : "+ More"}</button>
      </div>

      {/* Advanced fields */}
      {showAdvanced && (
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Section</span>
            <input value={section} onChange={e => setSection(e.target.value)}
              placeholder="e.g. Health, Learning"
              style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Reminder</span>
            <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
              style={{ ...inputStyle, width: 110 }} />
          </label>
          <label style={{ ...fieldStyle, flex: 2 }}>
            <span style={labelStyle}>Notes</span>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional description…"
              style={inputStyle} />
          </label>
        </div>
      )}
    </div>
  )
}

/* ── Archive Panel ── */
function ArchivePanel({
  habits, onRestore, onDelete, onClose,
}: {
  habits: Habit[]
  onRestore: (id: number) => void
  onDelete: (id: number) => void
  onClose: () => void
}) {
  return (
    <div style={{
      padding: "12px 28px", borderBottom: "1px solid var(--glass-border)",
      background: "var(--glass-bg)", maxHeight: 200, overflowY: "auto",
      animation: "slideDown 0.2s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
          📦 Archived Habits ({habits.length})
        </span>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 12,
        }}>✕</button>
      </div>
      {habits.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", padding: "12px 0", textAlign: "center" }}>
          No archived habits
        </div>
      ) : habits.map(h => (
        <div key={h.id} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
          borderBottom: "1px solid var(--glass-border)",
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 6,
            background: `${h.color}15`, border: `1px solid ${h.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, opacity: 0.6,
          }}>{h.icon}</span>
          <span style={{ flex: 1, fontSize: 11, color: "var(--text-secondary)" }}>{h.name}</span>
          <button onClick={() => onRestore(h.id)} style={{
            padding: "3px 10px", borderRadius: 6, fontSize: 9, fontWeight: 600,
            background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
            color: "var(--accent)", cursor: "pointer",
          }}>Restore</button>
          <button onClick={() => { if (confirm(`Permanently delete "${h.name}"?`)) onDelete(h.id) }} style={{
            padding: "3px 10px", borderRadius: 6, fontSize: 9, fontWeight: 600,
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
            color: "#ef4444", cursor: "pointer",
          }}>Delete</button>
        </div>
      ))}
    </div>
  )
}

/* ── Edit Habit Modal ── */
function EditHabitModal({
  habit, onSave, onClose,
}: {
  habit: Habit
  onSave: (updates: Record<string, unknown>) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(habit.name)
  const [icon, setIcon] = useState(habit.icon)
  const [color, setColor] = useState(habit.color)
  const [target, setTarget] = useState(habit.target_count)
  const [frequency, setFrequency] = useState(habit.frequency)
  const [goalType, setGoalType] = useState(habit.goal_type)
  const [section, setSection] = useState(habit.section || "")
  const [reminderTime, setReminderTime] = useState(habit.reminder_time || "")
  const [notes, setNotes] = useState(habit.notes || "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onSave({
      name: name.trim(),
      icon,
      color,
      target_count: target,
      frequency,
      goal_type: goalType,
      section: section.trim() || "",
      reminder_time: reminderTime || "",
      notes: notes.trim() || "",
    })
    setSaving(false)
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: "var(--bg-base)", border: "1px solid var(--glass-border)",
        borderRadius: "16px", padding: "24px", width: 440, maxWidth: "90vw",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Edit Habit</h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16,
          }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Name</span>
            <input value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              style={{ ...inputStyle, width: "100%" }} autoFocus />
          </label>

          <div style={{ display: "flex", gap: 12 }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Goal Type</span>
              <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--glass-border)" }}>
                <button onClick={() => setGoalType("at_least")} style={{
                  padding: "5px 12px", fontSize: "9px", fontWeight: 600, border: "none", cursor: "pointer",
                  background: goalType === "at_least" ? "var(--accent-dim)" : "transparent",
                  color: goalType === "at_least" ? "var(--accent)" : "var(--text-tertiary)",
                }}>Build ≥</button>
                <button onClick={() => setGoalType("at_most")} style={{
                  padding: "5px 12px", fontSize: "9px", fontWeight: 600, border: "none", cursor: "pointer",
                  background: goalType === "at_most" ? "rgba(239,68,68,0.15)" : "transparent",
                  color: goalType === "at_most" ? "#ef4444" : "var(--text-tertiary)",
                }}>Break ≤</button>
              </div>
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Target</span>
              <input type="number" value={target} min={1} max={99}
                onChange={e => setTarget(Math.max(1, +e.target.value))}
                style={{ ...inputStyle, width: 60, textAlign: "center" }} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Frequency</span>
              <select value={frequency} onChange={e => setFrequency(e.target.value as HabitFrequency)} style={{
                ...inputStyle, width: 80,
              }}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Section</span>
              <input value={section} onChange={e => setSection(e.target.value)}
                placeholder="e.g. Health"
                style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Reminder</span>
              <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                style={{ ...inputStyle, width: 110 }} />
            </label>
          </div>

          {/* Icon picker */}
          <div>
            <span style={labelStyle}>Icon</span>
            <div style={{ display: "flex", gap: "4px", marginTop: "4px", flexWrap: "wrap" }}>
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setIcon(ic)} style={{
                  width: "28px", height: "28px", borderRadius: "7px", fontSize: "14px",
                  background: icon === ic ? "var(--accent-dim)" : "var(--bg-base)",
                  border: `1px solid ${icon === ic ? "var(--accent-border)" : "var(--glass-border)"}`,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}>{ic}</button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <span style={labelStyle}>Color</span>
            <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: "24px", height: "24px", borderRadius: "6px",
                  background: c, border: `2px solid ${color === c ? "white" : "transparent"}`,
                  cursor: "pointer", boxShadow: color === c ? `0 0 8px ${c}` : "none",
                }} />
              ))}
            </div>
          </div>

          <label style={fieldStyle}>
            <span style={labelStyle}>Notes</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional description…" rows={2}
              style={{
                ...inputStyle, width: "100%", resize: "vertical", fontFamily: "inherit",
              }} />
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={{
              padding: "8px 16px", borderRadius: "10px",
              background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)", fontSize: "11px", fontWeight: 600, cursor: "pointer",
            }}>Cancel</button>
            <button onClick={handleSave} disabled={!name.trim() || saving} style={{
              padding: "8px 20px", borderRadius: "10px",
              background: name.trim() ? "var(--accent)" : "var(--glass-bg)",
              border: "none", color: name.trim() ? "white" : "var(--text-tertiary)",
              fontSize: "11px", fontWeight: 700, cursor: name.trim() ? "pointer" : "default",
            }}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Habit Detail/Stats Modal ── */
function HabitDetailModal({
  habit, streak, onClose,
}: {
  habit: Habit
  streak?: { current_streak: number; best_streak: number; total_completions: number; completion_rate: number }
  onClose: () => void
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: "var(--bg-base)", border: "1px solid var(--glass-border)",
        borderRadius: "16px", padding: "24px", width: 380, maxWidth: "90vw",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${habit.color}20`, border: `1px solid ${habit.color}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18,
          }}>{habit.icon}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{habit.name}</h3>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
              {habit.goal_type === "at_most" ? "Break habit" : "Build habit"} •{" "}
              {habit.goal_type === "at_most" ? "≤" : "≥"}{habit.target_count}×/{habit.frequency === "weekly" ? "wk" : "day"}
              {habit.section && <span> • {habit.section}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{
            marginLeft: "auto", background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16,
          }}>✕</button>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <StatCard label="Current Streak" value={`${streak?.current_streak ?? 0}${habit.frequency === "weekly" ? "w" : "d"}`} icon="🔥" color={habit.color} />
          <StatCard label="Best Streak" value={`${streak?.best_streak ?? 0}${habit.frequency === "weekly" ? "w" : "d"}`} icon="🏆" color="#fbbf24" />
          <StatCard label="Total Completions" value={streak ? String(streak.total_completions) : "0"} icon="✓" color="#34d399" />
          <StatCard label="Completion Rate" value={streak ? `${Math.round(streak.completion_rate * 100)}%` : "0%"} icon="📊" color="#60a5fa" />
        </div>

        {/* Meta info */}
        <div style={{
          padding: "12px 14px", borderRadius: 10,
          background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
          fontSize: 10, color: "var(--text-tertiary)", lineHeight: 1.8,
        }}>
          {habit.created_at && <div>📅 Created: {new Date(habit.created_at).toLocaleDateString()}</div>}
          {habit.start_date && <div>🚀 Tracking since: {shortDate(habit.start_date)}</div>}
          {habit.reminder_time && <div>⏰ Reminder: {habit.reminder_time}</div>}
          {habit.notes && <div style={{ marginTop: 6, color: "var(--text-secondary)" }}>📝 {habit.notes}</div>}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div style={{
      padding: "12px 14px", borderRadius: 10,
      background: `${color}08`, border: `1px solid ${color}20`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 12 }}>{icon}</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.3px" }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: "-0.5px" }}>{value}</div>
    </div>
  )
}

/* ── Shared Components ── */
function MenuBtn({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "6px 10px", borderRadius: "6px", fontSize: "11px",
        background: "transparent", border: "none", cursor: "pointer",
        color: danger ? "var(--color-red)" : "var(--text-secondary)",
        transition: "background 0.1s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--glass-bg-hover)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >{label}</button>
  )
}

/* ── Shared Styles ── */
const navBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
  background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
  color: "var(--text-secondary)", cursor: "pointer",
}

const fieldStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 3, flex: 1,
}

const labelStyle: React.CSSProperties = {
  fontSize: "9px", fontWeight: 700, color: "var(--text-tertiary)",
  textTransform: "uppercase", letterSpacing: "0.5px",
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", borderRadius: "8px", fontSize: "11px",
  background: "var(--bg-base)", border: "1px solid var(--glass-border)",
  color: "var(--text-primary)", outline: "none",
}
