import { useThemeStore, THEMES } from "../store/theme.store"
import type { ThemeId } from "../store/theme.store"
import "../preferences.css"

interface SettingsProps {
  onClose: () => void
}

/* ── Reusable toggle switch ── */
function ToggleSwitch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label}
      onClick={onToggle}
      style={{
        width: "44px", height: "24px", borderRadius: "12px",
        background: on ? "var(--accent)" : "var(--glass-border-strong)",
        border: "none", cursor: "pointer", flexShrink: 0,
        position: "relative", transition: "background 0.25s ease", padding: 0,
      }}
    >
      <div style={{
        position: "absolute", top: "3px",
        left: on ? "23px" : "3px",
        width: "18px", height: "18px", borderRadius: "50%",
        background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        transition: "left 0.25s cubic-bezier(0.34,1.56,0.64,1)",
      }} />
    </button>
  )
}

/* ── Reusable setting row ── */
function SettingRow({
  icon, title, description, active, onToggle,
}: {
  icon: React.ReactNode
  title: string
  description: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: "16px", padding: "14px 16px", borderRadius: "var(--radius-lg)",
      background: active ? "var(--accent-dim)" : "var(--glass-bg)",
      border: `1px solid ${active ? "var(--accent-border)" : "var(--glass-border)"}`,
      transition: "all 0.2s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
        <div style={{
          width: "34px", height: "34px", borderRadius: "8px", flexShrink: 0,
          background: active ? "var(--accent-dim)" : "var(--glass-bg-hover)",
          border: `1px solid ${active ? "var(--accent-border)" : "var(--glass-border)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s ease",
        }}>
          {icon}
        </div>
        <div>
          <div style={{
            fontSize: "13px", fontWeight: 600,
            color: active ? "var(--accent)" : "var(--text-primary)",
            marginBottom: "2px", transition: "color 0.2s",
          }}>{title}</div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", lineHeight: 1.4 }}>
            {description}
          </div>
        </div>
      </div>
      <ToggleSwitch on={active} onToggle={onToggle} label={title} />
    </div>
  )
}

export default function Settings({ onClose }: SettingsProps) {
  const { theme, setTheme, memorySaver, setMemorySaver } = useThemeStore()

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "pageEnter 0.2s ease",
      }}
    >
      <div className="preferences-panel"
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(560px, calc(100vw - 48px))",
          maxHeight: "calc(100vh - 80px)", overflowY: "auto",
          borderRadius: "var(--radius-xl)",
          background: "var(--modal-bg, rgba(12,15,30,0.97))",
          border: "1px solid var(--glass-border-strong)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
          animation: "settingsEnter 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px 16px", borderBottom: "1px solid var(--glass-border)",
        }}>
          <div>
            <div style={{
              fontSize: "10px", fontWeight: 700, letterSpacing: "0.8px",
              textTransform: "uppercase", color: "var(--accent)", marginBottom: "4px",
            }}>Settings</div>
            <h2 style={{
              fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.3px",
              color: "var(--text-primary)", margin: 0,
            }}>Make this space yours.</h2>
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

        {/* ── Body ── */}
        <div style={{ padding: "20px 24px 24px" }}>

          {/* ══ THEME SECTION ══ */}
          <SectionLabel>Theme</SectionLabel>

          <div className="preferences-themes" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {THEMES.map(t => {
              const active = theme === t.id
              return (
                <button
                  key={t.id}
                  className="preferences-theme" aria-pressed={active}
                  onClick={() => setTheme(t.id as ThemeId)}
                  style={{
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "12px 14px", borderRadius: "var(--radius-lg)",
                    background: active ? "var(--accent-dim)" : "var(--glass-bg)",
                    border: `1px solid ${active ? "var(--accent-border)" : "var(--glass-border)"}`,
                    boxShadow: active ? "0 0 0 1px var(--accent-border)" : "none",
                    transition: "all 0.18s ease", textAlign: "left",
                    width: "100%", cursor: "pointer",
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.borderColor = "var(--glass-border-strong)" } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "var(--glass-bg)"; e.currentTarget.style.borderColor = "var(--glass-border)" } }}
                >
                  {/* Swatches */}
                  <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
                    {t.swatches.map((color, i) => (
                      <div key={i} style={{
                        width: i === 0 ? "22px" : "14px", height: "28px",
                        borderRadius: "5px", background: color,
                        border: "1px solid rgba(255,255,255,0.08)", flexShrink: 0,
                      }} />
                    ))}
                  </div>
                  {/* Label */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: "13px", fontWeight: 600,
                      color: active ? "var(--accent)" : "var(--text-primary)",
                      marginBottom: "2px", transition: "color 0.15s",
                    }}>{t.name}</div>
                    <div style={{
                      fontSize: "11px", color: "var(--text-tertiary)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{t.description}</div>
                  </div>
                  {/* Active checkmark */}
                  <div style={{
                    width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0,
                    background: active ? "var(--accent)" : "transparent",
                    border: `1.5px solid ${active ? "var(--accent)" : "var(--glass-border-strong)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.18s ease",
                  }}>
                    {active && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5L4.2 7.2L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <Divider />

          {/* ══ MEMORY SECTION ══ */}
          <SectionLabel>Memory</SectionLabel>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

            {/* Memory Saver */}
            <SettingRow
              active={memorySaver}
              onToggle={() => setMemorySaver(!memorySaver)}
              title="Memory Saver"
              description={memorySaver ? "Inactive pages unmounted — lower RAM use" : "Unmounts background pages to free system memory"}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={memorySaver ? "var(--accent)" : "var(--text-secondary)"}
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M6 10h.01M6 14h.01M10 10h4M10 14h4" />
                  <path d="M2 10h2M20 10h2M2 14h2M20 14h2" />
                </svg>
              }
            />

            {/* Expanded detail when memory saver on */}
            {memorySaver && (
              <div style={{
                padding: "10px 14px", borderRadius: "var(--radius-md)",
                background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                animation: "pageEnter 0.2s ease",
              }}>
                <p style={{ fontSize: "11px", color: "var(--text-tertiary)", lineHeight: 1.6, margin: 0 }}>
                  <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>How it works: </span>
                  Pages you're not viewing are fully unmounted from the React tree — their DOM nodes,
                  event listeners, and editor instances are destroyed and memory is returned to the system.
                  Pages reload when you switch to them (slight delay on first visit).
                </p>
              </div>
            )}

            {/* Status badge */}
            {memorySaver && (
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "10px 14px", borderRadius: "var(--radius-md)",
                background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
                animation: "pageEnter 0.2s ease",
              }}>
                <span style={{
                  width: "6px", height: "6px", borderRadius: "50%",
                  background: "var(--color-green)", boxShadow: "0 0 6px var(--color-green)",
                  display: "inline-block", animation: "pulse-glow 2s ease-in-out infinite",
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600 }}>
                  Memory saver active
                </span>
              </div>
            )}
          </div>

          <Divider />

          {/* ══ UPDATES SECTION ══ */}
          <SectionLabel>Updates</SectionLabel>

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: "16px", padding: "14px 16px", borderRadius: "var(--radius-lg)",
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "8px", flexShrink: 0,
                background: "var(--glass-bg-hover)",
                border: "1px solid var(--glass-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <div>
                <div style={{
                  fontSize: "13px", fontWeight: 600,
                  color: "var(--text-primary)", marginBottom: "2px",
                }}>Check for Updates</div>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)", lineHeight: 1.4 }}>
                  See if a newer version is available on GitHub
                </div>
              </div>
            </div>
            <button
              onClick={() => window.dispatchEvent(new Event("check-for-updates"))}
              style={{
                padding: "7px 16px", borderRadius: "var(--radius-md)",
                fontSize: "11px", fontWeight: 600, flexShrink: 0,
                background: "var(--accent-dim)",
                border: "1px solid var(--accent-border)",
                color: "var(--accent)", cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--accent-border)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--accent-dim)" }}
            >
              Check Now
            </button>
          </div>

          <Divider />

          {/* ── Active theme badge ── */}
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "10px 14px", borderRadius: "var(--radius-md)",
            background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
          }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: "var(--accent)", boxShadow: "0 0 6px var(--accent-glow)",
              animation: "pulse-glow 2s ease-in-out infinite", flexShrink: 0,
            }} />
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Active theme:{" "}
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                {THEMES.find(t => t.id === theme)?.name}
              </span>
              {memorySaver && <Badge label="MEM" />}
            </span>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes settingsEnter {
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
      fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px",
      textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: "14px",
    }}>{children}</p>
  )
}

function Divider() {
  return <div style={{ height: "1px", background: "var(--glass-border)", margin: "20px 0" }} />
}

function Badge({ label }: { label: string }) {
  return (
    <span style={{
      marginLeft: "6px", fontSize: "10px", fontWeight: 600,
      color: "var(--accent)", opacity: 0.75,
      padding: "1px 6px", borderRadius: "4px",
      background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
    }}>{label}</span>
  )
}
