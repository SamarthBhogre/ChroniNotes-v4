import { habitWeekStart, localDate } from "./scheduling.ts"

type Goal = { frequency: string; goal_type: string; target_count: number; start_date?: string | null; created_at?: string }
export function habitDayComplete(habit: Goal, date: string, today: string, countOn: (date: string) => number) {
  const start = habit.start_date || habit.created_at?.slice(0, 10) || today
  if (date < start || date > today) return false
  let count = countOn(date)
  if (habit.frequency === "weekly") {
    const day = new Date(`${date}T12:00:00`)
    if (day.getDay() !== 0) return false
    const cursor = habitWeekStart(day)
    count = 0
    for (let i = 0; i < 7; i++) {
      const key = localDate(cursor)
      if (key >= start && key <= today) count += countOn(key)
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  return habit.goal_type === "at_most" ? date < today && count <= habit.target_count : count >= habit.target_count
}
