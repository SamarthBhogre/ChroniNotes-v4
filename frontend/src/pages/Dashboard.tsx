import { useEffect, useRef, useState } from "react"
import { useTasksStore } from "../store/tasks.store"
import ActivityHeatmap from "../components/ActivityHeatmap"
import CalendarMiniWidget from "../components/CalendarMiniWidget"
import WorkspaceHero from "../components/WorkspaceHero"

type Page = "dashboard" | "tasks" | "notes" | "timer" | "calendar" | "habits" | "countdown"

function useCardEntrance(_count: number) {
  const refs = useRef<(HTMLDivElement | null)[]>([])
  useEffect(() => {
    const elements = refs.current.filter((el): el is HTMLDivElement => el !== null)
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const timers: ReturnType<typeof setTimeout>[] = []
    const reveal = () => {
      timers.forEach(clearTimeout)
      elements.forEach(el => { el.style.opacity = "1"; el.style.transform = "" })
    }
    const onPreferenceChange = () => { if (preference.matches) reveal() }
    if (!preference.matches) elements.forEach((el, i) => {
      el.style.opacity = "0"
      el.style.transform = "translateY(10px) scale(0.98)"
      timers.push(setTimeout(() => {
        el.style.transition = "opacity 0.25s ease, transform 0.25s ease"
        el.style.opacity = "1"
        el.style.transform = ""
      }, 40 + i * 30))
    })
    preference.addEventListener("change", onPreferenceChange)
    return () => { reveal(); preference.removeEventListener("change", onPreferenceChange) }
  }, [])
  return refs
}

const CARDS = [
  { icon: "◈", label: "Tasks",     desc: "Todos & progress",      rgb: "99,102,241",  page: "tasks"     as Page },
  { icon: "◉", label: "Notes",     desc: "Thoughts & writing",    rgb: "139,92,246",  page: "notes"     as Page },
  { icon: "⊹", label: "Timer",     desc: "Pomodoro & focus",      rgb: "6,182,212",   page: "timer"     as Page },
  { icon: "▦", label: "Calendar",  desc: "Events & reminders",    rgb: "251,146,60",  page: "calendar"  as Page },
  { icon: "⟡", label: "Habits",    desc: "Daily tracking",        rgb: "52,211,153",  page: "habits"    as Page },
  { icon: "⏳", label: "Countdown", desc: "Days until events",     rgb: "244,114,182", page: "countdown" as Page },
]

interface Props { onNavigate?: (page: Page) => void }
type DataView = "tasks" | "pomodoro"

function GoalRing({ completed, goal, size = 100 }: { completed: number; goal: number; size?: number }) {
  const stroke = 5, r = (size - stroke * 2) / 2, circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(goal > 0 ? completed / goal : 0, 1))
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--glass-border-strong)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)", filter: "drop-shadow(0 0 4px var(--accent-glow))" }}
      />
    </svg>
  )
}

export default function Dashboard({ onNavigate }: Props) {
  const cardRefs = useCardEntrance(CARDS.length + 3)

  const [dataView, setDataView] = useState<DataView>(() =>
    (localStorage.getItem("chorniNotes-dataView") as DataView) ?? "tasks")
  const switchView = (v: DataView) => { setDataView(v); localStorage.setItem("chorniNotes-dataView", v) }

  const { tasks, loadTasks, completionHistory, loadCompletionHistory } = useTasksStore()
  useEffect(() => { loadTasks(); loadCompletionHistory() }, [])

  const activeTasks = tasks.length
  const doneTasks   = tasks.filter(t => t.status === "done").length
  const doingTasks  = tasks.filter(t => t.status === "in-progress").length
  const todoTasks   = tasks.filter(t => t.status === "todo").length

  const [focusHistory, setFocusHistory]         = useState<{ date: string; count: number; total_seconds: number }[]>([])
  const [todayMinutes, setTodayMinutes]         = useState(0)
  const [yesterdayMinutes, setYesterdayMinutes] = useState(0)

  useEffect(() => {
    window.electron.invoke("focus:history")
      .then(d => setFocusHistory(d as { date: string; count: number; total_seconds: number }[]))
      .catch(() => {})
    window.electron.invoke("focus:todayMinutes")
      .then(d => setTodayMinutes(d as number))
      .catch(() => {})
    window.electron.invoke("focus:yesterdayMinutes")
      .then(d => setYesterdayMinutes(d as number))
      .catch(() => {})
  }, [])

  const focusDayActivity = focusHistory.map(d => ({ date: d.date, count: d.count }))

  const [taskGoal,  setTaskGoal]  = useState(() => parseInt(localStorage.getItem("chorniNotes-dailyGoal")  ?? "5",   10))
  const [focusGoal, setFocusGoal] = useState(() => parseInt(localStorage.getItem("chorniNotes-focusGoal") ?? "120", 10))
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput,   setGoalInput]   = useState(0)

  const openEditGoal = () => { setGoalInput(dataView === "tasks" ? taskGoal : focusGoal); setEditingGoal(true) }
  const saveGoal = () => {
    const val = Math.max(1, goalInput)
    if (dataView === "tasks") { setTaskGoal(val); localStorage.setItem("chorniNotes-dailyGoal", String(val)) }
    else { setFocusGoal(val); localStorage.setItem("chorniNotes-focusGoal", String(val)) }
    setEditingGoal(false)
  }

  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` })()
  const yd = new Date(); yd.setDate(yd.getDate() - 1)
  const todayTasksDone     = completionHistory.find(d => d.date === todayStr)?.count ?? 0
  const yesterdayTasksDone = completionHistory.find(d => d.date === `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, "0")}-${String(yd.getDate()).padStart(2, "0")}`)?.count ?? 0

  function calcStreak(history: { date: string; count: number }[]) {
    const map = new Map(history.map(d => [d.date, d.count]))
    let streak = 0, cur = new Date()
    while (true) {
      const d = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`
      if ((map.get(d) ?? 0) > 0) { streak++; cur.setDate(cur.getDate() - 1) } else break
    }
    return streak
  }
  const taskStreak  = calcStreak(completionHistory)
  const focusStreak = calcStreak(focusDayActivity)

  const isPomodoro      = dataView === "pomodoro"
  const activeCompleted = isPomodoro ? todayMinutes     : todayTasksDone
  const activeYesterday = isPomodoro ? yesterdayMinutes : yesterdayTasksDone
  const activeGoal      = isPomodoro ? focusGoal        : taskGoal
  const activeStreak    = isPomodoro ? focusStreak      : taskStreak
  const activeHistory   = isPomodoro ? focusDayActivity : completionHistory
  const activeUnit      = isPomodoro ? "min"    : "tasks"
  const activeGoalUnit  = isPomodoro ? "min/day" : "tasks/day"

  return (
    <div style={{ height: "100%", color: "var(--text-primary)", overflowY: "auto" }}>
      <div className="spatial-dashboard">
        <WorkspaceHero onFocus={() => onNavigate?.("timer")} onNotes={() => onNavigate?.("notes")} />

        {/* ── Header row ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "34px", height: "34px", borderRadius: "10px",
              background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "15px", color: "var(--accent)",
            }}>⬡</div>
            <div>
              <h1 style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.3px", lineHeight: 1.2, margin: 0, color: "var(--text-primary)" }}>
                Dashboard
              </h1>
              <div style={{ fontSize: "10px", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "5px", marginTop: "1px" }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--color-green)", boxShadow: "0 0 4px var(--color-green)", display: "inline-block", animation: "pulse-glow 2s ease-in-out infinite" }} />
                All systems active
              </div>
            </div>
          </div>

          {/* Data view toggle */}
          <div style={{ display: "flex", padding: "3px", borderRadius: "10px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            {(["tasks", "pomodoro"] as DataView[]).map(v => (
              <button key={v} onClick={() => switchView(v)} style={{
                padding: "5px 12px", borderRadius: "7px", fontSize: "11px", fontWeight: 600,
                color: dataView === v ? "var(--text-primary)" : "var(--text-tertiary)",
                background: dataView === v ? "var(--glass-bg-hover)" : "transparent",
                border: `1px solid ${dataView === v ? "var(--glass-border-strong)" : "transparent"}`,
                cursor: "pointer", transition: "all 0.15s ease",
                display: "flex", alignItems: "center", gap: "4px",
              }}>
                {v === "tasks" ? "◈" : "⊹"} {v === "tasks" ? "Tasks" : "Focus"}
              </button>
            ))}
          </div>
        </div>

        {/* ── Row 1: Nav Cards (compact) ── */}
        <div className="spatial-tools">
          {CARDS.map(({ icon, label, desc, rgb, page }, i) => (
            <div key={label} ref={el => { cardRefs.current[i] = el }} className="glass spatial-tool"
              onClick={() => onNavigate?.(page)}
              style={{
                borderRadius: "12px", padding: "14px 16px",
                position: "relative", overflow: "hidden",
                cursor: onNavigate ? "pointer" : "default",
                transition: "all 0.18s cubic-bezier(0.34,1.56,0.64,1)",
              }}
              onMouseEnter={e => { if (!onNavigate) return; const el = e.currentTarget; el.style.background = "var(--glass-bg-hover)"; el.style.borderColor = `rgba(${rgb},0.25)`; el.style.transform = "translateY(-2px)"; el.style.boxShadow = `0 6px 20px rgba(${rgb},0.12)` }}
              onMouseLeave={e => { const el = e.currentTarget; el.style.background = "var(--glass-bg)"; el.style.borderColor = "var(--glass-border)"; el.style.transform = "translateY(0)"; el.style.boxShadow = "var(--glass-shadow)" }}
            >
              <div style={{ position: "absolute", top: "-25px", right: "-25px", width: "70px", height: "70px", borderRadius: "50%", background: `rgba(${rgb},0.08)`, filter: "blur(15px)", pointerEvents: "none" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: `rgba(${rgb},0.12)`, border: `1px solid rgba(${rgb},0.24)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", color: `rgba(${rgb},1)`, flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>{label}</div>
                  <div style={{ fontSize: "9px", color: "var(--text-tertiary)", lineHeight: 1.3 }}>{desc}</div>
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); onNavigate?.(page) }}
                style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "6px", background: `rgba(${rgb},0.08)`, border: `1px solid rgba(${rgb},0.18)`, fontSize: "9px", fontWeight: 700, color: `rgba(${rgb},1)`, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = `rgba(${rgb},0.16)` }}
                onMouseLeave={e => { e.currentTarget.style.background = `rgba(${rgb},0.08)` }}>
                Open <span style={{ opacity: 0.5 }}>→</span>
              </button>
            </div>
          ))}
        </div>

        {/* ── Row 2: Progress Ring + Streak ── */}
        <div className="spatial-progress">

          {/* Daily Progress Ring */}
          <div ref={el => { cardRefs.current[6] = el }} className="glass" style={{ borderRadius: "12px", padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <div>
                <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Daily Progress</div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginTop: "1px" }}>{isPomodoro ? "Focus Minutes" : "Task Completions"}</div>
              </div>
              <button onClick={openEditGoal} style={{ width: "22px", height: "22px", borderRadius: "6px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)" }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)" }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <GoalRing completed={activeCompleted} goal={activeGoal} size={90} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  {editingGoal ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                      <input type="number" value={goalInput} min={1} onChange={e => setGoalInput(+e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditingGoal(false) }} autoFocus
                        style={{ width: "42px", textAlign: "center", fontSize: "12px", fontWeight: 700, background: "var(--glass-bg)", border: "1px solid var(--accent-border)", borderRadius: "5px", color: "var(--text-primary)", padding: "2px 0" }} />
                      <button onClick={saveGoal} style={{ fontSize: "8px", fontWeight: 600, color: "var(--accent)", background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: "3px", padding: "1px 5px", cursor: "pointer" }}>Set</button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: "18px", fontWeight: 700, lineHeight: 1, color: "var(--text-primary)" }}>{activeCompleted}</span>
                      <span style={{ fontSize: "8px", color: "var(--text-tertiary)", marginTop: "1px" }}>of {activeGoal} {activeUnit}</span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                <MiniStat label="Yesterday" value={`${activeYesterday}`} unit={activeUnit} />
                <div style={{ height: "1px", background: "var(--glass-border)" }} />
                <MiniStat label="Goal" value={`${activeGoal}`} unit={activeGoalUnit} accent />
                <div style={{ height: "1px", background: "var(--glass-border)" }} />
                <MiniStat label="Progress" value={activeGoal > 0 ? `${Math.round((activeCompleted / activeGoal) * 100)}%` : "0%"} unit="" accent={activeCompleted >= activeGoal && activeGoal > 0} />
              </div>
            </div>
            {activeCompleted >= activeGoal && activeGoal > 0 && activeCompleted > 0 && (
              <div style={{ marginTop: "8px", paddingTop: "6px", borderTop: "1px solid var(--glass-border)", textAlign: "center", fontSize: "10px", color: "var(--accent)", fontWeight: 600 }}>
                🎉 Daily goal reached!
              </div>
            )}
          </div>

          {/* Streak + breakdown */}
          <div ref={el => { cardRefs.current[7] = el }} className="glass" style={{ borderRadius: "12px", padding: "14px 18px" }}>
            <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Overview</div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px", marginTop: "1px" }}>{isPomodoro ? "Focus Stats" : "Task Stats"}</div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "10px", background: activeStreak > 0 ? "var(--accent-dim)" : "var(--glass-bg)", border: `1px solid ${activeStreak > 0 ? "var(--accent-border)" : "var(--glass-border)"}`, marginBottom: "8px" }}>
              <div style={{ fontSize: "20px", lineHeight: 1 }}>{activeStreak >= 7 ? "🔥" : activeStreak >= 3 ? "⚡" : activeStreak > 0 ? "✦" : "○"}</div>
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: activeStreak > 0 ? "var(--accent)" : "var(--text-secondary)", lineHeight: 1 }}>
                  {activeStreak}<span style={{ fontSize: "10px", fontWeight: 500, color: "var(--text-tertiary)", marginLeft: "2px" }}>day{activeStreak !== 1 ? "s" : ""}</span>
                </div>
                <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "1px" }}>
                  {activeStreak === 0 ? "Start your streak" : activeStreak >= 7 ? "On fire! 🔥" : "Current streak"}
                </div>
              </div>
            </div>

            {isPomodoro ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <MiniStat label="Sessions today" value={`${focusHistory.find(d => d.date === todayStr)?.count ?? 0}`} unit="sessions" />
                <div style={{ height: "1px", background: "var(--glass-border)" }} />
                <MiniStat label="Focus today" value={`${todayMinutes}`} unit="min" accent />
                <div style={{ height: "1px", background: "var(--glass-border)" }} />
                <MiniStat label="Total sessions" value={`${focusHistory.reduce((s, d) => s + d.count, 0)}`} unit="all time" />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {[
                  { label: "To do", count: todoTasks, color: "var(--text-tertiary)", bar: "var(--glass-border-strong)" },
                  { label: "In progress", count: doingTasks, color: "var(--color-yellow)", bar: "var(--color-yellow)" },
                  { label: "Done", count: doneTasks, color: "var(--color-green)", bar: "var(--color-green)" },
                ].map(({ label, count, color, bar }) => (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{label}</span>
                      <span style={{ fontSize: "10px", fontWeight: 600, color }}>{count}</span>
                    </div>
                    <div style={{ height: "3px", borderRadius: "2px", background: "var(--glass-border-strong)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: "2px", width: `${activeTasks > 0 ? (count / activeTasks) * 100 : 0}%`, background: bar, transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 3: Countdown + Mini Calendar + Heatmap ── */}
        <div className="spatial-widgets">
          <div ref={el => { cardRefs.current[8] = el }}>
            <CountdownWidget onNavigate={() => onNavigate?.("countdown")} />
          </div>
          <div ref={el => { cardRefs.current[9] = el }}>
            <CalendarMiniWidget onNavigate={() => onNavigate?.("calendar")} />
          </div>
          <div ref={el => { cardRefs.current[10] = el }}>
            <ActivityHeatmap
              history={activeHistory}
              weeks={20}
              label={isPomodoro ? "Focus Session Heatmap" : "Task Completion Heatmap"}
            />
          </div>
        </div>

      </div>
    </div>
  )
}

function MiniStat({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontSize: "12px", fontWeight: 700, color: accent ? "var(--accent)" : "var(--text-primary)" }}>
        {value} <span style={{ fontSize: "8px", fontWeight: 500, color: "var(--text-tertiary)" }}>{unit}</span>
      </span>
    </div>
  )
}

/* ══════════════════════════════════════
   COUNTDOWN WIDGET (Dashboard mini version)
══════════════════════════════════════ */
type CountdownItem = { id: string; label: string; date: string; color: string; icon: string; notes?: string }

function CountdownWidget({ onNavigate }: { onNavigate?: () => void }) {
  const [items] = useState<CountdownItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("chorniNotes-countdowns-v2") || "[]") } catch { return [] }
  })

  const now = new Date()
  const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  const upcoming = items
    .map(it => {
      const targetMs = new Date(it.date + "T00:00:00").getTime()
      const daysLeft = Math.ceil((targetMs - todayMs) / 86400000)
      return { ...it, daysLeft }
    })
    .filter(it => it.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 4)

  return (
    <div className="glass" style={{ borderRadius: "12px", padding: "14px 16px", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div>
          <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--text-tertiary)" }}>Countdown</div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginTop: "1px" }}>Upcoming</div>
        </div>
        {onNavigate && (
          <button onClick={onNavigate} style={{
            padding: "3px 8px", borderRadius: "6px", fontSize: "9px", fontWeight: 600,
            background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
            color: "var(--text-tertiary)", cursor: "pointer", transition: "all 0.12s",
          }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "var(--accent-border)" }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.borderColor = "var(--glass-border)" }}
          >View all →</button>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto" }}>
        {upcoming.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "var(--text-tertiary)", opacity: 0.5 }}>
            No upcoming events
          </div>
        ) : upcoming.map(item => (
          <div key={item.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "6px 8px", borderRadius: "8px",
            background: item.daysLeft === 0 ? "var(--accent-dim)" : "var(--glass-bg)",
            border: `1px solid ${item.daysLeft === 0 ? "var(--accent-border)" : "var(--glass-border)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
              <span style={{ fontSize: "12px", flexShrink: 0 }}>{item.icon}</span>
              <span style={{
                fontSize: "11px", fontWeight: 600, color: "var(--text-primary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{item.label}</span>
            </div>
            <span style={{
              fontSize: "12px", fontWeight: 700, flexShrink: 0, marginLeft: "6px",
              color: item.daysLeft === 0 ? "var(--accent)" : item.daysLeft <= 3 ? item.color : "var(--text-primary)",
            }}>
              {item.daysLeft === 0 ? "Today!" : `${item.daysLeft}d`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
