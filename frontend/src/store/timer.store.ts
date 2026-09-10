import { create } from "zustand"
import { playTimerComplete, playBreakStart } from "../lib/sounds"
import { useUserStore } from "./user.store"
import { remainingSeconds } from "../lib/scheduling"

type Mode = "work" | "break" | "stopwatch" | "timer"

type TimerState = {
  mode:      Mode
  seconds:   number
  isRunning: boolean
  isPaused:  boolean
  tool:      "pomodoro" | "stopwatch" | "timer"   // ← Added "timer"

  workMinutes:   number
  breakMinutes:  number
  customMinutes: number   // ← NEW: custom timer duration

  setTool:         (tool: "pomodoro" | "stopwatch" | "timer") => void
  setCustom:       (minutes: number) => void   // ← NEW
  start:           () => Promise<void>
  pause:           () => Promise<void>
  stop:            () => Promise<void>
  loadSettings:    () => Promise<void>
  updateSettings:  (w: number, b: number) => Promise<void>
  updateFromMain:  (data: { seconds: number; mode: Mode }) => void
}

export const useTimerStore = create<TimerState>((set, get) => ({
  mode:      "work",
  seconds:   0,
  isRunning: false,
  isPaused:  false,
  tool:      "pomodoro",

  workMinutes:   25,
  breakMinutes:  5,
  customMinutes: 10,   // ← NEW: default 10 min

  setTool: (tool) => {
    if (get().isRunning || get().isPaused) return
    set({ tool, seconds: 0, mode: tool === "timer" ? "timer" : tool === "stopwatch" ? "stopwatch" : "work" })
  },

  setCustom: (minutes) => set({ customMinutes: minutes }),   // ← NEW

  start: async () => {
    const { tool, customMinutes } = get()
    if (tool === "pomodoro" && get().mode === "work") {
      useUserStore.getState().setStatus("working")
    }
    
    // For custom timer, set initial seconds before starting
    if (tool === "timer" && !get().isPaused) {
      set({ seconds: customMinutes * 60, mode: "timer" })
    }
    
    set({ isRunning: true, isPaused: false })
    
    // Only call IPC for pomodoro/stopwatch — custom timer runs client-side
    if (tool === "pomodoro" || tool === "stopwatch") {
      await window.electron.invoke(`${tool}:start`)
    } else if (tool === "timer") {
      // Start client-side countdown
      startClientTimer()
    }
  },

  pause: async () => {
    const { tool } = get()
    if (tool === "pomodoro") {
      useUserStore.getState().setStatus("idle")
    }
    set({ isRunning: false, isPaused: true })
    
    if (tool === "pomodoro" || tool === "stopwatch") {
      await window.electron.invoke(`${tool}:pause`)
    } else if (tool === "timer") {
      stopClientTimer()
    }
  },

  stop: async () => {
    const { tool } = get()
    if (tool === "pomodoro") {
      useUserStore.getState().setStatus("idle")
    }
    set({ isRunning: false, isPaused: false, seconds: 0, mode: "work" })
    
    if (tool === "pomodoro" || tool === "stopwatch") {
      await window.electron.invoke(`${tool}:stop`)
    } else if (tool === "timer") {
      stopClientTimer()
    }
  },

  loadSettings: async () => {
    const s = await window.electron.invoke("pomodoro:getSettings") as { workMinutes: number; breakMinutes: number }
    set({ workMinutes: s.workMinutes, breakMinutes: s.breakMinutes })
  },

  updateSettings: async (w, b) => {
    await window.electron.invoke("pomodoro:updateSettings", {
      workMinutes:  w,
      breakMinutes: b,
    })
    set({ workMinutes: w, breakMinutes: b })
  },

  updateFromMain: (data) => {
    const prev = useTimerStore.getState()
    if (prev.mode === "work" && data.mode === "break") playBreakStart()
    if (prev.mode === "break" && data.mode === "work") playTimerComplete()
    if (prev.mode !== data.mode) {
      useUserStore.getState().setStatus(data.mode === "work" ? "working" : "idle")
    }
    set({ seconds: data.seconds, mode: data.mode })
  },
}))

/* ═══════════════════════════════════
   CLIENT-SIDE TIMER (no backend)
═══════════════════════════════════ */
let clientTimerInterval: ReturnType<typeof setInterval> | null = null
let clientDeadline = 0

function startClientTimer() {
  if (clientTimerInterval) return
  clientDeadline = Date.now() + useTimerStore.getState().seconds * 1000

  clientTimerInterval = setInterval(() => {
    const state = useTimerStore.getState()
    
    if (!state.isRunning || state.tool !== "timer") {
      stopClientTimer()
      return
    }
    
    const newSeconds = remainingSeconds(clientDeadline, Date.now())
    useTimerStore.setState({ seconds: newSeconds })
    
    // Auto-stop when timer reaches 0
    if (newSeconds === 0) {
      stopClientTimer()
      useTimerStore.setState({ isRunning: false, isPaused: false })
      playTimerComplete()
      
      // Send notification via Tauri bridge
      try {
        window.electron.invoke("timer:notify", {
          title: "⏱️ Timer Complete",
          body: "Your custom timer has finished!",
        })
      } catch (_) {}
    }
  }, 1000)
}

function stopClientTimer() {
  if (clientTimerInterval) {
    clearInterval(clientTimerInterval)
    clientTimerInterval = null
  }
}
