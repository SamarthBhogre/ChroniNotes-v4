import { useEffect, useMemo, useState } from "react"
import { countdownDays } from "../lib/scheduling"
import StudioHeader from "../components/StudioHeader"
import "../studios.css"
import "../tracking.css"

type CountdownItem = {
  id: string
  label: string
  date: string       // YYYY-MM-DD
  color: string
  icon: string
  notes?: string
}

const COLORS = ["#818cf8", "#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c", "#ef4444"]
const ICONS = ["🎯", "📅", "🎓", "🏆", "🚀", "📝", "💼", "🎂", "✈️", "🎄", "💍", "⏰"]

const STORAGE_KEY = "chorniNotes-countdowns-v2"

function loadItems(): CountdownItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") } catch { return [] }
}
function saveItems(items: CountdownItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event("chroninotes:countdowns-changed"))
}

function daysUntil(dateStr: string): number {
  return countdownDays(dateStr)
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  })
}

export default function Countdown() {
  const [items, setItems] = useState<CountdownItem[]>(loadItems)
  const [showCreate, setShowCreate] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newDate, setNewDate] = useState("")
  const [newColor, setNewColor] = useState("#818cf8")
  const [newIcon, setNewIcon] = useState("🎯")
  const [newNotes, setNewNotes] = useState("")
  const [editId, setEditId] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all")
  const [tick, setTick] = useState(0)

  // Live-refresh every minute
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(iv)
  }, [])

  const save = (updated: CountdownItem[]) => {
    setItems(updated)
    saveItems(updated)
  }

  const handleCreate = () => {
    if (!newLabel.trim() || !newDate) return
    const item: CountdownItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      label: newLabel.trim(), date: newDate, color: newColor, icon: newIcon,
      notes: newNotes.trim() || undefined,
    }
    save([...items, item])
    resetForm()
  }

  const handleUpdate = () => {
    if (!editId || !newLabel.trim() || !newDate) return
    save(items.map(it => it.id === editId
      ? { ...it, label: newLabel.trim(), date: newDate, color: newColor, icon: newIcon, notes: newNotes.trim() || undefined }
      : it
    ))
    resetForm()
  }

  const startEdit = (item: CountdownItem) => {
    setEditId(item.id)
    setNewLabel(item.label)
    setNewDate(item.date)
    setNewColor(item.color)
    setNewIcon(item.icon)
    setNewNotes(item.notes || "")
    setShowCreate(true)
  }

  const resetForm = () => {
    setShowCreate(false); setEditId(null)
    setNewLabel(""); setNewDate(""); setNewColor("#818cf8"); setNewIcon("🎯"); setNewNotes("")
  }

  const handleDelete = (id: string) => save(items.filter(it => it.id !== id))

  const sorted = useMemo(() => {
    let filtered = [...items]
    if (filter === "upcoming") filtered = filtered.filter(it => daysUntil(it.date) >= 0)
    if (filter === "past") filtered = filtered.filter(it => daysUntil(it.date) < 0)
    return filtered.sort((a, b) => daysUntil(a.date) - daysUntil(b.date))
  }, [items, filter, tick])

  const upcomingCount = items.filter(it => daysUntil(it.date) >= 0).length
  const pastCount = items.filter(it => daysUntil(it.date) < 0).length

  // Find the nearest upcoming event
  const nearest = items
    .filter(it => daysUntil(it.date) >= 0)
    .sort((a, b) => daysUntil(a.date) - daysUntil(b.date))[0]

  return (
    <div className="tracking-page" style={{ height: "100%", color: "var(--text-primary)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <StudioHeader eyebrow="LOOK FORWARD" title="Keep meaningful moments close." description="Days are counted by your local calendar, not by elapsed hours."
        stats={[{ label: "Upcoming", value: upcomingCount }, { label: "Past", value: pastCount }]} />

      {/* Header */}
      <div style={{
        padding: "18px 28px 14px", borderBottom: "1px solid var(--glass-border)",
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "12px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "10px",
            background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", color: "var(--accent)",
          }}>⏳</div>
          <div>
            <h1 style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.3px", lineHeight: 1.2, margin: 0 }}>Countdown</h1>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "1px" }}>
              {items.length} event{items.length !== 1 ? "s" : ""} · {upcomingCount} upcoming
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Filter pills */}
          <div style={{ display: "flex", gap: "4px" }}>
            {([
              { key: "all" as const, label: "All", count: items.length },
              { key: "upcoming" as const, label: "Upcoming", count: upcomingCount },
              { key: "past" as const, label: "Past", count: pastCount },
            ]).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: "4px 10px", borderRadius: "8px", fontSize: "10px", fontWeight: 600,
                background: filter === f.key ? "var(--accent-dim)" : "var(--glass-bg)",
                border: `1px solid ${filter === f.key ? "var(--accent-border)" : "transparent"}`,
                color: filter === f.key ? "var(--accent)" : "var(--text-tertiary)",
                cursor: "pointer", transition: "all 0.12s",
              }}>
                {f.label} <span style={{ opacity: 0.5 }}>{f.count}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => { if (showCreate && !editId) resetForm(); else { resetForm(); setShowCreate(true) } }}
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
            {showCreate ? "Cancel" : "+ New Event"}
          </button>
        </div>
      </div>

      {/* Create/Edit form */}
      {showCreate && (
        <div style={{
          padding: "16px 28px", borderBottom: "1px solid var(--glass-border)",
          background: "var(--glass-bg)", display: "flex", flexDirection: "column", gap: "12px",
        }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Event Name</FieldLabel>
              <input
                value={newLabel} onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (editId ? handleUpdate() : handleCreate())}
                placeholder="e.g. Final Exam, Birthday, Launch Day…"
                autoFocus
                style={{
                  width: "100%", padding: "8px 14px",
                  background: "var(--bg-base)", border: "1.5px solid var(--glass-border)",
                  borderRadius: "10px", color: "var(--text-primary)", fontSize: "12px", outline: "none",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "var(--accent-border)")}
                onBlur={e => (e.currentTarget.style.borderColor = "var(--glass-border)")}
              />
            </div>
            <div>
              <FieldLabel>Date</FieldLabel>
              <input
                type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                style={{
                  padding: "8px 14px",
                  background: "var(--bg-base)", border: "1.5px solid var(--glass-border)",
                  borderRadius: "10px", color: "var(--text-primary)", fontSize: "12px", outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "20px" }}>
            <div>
              <FieldLabel>Icon</FieldLabel>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => setNewIcon(ic)} style={{
                    width: "28px", height: "28px", borderRadius: "7px", fontSize: "14px",
                    background: newIcon === ic ? "var(--accent-dim)" : "var(--bg-base)",
                    border: `1px solid ${newIcon === ic ? "var(--accent-border)" : "var(--glass-border)"}`,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{ic}</button>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Color</FieldLabel>
              <div style={{ display: "flex", gap: "4px" }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setNewColor(c)} style={{
                    width: "24px", height: "24px", borderRadius: "6px",
                    background: c, border: `2px solid ${newColor === c ? "white" : "transparent"}`,
                    cursor: "pointer", boxShadow: newColor === c ? `0 0 8px ${c}` : "none",
                  }} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <FieldLabel>Notes (optional)</FieldLabel>
            <input
              value={newNotes} onChange={e => setNewNotes(e.target.value)}
              placeholder="Additional details…"
              style={{
                width: "100%", padding: "6px 12px",
                background: "var(--bg-base)", border: "1px solid var(--glass-border)",
                borderRadius: "8px", color: "var(--text-primary)", fontSize: "11px", outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
            <button onClick={resetForm} style={{
              padding: "8px 14px", borderRadius: "8px", fontSize: "11px",
              background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
              color: "var(--text-tertiary)", cursor: "pointer",
            }}>Cancel</button>
            <button
              onClick={editId ? handleUpdate : handleCreate}
              disabled={!newLabel.trim() || !newDate}
              style={{
                padding: "8px 18px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
                background: "var(--accent)", border: "none", color: "white",
                cursor: newLabel.trim() && newDate ? "pointer" : "default",
                opacity: newLabel.trim() && newDate ? 1 : 0.5,
              }}
            >{editId ? "Update" : "Create"}</button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>

        {/* Hero — nearest event */}
        {nearest && (
          <div style={{
            padding: "20px 24px", borderRadius: "16px", marginBottom: "20px",
            background: `linear-gradient(135deg, ${nearest.color}15, ${nearest.color}08)`,
            border: `1px solid ${nearest.color}30`,
            display: "flex", alignItems: "center", gap: "20px",
          }}>
            <div style={{
              width: "64px", height: "64px", borderRadius: "16px", flexShrink: 0,
              background: `${nearest.color}20`, border: `1px solid ${nearest.color}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "28px",
            }}>{nearest.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: nearest.color, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                Next Up
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "4px" }}>
                {nearest.label}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                {formatDateFull(nearest.date)}
              </div>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: "36px", fontWeight: 800, color: nearest.color, lineHeight: 1 }}>
                {daysUntil(nearest.date)}
              </div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: nearest.color, opacity: 0.7, marginTop: "2px" }}>
                {daysUntil(nearest.date) === 0 ? "TODAY" : daysUntil(nearest.date) === 1 ? "day left" : "days left"}
              </div>
            </div>
          </div>
        )}

        {/* Event cards grid */}
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-tertiary)" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px", opacity: 0.15 }}>⏳</div>
            <div style={{ fontSize: "13px", marginBottom: "8px" }}>No countdown events</div>
            <div style={{ fontSize: "11px" }}>Create an event to start counting down</div>
          </div>
        ) : (
          <div className="tracking-countdown-grid">
            {sorted.map(item => (
              <CountdownCard
                key={item.id}
                item={item}
                onEdit={() => startEdit(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────
   Countdown Card
────────────────────────────────────────── */
function CountdownCard({ item, onEdit, onDelete }: {
  item: CountdownItem
  onEdit: () => void; onDelete: () => void
}) {
  const [hov, setHov] = useState(false)
  const days = daysUntil(item.date)
  const isPast = days < 0
  const isToday = days === 0
  const isTomorrow = days === 1
  const isThisWeek = days > 0 && days <= 7

  // Progress ring for nearby events
  const showRing = !isPast && days <= 30
  const ringProgress = showRing ? Math.max(0, 1 - days / 30) : 0

  return (
    <div className="tracking-countdown-card"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "16px", borderRadius: "14px",
        background: hov ? "var(--glass-bg-hover)" : "var(--glass-bg)",
        border: `1px solid ${isToday ? `${item.color}60` : hov ? "var(--glass-border-strong)" : "var(--glass-border)"}`,
        borderLeft: `4px solid ${item.color}`,
        transition: "all 0.15s",
        transform: hov ? "translateY(-2px)" : "none",
        boxShadow: hov ? `0 6px 20px rgba(0,0,0,0.15)` : "none",
        position: "relative", overflow: "hidden",
        opacity: isPast ? 0.6 : 1,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
          <span style={{
            width: "32px", height: "32px", borderRadius: "9px", flexShrink: 0,
            background: `${item.color}20`, border: `1px solid ${item.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px",
          }}>{item.icon}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: "13px", fontWeight: 700, color: "var(--text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              textDecoration: isPast ? "line-through" : "none",
            }}>{item.label}</div>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
              {formatDateShort(item.date)}
            </div>
          </div>
        </div>

        {/* Actions on hover */}
        {hov && (
          <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
            <button onClick={onEdit} title="Edit" style={{
              padding: "3px 5px", borderRadius: "5px", fontSize: "10px",
              background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
              color: "var(--text-tertiary)", cursor: "pointer",
            }}>✎</button>
            <button onClick={onDelete} title="Delete" style={{
              padding: "3px 5px", borderRadius: "5px", fontSize: "10px",
              background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
              color: "var(--text-tertiary)", cursor: "pointer",
            }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--color-red)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-tertiary)")}
            >✕</button>
          </div>
        )}
      </div>

      {/* Notes */}
      {item.notes && (
        <div style={{
          fontSize: "10px", color: "var(--text-tertiary)", lineHeight: 1.4,
          marginBottom: "10px", padding: "6px 8px", borderRadius: "6px",
          background: "rgba(255,255,255,0.03)",
        }}>
          {item.notes}
        </div>
      )}

      {/* Countdown display */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 12px", borderRadius: "10px",
        background: isToday ? `${item.color}15` : isPast ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isToday ? `${item.color}30` : isPast ? "rgba(239,68,68,0.15)" : "var(--glass-border)"}`,
      }}>
        <div>
          <div style={{
            fontSize: "22px", fontWeight: 800, lineHeight: 1,
            color: isPast ? "var(--color-red)" : isToday ? item.color : "var(--text-primary)",
          }}>
            {isToday ? "🎉" : isPast ? Math.abs(days) : days}
          </div>
          <div style={{
            fontSize: "9px", fontWeight: 600, marginTop: "2px",
            color: isPast ? "var(--color-red)" : isToday ? item.color : "var(--text-tertiary)",
          }}>
            {isToday ? "TODAY!" : isPast ? "days ago" : isTomorrow ? "day left" : isThisWeek ? "days left (this week)" : "days left"}
          </div>
        </div>

        {/* Mini progress ring */}
        {showRing && (
          <svg width="36" height="36" style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--glass-border)" strokeWidth="3" />
            <circle cx="18" cy="18" r="14" fill="none" stroke={item.color} strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 14}
              strokeDashoffset={2 * Math.PI * 14 * (1 - ringProgress)}
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
        )}
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: "9px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
      color: "var(--text-tertiary)", marginBottom: "6px",
    }}>{children}</div>
  )
}
