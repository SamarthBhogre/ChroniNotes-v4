import { useEffect, useState, useRef } from "react"
import { useTimerStore } from "../store/timer.store"
import StudioHeader from "../components/StudioHeader"
import "../studios.css"
import "../tracking.css"

/* ════════════════════════════════════
   ANIMATED DIGIT
════════════════════════════════════ */
function AnimDigit({ value }: { value: string }) {
  const prev = useRef(value)
  const [flip, setFlip] = useState(false)

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value
      setFlip(true)
      const t = setTimeout(() => setFlip(false), 260)
      return () => clearTimeout(t)
    }
  }, [value])

  return (
    <span className="tracking-timer-digit" style={{
      display: "inline-block",
      transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease",
      transform: flip ? "translateY(-3px) scale(1.06)" : "translateY(0) scale(1)",
      opacity: flip ? 0.5 : 1,
      width: "1ch", textAlign: "center",
    }}>
      {value}
    </span>
  )
}

/* ════════════════════════════════════
   DISPLAY TIMER TEXT (mm:ss or hh:mm:ss)
════════════════════════════════════ */
function TimerDisplay({ seconds, size = "large" }: { seconds: number; size?: "large" | "medium" }) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0")
  const s = (seconds % 60).toString().padStart(2, "0")

  const fontSize = size === "large" ? "clamp(2rem, 6vw, 3rem)" : "clamp(1.5rem, 5vw, 2.2rem)"
  const sepStyle: React.CSSProperties = { opacity: 0.3, margin: "0 1px", fontWeight: 300 }

  return (
    <span style={{
      fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
      fontSize, fontWeight: 700, letterSpacing: "-1.5px",
      fontVariantNumeric: "tabular-nums",
      display: "inline-flex", alignItems: "center",
    }}>
      {h > 0 && (
        <>
          <AnimDigit value={String(h)} />
          <span style={sepStyle}>:</span>
        </>
      )}
      <AnimDigit value={m[0]} />
      <AnimDigit value={m[1]} />
      <span style={sepStyle}>:</span>
      <AnimDigit value={s[0]} />
      <AnimDigit value={s[1]} />
    </span>
  )
}

/* ════════════════════════════════════
   CIRCULAR PROGRESS RING
════════════════════════════════════ */
function CircleRing({ progress, isBreak, isRunning, size = 200, stroke = 5 }: {
  progress: number; isBreak: boolean; isRunning: boolean
  size?: number; stroke?: number
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(1, progress))
  const offset = circumference * (1 - pct)

  const accentColor = isBreak ? "var(--color-green)" : "var(--accent)"
  const glowColor = isBreak ? "var(--color-green)" : "var(--accent-glow)"

  return (
    <svg
      width={size} height={size}
      style={{ transform: "rotate(-90deg)", overflow: "visible" }}
    >
      {/* Glow filter */}
      <defs>
        <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background track */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke="var(--glass-border)"
        strokeWidth={stroke}
        opacity={0.6}
      />

      {/* Second subtle track (tick marks feel) */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke="var(--glass-border-strong)"
        strokeWidth={stroke}
        strokeDasharray="2 12"
        opacity={0.3}
      />

      {/* Progress arc */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={isRunning ? `url(#ring-gradient)` : accentColor}
        strokeWidth={stroke + 1}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        filter={isRunning ? "url(#ring-glow)" : undefined}
        style={{
          transition: "stroke-dashoffset 1.05s cubic-bezier(0.4,0,0.2,1)",
        }}
      />

      {/* Gradient for the arc */}
      <defs>
        <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isBreak ? "var(--color-green)" : "var(--glow-a)"} />
          <stop offset="50%" stopColor={accentColor} />
          <stop offset="100%" stopColor={isBreak ? "var(--color-green)" : "var(--glow-b)"} />
        </linearGradient>
      </defs>

      {/* Leading dot at the tip of progress */}
      {isRunning && pct > 0.01 && pct < 0.99 && (
        <circle
          cx={size / 2 + radius * Math.cos(2 * Math.PI * pct)}
          cy={size / 2 + radius * Math.sin(2 * Math.PI * pct)}
          r={stroke}
          fill={accentColor}
          style={{
            filter: `drop-shadow(0 0 6px ${glowColor})`,
            transition: "cx 1.05s cubic-bezier(0.4,0,0.2,1), cy 1.05s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      )}
    </svg>
  )
}

/* ════════════════════════════════════
   ACTION BUTTON
════════════════════════════════════ */
function ActionBtn({ label, icon, variant = "primary", onClick, disabled }: {
  label: string
  icon: React.ReactNode
  variant?: "primary" | "secondary" | "danger"
  onClick: () => void
  disabled?: boolean
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: "linear-gradient(135deg, var(--glow-a), var(--glow-b))",
      color: "white",
      border: "1px solid var(--accent-border)",
      boxShadow: "0 0 16px var(--accent-glow)",
    },
    secondary: {
      background: "var(--glass-bg)",
      color: "var(--accent)",
      border: "1px solid var(--accent-border)",
    },
    danger: {
      background: "var(--glass-bg)",
      color: "var(--color-red)",
      border: "1px solid var(--glass-border)",
    },
  }

  return (
    <button className="tracking-timer-action"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        padding: "9px 20px", borderRadius: "var(--radius-lg)",
        fontWeight: 600, fontSize: "12px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.18s ease",
        ...styles[variant],
      }}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.transform = "translateY(-1px)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)"
      }}
    >
      {icon}
      {label}
    </button>
  )
}

/* ════════════════════════════════════
   SVG ICONS (small, inline)
════════════════════════════════════ */
const PlayIcon = <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
const PauseIcon = <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
const StopIcon = <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>

/* ════════════════════════════════════
   TOOL ICONS for the tab bar
════════════════════════════════════ */
const ToolIcons: Record<string, React.ReactNode> = {
  pomodoro: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M5 3L2 6" /><path d="M22 6l-3-3" />
      <path d="M12 5V3" />
    </svg>
  ),
  timer: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2h4" /><path d="M12 14V10" />
      <circle cx="12" cy="14" r="8" />
    </svg>
  ),
  stopwatch: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
}

/* ════════════════════════════════════════════
   MAIN TIMER PAGE — TWO-COLUMN LAYOUT
   Left:  circular ring + timer digits inside + controls
   Right: settings panel for the active tool
════════════════════════════════════════════ */
export default function Timer() {
  const {
    tool, setTool,
    seconds, isRunning, isPaused, mode,
    workMinutes, breakMinutes, customMinutes, setCustom,
    start, pause, stop,
    loadSettings, updateSettings, updateFromMain,
  } = useTimerStore()

  const [workInput, setWorkInput]     = useState(workMinutes)
  const [breakInput, setBreakInput]   = useState(breakMinutes)
  const [customInput, setCustomInput] = useState(customMinutes)

  useEffect(() => { loadSettings() }, [])
  useEffect(() => { setWorkInput(workMinutes); setBreakInput(breakMinutes) }, [workMinutes, breakMinutes])
  useEffect(() => { setCustomInput(customMinutes) }, [customMinutes])
  useEffect(() => {
    return window.electron.on("timer:update", updateFromMain as (data: unknown) => void)
  }, [])

  const isBreak = tool === "pomodoro" && isRunning && mode === "break"

  const totalSeconds =
    tool === "pomodoro"
      ? (mode === "work" ? workMinutes : breakMinutes) * 60
      : tool === "timer" ? customInput * 60 : 0

  const progress = totalSeconds > 0 ? seconds / totalSeconds : (tool === "stopwatch" ? 1 : 0)

  const statusLabel = isRunning
    ? tool === "pomodoro"
      ? mode === "work" ? "Focusing" : "On Break"
      : tool === "stopwatch" ? "Running" : "Counting Down"
    : isPaused ? "Paused"
    : "Ready"

  const statusColor = isRunning
    ? isBreak ? "var(--color-green)" : "var(--accent)"
    : isPaused ? "var(--color-yellow)"
    : "var(--text-tertiary)"

  /* Ring size — responsive to available space */
  const RING_SIZE = 200

  /* ══════════════════════════════════
     RENDER
  ══════════════════════════════════ */
  return (
    <div className="tracking-page" style={{
      height: "100%", color: "var(--text-primary)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <StudioHeader eyebrow="FOCUS STUDIO" title="One thing. Your full attention." description="Find your flow, then make room to recharge."
        stats={[{ label: "Focus minutes", value: workMinutes }, { label: "Break minutes", value: breakMinutes }]} />
      {/* ── Header bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 28px", flexShrink: 0,
        borderBottom: "1px solid var(--glass-border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "30px", height: "30px", borderRadius: "8px",
            background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", color: "var(--accent)",
          }}>⊹</div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "-0.2px" }}>Timer</div>
            <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>Focus · Countdown · Stopwatch</div>
          </div>
        </div>

        {/* Tool tabs */}
        <div style={{
          display: "flex", padding: "3px", borderRadius: "var(--radius-lg)",
          background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
        }}>
          {(["pomodoro", "timer", "stopwatch"] as const).map(t => (
            <button key={t} onClick={() => setTool(t)} aria-pressed={tool === t} disabled={isRunning || isPaused} title={isRunning || isPaused ? "Stop the current session before changing tools" : undefined} style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "5px 14px", borderRadius: "var(--radius-sm)",
              fontSize: "11px", fontWeight: 600,
              color: tool === t ? "var(--text-primary)" : "var(--text-tertiary)",
              background: tool === t ? "var(--glass-bg-hover)" : "transparent",
              border: `1px solid ${tool === t ? "var(--glass-border-strong)" : "transparent"}`,
              transition: "all 0.18s ease",
              textTransform: "capitalize",
            }}>
              {ToolIcons[t]}
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main two-column body ── */}
      <div className="tracking-timer-body" style={{
        flex: 1, display: "flex", minHeight: 0, overflow: "hidden",
      }}>

        {/* ─── LEFT: Ring + Timer display ─── */}
        <div className="tracking-timer-stage" style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "24px", position: "relative",
          minWidth: 0,
        }}>
          {/* Status badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "4px 12px", borderRadius: "20px", marginBottom: "20px",
            background: isRunning || isPaused ? "var(--accent-dim)" : "var(--glass-bg)",
            border: `1px solid ${isRunning || isPaused ? "var(--accent-border)" : "var(--glass-border)"}`,
          }}>
            <span style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: statusColor,
              boxShadow: isRunning ? `0 0 6px ${statusColor}` : "none",
              animation: isRunning ? "pulse-glow 2s ease-in-out infinite" : "none",
            }} />
            <span style={{ fontSize: "10px", fontWeight: 600, color: statusColor }}>
              {statusLabel}
            </span>
            {tool === "pomodoro" && isRunning && (
              <span style={{
                fontSize: "9px", fontWeight: 500, color: "var(--text-tertiary)",
                marginLeft: "2px",
              }}>
                · {mode === "work" ? `${workMinutes}m session` : `${breakMinutes}m break`}
              </span>
            )}
          </div>

          {/* ── Circular ring with digits inside ── */}
          <div className="tracking-timer-dial" style={{
            position: "relative",
            width: `${RING_SIZE}px`, height: `${RING_SIZE}px`,
            marginBottom: "24px",
          }}>
            {/* The SVG ring */}
            <CircleRing
              progress={progress}
              isBreak={isBreak}
              isRunning={isRunning}
              size={RING_SIZE}
              stroke={5}
            />

            {/* Digits centered inside the ring */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              transform: "rotate(0deg)", /* counteract SVG rotation via positioning */
            }}>
              <div style={{
                color: isRunning
                  ? isBreak ? "var(--color-green)" : "var(--text-primary)"
                  : isPaused ? "var(--accent)" : "var(--text-secondary)",
                transition: "color 0.4s ease",
              }}>
                <TimerDisplay seconds={seconds} size="large" />
              </div>

              {/* Sub-label inside ring */}
              <div style={{
                fontSize: "9px", fontWeight: 600, letterSpacing: "0.5px",
                textTransform: "uppercase",
                color: "var(--text-tertiary)", marginTop: "4px",
              }}>
                {tool === "pomodoro"
                  ? mode === "work" ? "work" : "break"
                  : tool === "timer" ? "countdown"
                  : "elapsed"}
              </div>
            </div>
          </div>

          {/* Stopwatch elapsed label (below ring, only for stopwatch) */}
          {tool === "stopwatch" && (
            <div style={{
              fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "8px",
              fontWeight: 500, marginTop: "-8px",
            }}>
              {seconds === 0 ? "Press Start to begin" : `${Math.floor(seconds / 60)}m ${seconds % 60}s total`}
            </div>
          )}

          {/* Control buttons */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
            {!isRunning && (
              <ActionBtn
                label={isPaused ? "Resume" : "Start"}
                icon={PlayIcon}
                variant="primary"
                onClick={start}
              />
            )}
            {isRunning && (
              <ActionBtn
                label="Pause"
                icon={PauseIcon}
                variant="secondary"
                onClick={pause}
              />
            )}
            {(isRunning || isPaused) && (
              <ActionBtn
                label="Stop"
                icon={StopIcon}
                variant="danger"
                onClick={stop}
              />
            )}
          </div>
        </div>

        {/* ─── RIGHT: Settings panel ─── */}
        <div style={{
          width: "280px", flexShrink: 0,
          borderLeft: "1px solid var(--glass-border)",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}>
          {/* Panel header */}
          <div style={{
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--glass-border)",
          }}>
            <div style={{
              fontSize: "9px", fontWeight: 700, letterSpacing: "0.8px",
              textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "3px",
            }}>Configuration</div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
              {tool === "pomodoro" ? "Pomodoro Settings" : tool === "timer" ? "Timer Settings" : "Stopwatch"}
            </div>
          </div>

          {/* Panel body */}
          <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {tool === "pomodoro" && (
              <PomodoroPanel
                workInput={workInput} setWorkInput={setWorkInput}
                breakInput={breakInput} setBreakInput={setBreakInput}
                isRunning={isRunning}
                onSave={() => updateSettings(
                  Math.max(1, Math.floor(workInput)),
                  Math.max(1, Math.floor(breakInput)),
                )}
              />
            )}

            {tool === "timer" && (
              <TimerPanel
                customInput={customInput}
                onChange={v => { setCustomInput(v); setCustom(v) }}
                isRunning={isRunning}
              />
            )}

            {tool === "stopwatch" && (
              <StopwatchPanel seconds={seconds} isRunning={isRunning} isPaused={isPaused} />
            )}

            {/* Focus Records */}
            <FocusRecords />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════
   RIGHT PANEL: POMODORO SETTINGS
════════════════════════════════════ */
function PomodoroPanel({ workInput, setWorkInput, breakInput, setBreakInput, isRunning, onSave }: {
  workInput: number; setWorkInput: (v: number) => void
  breakInput: number; setBreakInput: (v: number) => void
  isRunning: boolean; onSave: () => void
}) {
  const presets = [
    { label: "Short Sprint", work: 15, brk: 3 },
    { label: "Classic", work: 25, brk: 5 },
    { label: "Long Focus", work: 45, brk: 10 },
    { label: "Deep Work", work: 60, brk: 15 },
  ]

  return (
    <>
      {/* Quick presets */}
      <div>
        <FieldLabel>Quick Presets</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          {presets.map(p => {
            const active = workInput === p.work && breakInput === p.brk
            return (
              <button key={p.label}
                disabled={isRunning}
                onClick={() => { setWorkInput(p.work); setBreakInput(p.brk) }}
                style={{
                  padding: "8px 10px", borderRadius: "var(--radius-md)",
                  fontSize: "11px", fontWeight: 600, textAlign: "left",
                  background: active ? "var(--accent-dim)" : "var(--glass-bg)",
                  border: `1px solid ${active ? "var(--accent-border)" : "var(--glass-border)"}`,
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  opacity: isRunning ? 0.45 : 1,
                  cursor: isRunning ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => {
                  if (!isRunning && !active) {
                    e.currentTarget.style.background = "var(--glass-bg-hover)"
                    e.currentTarget.style.borderColor = "var(--glass-border-strong)"
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = active ? "var(--accent-dim)" : "var(--glass-bg)"
                    e.currentTarget.style.borderColor = active ? "var(--accent-border)" : "var(--glass-border)"
                  }
                }}
              >
                <div>{p.label}</div>
                <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                  {p.work}m work · {p.brk}m break
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: "var(--glass-border)" }} />

      {/* Manual inputs */}
      <div>
        <FieldLabel>Custom Duration</FieldLabel>
        <div style={{ display: "flex", gap: "10px" }}>
          <NumberInput label="Work" unit="min" value={workInput} onChange={setWorkInput}
            min={1} max={120} disabled={isRunning} />
          <NumberInput label="Break" unit="min" value={breakInput} onChange={setBreakInput}
            min={1} max={60} disabled={isRunning} />
        </div>
      </div>

      {/* Save button */}
      <button
        disabled={isRunning || workInput < 1 || breakInput < 1}
        onClick={onSave}
        style={{
          width: "100%", padding: "9px 0", borderRadius: "var(--radius-md)",
          fontSize: "11.5px", fontWeight: 600,
          background: isRunning || workInput < 1 || breakInput < 1
            ? "var(--glass-bg)" : "var(--accent-dim)",
          border: "1px solid",
          borderColor: isRunning || workInput < 1 || breakInput < 1
            ? "var(--glass-border)" : "var(--accent-border)",
          color: isRunning || workInput < 1 || breakInput < 1
            ? "var(--text-tertiary)" : "var(--accent)",
          cursor: isRunning || workInput < 1 || breakInput < 1
            ? "not-allowed" : "pointer",
          transition: "all 0.18s ease",
        }}
        onMouseEnter={e => {
          if (!isRunning && workInput >= 1 && breakInput >= 1)
            e.currentTarget.style.background = "var(--accent-border)"
        }}
        onMouseLeave={e => {
          if (!isRunning && workInput >= 1 && breakInput >= 1)
            e.currentTarget.style.background = "var(--accent-dim)"
        }}
      >
        Save Settings
      </button>

      {/* Info */}
      <div style={{
        padding: "10px 12px", borderRadius: "var(--radius-md)",
        background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
      }}>
        <p style={{ fontSize: "10px", color: "var(--text-tertiary)", lineHeight: 1.6, margin: 0 }}>
          Pomodoro technique alternates focused work sessions with short breaks.
          A desktop notification will alert you when each phase ends.
        </p>
      </div>
    </>
  )
}

/* ════════════════════════════════════
   RIGHT PANEL: CUSTOM TIMER SETTINGS
════════════════════════════════════ */
function TimerPanel({ customInput, onChange, isRunning }: {
  customInput: number; onChange: (v: number) => void; isRunning: boolean
}) {
  const quickPresets = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120]

  return (
    <>
      {/* Duration input */}
      <div>
        <FieldLabel>Duration</FieldLabel>
        <NumberInput label="" unit="minutes" value={customInput} onChange={onChange}
          min={1} max={240} disabled={isRunning} wide />
      </div>

      {/* Quick presets grid */}
      <div>
        <FieldLabel>Quick Set</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "5px" }}>
          {quickPresets.map(p => {
            const active = customInput === p
            const label = p >= 60 ? `${p / 60}h` : `${p}m`
            return (
              <button key={p} onClick={() => onChange(p)} disabled={isRunning}
                style={{
                  padding: "7px 0", borderRadius: "var(--radius-sm)",
                  fontSize: "11px", fontWeight: 600, textAlign: "center",
                  background: active ? "var(--accent-dim)" : "var(--glass-bg)",
                  border: `1px solid ${active ? "var(--accent-border)" : "var(--glass-border)"}`,
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  opacity: isRunning ? 0.45 : 1,
                  cursor: isRunning ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={e => {
                  if (!isRunning && !active) {
                    e.currentTarget.style.background = "var(--glass-bg-hover)"
                    e.currentTarget.style.borderColor = "var(--glass-border-strong)"
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = "var(--glass-bg)"
                    e.currentTarget.style.borderColor = "var(--glass-border)"
                  }
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Info */}
      <div style={{
        padding: "10px 12px", borderRadius: "var(--radius-md)",
        background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
      }}>
        <p style={{ fontSize: "10px", color: "var(--text-tertiary)", lineHeight: 1.6, margin: 0 }}>
          Set a custom countdown. You'll receive a desktop notification when the timer
          finishes. The timer runs client-side — no backend needed.
        </p>
      </div>
    </>
  )
}

/* ════════════════════════════════════
   RIGHT PANEL: STOPWATCH INFO
════════════════════════════════════ */
function StopwatchPanel({ seconds, isRunning, isPaused }: {
  seconds: number; isRunning: boolean; isPaused: boolean
}) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const hrs  = Math.floor(seconds / 3600)

  return (
    <>
      {/* Live stats */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <StatRow label="Hours" value={String(hrs)} />
        <div style={{ height: "1px", background: "var(--glass-border)" }} />
        <StatRow label="Minutes" value={String(mins)} />
        <div style={{ height: "1px", background: "var(--glass-border)" }} />
        <StatRow label="Seconds" value={String(secs)} />
        <div style={{ height: "1px", background: "var(--glass-border)" }} />
        <StatRow label="Total" value={`${seconds}s`} accent />
      </div>

      {/* Status */}
      <div style={{
        padding: "10px 12px", borderRadius: "var(--radius-md)",
        background: isRunning ? "var(--accent-dim)" : isPaused ? "rgba(251,191,36,0.08)" : "var(--glass-bg)",
        border: `1px solid ${isRunning ? "var(--accent-border)" : isPaused ? "rgba(251,191,36,0.2)" : "var(--glass-border)"}`,
        transition: "all 0.3s ease",
      }}>
        <div style={{
          fontSize: "10px", fontWeight: 600,
          color: isRunning ? "var(--accent)" : isPaused ? "var(--color-yellow)" : "var(--text-tertiary)",
          display: "flex", alignItems: "center", gap: "6px",
        }}>
          <span style={{
            width: "5px", height: "5px", borderRadius: "50%",
            background: isRunning ? "var(--accent)" : isPaused ? "var(--color-yellow)" : "var(--glass-border-strong)",
            animation: isRunning ? "pulse-glow 2s ease-in-out infinite" : "none",
          }} />
          {isRunning ? "Stopwatch is running…" : isPaused ? "Stopwatch paused" : "Ready to start"}
        </div>
      </div>

      {/* Info */}
      <div style={{
        padding: "10px 12px", borderRadius: "var(--radius-md)",
        background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
      }}>
        <p style={{ fontSize: "10px", color: "var(--text-tertiary)", lineHeight: 1.6, margin: 0 }}>
          Track elapsed time with no limit. The stopwatch counts up from zero.
          Sessions over 10 seconds are saved to your focus history.
        </p>
      </div>
    </>
  )
}

/* ════════════════════════════════════
   SHARED SMALL COMPONENTS
════════════════════════════════════ */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: "9px", fontWeight: 700, letterSpacing: "0.6px",
      textTransform: "uppercase", color: "var(--text-tertiary)",
      marginBottom: "8px",
    }}>
      {children}
    </div>
  )
}

function NumberInput({ label, unit, value, onChange, min, max, disabled, wide }: {
  label: string; unit: string; value: number; onChange: (v: number) => void
  min: number; max: number; disabled: boolean; wide?: boolean
}) {
  return (
    <div style={{ flex: wide ? undefined : 1 }}>
      {label && (
        <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px" }}>
          {label}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <input
          type="number" value={value} disabled={disabled}
          onChange={e => onChange(Math.max(min, Math.min(max, +e.target.value)))}
          min={min} max={max}
          style={{
            width: "100%",
            padding: "7px 10px", textAlign: "center",
            fontSize: "13px", fontWeight: 700,
            borderRadius: "var(--radius-md)",
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-primary)",
            opacity: disabled ? 0.45 : 1,
            cursor: disabled ? "not-allowed" : "text",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
          onFocus={e => {
            if (!disabled) {
              e.currentTarget.style.borderColor = "var(--accent-border)"
              e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-glow)"
            }
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = "var(--glass-border)"
            e.currentTarget.style.boxShadow = "none"
          }}
        />
        {unit && (
          <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 500, whiteSpace: "nowrap" }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{
        fontSize: "13px", fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        color: accent ? "var(--accent)" : "var(--text-primary)",
      }}>{value}</span>
    </div>
  )
}

/* ════════════════════════════════════
   FOCUS RECORDS — Recent session history
════════════════════════════════════ */
function FocusRecords() {
  const [history, setHistory] = useState<{ date: string; count: number; total_seconds: number }[]>([])
  const [todayMin, setTodayMin] = useState(0)

  useEffect(() => {
    window.electron.invoke("focus:history")
      .then(d => setHistory((d as { date: string; count: number; total_seconds: number }[]).slice(-14).reverse()))
      .catch(() => {})
    window.electron.invoke("focus:todayMinutes")
      .then(d => setTodayMin(d as number))
      .catch(() => {})
  }, [])

  const totalSessions = history.reduce((s, d) => s + d.count, 0)
  const totalMinutes = history.reduce((s, d) => s + Math.round(d.total_seconds / 60), 0)

  return (
    <>
      <div style={{ height: "1px", background: "var(--glass-border)" }} />
      <div>
        <FieldLabel>Focus Records</FieldLabel>

        {/* Summary stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "10px",
        }}>
          <MiniStatBox label="Today" value={`${todayMin}m`} accent />
          <MiniStatBox label="Sessions" value={String(totalSessions)} />
          <MiniStatBox label="Total" value={`${totalMinutes}m`} />
        </div>

        {/* Recent days */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", maxHeight: "140px", overflowY: "auto" }}>
          {history.length === 0 ? (
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textAlign: "center", padding: "12px 0" }}>
              No focus sessions yet
            </div>
          ) : history.map(d => {
            const mins = Math.round(d.total_seconds / 60)
            return (
              <div key={d.date} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "4px 8px", borderRadius: "6px",
                fontSize: "10px",
              }}>
                <span style={{ color: "var(--text-tertiary)" }}>
                  {new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{d.count} session{d.count !== 1 ? "s" : ""}</span>
                  <span style={{ fontWeight: 700, color: "var(--accent)", minWidth: "36px", textAlign: "right" }}>{mins}m</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function MiniStatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      padding: "6px 8px", borderRadius: "8px", textAlign: "center",
      background: accent ? "var(--accent-dim)" : "var(--glass-bg)",
      border: `1px solid ${accent ? "var(--accent-border)" : "var(--glass-border)"}`,
    }}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: accent ? "var(--accent)" : "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: "8px", color: "var(--text-tertiary)", marginTop: "1px" }}>{label}</div>
    </div>
  )
}
