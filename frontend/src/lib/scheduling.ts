import { addMonths, differenceInCalendarDays, format, startOfWeek } from "date-fns"

export const localDate = (date: Date) => format(date, "yyyy-MM-dd")
export const countdownDays = (date: string, now = new Date()) => differenceInCalendarDays(new Date(`${date}T12:00:00`), now)
export const habitWeekStart = (date: Date) => startOfWeek(date, { weekStartsOn: 1 })
export function moveCalendarDate(date: Date, view: string, direction: number) {
  if (view === "month" || view === "agenda") return addMonths(date, direction)
  const next = new Date(date)
  next.setDate(next.getDate() + direction * (view === "week" ? 7 : 1))
  return next
}
export const remainingSeconds = (deadline: number, now: number) => Math.max(0, Math.ceil((deadline - now) / 1000))
