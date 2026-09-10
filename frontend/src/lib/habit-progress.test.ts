import assert from "node:assert/strict"
import { test } from "node:test"
import { habitDayComplete } from "./habit-progress.ts"

const goal = { frequency: "daily", goal_type: "at_least", target_count: 3, start_date: "2026-09-07" }
test("a partial log is not a completed daily goal", () => {
  assert.equal(habitDayComplete(goal, "2026-09-09", "2026-09-10", () => 1), false)
  assert.equal(habitDayComplete(goal, "2026-09-09", "2026-09-10", () => 3), true)
})
test("weekly results aggregate on Sunday only", () => {
  const weekly = { ...goal, frequency: "weekly" }
  const counts = (day: string) => day === "2026-09-07" ? 1 : day === "2026-09-10" ? 2 : 0
  assert.equal(habitDayComplete(weekly, "2026-09-10", "2026-09-14", counts), false)
  assert.equal(habitDayComplete(weekly, "2026-09-13", "2026-09-14", counts), true)
})
test("limit goals accept the target after the period closes", () => {
  const limit = { ...goal, goal_type: "at_most" }
  assert.equal(habitDayComplete(limit, "2026-09-09", "2026-09-10", () => 3), true)
  assert.equal(habitDayComplete(limit, "2026-09-10", "2026-09-10", () => 0), false)
  assert.equal(habitDayComplete(limit, "2026-09-09", "2026-09-10", () => 4), false)
})
test("future and pre-start dates cannot complete", () => {
  assert.equal(habitDayComplete(goal, "2026-09-11", "2026-09-10", () => 20), false)
  assert.equal(habitDayComplete(goal, "2026-09-06", "2026-09-10", () => 20), false)
})
