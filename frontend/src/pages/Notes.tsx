import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import RichEditor from "../components/editor/RichEditor"
import NotesSidebar from "../components/notes/NotesSidebar"
import { useNotesStore, type Difficulty } from "../store/notes.store"
import StudioHeader from "../components/StudioHeader"
import "../studios.css"

/* ── Difficulty config (used by folder cards) ── */
const DIFF_CFG: Record<NonNullable<Difficulty>, { label: string; color: string; bg: string; border: string }> = {
  easy:   { label: "Easy",   color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)"  },
  medium: { label: "Medium", color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)"  },
  hard:   { label: "Hard",   color: "#f87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)" },
}

export default function Notes() {
  const { activeNoteId, notes, saving, fetchNoteContent, updateNote, createNote } = useNotesStore()
  const activeNote = notes.find(n => n.id === activeNoteId)

  const [loadedContent, setLoadedContent] = useState<any>(null)
  const [contentReady, setContentReady]   = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(true)

  /* load content whenever active note changes */
  useEffect(() => {
    setContentReady(false); setLoadedContent(null)
    if (!activeNoteId || activeNote?.isFolder) return
    fetchNoteContent(activeNoteId).then(entry => {
      if (entry) { setLoadedContent(entry.content ?? { type: "doc", content: [] }); setContentReady(true) }
    })
  }, [activeNoteId])

  /* breadcrumb */
  const breadcrumb: { id: string; title: string; icon: string }[] = []
  if (activeNote) {
    let cur = activeNote
    breadcrumb.unshift({ id: cur.id, title: cur.title, icon: cur.icon })
    while (cur.parentId) {
      const parent = notes.find(n => n.id === cur.parentId)
      if (!parent) break
      breadcrumb.unshift({ id: parent.id, title: parent.title, icon: parent.icon })
      cur = parent
    }
  }

  return (
    <div className="studio-notes" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", color: "var(--text-primary)" }}>
      <StudioHeader eyebrow="YOUR KNOWLEDGE STUDIO" title="Give your ideas a home."
        description="Capture a spark, connect your thinking, and make something worth keeping."
        stats={[{ label: "Pages", value: notes.filter(note => !note.isFolder).length }, { label: "Folders", value: notes.filter(note => note.isFolder).length }]} />

      {/* ──────────────────────────────────────
          TOP NAV BAR  (breadcrumb + New button)
      ────────────────────────────────────── */}
      <div className="studio-notes-toolbar" style={{
        flexShrink: 0, height: "40px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--glass-border)",
        display: "flex", alignItems: "center",
        padding: "0 14px", gap: "8px",
      }}>
        <button className="studio-library-toggle" aria-expanded={libraryOpen} aria-controls="studio-note-library"
          onClick={() => setLibraryOpen(open => !open)}>{libraryOpen ? "Hide library" : "Show library"}</button>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: "3px", flex: 1, minWidth: 0, overflow: "hidden" }}>
          {breadcrumb.length === 0 ? (
            <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontStyle: "italic" }}>No page selected</span>
          ) : breadcrumb.map((crumb, i) => (
            <span key={crumb.id} style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: i < breadcrumb.length - 1 ? 0 : 1, minWidth: 0 }}>
              {i > 0 && <span style={{ color: "var(--text-tertiary)", opacity: 0.4, fontSize: "11px" }}>/</span>}
              {i < breadcrumb.length - 1 ? (
                <button onClick={() => useNotesStore.getState().setActiveNote(crumb.id)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "2px 5px", borderRadius: "5px",
                  fontSize: "11px", color: "var(--text-tertiary)",
                  whiteSpace: "nowrap", transition: "background 0.1s, color 0.1s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.color = "var(--text-secondary)" }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-tertiary)" }}
                >
                  <span>{crumb.icon}</span><span>{crumb.title}</span>
                </button>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", minWidth: 0 }}>
                  <span style={{ flexShrink: 0 }}>{crumb.icon}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{crumb.title}</span>
                </span>
              )}
            </span>
          ))}
        </div>

        {/* New page button — creates inside active folder if one is open */}
        <button onClick={() => createNote(activeNote?.isFolder ? activeNote.id : null)} title="New page" style={{
          height: "26px", padding: "0 10px", borderRadius: "7px", flexShrink: 0,
          background: "var(--accent-dim)", border: "1px solid var(--accent-border)",
          color: "var(--accent)", fontSize: "11px", fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", gap: "4px",
          transition: "box-shadow 0.12s",
        }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 10px var(--accent-glow)"}
          onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
        >
          <span style={{ fontSize: "13px", lineHeight: 1 }}>+</span> New
        </button>
      </div>

      {/* ──────────────────────────────────────
          SIDEBAR + CONTENT ROW
      ────────────────────────────────────── */}
      <div className="studio-notes-row" data-library-open={libraryOpen} style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Keep the library mounted so its loading and selection state survive toggling. */}
        <div id="studio-note-library" className="studio-library" hidden={!libraryOpen} style={{ width: "240px", flexShrink: 0, height: "100%" }}>
          <NotesSidebar />
        </div>

        {/* Content pane — fills all remaining space */}
        <div className="studio-writing-pane" style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {activeNoteId && activeNote && !activeNote.isFolder && contentReady ? (
            /* ── Full-height RichEditor (owns title bar + toolbar + scroll area) ── */
            <RichEditor
              key={activeNoteId}
              noteId={activeNoteId}
              content={loadedContent}
              title={activeNote.title}
              icon={activeNote.icon}
              tags={activeNote.tags}
              difficulty={activeNote.difficulty}
              saving={saving}
              onSave={json => updateNote(activeNoteId, { content: json })}
              onTitleChange={t  => updateNote(activeNoteId, { title: t })}
              onIconChange={ic  => updateNote(activeNoteId, { icon: ic })}
            />

          ) : activeNote?.isFolder ? (
            <FolderView
              note={activeNote}
              allNotes={notes}
              childNotes={notes.filter(n => n.parentId === activeNote.id).sort((a, b) => a.sortOrder - b.sortOrder)}
              onOpenNote={id => useNotesStore.getState().setActiveNote(id)}
              onCreateNote={() => createNote(activeNote.id, false)}
              onCreateFolder={() => useNotesStore.getState().createFolder(activeNote.id)}
            />
          ) : (
            <EmptyState onCreate={() => createNote(null)} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════
   useFolderDrag — same window-listener pattern as Tasks.tsx
══════════════════════════════════════ */
type FolderDragState = {
  id: string; title: string
  startX: number; startY: number; curX: number; curY: number
  active: boolean
}

function useFolderDrag(onDrop: (dragId: string, targetId: string, pos: "before" | "after") => void) {
  const [drag, setDrag]       = useState<FolderDragState | null>(null)
  const [overId, setOverId]   = useState<string | null>(null)
  const [overPos, setOverPos] = useState<"before" | "after">("before")
  const cardRefs = useRef<Record<string, HTMLDivElement>>({})
  const ghostRef = useRef<HTMLDivElement | null>(null)

  /* ghost */
  useEffect(() => {
    if (!drag?.active) { ghostRef.current?.remove(); ghostRef.current = null; return }
    if (!ghostRef.current) {
      const g = document.createElement("div")
      g.style.cssText = `position:fixed;z-index:9999;pointer-events:none;padding:6px 12px;border-radius:9px;background:var(--glass-bg-hover);border:1.5px solid var(--accent-border);box-shadow:0 8px 28px rgba(0,0,0,0.45);font-size:12px;font-weight:500;color:var(--text-primary);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transform:rotate(1.5deg) scale(1.04);opacity:0.92;`
      g.textContent = drag.title
      document.body.appendChild(g)
      ghostRef.current = g
    }
    return () => { ghostRef.current?.remove(); ghostRef.current = null }
  }, [drag?.active])

  /* global listeners */
  useEffect(() => {
    if (!drag) return
    const THRESHOLD = 6
    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY
      const moved = Math.sqrt(dx*dx + dy*dy) > THRESHOLD
      setDrag(d => d ? { ...d, curX: e.clientX, curY: e.clientY, active: d.active || moved } : null)
      if (ghostRef.current) { ghostRef.current.style.left = `${e.clientX + 14}px`; ghostRef.current.style.top = `${e.clientY - 16}px` }
      if (moved || drag.active) {
        let fId: string | null = null, fPos: "before" | "after" = "before"
        for (const [id, el] of Object.entries(cardRefs.current)) {
          if (!el) continue
          const r = el.getBoundingClientRect()
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
            fId = id; fPos = e.clientX < r.left + r.width / 2 ? "before" : "after"; break
          }
        }
        setOverId(fId); setOverPos(fPos)
      }
    }
    const onUp = (e: PointerEvent) => {
      if (drag.active) {
        let tId: string | null = null, tPos: "before" | "after" = "before"
        for (const [id, el] of Object.entries(cardRefs.current)) {
          if (!el) continue
          const r = el.getBoundingClientRect()
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
            tId = id; tPos = e.clientX < r.left + r.width / 2 ? "before" : "after"; break
          }
        }
        if (tId && tId !== drag.id) onDrop(drag.id, tId, tPos)
      }
      ghostRef.current?.remove(); ghostRef.current = null
      setDrag(null); setOverId(null)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup",   onUp)
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp) }
  }, [drag, onDrop])

  const startCardDrag = useCallback((id: string, title: string, e: React.PointerEvent) => {
    e.preventDefault()
    setDrag({ id, title, startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY, active: false })
  }, [])
  const registerCard   = useCallback((id: string, el: HTMLDivElement | null) => { if (el) cardRefs.current[id] = el; else delete cardRefs.current[id] }, [])
  const isDragging     = (id: string) => drag?.id === id && drag.active
  const isDraggingAny  = drag?.active === true
  return { startCardDrag, registerCard, overId, overPos, isDragging, isDraggingAny }
}

/* ══════════════════════════════════════
   FOLDER VIEW
══════════════════════════════════════ */
function FolderView({ note, allNotes, childNotes, onOpenNote, onCreateNote, onCreateFolder }: {
  note: any; allNotes: any[]; childNotes: any[]
  onOpenNote: (id: string) => void
  onCreateNote: () => void
  onCreateFolder: () => void
}) {
  const { reorderNote, deleteNote } = useNotesStore()
  const folderChildren = childNotes.filter(n => n.isFolder)
  const pageChildren   = childNotes.filter(n => !n.isFolder)
  const totalDeep      = countDeep(note.id, allNotes)

  /* multi-select */
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  // Shift+click: enter select mode + toggle the item in one gesture
  const shiftSelect  = (id: string) => { setSelectMode(true); setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  const clearSel     = () => { setSelected(new Set()); setSelectMode(false) }
  const selectAll    = () => setSelected(new Set(childNotes.map(n => n.id)))
  const massDelete   = () => { selected.forEach(id => deleteNote(id)); clearSel() }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSel()
      // Delete works whenever items are selected — no need to toggle select mode first
      if (selected.size > 0 && (e.key === "Delete" || e.key === "Backspace")) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === "INPUT" || tag === "TEXTAREA") return
        e.preventDefault()
        massDelete()
      }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [selectMode, selected])

  const handleDrop = useCallback((dragId: string, targetId: string, pos: "before" | "after") => {
    reorderNote(dragId, targetId, pos)
  }, [reorderNote])

  const { startCardDrag, registerCard, overId, isDragging, isDraggingAny } = useFolderDrag(handleDrop)

  return (
    <div className="studio-folder" style={{ flex: 1, overflow: "auto", padding: "28px 36px", cursor: isDraggingAny ? "grabbing" : "default" }}>
      {/* ── Folder hero ── */}
      <div className="studio-folder-hero" style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "20px", padding: "20px 24px", borderRadius: "16px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "14px", flexShrink: 0, background: "var(--accent-dim)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px" }}>{note.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px", letterSpacing: "-0.4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.title}</h2>
          <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "var(--text-tertiary)" }}>
            <span>{childNotes.length} item{childNotes.length !== 1 ? "s" : ""}</span>
            {totalDeep > childNotes.length && <span>{totalDeep} total</span>}
            <span>{pageChildren.length} page{pageChildren.length !== 1 ? "s" : ""}</span>
            <span>{folderChildren.length} subfolder{folderChildren.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", flexShrink: 0, alignItems: "center" }}>
          {/* Select mode toggle */}
          <button onClick={() => { setSelectMode(s => !s); setSelected(new Set()) }} title="Multi-select"
            style={{ height: "32px", padding: "0 12px", borderRadius: "9px", background: selectMode ? "var(--accent-dim)" : "var(--glass-bg)", border: `1px solid ${selectMode ? "var(--accent-border)" : "var(--glass-border)"}`, color: selectMode ? "var(--accent)" : "var(--text-secondary)", fontSize: "11px", fontWeight: 600, cursor: "pointer", transition: "all 0.12s", display: "flex", alignItems: "center", gap: "4px" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Select
          </button>
          <button onClick={onCreateNote} style={{ height: "32px", padding: "0 14px", borderRadius: "9px", background: "var(--accent)", border: "none", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", boxShadow: "0 0 12px var(--accent-glow)", transition: "transform 0.12s" }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >+ Page</button>
          <button onClick={onCreateFolder} style={{ height: "32px", padding: "0 14px", borderRadius: "9px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", color: "var(--text-secondary)", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-bg-hover)"; e.currentTarget.style.color = "var(--text-primary)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--glass-bg)"; e.currentTarget.style.color = "var(--text-secondary)" }}
          >+ Folder</button>
        </div>
      </div>

      {/* ── Mass-select action bar ── */}
      {selectMode && (
        <div style={{ marginBottom: "14px", padding: "8px 14px", borderRadius: "10px", background: "var(--accent-dim)", border: "1px solid var(--accent-border)", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)", flex: 1 }}>{selected.size} selected</span>
          <FolderMassBtn label="All"    onClick={selectAll} />
          <FolderMassBtn label="None"   onClick={() => setSelected(new Set())} />
          <div style={{ width: "1px", height: "14px", background: "var(--accent-border)" }} />
          <FolderMassBtn label="Delete selected" onClick={massDelete} danger disabled={selected.size === 0} />
          <button onClick={clearSel} style={{ width: "18px", height: "18px", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* ── Sub-folders ── */}
      {folderChildren.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <SectionLabel>Folders</SectionLabel>
          <div className="studio-folder-grid">
            {folderChildren.map(child => (
              <FolderCard key={child.id} note={child}
                childCount={allNotes.filter(n => n.parentId === child.id).length}
                isOver={overId === child.id && !isDragging(child.id)}
                isDragging={isDragging(child.id)}
                isSelected={selected.has(child.id)}
                selectMode={selectMode}
                onPointerDown={e => startCardDrag(child.id, child.title, e)}
                ref={el => registerCard(child.id, el)}
                onClick={e => e.shiftKey ? shiftSelect(child.id) : selectMode ? toggleSelect(child.id) : onOpenNote(child.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Pages ── */}
      {pageChildren.length > 0 && (
        <div>
          <SectionLabel>Pages</SectionLabel>
          <div className="studio-folder-grid">
            {pageChildren.map(child => (
              <NoteCard key={child.id} note={child}
                isOver={overId === child.id && !isDragging(child.id)}
                isDragging={isDragging(child.id)}
                isSelected={selected.has(child.id)}
                selectMode={selectMode}
                onPointerDown={e => startCardDrag(child.id, child.title, e)}
                ref={el => registerCard(child.id, el)}
                onClick={e => e.shiftKey ? shiftSelect(child.id) : selectMode ? toggleSelect(child.id) : onOpenNote(child.id)}
              />
            ))}
          </div>
        </div>
      )}

      {childNotes.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-tertiary)", fontSize: "13px" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.15 }}>◌</div>
          This folder is empty — create a page or subfolder above
        </div>
      )}
    </div>
  )
}

function countDeep(id: string, all: any[]): number {
  const direct = all.filter(n => n.parentId === id)
  return direct.length + direct.filter(n => n.isFolder).reduce((s, n) => s + countDeep(n.id, all), 0)
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "8px" }}>{children}</div>
}
function FolderMassBtn({ label, onClick, danger, disabled }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: "3px 9px", borderRadius: "6px", fontSize: "10px", fontWeight: 600, cursor: disabled ? "default" : "pointer", border: "none", background: danger ? (disabled ? "rgba(248,113,113,0.06)" : "rgba(248,113,113,0.18)") : "rgba(255,255,255,0.06)", color: danger ? (disabled ? "rgba(248,113,113,0.4)" : "var(--color-red)") : "var(--accent)", opacity: disabled ? 0.5 : 1, transition: "all 0.1s" }}>
      {label}
    </button>
  )
}

/* ── Card components — forwardRef so useFolderDrag can registerCard ── */
interface CardProps {
  note: any; isOver: boolean; isDragging: boolean
  isSelected: boolean; selectMode: boolean
  onPointerDown: (e: React.PointerEvent) => void
  onClick: (e: React.MouseEvent | React.KeyboardEvent) => void
}

const FolderCard = forwardRef<HTMLDivElement, CardProps & { childCount: number }>(
  ({ note, childCount, isOver, isDragging, isSelected, selectMode, onPointerDown, onClick }, ref) => {
    const [hov, setHov] = useState(false)
    return (
      <div ref={ref} className="studio-note-card" role="button" tabIndex={0}
        aria-label={note.title} aria-pressed={selectMode ? isSelected : undefined} data-dragging={isDragging}
        onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick(event) } }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        onPointerDown={onPointerDown} onClick={onClick}
        style={{
          padding: "12px 14px", borderRadius: "12px",
          background: isSelected ? "var(--accent-dim)" : hov ? "var(--glass-bg-hover)" : "var(--glass-bg)",
          border: `2px solid ${isOver ? "var(--accent)" : isSelected ? "var(--accent-border)" : hov ? "var(--glass-border-strong)" : "var(--glass-border)"}`,
          cursor: selectMode ? "pointer" : "grab",
          display: "flex", alignItems: "center", gap: "10px",
          transition: "all 0.14s ease",
          opacity: isDragging ? 0.35 : 1,
          userSelect: "none", touchAction: "none",
          boxShadow: isOver ? "0 0 0 3px var(--accent-glow)" : "none",
        }}>
        {selectMode && (
          <span style={{ width: "14px", height: "14px", borderRadius: "3px", border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--text-tertiary)"}`, background: isSelected ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.1s" }}>
            {isSelected && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.2 5.7L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </span>
        )}
        <span style={{ fontSize: "18px", flexShrink: 0 }}>{note.icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.title}</div>
          <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "1px" }}>{childCount} item{childCount !== 1 ? "s" : ""}</div>
        </div>
      </div>
    )
  }
)

const TAG_PALETTE_N = ["#818cf8","#60a5fa","#34d399","#fbbf24","#f472b6","#a78bfa","#38bdf8","#fb923c"]
function tagColorN(t: string) { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) & 0xffff; return TAG_PALETTE_N[h % TAG_PALETTE_N.length] }

const NoteCard = forwardRef<HTMLDivElement, CardProps>(
  ({ note, isOver, isDragging, isSelected, selectMode, onPointerDown, onClick }, ref) => {
    const [hov, setHov] = useState(false)
    const diffCfg = note.difficulty ? DIFF_CFG[note.difficulty as NonNullable<Difficulty>] : null
    return (
      <div ref={ref} className="studio-note-card" role="button" tabIndex={0}
        aria-label={note.title} aria-pressed={selectMode ? isSelected : undefined} data-dragging={isDragging}
        onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick(event) } }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        onPointerDown={onPointerDown} onClick={onClick}
        style={{
          padding: "14px", borderRadius: "12px",
          background: isSelected ? "var(--accent-dim)" : hov ? "var(--glass-bg-hover)" : "var(--glass-bg)",
          border: `2px solid ${isOver ? "var(--accent)" : isSelected ? "var(--accent-border)" : hov ? "var(--glass-border-strong)" : "var(--glass-border)"}`,
          cursor: selectMode ? "pointer" : "grab",
          transform: hov && !isDragging && !selectMode ? "translateY(-2px)" : "none",
          boxShadow: isOver ? "0 0 0 3px var(--accent-glow)" : hov ? "0 4px 18px rgba(0,0,0,0.15)" : "none",
          transition: "all 0.14s ease",
          opacity: isDragging ? 0.35 : 1,
          userSelect: "none", touchAction: "none",
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "7px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {selectMode && (
              <span style={{ width: "14px", height: "14px", borderRadius: "3px", border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--text-tertiary)"}`, background: isSelected ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.1s" }}>
                {isSelected && <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.2 5.7L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
            )}
            <span style={{ fontSize: "18px" }}>{note.icon}</span>
          </div>
          {diffCfg && <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "5px", background: diffCfg.bg, color: diffCfg.color }}>{diffCfg.label}</span>}
        </div>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: note.tags?.length ? "7px" : 0 }}>
          {note.title}
        </div>
        {note.tags?.length > 0 && (
          <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
            {note.tags.slice(0, 4).map((t: string) => (
              <span key={t} style={{ padding: "1px 6px", borderRadius: "20px", background: tagColorN(t) + "22", color: tagColorN(t), fontSize: "9px", fontWeight: 600 }}>#{t}</span>
            ))}
          </div>
        )}
      </div>
    )
  }
)

/* ══════════════════════════════════════
   EMPTY STATE
══════════════════════════════════════ */
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="studio-notes-empty" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: "320px" }}>
        <div style={{ width: "72px", height: "72px", borderRadius: "20px", margin: "0 auto 24px", background: "var(--glass-bg)", border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px", opacity: 0.3 }}>◉</div>
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px", letterSpacing: "-0.2px" }}>A blank page. Endless possibilities.</h2>
        <p style={{ fontSize: "12px", color: "var(--text-tertiary)", lineHeight: 1.7, marginBottom: "24px" }}>
          Select a page from the sidebar or create a new one.<br />
          Drag images in · type <code style={{ color: "var(--accent)", background: "var(--accent-dim)", padding: "1px 5px", borderRadius: "4px" }}>/link</code> to connect pages<br />
          · use <code style={{ color: "var(--accent)", background: "var(--accent-dim)", padding: "1px 5px", borderRadius: "4px" }}>⊞ Tabs</code> for multi-file code blocks.
        </p>
        <button onClick={onCreate} style={{ padding: "10px 24px", borderRadius: "12px", background: "var(--accent)", border: "none", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer", boxShadow: "0 0 16px var(--accent-glow)", display: "inline-flex", alignItems: "center", gap: "6px", transition: "transform 0.12s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px) scale(1.02)"}
          onMouseLeave={e => e.currentTarget.style.transform = "none"}
        >
          <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Create a new page
        </button>
      </div>
    </div>
  )
}
