import { useEffect, useState, useRef, useMemo } from "react"
import { useCalendarStore } from "../store/calendar.store"
import type { CalendarEvent, EventType } from "../store/calendar.store"
import { useTasksStore } from "../store/tasks.store"
import { useHabitsStore, type HabitLog } from "../store/habits.store"
import { habitDayComplete } from "../lib/habit-progress"
import { habitWeekStart, localDate } from "../lib/scheduling"
import StudioHeader from "../components/StudioHeader"
import "../studios.css"
import "../tracking.css"

/* ── Colour map for event types ── */
const TYPE_COLORS: Record<EventType | string, { bg: string; border: string; text: string; dot: string }> = {
  event:    { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.3)",  text: "#818cf8", dot: "#6366f1" },
  reminder: { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",  text: "#fbbf24", dot: "#f59e0b" },
  focus:    { bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)",  text: "#34d399", dot: "#10b981" },
  task:     { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)", text: "#a78bfa", dot: "#8b5cf6" },
  habit:    { bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)",  text: "#34d399", dot: "#10b981" },
  countdown:{ bg: "rgba(244,114,182,0.12)", border: "rgba(244,114,182,0.3)", text: "#f472b6", dot: "#ec4899" },
}

const TYPE_ICONS: Record<string, string> = {
  event: "◈", reminder: "◎", focus: "⊹", task: "◉",
}

const REMINDER_OPTIONS = [
  { label: "None",        value: -1 },
  { label: "At time",     value: 0  },
  { label: "5 min before", value: 5  },
  { label: "10 min",      value: 10 },
  { label: "15 min",      value: 15 },
  { label: "30 min",      value: 30 },
  { label: "1 hour",      value: 60 },
  { label: "2 hours",     value: 120 },
  { label: "1 day",       value: 1440 },
]

/* ── Helpers ── */
// Use local date components instead of toISOString() which returns UTC.
// At 00:33 IST (UTC+5:30) toISOString() would still show the previous UTC
// date, causing the "today" highlight to point to yesterday.
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function startDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}
function formatTime(t?: string | null) {
  if (!t) return ""
  const [h, m] = t.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`
}
function reminderLabel(mins: number | null | undefined): string {
  if (mins == null || mins < 0) return ""
  const opt = REMINDER_OPTIONS.find(o => o.value === mins)
  return opt ? opt.label : `${mins}m before`
}
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

/* ── Countdown items from localStorage ── */
type CountdownItem = { id: string; label: string; date: string; color: string; icon: string; notes?: string }
const COUNTDOWN_STORAGE_KEY = "chorniNotes-countdowns-v2"
function loadCountdowns(): CountdownItem[] {
  try { return JSON.parse(localStorage.getItem(COUNTDOWN_STORAGE_KEY) || "[]") } catch { return [] }
}

/* ── Habit summary for a single day ── */
type DayHabitSummary = { completed: number; total: number; habits: { name: string; icon: string; color: string; done: boolean }[] }

/* ══════════════════════════════════════
   EVENT CREATION / EDIT MODAL
══════════════════════════════════════ */
function EventModal({
  date, event, onSave, onDelete, onClose,
}: {
  date: string
  event?: CalendarEvent | null
  onSave: (data: Omit<CalendarEvent, "id" | "created_at">) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [title, setTitle]       = useState(event?.title ?? "")
  const [type, setType]         = useState<EventType>(event?.type ?? "event")
  const [startTime, setStart]   = useState(event?.start_time ?? "")
  const [endTime, setEnd]       = useState(event?.end_time ?? "")
  const [notes, setNotes]       = useState(event?.notes ?? "")
  const [duration, setDuration] = useState(event?.duration_minutes?.toString() ?? "25")
  const [reminderMin, setReminderMin] = useState<number>(event?.reminder_minutes ?? -1)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 80) }, [])

  const handleSave = () => {
    if (!title.trim()) return
    onSave({
      title: title.trim(), type, date,
      start_time: startTime || null,
      end_time: endTime || null,
      duration_minutes: type === "focus" ? parseInt(duration) || 25 : null,
      notes: notes || null,
      color: "accent", task_id: null,
      reminder_minutes: reminderMin >= 0 ? reminderMin : null,
    })
  }

  const fieldLabel = (text: string) => (
    <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "6px", letterSpacing: "0.5px", textTransform: "uppercase" }}>{text}</div>
  )

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "modalBgIn 0.2s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(500px, calc(100vw - 40px))",
        borderRadius: "16px",
        background: "var(--modal-bg, rgba(12,15,30,0.97))",
        border: "1px solid var(--glass-border-strong)",
        backdropFilter: "blur(32px)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        animation: "modalIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 22px 16px",
          borderBottom: "1px solid var(--glass-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--accent)", marginBottom: "3px" }}>
              {event ? "Edit Event" : "New Event"} · {date}
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
              {event ? "Edit Event" : "Create Event"}
            </div>
          </div>
          <button onClick={onClose} style={{ width: "30px", height: "30px", borderRadius: "8px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.color = "var(--text-primary)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--glass-bg)"; e.currentTarget.style.color = "var(--text-tertiary)" }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Type selector — pill style */}
          <div>
            {fieldLabel("Type")}
            <div style={{ display: "flex", gap: "6px" }}>
              {(["event","reminder","focus","task"] as EventType[]).map(t => {
                const c = TYPE_COLORS[t]
                const active = type === t
                return (
                  <button key={t} onClick={() => setType(t)} style={{
                    flex: 1, padding: "8px 4px", borderRadius: "10px",
                    fontSize: "11px", fontWeight: 600, cursor: "pointer",
                    background: active ? c.bg : "var(--glass-bg)",
                    border: `1.5px solid ${active ? c.border : "transparent"}`,
                    color: active ? c.text : "var(--text-tertiary)",
                    transition: "all 0.15s ease",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                  }}>
                    <span style={{ fontSize: "15px" }}>{TYPE_ICONS[t]}</span>
                    <span style={{ textTransform: "capitalize" }}>{t}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            {fieldLabel("Title")}
            <input
              ref={titleRef}
              value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSave() }}
              placeholder={`${type.charAt(0).toUpperCase() + type.slice(1)} title…`}
              style={{
                width: "100%", padding: "10px 14px",
                background: "var(--glass-bg)", border: "1.5px solid var(--glass-border)",
                borderRadius: "10px", color: "var(--text-primary)",
                fontSize: "14px", fontWeight: 500,
                outline: "none", boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={e => { e.target.style.borderColor = "var(--accent-border)" }}
              onBlur={e => { e.target.style.borderColor = "var(--glass-border)" }}
            />
          </div>

          {/* Time row */}
          {type !== "focus" && (
            <div style={{ display: "flex", gap: "12px" }}>
              {[{ label: "Start Time", val: startTime, set: setStart }, { label: "End Time", val: endTime, set: setEnd }].map(({ label, val, set }) => (
                <div key={label} style={{ flex: 1 }}>
                  {fieldLabel(label)}
                  <input type="time" value={val} onChange={e => set(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", background: "var(--glass-bg)", border: "1.5px solid var(--glass-border)", borderRadius: "10px", color: "var(--text-primary)", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
          )}

          {/* Duration for focus */}
          {type === "focus" && (
            <div>
              {fieldLabel("Duration (minutes)")}
              <div style={{ display: "flex", gap: "6px" }}>
                {[25, 50, 90].map(d => (
                  <button key={d} onClick={() => setDuration(String(d))} style={{
                    padding: "7px 16px", borderRadius: "10px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                    background: duration === String(d) ? TYPE_COLORS.focus.bg : "var(--glass-bg)",
                    border: `1.5px solid ${duration === String(d) ? TYPE_COLORS.focus.border : "transparent"}`,
                    color: duration === String(d) ? TYPE_COLORS.focus.text : "var(--text-tertiary)",
                    transition: "all 0.15s",
                  }}>{d}m</button>
                ))}
                <input type="number" value={duration} onChange={e => setDuration(e.target.value)} min={1}
                  style={{ flex: 1, padding: "7px 12px", background: "var(--glass-bg)", border: "1.5px solid var(--glass-border)", borderRadius: "10px", color: "var(--text-primary)", fontSize: "12px", outline: "none" }} />
              </div>
            </div>
          )}

          {/* 🔔 Reminder selector */}
          <div>
            {fieldLabel("🔔 Reminder")}
            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
              {REMINDER_OPTIONS.map(opt => {
                const active = reminderMin === opt.value
                const isNone = opt.value === -1
                return (
                  <button key={opt.value} onClick={() => setReminderMin(opt.value)} style={{
                    padding: "6px 12px", borderRadius: "8px",
                    fontSize: "11px", fontWeight: 600, cursor: "pointer",
                    background: active ? (isNone ? "var(--glass-bg-hover)" : "rgba(251,191,36,0.12)") : "var(--glass-bg)",
                    border: `1.5px solid ${active ? (isNone ? "var(--glass-border-strong)" : "rgba(251,191,36,0.3)") : "transparent"}`,
                    color: active ? (isNone ? "var(--text-primary)" : "#fbbf24") : "var(--text-tertiary)",
                    transition: "all 0.15s",
                  }}>{opt.label}</button>
                )
              })}
            </div>
            {reminderMin >= 0 && !startTime && type !== "focus" && (
              <div style={{ marginTop: "6px", fontSize: "10px", color: "#f59e0b", display: "flex", alignItems: "center", gap: "4px" }}>
                <span>⚠</span> Set a start time for the reminder to work
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            {fieldLabel("Notes")}
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Add notes…" rows={2}
              style={{ width: "100%", padding: "10px 14px", background: "var(--glass-bg)", border: "1.5px solid var(--glass-border)", borderRadius: "10px", color: "var(--text-primary)", fontSize: "13px", resize: "none", outline: "none", boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.15s" }}
              onFocus={e => { e.target.style.borderColor = "var(--accent-border)" }}
              onBlur={e => { e.target.style.borderColor = "var(--glass-border)" }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            {event && onDelete && (
              <button onClick={onDelete} style={{ padding: "10px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.15)" }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)" }}>
                Delete
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: "10px", background: "var(--glass-bg)", border: "1.5px solid var(--glass-border)", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={!title.trim()} style={{
              padding: "10px 22px", borderRadius: "10px",
              background: title.trim() ? "var(--accent)" : "var(--glass-bg)",
              border: "none", color: title.trim() ? "white" : "var(--text-tertiary)",
              fontSize: "12px", fontWeight: 700, cursor: title.trim() ? "pointer" : "default",
              transition: "all 0.15s ease",
              boxShadow: title.trim() ? "0 0 16px var(--accent-glow)" : "none",
            }}>
              {event ? "Save Changes" : "Create Event"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes modalBgIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/* ══════════════════════════════════════
   MONTH VIEW
══════════════════════════════════════ */
function MonthView({ year, month, events, selectedDate, tasksWithDates, habitSummary, countdowns, onSelectDate, onEventClick, onCreateEvent }: {
  year: number; month: number; events: CalendarEvent[]
  selectedDate: string; tasksWithDates: any[]
  habitSummary: Record<string, DayHabitSummary>
  countdowns: CountdownItem[]
  onSelectDate: (d: string) => void; onEventClick: (e: CalendarEvent) => void
  onCreateEvent: (date: string) => void
}) {
  const today      = toDateStr(new Date())
  const totalDays  = daysInMonth(year, month)
  const startDay   = startDayOfMonth(year, month)
  const totalCells = Math.ceil((startDay + totalDays) / 7) * 7

  const eventsByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})

  const tasksByDate = tasksWithDates.reduce<Record<string, any[]>>((acc, t) => {
    if (!t.due_date) return acc
    if (!acc[t.due_date]) acc[t.due_date] = []
    acc[t.due_date].push(t)
    return acc
  }, {})

  const countdownsByDate = countdowns.reduce<Record<string, CountdownItem[]>>((acc, c) => {
    if (!acc[c.date]) acc[c.date] = []
    acc[c.date].push(c)
    return acc
  }, {})

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--glass-border)" }}>
        {DAYS_SHORT.map(d => (
          <div key={d} style={{ padding: "10px 0", textAlign: "center", fontSize: "11px", fontWeight: 600, letterSpacing: "0.3px", textTransform: "uppercase", color: "var(--text-tertiary)" }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: `repeat(${totalCells / 7}, 1fr)`, minHeight: 0 }}>
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum   = idx - startDay + 1
          const isValid  = dayNum >= 1 && dayNum <= totalDays
          const dateStr  = isValid ? `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}` : ""
          const isToday  = dateStr === today
          const isSel    = dateStr === selectedDate
          const dayEvts  = isValid ? (eventsByDate[dateStr] ?? []) : []
          const dayTasks = isValid ? (tasksByDate[dateStr] ?? []) : []
          const dayHabits = isValid ? (habitSummary[dateStr] ?? null) : null
          const dayCountdowns = isValid ? (countdownsByDate[dateStr] ?? []) : []
          const hasReminder = dayEvts.some(e => e.reminder_minutes != null && e.reminder_minutes >= 0)

          return (
            <div key={idx} onClick={() => isValid && onSelectDate(dateStr)}
              onDoubleClick={() => isValid && onCreateEvent(dateStr)}
              style={{
                padding: "6px 5px", borderRight: "1px solid var(--glass-border)", borderBottom: "1px solid var(--glass-border)",
                cursor: isValid ? "pointer" : "default", minHeight: "80px",
                background: isSel ? "var(--accent-dim)" : isValid ? "transparent" : "rgba(0,0,0,0.02)",
                transition: "background 0.12s ease",
                display: "flex", flexDirection: "column", gap: "2px",
              }}
              onMouseEnter={e => { if (isValid && !isSel) e.currentTarget.style.background = "var(--glass-bg-hover)" }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = isValid ? "transparent" : "rgba(0,0,0,0.02)" }}
            >
              {isValid && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                    <div style={{
                      width: "24px", height: "24px", borderRadius: "8px", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px", fontWeight: isToday ? 700 : 500,
                      background: isToday ? "var(--accent)" : "transparent",
                      color: isToday ? "white" : isSel ? "var(--accent)" : "var(--text-primary)",
                      boxShadow: isToday ? "0 0 8px var(--accent-glow)" : "none",
                    }}>{dayNum}</div>
                    {hasReminder && <span style={{ fontSize: "9px", opacity: 0.6 }}>🔔</span>}
                  </div>

                  {dayEvts.slice(0, 2).map(ev => {
                    const c = TYPE_COLORS[ev.type]
                    return (
                      <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                        style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 600, background: c.bg, borderLeft: `2.5px solid ${c.dot}`, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", transition: "transform 0.1s" }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)" }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)" }}>
                        {ev.title}
                      </div>
                    )
                  })}

                  {dayTasks.length > 0 && (
                    <div style={{ display: "flex", gap: "2px", flexWrap: "wrap", marginTop: "1px" }}>
                      {dayTasks.slice(0, 3).map((t: any) => (
                        <div key={t.id} style={{ width: "5px", height: "5px", borderRadius: "50%", background: t.status === "done" ? "var(--color-green)" : t.status === "doing" ? "var(--color-yellow)" : "var(--text-tertiary)" }} />
                      ))}
                    </div>
                  )}

                  {/* Habit completion indicator */}
                  {dayHabits && dayHabits.total > 0 && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "3px", marginTop: "1px",
                      padding: "1px 4px", borderRadius: "4px",
                      background: dayHabits.completed === dayHabits.total ? "rgba(52,211,153,0.12)" : "rgba(52,211,153,0.06)",
                    }}>
                      <span style={{ fontSize: "8px" }}>⟡</span>
                      <span style={{
                        fontSize: "8px", fontWeight: 700,
                        color: dayHabits.completed === dayHabits.total ? "#34d399" : "var(--text-tertiary)",
                      }}>{dayHabits.completed}/{dayHabits.total}</span>
                    </div>
                  )}

                  {/* Countdown markers */}
                  {dayCountdowns.map(c => (
                    <div key={c.id} style={{
                      padding: "1px 5px", borderRadius: "4px", fontSize: "9px", fontWeight: 600,
                      background: `${c.color}15`, borderLeft: `2px solid ${c.color}`,
                      color: c.color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{c.icon} {c.label}</div>
                  ))}

                  {dayEvts.length > 2 && (
                    <div style={{ fontSize: "9px", color: "var(--text-tertiary)", fontWeight: 600, paddingLeft: "2px" }}>+{dayEvts.length - 2} more</div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════
   WEEK VIEW
══════════════════════════════════════ */
function WeekView({ anchorDate, events, onSelectDate, onEventClick }: {
  anchorDate: Date; events: CalendarEvent[]
  onSelectDate: (d: string) => void; onEventClick: (e: CalendarEvent) => void
}) {
  const today   = toDateStr(new Date())
  const start  = new Date(anchorDate)
  start.setDate(start.getDate() - start.getDay())

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i)
    return { date: toDateStr(d), day: d.getDate(), name: DAYS_SHORT[d.getDay()] }
  })

  const evByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--glass-border)" }}>
        {weekDays.map(({ date, day, name }) => {
          const isT = date === today
          return (
            <div key={date} onClick={() => onSelectDate(date)} style={{ padding: "12px 6px", textAlign: "center", cursor: "pointer", borderRight: "1px solid var(--glass-border)" }}>
              <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "6px" }}>{name}</div>
              <div style={{ width: "32px", height: "32px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", fontSize: "14px", fontWeight: isT ? 700 : 500, background: isT ? "var(--accent)" : "transparent", color: isT ? "white" : "var(--text-primary)", boxShadow: isT ? "0 0 8px var(--accent-glow)" : "none" }}>{day}</div>
            </div>
          )
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", flex: 1 }}>
        {weekDays.map(({ date }) => (
          <div key={date} onClick={() => onSelectDate(date)} style={{ padding: "10px 5px", borderRight: "1px solid var(--glass-border)", minHeight: "200px", cursor: "pointer", display: "flex", flexDirection: "column", gap: "4px", transition: "background 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}
          >
            {(evByDate[date] ?? []).map(ev => {
              const c = TYPE_COLORS[ev.type]
              return (
                <div key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                  style={{ padding: "5px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, background: c.bg, borderLeft: `2.5px solid ${c.dot}`, color: c.text, cursor: "pointer" }}>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: "4px" }}>
                    {ev.reminder_minutes != null && ev.reminder_minutes >= 0 && <span style={{ fontSize: "9px" }}>🔔</span>}
                    {ev.title}
                  </div>
                  {ev.start_time && <div style={{ fontSize: "9px", opacity: 0.7, marginTop: "2px" }}>{formatTime(ev.start_time)}</div>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════
   DAY VIEW
══════════════════════════════════════ */
function DayView({ date, events, tasksWithDates, habitSummary, countdowns, onEventClick }: {
  date: string; events: CalendarEvent[]; tasksWithDates: any[]
  habitSummary: Record<string, DayHabitSummary>; countdowns: CountdownItem[]
  onEventClick: (e: CalendarEvent) => void
}) {
  const dayEvts  = events.filter(e => e.date === date).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
  const dayTasks = tasksWithDates.filter(t => t.due_date === date)
  const dayHabits = habitSummary[date] ?? null
  const dayCountdowns = countdowns.filter(c => c.date === date)

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
      {dayEvts.length === 0 && dayTasks.length === 0 && dayCountdowns.length === 0 && !dayHabits?.total ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-tertiary)", fontSize: "13px" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px", opacity: 0.3 }}>◌</div>
          <div>No events for this day</div>
          <div style={{ fontSize: "11px", marginTop: "4px" }}>Double-click a date to create one</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {dayEvts.map(ev => {
            const c = TYPE_COLORS[ev.type]
            return (
              <div key={ev.id} onClick={() => onEventClick(ev)}
                style={{ padding: "14px 18px", borderRadius: "12px", background: c.bg, borderLeft: `3px solid ${c.dot}`, cursor: "pointer", transition: "all 0.12s ease" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateX(0)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "14px" }}>{TYPE_ICONS[ev.type]}</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: c.text, flex: 1 }}>{ev.title}</span>
                  {ev.reminder_minutes != null && ev.reminder_minutes >= 0 && (
                    <span style={{ fontSize: "9px", padding: "2px 6px", borderRadius: "6px", background: "rgba(251,191,36,0.1)", color: "#fbbf24", fontWeight: 600 }}>
                      🔔 {reminderLabel(ev.reminder_minutes)}
                    </span>
                  )}
                  {ev.start_time && <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}</span>}
                </div>
                {ev.notes && <div style={{ fontSize: "12px", color: "var(--text-secondary)", paddingLeft: "22px", lineHeight: 1.5 }}>{ev.notes}</div>}
              </div>
            )
          })}
          {dayTasks.map((t: any) => (
            <div key={`task-${t.id}`} style={{ padding: "12px 16px", borderRadius: "12px", background: TYPE_COLORS.task.bg, borderLeft: `3px solid ${TYPE_COLORS.task.dot}`, display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: t.status === "done" ? "var(--color-green)" : t.status === "doing" ? "var(--color-yellow)" : "var(--text-tertiary)", flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: TYPE_COLORS.task.text, fontWeight: 600 }}>{t.title}</span>
              <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>{t.status}</span>
            </div>
          ))}

          {/* Habit summary for this day */}
          {dayHabits && dayHabits.total > 0 && (
            <div style={{
              padding: "14px 18px", borderRadius: "12px",
              background: TYPE_COLORS.habit.bg, borderLeft: `3px solid ${TYPE_COLORS.habit.dot}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontSize: "14px" }}>⟡</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: TYPE_COLORS.habit.text, flex: 1 }}>
                  Habits — {dayHabits.completed}/{dayHabits.total} completed
                </span>
                {dayHabits.completed === dayHabits.total && (
                  <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "6px", background: "rgba(52,211,153,0.15)", color: "#34d399", fontWeight: 600 }}>
                    ✓ All done
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {dayHabits.habits.map((h, i) => (
                  <span key={i} style={{
                    padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 600,
                    background: h.done ? `${h.color}20` : "var(--glass-bg)",
                    border: `1px solid ${h.done ? `${h.color}40` : "var(--glass-border)"}`,
                    color: h.done ? h.color : "var(--text-tertiary)",
                  }}>{h.icon} {h.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Countdown events */}
          {dayCountdowns.map(c => (
            <div key={`cd-${c.id}`} style={{
              padding: "12px 16px", borderRadius: "12px",
              background: `${c.color}10`, borderLeft: `3px solid ${c.color}`,
              display: "flex", alignItems: "center", gap: "10px",
            }}>
              <span style={{ fontSize: "18px" }}>{c.icon}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: c.color }}>{c.label}</span>
                {c.notes && <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>{c.notes}</div>}
              </div>
              <span style={{ fontSize: "9px", fontWeight: 600, color: c.color, textTransform: "uppercase" }}>Countdown</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════
   AGENDA VIEW
══════════════════════════════════════ */
function AgendaView({ events, tasksWithDates, habitSummary, countdowns, onEventClick }: {
  events: CalendarEvent[]; tasksWithDates: any[]
  habitSummary: Record<string, DayHabitSummary>; countdowns: CountdownItem[]
  onEventClick: (e: CalendarEvent) => void
}) {
  const today = toDateStr(new Date())

  const allDates = new Set([
    ...events.map(e => e.date),
    ...tasksWithDates.filter(t => t.due_date).map(t => t.due_date),
    ...countdowns.map(c => c.date),
    ...Object.keys(habitSummary).filter(d => (habitSummary[d]?.total ?? 0) > 0),
  ])
  const sortedDates = Array.from(allDates).filter(d => d >= today).sort()

  if (sortedDates.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "12px", color: "var(--text-tertiary)" }}>
        <div style={{ fontSize: "36px", opacity: 0.3 }}>◌</div>
        <div style={{ fontSize: "13px" }}>No upcoming events</div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
      {sortedDates.map(date => {
        const d       = new Date(date + "T12:00:00")
        const dayEvts = events.filter(e => e.date === date)
        const dayTasks = tasksWithDates.filter(t => t.due_date === date)
        const dayHabits = habitSummary[date] ?? null
        const dayCountdowns = countdowns.filter(c => c.date === date)
        const isToday = date === today

        return (
          <div key={date} style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: isToday ? "var(--accent)" : "var(--text-secondary)" }}>
                {isToday ? "Today — " : ""}{MONTHS[d.getMonth()]} {d.getDate()}, {d.getFullYear()}
              </div>
              <div style={{ flex: 1, height: "1px", background: "var(--glass-border)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {dayEvts.map(ev => {
                const c = TYPE_COLORS[ev.type]
                return (
                  <div key={ev.id} onClick={() => onEventClick(ev)}
                    style={{ padding: "12px 16px", borderRadius: "10px", background: c.bg, borderLeft: `3px solid ${c.dot}`, display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", transition: "all 0.12s ease" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)" }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateX(0)" }}>
                    <span style={{ fontSize: "13px" }}>{TYPE_ICONS[ev.type]}</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: c.text, flex: 1 }}>{ev.title}</span>
                    {ev.reminder_minutes != null && ev.reminder_minutes >= 0 && (
                      <span style={{ fontSize: "9px" }}>🔔</span>
                    )}
                    {ev.start_time && <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{formatTime(ev.start_time)}</span>}
                  </div>
                )
              })}
              {dayTasks.map((t: any) => (
                <div key={`t${t.id}`} style={{ padding: "10px 16px", borderRadius: "10px", background: TYPE_COLORS.task.bg, borderLeft: `3px solid ${TYPE_COLORS.task.dot}`, display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: t.status === "done" ? "var(--color-green)" : "var(--text-tertiary)", flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", color: TYPE_COLORS.task.text, fontWeight: 600 }}>{t.title}</span>
                </div>
              ))}

              {/* Habit summary */}
              {dayHabits && dayHabits.total > 0 && (
                <div style={{
                  padding: "10px 16px", borderRadius: "10px",
                  background: TYPE_COLORS.habit.bg, borderLeft: `3px solid ${TYPE_COLORS.habit.dot}`,
                  display: "flex", alignItems: "center", gap: "8px",
                }}>
                  <span style={{ fontSize: "13px" }}>⟡</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: TYPE_COLORS.habit.text }}>
                    Habits: {dayHabits.completed}/{dayHabits.total}
                  </span>
                  <div style={{ display: "flex", gap: "3px", marginLeft: "4px" }}>
                    {dayHabits.habits.filter(h => h.done).slice(0, 5).map((h, i) => (
                      <span key={i} style={{ fontSize: "10px" }}>{h.icon}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Countdowns */}
              {dayCountdowns.map(c => (
                <div key={`cd-${c.id}`} style={{
                  padding: "10px 16px", borderRadius: "10px",
                  background: `${c.color}10`, borderLeft: `3px solid ${c.color}`,
                  display: "flex", alignItems: "center", gap: "8px",
                }}>
                  <span style={{ fontSize: "14px" }}>{c.icon}</span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: c.color }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════
   SIDEBAR — Today's events + upcoming
══════════════════════════════════════ */
function CalendarSidebar({ events, selectedDate, habitSummary, countdowns, onEventClick, onCreateEvent }: {
  events: CalendarEvent[]; selectedDate: string
  habitSummary: Record<string, DayHabitSummary>; countdowns: CountdownItem[]
  onEventClick: (e: CalendarEvent) => void; onCreateEvent: (date: string) => void
}) {
  const todayStr = toDateStr(new Date())
  const displayDate = selectedDate || todayStr
  const isToday = displayDate === todayStr
  const dayEvts = events.filter(e => e.date === displayDate).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))

  const upcoming = events
    .filter(e => e.date > todayStr)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""))
    .slice(0, 5)

  const d = new Date(displayDate + "T12:00:00")

  return (
    <div style={{
      width: "280px", flexShrink: 0, borderLeft: "1px solid var(--glass-border)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      background: "rgba(255,255,255,0.015)",
    }}>
      {/* Selected day header */}
      <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--glass-border)" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: isToday ? "var(--accent)" : "var(--text-tertiary)", marginBottom: "4px" }}>
          {isToday ? "Today" : DAYS_SHORT[d.getDay()]}
        </div>
        <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
          {MONTHS[d.getMonth()]} {d.getDate()}
        </div>
      </div>

      {/* Events for selected day */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {dayEvts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-tertiary)", fontSize: "11px" }}>
            <div style={{ fontSize: "24px", marginBottom: "8px", opacity: 0.3 }}>◌</div>
            No events
            <div style={{ marginTop: "8px" }}>
              <button onClick={() => onCreateEvent(displayDate)} style={{
                padding: "6px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: 600,
                background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
                color: "var(--accent)", cursor: "pointer", transition: "all 0.15s",
              }}>+ Add event</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {dayEvts.map(ev => {
              const c = TYPE_COLORS[ev.type]
              return (
                <div key={ev.id} onClick={() => onEventClick(ev)} style={{
                  padding: "10px 12px", borderRadius: "10px", background: c.bg,
                  borderLeft: `2.5px solid ${c.dot}`, cursor: "pointer", transition: "all 0.1s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateX(2px)" }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateX(0)" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: c.text, marginBottom: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                    {ev.reminder_minutes != null && ev.reminder_minutes >= 0 && <span style={{ fontSize: "9px" }}>🔔</span>}
                    {ev.title}
                  </div>
                  {ev.start_time && <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}</div>}
                </div>
              )
            })}
          </div>
        )}

        {/* Habit summary for selected day */}
        {(() => {
          const dh = habitSummary[displayDate]
          if (!dh || dh.total === 0) return null
          return (
            <div style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "6px" }}>
                Habits
              </div>
              <div style={{
                padding: "10px 12px", borderRadius: "10px",
                background: TYPE_COLORS.habit.bg, borderLeft: `2.5px solid ${TYPE_COLORS.habit.dot}`,
              }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: TYPE_COLORS.habit.text, marginBottom: "6px" }}>
                  {dh.completed}/{dh.total} completed
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                  {dh.habits.map((h, i) => (
                    <span key={i} style={{
                      padding: "2px 6px", borderRadius: "4px", fontSize: "9px", fontWeight: 600,
                      background: h.done ? `${h.color}20` : "var(--glass-bg)",
                      color: h.done ? h.color : "var(--text-tertiary)",
                      border: `1px solid ${h.done ? `${h.color}30` : "var(--glass-border)"}`,
                    }}>{h.icon} {h.name}</span>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Countdown events for selected day */}
        {countdowns.filter(c => c.date === displayDate).length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "6px" }}>
              Countdowns
            </div>
            {countdowns.filter(c => c.date === displayDate).map(c => (
              <div key={c.id} style={{
                padding: "8px 10px", borderRadius: "8px", marginBottom: "4px",
                background: `${c.color}10`, borderLeft: `2.5px solid ${c.color}`,
              }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: c.color, display: "flex", alignItems: "center", gap: "4px" }}>
                  {c.icon} {c.label}
                </div>
                {c.notes && <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "2px" }}>{c.notes}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Upcoming section */}
        {upcoming.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: "8px" }}>
              Upcoming
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {upcoming.map(ev => {
                const c = TYPE_COLORS[ev.type]
                const evDate = new Date(ev.date + "T12:00:00")
                return (
                  <div key={ev.id} onClick={() => onEventClick(ev)} style={{
                    padding: "8px 10px", borderRadius: "8px", background: "var(--glass-bg)",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: "8px",
                    transition: "background 0.1s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)" }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--glass-bg)" }}>
                    <div style={{ width: "4px", height: "24px", borderRadius: "2px", background: c.dot, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                      <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>{MONTHS[evDate.getMonth()]} {evDate.getDate()}{ev.start_time ? ` · ${formatTime(ev.start_time)}` : ""}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════
   MAIN CALENDAR PAGE
══════════════════════════════════════ */
export default function Calendar() {
  const {
    view, setView,
    currentDate, selectedDate,
    setSelectedDate, goToPrev, goToNext, goToToday,
    events, activeDates: _activeDates,
    loadEvents, loadActiveDates,
    createEvent, updateEvent, deleteEvent,
  } = useCalendarStore()

  const { tasks, loadTasks } = useTasksStore()
  const tasksWithDates = tasks.filter(t => t.due_date && !t.archived)

  const { habits, logs: changedLogs, loadHabits } = useHabitsStore()
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [today, setToday] = useState(() => localDate(new Date()))
  useEffect(() => {
    const refresh = () => setToday(localDate(new Date()))
    const timer = window.setInterval(refresh, 15000)
    window.addEventListener("focus", refresh)
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh) }
  }, [])

  const [modal, setModal] = useState<{ date: string; event?: CalendarEvent | null } | null>(null)

  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const mk    = monthKey(currentDate)

  // Load countdowns from localStorage
  const [countdowns, setCountdowns] = useState<CountdownItem[]>(loadCountdowns)
  const [dataError, setDataError] = useState("")

  useEffect(() => {
    const refresh = () => setCountdowns(loadCountdowns())
    window.addEventListener("chroninotes:countdowns-changed", refresh)
    window.addEventListener("storage", refresh)
    window.addEventListener("focus", refresh)
    return () => {
      window.removeEventListener("chroninotes:countdowns-changed", refresh)
      window.removeEventListener("storage", refresh)
      window.removeEventListener("focus", refresh)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setDataError("")
    Promise.all([loadEvents(mk), loadActiveDates(mk), loadHabits(), loadTasks()])
      .catch(() => { if (!cancelled) setDataError("Could not refresh calendar data. Navigate again to retry.") })
    return () => { cancelled = true }
  }, [mk, view, currentDate, loadEvents, loadActiveDates, loadHabits, loadTasks])

  // Keep Calendar's log range separate from the Habits page.
  useEffect(() => {
    let cancelled = false
    const firstDay = localDate(habitWeekStart(new Date(year, month, 1)))
    const lastDay = localDate(new Date(year, month + 1, 0))
    window.electron.invoke("habits:allLogs", { start_date: firstDay, end_date: lastDay })
      .then(data => { if (!cancelled) setLogs(data as HabitLog[]) })
      .catch(() => { if (!cancelled) setDataError("Could not refresh habit activity.") })
    return () => { cancelled = true }
  }, [year, month, today, changedLogs])

  // Build habit summary per day
  const habitSummary = useMemo<Record<string, DayHabitSummary>>(() => {
    if (habits.length === 0) return {}
    const summary: Record<string, DayHabitSummary> = {}
    const activeHabits = habits.filter(h => !h.archived)

    const logIndex = new Map(logs.map(log => [`${log.habit_id}:${log.date}`, log.count]))

    // For each day in the current month
    const totalDays = daysInMonth(year, month)
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      const dayHabits = activeHabits
        .filter(h => (h.start_date || h.created_at?.slice(0, 10) || today) <= dateStr)
        .filter(h => h.frequency !== "weekly" || new Date(`${dateStr}T12:00:00`).getDay() === 0)
        .map(h => ({
          name: h.name,
          icon: h.icon,
          color: h.color,
          done: habitDayComplete(h, dateStr, today, date => logIndex.get(`${h.id}:${date}`) ?? 0),
        }))
      if (dayHabits.length > 0) {
        summary[dateStr] = {
          completed: dayHabits.filter(h => h.done).length,
          total: dayHabits.length,
          habits: dayHabits,
        }
      }
    }
    return summary
  }, [habits, logs, year, month, today])

  const handleSelectDate = (date: string) => {
    setSelectedDate(date)
  }

  const handleEventClick = (event: CalendarEvent) => {
    setModal({ date: event.date, event })
  }

  const handleCreateEvent = (date: string) => {
    setSelectedDate(date)
    setModal({ date })
  }

  const handleSave = async (data: Omit<CalendarEvent, "id" | "created_at">) => {
    if (modal?.event) {
      await updateEvent(modal.event.id, data)
    } else {
      await createEvent(data)
    }
    setModal(null)
  }

  const handleDelete = async () => {
    if (modal?.event) {
      await deleteEvent(modal.event.id)
      setModal(null)
    }
  }

  const VIEW_TABS: { id: typeof view; label: string }[] = [
    { id: "month",  label: "Month"  },
    { id: "week",   label: "Week"   },
    { id: "day",    label: "Day"    },
    { id: "agenda", label: "Agenda" },
  ]

  const headerTitle = view === "month"  ? `${MONTHS[month]} ${year}`
    : view === "week"   ? `Week of ${MONTHS[month]} ${currentDate.getDate()}, ${year}`
    : view === "day"    ? `${MONTHS[month]} ${currentDate.getDate()}, ${year}`
    : `Agenda — ${MONTHS[month]} ${year}`

  const totalEvents = events.length
  const remindersCount = events.filter(e => e.reminder_minutes != null && e.reminder_minutes >= 0).length

  return (
    <div className="tracking-page" style={{ height: "100%", display: "flex", flexDirection: "column", color: "var(--text-primary)", overflow: "hidden" }}>
      <StudioHeader eyebrow="MAKE TIME FOR WHAT MATTERS" title="A clearer view of your days." description="Plans, deadlines, and routines in one place."
        stats={[{ label: "Loaded events", value: totalEvents }, { label: "Reminders", value: remindersCount }]} />
      {dataError && <p className="tracking-note" role="alert">{dataError}</p>}

      {/* ── Header bar ── */}
      <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0, flexWrap: "wrap" }}>
        {/* Nav arrows */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <NavBtn label="‹" onClick={goToPrev} />
          <button onClick={goToToday} style={{
            padding: "6px 14px", borderRadius: "8px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
            color: "var(--text-secondary)", fontSize: "11px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.color = "var(--text-primary)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--glass-bg)"; e.currentTarget.style.color = "var(--text-secondary)" }}>
            Today
          </button>
          <NavBtn label="›" onClick={goToNext} />
        </div>

        {/* Title + counts */}
        <div style={{ flex: 1, display: "flex", alignItems: "baseline", gap: "10px" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
            {headerTitle}
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {totalEvents > 0 && (
              <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "6px", background: "var(--accent-dim)", border: "1px solid var(--accent-border)", color: "var(--accent)", fontWeight: 600 }}>
                {totalEvents} event{totalEvents !== 1 ? "s" : ""}
              </span>
            )}
            {remindersCount > 0 && (
              <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "6px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24", fontWeight: 600 }}>
                🔔 {remindersCount}
              </span>
            )}
            {habits.filter(h => !h.archived).length > 0 && (
              <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "6px", background: TYPE_COLORS.habit.bg, border: `1px solid ${TYPE_COLORS.habit.border}`, color: TYPE_COLORS.habit.text, fontWeight: 600 }}>
                ⟡ {habits.filter(h => !h.archived).length} habit{habits.filter(h => !h.archived).length !== 1 ? "s" : ""}
              </span>
            )}
            {countdowns.length > 0 && (
              <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "6px", background: TYPE_COLORS.countdown.bg, border: `1px solid ${TYPE_COLORS.countdown.border}`, color: TYPE_COLORS.countdown.text, fontWeight: 600 }}>
                ⏳ {countdowns.length}
              </span>
            )}
          </div>
        </div>

        {/* View tabs */}
        <div style={{ display: "flex", padding: "3px", borderRadius: "10px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
          {VIEW_TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setView(id)} style={{
              padding: "5px 14px", borderRadius: "7px", fontSize: "11px", fontWeight: 600,
              color: view === id ? "var(--text-primary)" : "var(--text-tertiary)",
              background: view === id ? "var(--glass-bg-hover)" : "transparent",
              border: `1px solid ${view === id ? "var(--glass-border-strong)" : "transparent"}`,
              cursor: "pointer", transition: "all 0.15s ease",
            }}>{label}</button>
          ))}
        </div>

        {/* Add button */}
        <button onClick={() => setModal({ date: selectedDate })} style={{
          padding: "8px 16px", borderRadius: "10px",
          background: "var(--accent)", border: "none",
          color: "white", fontSize: "12px", fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
          boxShadow: "0 0 14px var(--accent-glow)", transition: "all 0.15s ease",
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)" }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)" }}>
          <span style={{ fontSize: "14px", lineHeight: 1 }}>+</span> New Event
        </button>
      </div>

      {/* ── Calendar body + sidebar ── */}
      <div className="tracking-calendar-body" style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {/* Main view */}
        <div className="tracking-calendar-view" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          {view === "month" && (
            <MonthView year={year} month={month} events={events}
              selectedDate={selectedDate} tasksWithDates={tasksWithDates}
              habitSummary={habitSummary} countdowns={countdowns}
              onSelectDate={handleSelectDate} onEventClick={handleEventClick}
              onCreateEvent={handleCreateEvent} />
          )}
          {view === "week" && (
            <WeekView anchorDate={currentDate} events={events}
              onSelectDate={handleSelectDate} onEventClick={handleEventClick} />
          )}
          {view === "day" && (
            <DayView date={selectedDate} events={events} tasksWithDates={tasksWithDates}
              habitSummary={habitSummary} countdowns={countdowns}
              onEventClick={handleEventClick} />
          )}
          {view === "agenda" && (
            <AgendaView events={events} tasksWithDates={tasksWithDates}
              habitSummary={habitSummary} countdowns={countdowns}
              onEventClick={handleEventClick} />
          )}
        </div>

        {/* Right sidebar — selected day detail */}
        <CalendarSidebar events={events} selectedDate={selectedDate}
          habitSummary={habitSummary} countdowns={countdowns}
          onEventClick={handleEventClick} onCreateEvent={handleCreateEvent} />
      </div>

      {/* ── Event modal ── */}
      {modal && (
        <EventModal
          date={modal.date}
          event={modal.event}
          onSave={handleSave}
          onDelete={modal.event ? handleDelete : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function NavBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: "30px", height: "30px", borderRadius: "8px",
      background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
      color: "var(--text-secondary)", fontSize: "15px", fontWeight: 600,
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.15s ease",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.color = "var(--text-primary)" }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--glass-bg)"; e.currentTarget.style.color = "var(--text-secondary)" }}>
      {label}
    </button>
  )
}
