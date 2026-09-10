import { create } from "zustand"
import { localDate, moveCalendarDate } from "../lib/scheduling"

let eventsRequest = 0

export type EventType = "event" | "reminder" | "focus" | "task"

export type CalendarEvent = {
  id: number
  title: string
  type: EventType
  date: string           // "YYYY-MM-DD"
  start_time?: string | null
  end_time?: string | null
  duration_minutes?: number | null
  color?: string | null
  notes?: string | null
  task_id?: number | null
  reminder_minutes?: number | null
  notified?: number | null
  created_at?: string
}

export type CalendarView = "month" | "week" | "day" | "agenda"

export type ActiveDate = {
  date: string
  type: EventType
}

type CalendarStore = {
  /* ── View state ── */
  view: CalendarView
  setView: (v: CalendarView) => void

  /* ── Navigation ── */
  currentDate: Date        // anchor date for current view
  selectedDate: string     // "YYYY-MM-DD" — date clicked by user
  setCurrentDate: (d: Date) => void
  setSelectedDate: (d: string) => void
  goToPrev: () => void
  goToNext: () => void
  goToToday: () => void

  /* ── Events data ── */
  events: CalendarEvent[]
  activeDates: ActiveDate[]   // dates with events (for dot indicators)
  loadEvents: (month: string) => Promise<void>
  loadEventsByDate: (date: string) => Promise<CalendarEvent[]>
  loadActiveDates: (month: string) => Promise<void>
  createEvent: (event: Omit<CalendarEvent, "id" | "created_at">) => Promise<void>
  updateEvent: (id: number, fields: Partial<CalendarEvent>) => Promise<void>
  deleteEvent: (id: number) => Promise<void>
}

// Use local date components instead of toISOString() which returns UTC.
// At e.g. 00:33 IST (UTC+5:30) toISOString() would still return the
// previous UTC date, making "today" point to yesterday.
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  view: "month",
  setView: (v) => set({ view: v }),

  currentDate: new Date(),
  selectedDate: todayStr(),
  setCurrentDate: (d) => set({ currentDate: d }),
  setSelectedDate: (d) => set({ selectedDate: d, currentDate: new Date(`${d}T12:00:00`) }),

  goToPrev: () => {
    const { view, currentDate } = get()
    const d = moveCalendarDate(currentDate, view, -1)
    set({ currentDate: d, selectedDate: localDate(d) })
  },

  goToNext: () => {
    const { view, currentDate } = get()
    const d = moveCalendarDate(currentDate, view, 1)
    set({ currentDate: d, selectedDate: localDate(d) })
  },

  goToToday: () => {
    set({ currentDate: new Date(), selectedDate: todayStr() })
  },

  events: [],
  activeDates: [],

  loadEvents: async (month) => {
    const request = ++eventsRequest
    const months = new Set([month])
    const { view, currentDate } = get()
    if (view === "week") {
      const start = new Date(currentDate)
      start.setDate(start.getDate() - start.getDay())
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      months.add(localDate(start).slice(0, 7))
      months.add(localDate(end).slice(0, 7))
    }
    const batches = await Promise.all([...months].map(m => window.electron.invoke("calendar:list", m) as Promise<CalendarEvent[]>))
    if (request === eventsRequest) set({ events: batches.flat() })
  },

  loadEventsByDate: async (date) => {
    return await window.electron.invoke("calendar:listByDate", date) as CalendarEvent[]
  },

  loadActiveDates: async (month) => {
    const data = await window.electron.invoke("calendar:activeDates", month) as ActiveDate[]
    set({ activeDates: data })
  },

  createEvent: async (event) => {
    await window.electron.invoke("calendar:create", event)
    const month = event.date.slice(0, 7)
    const [events, activeDates] = await Promise.all([
      window.electron.invoke("calendar:list", month) as Promise<CalendarEvent[]>,
      window.electron.invoke("calendar:activeDates", month) as Promise<ActiveDate[]>,
    ])
    set({ events, activeDates })
  },

  updateEvent: async (id, fields) => {
    await window.electron.invoke("calendar:update", { id, ...fields })
    const month = (fields.date ?? get().events.find(e => e.id === id)?.date ?? todayStr()).slice(0, 7)
    const [events, activeDates] = await Promise.all([
      window.electron.invoke("calendar:list", month) as Promise<CalendarEvent[]>,
      window.electron.invoke("calendar:activeDates", month) as Promise<ActiveDate[]>,
    ])
    set({ events, activeDates })
  },

  deleteEvent: async (id) => {
    const ev    = get().events.find(e => e.id === id)
    const month = ev?.date?.slice(0, 7) ?? todayStr().slice(0, 7)
    await window.electron.invoke("calendar:delete", id)
    const [events, activeDates] = await Promise.all([
      window.electron.invoke("calendar:list", month) as Promise<CalendarEvent[]>,
      window.electron.invoke("calendar:activeDates", month) as Promise<ActiveDate[]>,
    ])
    set({ events, activeDates })
  },
}))
