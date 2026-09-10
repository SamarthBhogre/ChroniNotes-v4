import { useEffect, useRef, useState, useCallback } from "react"
import { useTasksStore } from "../store/tasks.store"
import type { Task, TaskStatus, TaskPriority } from "../store/tasks.store"
import StudioHeader from "../components/StudioHeader"
import "../studios.css"

const STATUSES = ["todo", "in-progress", "done"] as const

const STATUS_CONFIG: Record<TaskStatus, {
  label: string; accent: string; glow: string; dot: string; bg: string
}> = {
  "todo":        { label: "To Do",       accent: "var(--text-tertiary)",  glow: "rgba(255,255,255,0.08)", dot: "#94a3b8", bg: "rgba(148,163,184,0.06)" },
  "in-progress": { label: "In Progress", accent: "var(--color-blue)",     glow: "rgba(96,165,250,0.12)",  dot: "#60a5fa", bg: "rgba(96,165,250,0.06)"  },
  "done":        { label: "Done",        accent: "var(--color-green)",    glow: "rgba(52,211,153,0.12)",  dot: "#34d399", bg: "rgba(52,211,153,0.06)"  },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: string; short: string }> = {
  "urgent-important": { label: "Urgent & Important", color: "#ef4444", icon: "🔴", short: "P1" },
  "important":        { label: "Important",          color: "#f59e0b", icon: "🟡", short: "P2" },
  "urgent":           { label: "Urgent",             color: "#3b82f6", icon: "🔵", short: "P3" },
  "neither":          { label: "Neither",            color: "#6b7280", icon: "⚪", short: "P4" },
}

/* ──────────────────────────────────────────
   Global styles (keyframes)
────────────────────────────────────────── */
function useGlobalStyles() {
  useEffect(() => {
    const id = "tasks-global-styles"
    if (document.getElementById(id)) return
    const s = document.createElement("style")
    s.id = id
    s.textContent = `
      @keyframes badgePop {
        0%   { transform: scale(0.7); opacity: 0.5; }
        70%  { transform: scale(1.15); }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes taskIn {
        from { opacity: 0; transform: translateY(8px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)  scale(1);    }
      }
      @keyframes slideDown {
        from { opacity: 0; max-height: 0; }
        to   { opacity: 1; max-height: 400px; }
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.96); }
        to   { opacity: 1; transform: scale(1); }
      }
    `
    document.head.appendChild(s)
    return () => document.getElementById(id)?.remove()
  }, [])
}

/* ──────────────────────────────────────────
   useDragDrop  — pointer-event based drag & drop
────────────────────────────────────────── */
type DragState = {
  taskId: number
  fromStatus: TaskStatus
  startX: number
  startY: number
  currentX: number
  currentY: number
  active: boolean
}

function useDragDrop(onDrop: (taskId: number, toStatus: TaskStatus) => void) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [overCol, setOverCol] = useState<TaskStatus | null>(null)
  const colRefs = useRef<Partial<Record<TaskStatus, HTMLDivElement>>>({})
  const ghostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!drag?.active) {
      ghostRef.current?.remove()
      ghostRef.current = null
      return
    }
    if (!ghostRef.current) {
      const g = document.createElement("div")
      g.style.cssText = `
        position:fixed; z-index:9999; pointer-events:none;
        padding:8px 12px; border-radius:10px;
        background:var(--glass-bg-hover);
        border:1.5px solid var(--accent-border);
        box-shadow:0 8px 32px rgba(0,0,0,0.4);
        font-size:12px; font-weight:500;
        color:var(--text-primary);
        max-width:220px; white-space:nowrap;
        overflow:hidden; text-overflow:ellipsis;
        transform:rotate(2deg) scale(1.04);
        transition:none; opacity:0.92;
      `
      document.body.appendChild(g)
      ghostRef.current = g
    }
    return () => { ghostRef.current?.remove(); ghostRef.current = null }
  }, [drag?.active])

  useEffect(() => {
    if (!drag?.active || !ghostRef.current) return
    ghostRef.current.style.left = `${drag.currentX + 14}px`
    ghostRef.current.style.top  = `${drag.currentY - 16}px`
  })

  useEffect(() => {
    if (!drag?.active) { setOverCol(null); return }
    let found: TaskStatus | null = null
    for (const s of STATUSES) {
      const el = colRefs.current[s]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (drag.currentX >= r.left && drag.currentX <= r.right &&
          drag.currentY >= r.top  && drag.currentY <= r.bottom) {
        found = s; break
      }
    }
    setOverCol(found)
  }, [drag?.currentX, drag?.currentY, drag?.active])

  useEffect(() => {
    if (!drag) return
    const THRESHOLD = 5
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      const moved = Math.sqrt(dx * dx + dy * dy) > THRESHOLD
      setDrag(d => d ? { ...d, currentX: e.clientX, currentY: e.clientY, active: d.active || moved } : null)
    }
    const onUp = (e: PointerEvent) => {
      if (drag.active) {
        let target: TaskStatus | null = null
        for (const s of STATUSES) {
          const el = colRefs.current[s]
          if (!el) continue
          const r = el.getBoundingClientRect()
          if (e.clientX >= r.left && e.clientX <= r.right &&
              e.clientY >= r.top  && e.clientY <= r.bottom) {
            target = s; break
          }
        }
        if (target && target !== drag.fromStatus) {
          onDrop(drag.taskId, target)
        }
      }
      ghostRef.current?.remove()
      ghostRef.current = null
      setDrag(null)
      setOverCol(null)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [drag, onDrop])

  const startDrag = (taskId: number, fromStatus: TaskStatus, title: string, e: React.PointerEvent) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    if (ghostRef.current) ghostRef.current.textContent = title
    setDrag({
      taskId, fromStatus,
      startX: e.clientX, startY: e.clientY,
      currentX: e.clientX, currentY: e.clientY,
      active: false,
    })
  }

  const setColRef = (s: TaskStatus) => (el: HTMLDivElement | null) => {
    if (el) colRefs.current[s] = el
  }

  const isDragging    = (id: number) => drag?.taskId === id && drag.active
  const isDraggingAny = drag?.active === true

  return { startDrag, setColRef, overCol, isDragging, isDraggingAny, dragState: drag }
}

/* ──────────────────────────────────────────
   Animate card in on mount
────────────────────────────────────────── */
function useCardEnter(delay: number) {
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.animation = `taskIn 0.22s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both`
  }, [delay])
  return ref
}

/* ──────────────────────────────────────────
   Sort helpers
────────────────────────────────────────── */
type SortMode = "created" | "due-date" | "priority" | "alphabetical"

function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  const copy = [...tasks]
  switch (mode) {
    case "created":
      return copy.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    case "due-date":
      return copy.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
    case "priority": {
      const order = ["urgent-important", "important", "urgent", "neither"]
      return copy.sort((a, b) => {
        const ai = a.priority ? order.indexOf(a.priority) : 999
        const bi = b.priority ? order.indexOf(b.priority) : 999
        return ai - bi
      })
    }
    case "alphabetical":
      return copy.sort((a, b) => a.title.localeCompare(b.title))
  }
}

/* ──────────────────────────────────────────
   Tasks Page
────────────────────────────────────────── */
type ViewMode = "kanban" | "eisenhower"

export default function Tasks() {
  const [title, setTitle]         = useState("")
  const [adding, setAdding]       = useState(false)
  const [filter, setFilter]       = useState<"all" | TaskStatus>("all")
  const [sortMode, setSortMode]   = useState<SortMode>("created")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [viewMode, setViewMode]   = useState<ViewMode>("kanban")
  const inputRef = useRef<HTMLInputElement>(null)

  useGlobalStyles()

  const { tasks, loadTasks, createTask, updateStatus, updatePriority, updateDueDate, updateDescription, deleteTask, archiveTask, archiveDone, loadArchivedTasks, archivedTasks, restoreTask } = useTasksStore()
  const [showArchive, setShowArchive] = useState(false)
  useEffect(() => { loadTasks() }, [])

  const handleDrop = useCallback((taskId: number, toStatus: TaskStatus) => {
    const prevTasks = useTasksStore.getState().tasks
    useTasksStore.setState(s => ({
      tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: toStatus } : t),
    }))
    updateStatus(taskId, toStatus).catch(() => {
      useTasksStore.setState({ tasks: prevTasks })
    })
  }, [updateStatus])

  const { startDrag, setColRef, overCol, isDragging, isDraggingAny } = useDragDrop(handleDrop)

  const handleAddTask = async () => {
    if (!title.trim()) return
    setAdding(true)
    await createTask(title.trim())
    setTitle("")
    setTimeout(() => setAdding(false), 300)
    inputRef.current?.focus()
  }

  // Build task tree: separate root tasks and subtasks
  const rootTasks = tasks.filter(t => !t.parent_id)
  const getSubtasks = (parentId: number) => tasks.filter(t => t.parent_id === parentId)

  const filteredStatuses = filter === "all" ? [...STATUSES] : [filter] as TaskStatus[]

  const todoCount       = rootTasks.filter(t => t.status === "todo").length
  const inProgressCount = rootTasks.filter(t => t.status === "in-progress").length
  const doneCount       = rootTasks.filter(t => t.status === "done").length

  return (
    <div className="studio-tasks" style={{ height: "100%", color: "var(--text-primary)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <StudioHeader eyebrow="PLAN WITH PURPOSE" title="Make room for progress."
        description="Organize the next step. Protect what matters. Build a little momentum."
        stats={[{ label: "To do", value: todoCount }, { label: "In progress", value: inProgressCount }, { label: "Completed", value: doneCount }]} />

      {/* ── Header ── */}
      <div className="studio-task-toolbar" style={{
        padding: "18px 28px 14px", borderBottom: "1px solid var(--glass-border)",
        flexShrink: 0, display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
      }}>
        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 auto", minWidth: "180px" }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "10px",
            background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", color: "var(--accent)", flexShrink: 0,
          }}>◈</div>
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: 700, letterSpacing: "-0.3px", lineHeight: 1.2, margin: 0 }}>Your tasks</h2>
            <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "1px" }}>
              {tasks.length} total · {tasks.filter(t => t.status === "done").length} completed
            </div>
          </div>
        </div>

        {/* View mode toggle */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <div style={{ display: "flex", padding: "3px", borderRadius: "8px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
            {([
              { key: "kanban" as ViewMode, label: "Board", icon: "▤" },
              { key: "eisenhower" as ViewMode, label: "Matrix", icon: "⊞" },
            ]).map(({ key, label, icon }) => (
              <button key={key} onClick={() => setViewMode(key)} aria-pressed={viewMode === key} style={{
                padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 600,
                background: viewMode === key ? "var(--glass-bg-hover)" : "transparent",
                border: `1px solid ${viewMode === key ? "var(--glass-border-strong)" : "transparent"}`,
                color: viewMode === key ? "var(--text-primary)" : "var(--text-tertiary)",
                cursor: "pointer", transition: "all 0.12s",
                display: "flex", alignItems: "center", gap: "3px",
              }}>
                {icon} {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setShowArchive(!showArchive); if (!showArchive) loadArchivedTasks() }}
            title="View archived tasks"
            style={{
              padding: "4px 10px", borderRadius: "8px", fontSize: "10px", fontWeight: 600,
              background: showArchive ? "var(--accent-dim)" : "var(--glass-bg)",
              border: `1px solid ${showArchive ? "var(--accent-border)" : "var(--glass-border)"}`,
              color: showArchive ? "var(--accent)" : "var(--text-tertiary)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "4px",
              transition: "all 0.12s",
            }}
          >📦 Archive</button>
        </div>

        {/* Sort dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600 }}>Sort:</span>
          <select
            aria-label="Sort tasks"
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
            style={{
              padding: "4px 8px", borderRadius: "8px", fontSize: "10px", fontWeight: 600,
              background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)", cursor: "pointer", outline: "none",
            }}
          >
            <option value="created">Default</option>
            <option value="due-date">Due Date</option>
            <option value="priority">Priority</option>
            <option value="alphabetical">A → Z</option>
          </select>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {([
            { key: "all"          as const, label: "All",    count: rootTasks.length, color: "var(--text-secondary)" },
            { key: "todo"         as const, label: "To Do",  count: todoCount,        color: STATUS_CONFIG.todo.dot  },
            { key: "in-progress"  as const, label: "Active", count: inProgressCount,  color: STATUS_CONFIG["in-progress"].dot },
            { key: "done"         as const, label: "Done",   count: doneCount,        color: STATUS_CONFIG.done.dot  },
          ]).map(({ key, label, count, color }) => {
            const active = filter === key
            return (
              <button key={key} onClick={() => setFilter(key)} aria-pressed={active} style={{
                padding: "4px 10px", borderRadius: "8px", fontSize: "10px", fontWeight: 600,
                background: active ? "var(--accent-dim)" : "var(--glass-bg)",
                border: `1px solid ${active ? "var(--accent-border)" : "transparent"}`,
                color: active ? "var(--accent)" : "var(--text-tertiary)",
                cursor: "pointer", transition: "all 0.15s ease",
                display: "flex", alignItems: "center", gap: "5px",
              }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: color, display: "inline-block" }} />
                {label} <span style={{ opacity: 0.6 }}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Add task */}
        <div style={{ display: "flex", gap: "6px", flex: "0 1 380px", minWidth: "220px" }}>
          <input
            ref={inputRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddTask()}
            placeholder="What is your next step?"
            aria-label="New task title"
            style={{
              flex: 1, padding: "8px 14px",
              background: "var(--glass-bg)", border: "1.5px solid var(--glass-border)",
              borderRadius: "10px", color: "var(--text-primary)", fontSize: "12px",
              outline: "none", transition: "border-color 0.15s",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "var(--accent-border)")}
            onBlur={e  => (e.currentTarget.style.borderColor = "var(--glass-border)")}
          />
          <button
            onClick={handleAddTask}
            disabled={!title.trim()}
            style={{
              padding: "8px 16px", borderRadius: "10px",
              background: title.trim() ? "var(--accent)" : "var(--glass-bg)",
              border: "none", color: title.trim() ? "white" : "var(--text-tertiary)",
              fontSize: "11px", fontWeight: 700,
              cursor: title.trim() ? "pointer" : "default",
              boxShadow: title.trim() ? "0 0 12px var(--accent-glow)" : "none",
              transform: adding ? "scale(0.96)" : "scale(1)",
              transition: "all 0.15s ease", whiteSpace: "nowrap",
            }}
          >
            {adding ? "…" : "+ Add"}
          </button>
        </div>
      </div>

      {/* ── Archive Panel ── */}
      {showArchive && (
        <TaskArchivePanel
          tasks={archivedTasks}
          onRestore={restoreTask}
          onDelete={deleteTask}
          onClose={() => setShowArchive(false)}
        />
      )}

      {/* ── Kanban Board ── */}
      {viewMode === "kanban" && (
      <div className="studio-task-board" data-filter={filter} role="region" aria-label="Task board" tabIndex={0} style={{
        flex: 1, display: "grid",
        gridTemplateColumns: filter === "all" ? "repeat(3, 1fr)" : "1fr",
        minHeight: 0, overflow: "hidden",
        cursor: isDraggingAny ? "grabbing" : "default",
      }}>
        {filteredStatuses.map((status, colIdx) => {
          const cfg        = STATUS_CONFIG[status]
          const colTasks   = sortTasks(rootTasks.filter(t => t.status === status), sortMode)
          const isTarget   = overCol === status && isDraggingAny

          return (
            <div
              key={status}
              className="studio-task-column"
              ref={setColRef(status)}
              style={{
                display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden",
                borderRight: colIdx < filteredStatuses.length - 1 ? "1px solid var(--glass-border)" : "none",
                background: isTarget
                  ? `linear-gradient(180deg, ${cfg.bg.replace("0.06","0.14")}, ${cfg.bg})`
                  : "transparent",
                transition: "background 0.18s ease",
                outline: isTarget ? `1.5px solid ${cfg.dot}40` : "1.5px solid transparent",
                outlineOffset: "-1.5px",
              }}
            >
              {/* Column header */}
              <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--glass-border)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0,
                background: isTarget ? cfg.bg.replace("0.06","0.12") : cfg.bg,
                transition: "background 0.18s ease",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    width: "7px", height: "7px", borderRadius: "50%",
                    background: cfg.dot, boxShadow: `0 0 6px ${cfg.dot}`,
                    display: "inline-block",
                    transform: isTarget ? "scale(1.4)" : "scale(1)",
                    transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1)",
                  }} />
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: cfg.accent }}>
                    {cfg.label}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span key={colTasks.length} style={{
                    fontSize: "10px", fontWeight: 700,
                    padding: "2px 8px", borderRadius: "20px",
                    background: cfg.glow, color: cfg.dot,
                    border: `1px solid ${cfg.dot}33`,
                    animation: "badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                  }}>
                    {colTasks.length}
                  </span>
                  {status === "done" && colTasks.length > 0 && (
                    <button
                      onClick={async () => { await archiveDone(); }}
                      title="Archive all completed tasks"
                      style={{
                        padding: "2px 8px", borderRadius: "6px", fontSize: "9px", fontWeight: 600,
                        background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                        color: "var(--text-tertiary)", cursor: "pointer",
                        transition: "all 0.12s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--accent-dim)"; e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "var(--accent-border)" }}
                      onMouseLeave={e => { e.currentTarget.style.background = "var(--glass-bg)"; e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.borderColor = "var(--glass-border)" }}
                    >📦 Archive All</button>
                  )}
                </div>
              </div>

              {/* Task list */}
              <ul style={{
                flex: 1, overflowY: "auto", overflowX: "hidden",
                padding: "8px 10px", margin: 0,
                display: "flex", flexDirection: "column", gap: "5px",
                listStyle: "none",
              }}>
                {colTasks.length === 0 ? (
                  <EmptySlot isTarget={isTarget} dot={cfg.dot} status={status} />
                ) : (
                  colTasks.map((task, index) => (
                    <TaskCard
                      key={task.id}
                      index={index}
                      task={task}
                      subtasks={getSubtasks(task.id)}
                      cfg={cfg}
                      dragging={isDragging(task.id)}
                      expanded={expandedId === task.id}
                      onToggleExpand={() => setExpandedId(expandedId === task.id ? null : task.id)}
                      onPointerDown={(e) => startDrag(task.id, status, task.title, e)}
                      onStatusChange={val => {
                        const prevTasks = useTasksStore.getState().tasks
                        useTasksStore.setState(s => ({
                          tasks: s.tasks.map(t => t.id === task.id ? { ...t, status: val } : t),
                        }))
                        updateStatus(task.id, val).catch(() => {
                          useTasksStore.setState({ tasks: prevTasks })
                        })
                      }}
                      onPriorityChange={p => updatePriority(task.id, p)}
                      onDueDateChange={d => updateDueDate(task.id, d)}
                      onDescriptionChange={d => updateDescription(task.id, d)}
                      onAddSubtask={async (t) => { await createTask(t, task.id) }}
                      onDelete={() => deleteTask(task.id)}
                      onArchive={status === "done" ? () => archiveTask(task.id) : undefined}
                      onSubtaskStatusChange={(id, st) => updateStatus(id, st)}
                      onDeleteSubtask={(id) => deleteTask(id)}
                    />
                  ))
                )}

                {isTarget && colTasks.length > 0 && (
                  <li aria-hidden style={{
                    height: "3px", borderRadius: "3px",
                    background: `linear-gradient(90deg, transparent, ${cfg.dot}, transparent)`,
                    opacity: 0.7, flexShrink: 0, margin: "2px 4px",
                  }} />
                )}
              </ul>
            </div>
          )
        })}
      </div>
      )}

      {/* ── Eisenhower Matrix ── */}
      {viewMode === "eisenhower" && (
        <EisenhowerMatrix
          tasks={rootTasks.filter(t => t.status !== "done")}
          onPriorityChange={updatePriority}
          onStatusChange={updateStatus}
          onDelete={deleteTask}
        />
      )}
    </div>
  )
}

/* ──────────────────────────────────────────
   Empty slot
────────────────────────────────────────── */
function EmptySlot({ isTarget, dot, status }: { isTarget: boolean; dot: string; status: string }) {
  const msgs: Record<string, string> = {
    todo: "No tasks yet", "in-progress": "Nothing in progress", done: "Nothing done yet",
  }
  return (
    <li style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "8px",
      minHeight: "120px",
      border: isTarget ? `2px dashed ${dot}80` : "2px dashed transparent",
      borderRadius: "12px",
      background: isTarget ? `${dot}0d` : "transparent",
      color: isTarget ? dot : "var(--text-tertiary)",
      fontSize: "11px", transition: "all 0.18s ease",
    }}>
      <span style={{
        fontSize: "22px",
        opacity: isTarget ? 1 : 0.2,
        transform: isTarget ? "scale(1.15)" : "scale(1)",
        transition: "all 0.18s cubic-bezier(0.34,1.56,0.64,1)",
        display: "inline-block",
      }}>
        {isTarget ? "⊕" : "◌"}
      </span>
      {isTarget ? "Drop here" : msgs[status]}
    </li>
  )
}

/* ──────────────────────────────────────────
   Priority Picker (inline dropdown)
────────────────────────────────────────── */
function PriorityPicker({ current, onChange }: {
  current: TaskPriority | null | undefined
  onChange: (p: TaskPriority | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  const currentCfg = current ? PRIORITY_CONFIG[current] : null

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(!open) }}
        title="Set priority"
        style={{
          padding: "2px 6px", borderRadius: "6px", fontSize: "9px", fontWeight: 700,
          background: currentCfg ? `${currentCfg.color}20` : "var(--glass-bg)",
          border: `1px solid ${currentCfg ? `${currentCfg.color}40` : "var(--glass-border)"}`,
          color: currentCfg ? currentCfg.color : "var(--text-tertiary)",
          cursor: "pointer", display: "flex", alignItems: "center", gap: "3px",
          transition: "all 0.12s",
        }}
      >
        {currentCfg ? (
          <>{currentCfg.icon} {currentCfg.short}</>
        ) : (
          <span style={{ opacity: 0.6 }}>◇ Pri</span>
        )}
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: "4px",
          background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
          borderRadius: "10px", padding: "4px", zIndex: 100,
          minWidth: "160px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          animation: "fadeIn 0.12s ease",
        }}>
          {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={e => { e.stopPropagation(); onChange(key as TaskPriority); setOpen(false) }}
              style={{
                display: "flex", alignItems: "center", gap: "8px", width: "100%",
                padding: "6px 10px", borderRadius: "7px", fontSize: "11px",
                background: current === key ? `${cfg.color}15` : "transparent",
                border: "none", color: cfg.color, cursor: "pointer",
                fontWeight: current === key ? 700 : 500,
                transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = `${cfg.color}15`)}
              onMouseLeave={e => (e.currentTarget.style.background = current === key ? `${cfg.color}15` : "transparent")}
            >
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              {current === key && <span style={{ marginLeft: "auto", fontSize: "10px" }}>✓</span>}
            </button>
          ))}
          {current && (
            <button
              onClick={e => { e.stopPropagation(); onChange(null); setOpen(false) }}
              style={{
                display: "flex", alignItems: "center", gap: "8px", width: "100%",
                padding: "6px 10px", borderRadius: "7px", fontSize: "11px",
                background: "transparent", border: "none",
                color: "var(--text-tertiary)", cursor: "pointer",
                borderTop: "1px solid var(--glass-border)", marginTop: "2px", paddingTop: "8px",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--glass-bg-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span>✕</span>
              <span>Clear priority</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────
   Due Date Picker (inline)
────────────────────────────────────────── */
function DueDateInline({ dueDate, onChange }: {
  dueDate: string | null | undefined
  onChange: (d: string | null) => void
}) {
  const today = new Date().toISOString().split("T")[0]
  const isOverdue = dueDate && dueDate < today
  const isToday = dueDate === today
  const isTomorrow = dueDate && (() => {
    const t = new Date(); t.setDate(t.getDate() + 1); return dueDate === t.toISOString().split("T")[0]
  })()

  const formatDate = (d: string) => {
    if (isToday) return "Today"
    if (isTomorrow) return "Tomorrow"
    const dt = new Date(d + "T00:00:00")
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <label style={{ position: "relative", cursor: "pointer" }}>
        <input
          type="date"
          value={dueDate || ""}
          onChange={e => onChange(e.target.value || null)}
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute", opacity: 0, width: "100%", height: "100%",
            top: 0, left: 0, cursor: "pointer",
          }}
        />
        <span style={{
          padding: "2px 6px", borderRadius: "6px", fontSize: "9px", fontWeight: 600,
          background: isOverdue ? "rgba(239,68,68,0.15)" : isToday ? "rgba(59,130,246,0.15)" : "var(--glass-bg)",
          border: `1px solid ${isOverdue ? "rgba(239,68,68,0.3)" : isToday ? "rgba(59,130,246,0.3)" : "var(--glass-border)"}`,
          color: isOverdue ? "#ef4444" : isToday ? "#3b82f6" : "var(--text-tertiary)",
          display: "flex", alignItems: "center", gap: "3px",
          transition: "all 0.12s",
        }}>
          <span style={{ fontSize: "10px" }}>📅</span>
          {dueDate ? formatDate(dueDate) : "Date"}
        </span>
      </label>
      {dueDate && (
        <button
          onClick={e => { e.stopPropagation(); onChange(null) }}
          style={{
            padding: "1px 3px", borderRadius: "4px", fontSize: "8px",
            background: "none", border: "none", color: "var(--text-tertiary)",
            cursor: "pointer", opacity: 0.5, lineHeight: 1,
          }}
          title="Clear date"
        >✕</button>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────
   Task Card (enhanced with subtasks, priority, description)
────────────────────────────────────────── */
function TaskCard({
  task, subtasks, index, cfg, dragging, expanded,
  onToggleExpand, onPointerDown, onStatusChange, onPriorityChange,
  onDueDateChange, onDescriptionChange, onAddSubtask, onDelete,
  onSubtaskStatusChange, onDeleteSubtask, onArchive,
}: {
  task: Task
  subtasks: Task[]
  index: number
  cfg: typeof STATUS_CONFIG[TaskStatus]
  dragging: boolean
  expanded: boolean
  onToggleExpand: () => void
  onPointerDown: (e: React.PointerEvent) => void
  onStatusChange: (v: TaskStatus) => void
  onPriorityChange: (p: TaskPriority | null) => void
  onDueDateChange: (d: string | null) => void
  onDescriptionChange: (d: string | null) => void
  onAddSubtask: (title: string) => Promise<void>
  onDelete: () => void
  onSubtaskStatusChange: (id: number, status: TaskStatus) => void
  onDeleteSubtask: (id: number) => void
  onArchive?: () => void
}) {
  const [hovered, setHovered]           = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [btnAnim, setBtnAnim]           = useState(false)
  const [subtaskInput, setSubtaskInput] = useState("")
  const [showSubInput, setShowSubInput] = useState(false)
  const [editingDesc, setEditingDesc]   = useState(false)
  const [descDraft, setDescDraft]       = useState(task.description || "")
  const ref = useCardEnter(index * 28)

  const isDone  = task.status === "done"
  const isDoing = task.status === "in-progress"
  const subtaskDoneCount = subtasks.filter(s => s.status === "done").length
  const hasSubtasks = subtasks.length > 0
  const priorityCfg = task.priority ? PRIORITY_CONFIG[task.priority] : null

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (deleting) return
    setDeleting(true)
    const el = ref.current
    if (el) {
      el.style.transition = "opacity 0.18s ease, transform 0.18s ease, max-height 0.22s ease, padding 0.22s ease"
      el.style.opacity    = "0"
      el.style.transform  = "translateX(12px) scale(0.95)"
      el.style.maxHeight  = "0px"
      el.style.padding    = "0"
      el.style.overflow   = "hidden"
    }
    setTimeout(() => onDelete(), 220)
  }

  const handleAdvance = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (btnAnim) return
    setBtnAnim(true)
    setTimeout(() => setBtnAnim(false), 320)
    const next = (task.status === "todo" ? "in-progress" : task.status === "in-progress" ? "done" : "todo") as TaskStatus
    onStatusChange(next)
  }

  const handleAddSubtask = async () => {
    if (!subtaskInput.trim()) return
    await onAddSubtask(subtaskInput.trim())
    setSubtaskInput("")
  }

  const handleSaveDesc = () => {
    onDescriptionChange(descDraft.trim() || null)
    setEditingDesc(false)
  }

  return (
    <li
      className="studio-task-card"
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: dragging ? "var(--accent-dim)" : hovered ? "var(--glass-bg-hover)" : "var(--glass-bg)",
        border: `1px solid ${dragging ? "var(--accent-border)" : hovered ? "var(--glass-border-strong)" : "var(--glass-border)"}`,
        borderRadius: "10px",
        padding: deleting ? "0 10px" : "0",
        boxShadow: dragging ? "0 0 0 2px var(--accent-border)" : hovered ? "0 2px 10px rgba(0,0,0,0.14)" : "none",
        transform: dragging ? "scale(0.96)" : hovered && !deleting ? "translateY(-1px)" : "translateY(0)",
        transition: "background 0.12s, border-color 0.12s, box-shadow 0.12s, transform 0.12s, opacity 0.12s",
        overflow: "hidden",
        maxHeight: deleting ? "0px" : "none",
        userSelect: "none",
        opacity: dragging ? 0.45 : 1,
        cursor: "grab",
        touchAction: "none",
        borderLeft: priorityCfg ? `3px solid ${priorityCfg.color}` : undefined,
      }}
      onPointerDown={e => {
        if ((e.target as HTMLElement).closest("button, input, textarea, select, label")) return
        onPointerDown(e)
      }}
    >
      {/* ── Main row ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "8px 10px",
      }}>
        {/* Status circle */}
        <button
          onClick={handleAdvance}
          title={task.status === "todo" ? "Start" : task.status === "in-progress" ? "Done" : "Reset"}
          style={{
            width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0,
            background: isDone ? cfg.dot : "transparent",
            border: `2px solid ${cfg.dot}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0, outline: "none",
            transition: "transform 0.18s cubic-bezier(0.34,1.56,0.64,1), background 0.15s, box-shadow 0.15s",
            transform: btnAnim ? "scale(1.35)" : "scale(1)",
            boxShadow: hovered ? `0 0 7px ${cfg.dot}70` : "none",
          }}
          onMouseEnter={e => { if (!isDone) e.currentTarget.style.background = `${cfg.dot}33` }}
          onMouseLeave={e => { if (!isDone) e.currentTarget.style.background = "transparent" }}
        >
          {isDone ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4.2 7.2L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : isDoing ? (
            <svg width="8" height="8" viewBox="0 0 8 8">
              <path d="M4 0.5 A3.5 3.5 0 0 1 7.5 4 A3.5 3.5 0 0 1 4 7.5 Z" fill={cfg.dot} />
            </svg>
          ) : null}
        </button>

        {/* Title + metadata */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "12px", fontWeight: 500, lineHeight: 1.4,
            color: isDone ? "var(--text-tertiary)" : "var(--text-primary)",
            textDecoration: isDone ? "line-through" : "none",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            transition: "color 0.18s",
          }}>
            {task.title}
          </div>

          {/* Metadata row: subtask count, description indicator */}
          {(hasSubtasks || task.description) && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px", marginTop: "2px",
              fontSize: "9px", color: "var(--text-tertiary)",
            }}>
              {hasSubtasks && (
                <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  <span style={{ fontSize: "10px" }}>⊟</span>
                  {subtaskDoneCount}/{subtasks.length}
                </span>
              )}
              {task.description && (
                <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                  <span style={{ fontSize: "10px" }}>📝</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Inline badges: priority + due date */}
        <div style={{
          display: "flex", alignItems: "center", gap: "4px", flexShrink: 0,
        }}>
          <PriorityPicker current={task.priority} onChange={onPriorityChange} />
          <DueDateInline dueDate={task.due_date} onChange={onDueDateChange} />
        </div>

        {/* Expand / actions */}
        <div style={{
          display: "flex", alignItems: "center", gap: "3px", flexShrink: 0,
          opacity: hovered && !dragging ? 1 : 0,
          transform: hovered && !dragging ? "translateX(0)" : "translateX(5px)",
          transition: "opacity 0.12s, transform 0.12s",
          pointerEvents: hovered ? "auto" : "none",
        }}>
          {/* Expand toggle */}
          <button
            onClick={e => { e.stopPropagation(); onToggleExpand() }}
            title={expanded ? "Collapse" : "Expand details"}
            style={{
              padding: "3px", borderRadius: "5px",
              background: "none", border: "none", cursor: "pointer", outline: "none",
              color: expanded ? "var(--accent)" : "var(--text-tertiary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "color 0.12s, transform 0.15s",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              fontSize: "10px",
            }}
          >
            ▾
          </button>

          {/* Drag handle */}
          <span style={{
            color: "var(--text-tertiary)", opacity: 0.5, fontSize: "12px",
            cursor: "grab", padding: "2px 3px", lineHeight: 1,
          }}>
            {"⠿"}
          </span>

          {/* Archive (for done tasks) */}
          {isDone && onArchive && (
            <button
              onClick={(e) => { e.stopPropagation(); onArchive() }}
              title="Archive"
              style={{
                padding: "3px", borderRadius: "5px",
                background: "none", border: "none", cursor: "pointer", outline: "none",
                color: "var(--text-tertiary)", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "color 0.12s, transform 0.12s",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.transform = "scale(1.2)" }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.transform = "scale(1)" }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M20 7l-2-3H6L4 7m16 0v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7m16 0H4m5 4h6" />
              </svg>
            </button>
          )}

          {/* Delete */}
          <button
            onClick={handleDelete}
            title="Delete"
            style={{
              padding: "3px", borderRadius: "5px",
              background: "none", border: "none", cursor: "pointer", outline: "none",
              color: "var(--text-tertiary)", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "color 0.12s, transform 0.12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--color-red)"; e.currentTarget.style.transform = "scale(1.2)" }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.transform = "scale(1)" }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Expanded Panel ── */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--glass-border)",
            padding: "10px 12px",
            animation: "slideDown 0.2s ease",
            overflow: "hidden",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Description */}
          <div style={{ marginBottom: "10px" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px",
            }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Description
              </span>
              {!editingDesc && (
                <button
                  onClick={() => { setDescDraft(task.description || ""); setEditingDesc(true) }}
                  style={{
                    fontSize: "9px", padding: "2px 6px", borderRadius: "5px",
                    background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                    color: "var(--text-tertiary)", cursor: "pointer",
                  }}
                >
                  {task.description ? "Edit" : "+ Add"}
                </button>
              )}
            </div>
            {editingDesc ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <textarea
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                  placeholder="Add notes or details…"
                  autoFocus
                  style={{
                    width: "100%", minHeight: "60px", padding: "8px",
                    background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                    borderRadius: "8px", color: "var(--text-primary)", fontSize: "11px",
                    outline: "none", resize: "vertical", fontFamily: "inherit",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--accent-border)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--glass-border)")}
                />
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setEditingDesc(false)}
                    style={{
                      padding: "4px 10px", borderRadius: "6px", fontSize: "10px",
                      background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                      color: "var(--text-tertiary)", cursor: "pointer",
                    }}
                  >Cancel</button>
                  <button
                    onClick={handleSaveDesc}
                    style={{
                      padding: "4px 10px", borderRadius: "6px", fontSize: "10px",
                      background: "var(--accent)", border: "none",
                      color: "white", cursor: "pointer", fontWeight: 600,
                    }}
                  >Save</button>
                </div>
              </div>
            ) : task.description ? (
              <div style={{
                fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.5,
                padding: "6px 8px", background: "var(--glass-bg)", borderRadius: "7px",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {task.description}
              </div>
            ) : (
              <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontStyle: "italic" }}>
                No description
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px",
            }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Subtasks {hasSubtasks && `(${subtaskDoneCount}/${subtasks.length})`}
              </span>
              {!showSubInput && (
                <button
                  onClick={() => setShowSubInput(true)}
                  style={{
                    fontSize: "9px", padding: "2px 6px", borderRadius: "5px",
                    background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                    color: "var(--text-tertiary)", cursor: "pointer",
                  }}
                >+ Add</button>
              )}
            </div>

            {/* Subtask progress bar */}
            {hasSubtasks && (
              <div style={{
                height: "3px", borderRadius: "3px", background: "var(--glass-border)",
                marginBottom: "8px", overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", borderRadius: "3px",
                  background: "var(--color-green)",
                  width: `${(subtaskDoneCount / subtasks.length) * 100}%`,
                  transition: "width 0.3s ease",
                }} />
              </div>
            )}

            {/* Subtask list */}
            {subtasks.map(sub => (
              <SubtaskRow
                key={sub.id}
                subtask={sub}
                onStatusChange={st => onSubtaskStatusChange(sub.id, st)}
                onDelete={() => onDeleteSubtask(sub.id)}
              />
            ))}

            {/* Add subtask input */}
            {showSubInput && (
              <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                <input
                  value={subtaskInput}
                  onChange={e => setSubtaskInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAddSubtask(); if (e.key === "Escape") setShowSubInput(false) }}
                  placeholder="Subtask name…"
                  autoFocus
                  style={{
                    flex: 1, padding: "5px 8px", fontSize: "10px",
                    background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                    borderRadius: "7px", color: "var(--text-primary)", outline: "none",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--accent-border)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--glass-border)")}
                />
                <button
                  onClick={handleAddSubtask}
                  disabled={!subtaskInput.trim()}
                  style={{
                    padding: "5px 10px", borderRadius: "7px", fontSize: "9px", fontWeight: 700,
                    background: subtaskInput.trim() ? "var(--accent)" : "var(--glass-bg)",
                    border: "none", color: subtaskInput.trim() ? "white" : "var(--text-tertiary)",
                    cursor: subtaskInput.trim() ? "pointer" : "default",
                  }}
                >Add</button>
                <button
                  onClick={() => { setShowSubInput(false); setSubtaskInput("") }}
                  style={{
                    padding: "5px 6px", borderRadius: "7px", fontSize: "9px",
                    background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
                    color: "var(--text-tertiary)", cursor: "pointer",
                  }}
                >✕</button>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

/* ──────────────────────────────────────────
   Subtask Row
────────────────────────────────────────── */
function SubtaskRow({ subtask, onStatusChange, onDelete }: {
  subtask: Task
  onStatusChange: (st: TaskStatus) => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const isDone = subtask.status === "done"

  const toggle = () => {
    onStatusChange(isDone ? "todo" : "done")
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "6px",
        padding: "4px 6px", borderRadius: "6px",
        background: hovered ? "var(--glass-bg-hover)" : "transparent",
        transition: "background 0.1s",
        marginBottom: "2px",
      }}
    >
      {/* Checkbox */}
      <button
        onClick={toggle}
        style={{
          width: "14px", height: "14px", borderRadius: "4px", flexShrink: 0,
          background: isDone ? "var(--color-green)" : "transparent",
          border: `1.5px solid ${isDone ? "var(--color-green)" : "var(--text-tertiary)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", padding: 0, outline: "none",
          transition: "all 0.15s",
        }}
      >
        {isDone && (
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4.2 7.2L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Title */}
      <span style={{
        flex: 1, fontSize: "10px", lineHeight: 1.3,
        color: isDone ? "var(--text-tertiary)" : "var(--text-secondary)",
        textDecoration: isDone ? "line-through" : "none",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {subtask.title}
      </span>

      {/* Delete */}
      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Remove subtask"
          style={{
            padding: "1px 3px", borderRadius: "4px",
            background: "none", border: "none", cursor: "pointer", outline: "none",
            color: "var(--text-tertiary)", fontSize: "9px",
            transition: "color 0.1s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--color-red)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-tertiary)")}
        >
          ✕
        </button>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────
   Eisenhower Matrix View
────────────────────────────────────────── */
const QUADRANTS: { key: TaskPriority; label: string; subtitle: string; color: string; icon: string }[] = [
  { key: "urgent-important", label: "Do First",    subtitle: "Urgent & Important", color: "#ef4444", icon: "🔴" },
  { key: "important",        label: "Schedule",    subtitle: "Important, Not Urgent", color: "#f59e0b", icon: "🟡" },
  { key: "urgent",           label: "Delegate",    subtitle: "Urgent, Not Important", color: "#3b82f6", icon: "🔵" },
  { key: "neither",          label: "Eliminate",    subtitle: "Neither",             color: "#6b7280", icon: "⚪" },
]

/* ──────────────────────────────────────────
   Task Archive Panel
────────────────────────────────────────── */
function TaskArchivePanel({ tasks, onRestore, onDelete, onClose }: {
  tasks: Task[]
  onRestore: (id: number) => void
  onDelete: (id: number) => void
  onClose: () => void
}) {
  return (
    <div style={{
      padding: "12px 28px", borderBottom: "1px solid var(--glass-border)",
      background: "var(--glass-bg)", maxHeight: 220, overflowY: "auto",
      flexShrink: 0, animation: "slideDown 0.2s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
          📦 Archived Tasks ({tasks.length})
        </span>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 12,
        }}>✕</button>
      </div>
      {tasks.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", padding: "16px 0", textAlign: "center" }}>
          No archived tasks. Completed tasks can be archived from the Done column.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {tasks.map(t => (
            <div key={t.id} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
              borderBottom: "1px solid var(--glass-border)",
            }}>
              <span style={{ fontSize: 10, color: "var(--color-green)" }}>✓</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, color: "var(--text-secondary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{t.title}</div>
                {t.completed_at && (
                  <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>
                    Completed {new Date(t.completed_at).toLocaleDateString()}
                  </div>
                )}
              </div>
              <button onClick={() => onRestore(t.id)} style={{
                padding: "3px 10px", borderRadius: 6, fontSize: 9, fontWeight: 600,
                background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
                color: "var(--accent)", cursor: "pointer",
              }}>Restore</button>
              <button onClick={() => { if (confirm(`Permanently delete "${t.title}"?`)) onDelete(t.id) }} style={{
                padding: "3px 10px", borderRadius: 6, fontSize: 9, fontWeight: 600,
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                color: "#ef4444", cursor: "pointer",
              }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────
   Eisenhower Matrix
────────────────────────────────────────── */
function EisenhowerMatrix({ tasks, onPriorityChange, onStatusChange, onDelete }: {
  tasks: Task[]
  onPriorityChange: (id: number, p: TaskPriority | null) => void
  onStatusChange: (id: number, s: TaskStatus) => void
  onDelete: (id: number) => void
}) {
  const unassigned = tasks.filter(t => !t.priority)

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      {/* Unassigned banner */}
      {unassigned.length > 0 && (
        <div style={{
          padding: "8px 16px", borderBottom: "1px solid var(--glass-border)",
          background: "var(--glass-bg)", display: "flex", alignItems: "center", gap: "8px",
          flexShrink: 0, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)" }}>
            Unassigned ({unassigned.length}):
          </span>
          {unassigned.slice(0, 8).map(t => (
            <span key={t.id} style={{
              fontSize: "10px", padding: "2px 8px", borderRadius: "6px",
              background: "var(--glass-bg-hover)", border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "4px",
            }}>
              {t.title.slice(0, 25)}{t.title.length > 25 ? "…" : ""}
              <span style={{ display: "flex", gap: "2px" }}>
                {QUADRANTS.map(q => (
                  <button key={q.key} onClick={() => onPriorityChange(t.id, q.key)} title={q.subtitle}
                    style={{
                      width: "14px", height: "14px", borderRadius: "3px", fontSize: "8px",
                      background: `${q.color}20`, border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{q.icon}</button>
                ))}
              </span>
            </span>
          ))}
          {unassigned.length > 8 && (
            <span style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>+{unassigned.length - 8} more</span>
          )}
        </div>
      )}

      {/* 2x2 Grid */}
      <div style={{
        flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr",
        minHeight: 0, overflow: "hidden",
      }}>
        {QUADRANTS.map((q, qi) => {
          const qTasks = tasks.filter(t => t.priority === q.key)
          return (
            <div key={q.key} style={{
              display: "flex", flexDirection: "column",
              borderRight: qi % 2 === 0 ? "1px solid var(--glass-border)" : "none",
              borderBottom: qi < 2 ? "1px solid var(--glass-border)" : "none",
              overflow: "hidden",
            }}>
              {/* Quadrant header */}
              <div style={{
                padding: "10px 14px", flexShrink: 0,
                borderBottom: "1px solid var(--glass-border)",
                background: `${q.color}08`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>{q.icon}</span>
                  <div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: q.color }}>{q.label}</div>
                    <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>{q.subtitle}</div>
                  </div>
                </div>
                <span style={{
                  fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "10px",
                  background: `${q.color}15`, color: q.color,
                }}>{qTasks.length}</span>
              </div>

              {/* Tasks in quadrant */}
              <div style={{
                flex: 1, overflowY: "auto", padding: "6px 8px",
                display: "flex", flexDirection: "column", gap: "4px",
              }}>
                {qTasks.length === 0 ? (
                  <div style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--text-tertiary)", fontSize: "10px", opacity: 0.5,
                  }}>
                    No tasks
                  </div>
                ) : qTasks.map(task => (
                  <MatrixTaskItem key={task.id} task={task} color={q.color}
                    onDone={() => onStatusChange(task.id, "done")}
                    onDelete={() => onDelete(task.id)}
                    onClearPriority={() => onPriorityChange(task.id, null)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MatrixTaskItem({ task, color, onDone, onDelete, onClearPriority }: {
  task: Task; color: string
  onDone: () => void; onDelete: () => void; onClearPriority: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: "6px",
        padding: "6px 8px", borderRadius: "8px",
        background: hov ? "var(--glass-bg-hover)" : "var(--glass-bg)",
        border: `1px solid ${hov ? "var(--glass-border-strong)" : "var(--glass-border)"}`,
        transition: "all 0.12s",
      }}
    >
      <button onClick={onDone} title="Mark done" style={{
        width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0,
        background: "transparent", border: `2px solid ${color}`,
        cursor: "pointer", padding: 0, outline: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.12s",
      }}
        onMouseEnter={e => (e.currentTarget.style.background = `${color}33`)}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      />
      <span style={{
        flex: 1, fontSize: "11px", fontWeight: 500, color: "var(--text-primary)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{task.title}</span>
      {task.due_date && (
        <span style={{ fontSize: "9px", color: "var(--text-tertiary)", flexShrink: 0 }}>
          📅 {task.due_date.slice(5)}
        </span>
      )}
      {hov && (
        <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
          <button onClick={onClearPriority} title="Unassign" style={{
            padding: "2px 4px", borderRadius: "4px", fontSize: "9px",
            background: "none", border: "none", color: "var(--text-tertiary)",
            cursor: "pointer",
          }}>↩</button>
          <button onClick={onDelete} title="Delete" style={{
            padding: "2px 4px", borderRadius: "4px", fontSize: "9px",
            background: "none", border: "none", color: "var(--text-tertiary)",
            cursor: "pointer",
          }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--color-red)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-tertiary)")}
          >✕</button>
        </div>
      )}
    </div>
  )
}
