import assert from "node:assert/strict"
import { test } from "node:test"
import { countdownDays, habitWeekStart, localDate, moveCalendarDate, remainingSeconds } from "./scheduling.ts"

test("Sunday stays in its Monday-based habit week", () => {
  assert.equal(localDate(habitWeekStart(new Date(2026, 8, 13))), "2026-09-07")
})
test("month navigation clamps at month end", () => {
  assert.equal(localDate(moveCalendarDate(new Date(2026, 0, 31), "month", 1)), "2026-02-28")
  assert.equal(localDate(moveCalendarDate(new Date(2024, 0, 31), "month", 1)), "2024-02-29")
})
test("countdowns count calendar days across DST changes", () => {
  assert.equal(countdownDays("2026-11-02", new Date(2026, 10, 1)), 1)
  assert.equal(countdownDays("2026-03-09", new Date(2026, 2, 8)), 1)
  assert.equal(countdownDays("2026-09-10", new Date(2026, 8, 10, 23)), 0)
})
test("late timer ticks catch up with the deadline", () => {
  assert.equal(remainingSeconds(60000, 15500), 45)
  assert.equal(remainingSeconds(60000, 90000), 0)
})
