use super::*;
use chrono::NaiveDate;
use rusqlite::Connection;

fn fixture(frequency: &str, goal: &str, target: i64, start: &str) -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("CREATE TABLE habits (id INTEGER, target_count INTEGER, goal_type TEXT, start_date TEXT, frequency TEXT, created_at TEXT); CREATE TABLE habit_logs (habit_id INTEGER, date TEXT, count INTEGER);").unwrap();
    conn.execute("INSERT INTO habits VALUES (1, ?1, ?2, ?3, ?4, '2026-09-07 00:00:00')", params![target, goal, start, frequency]).unwrap();
    conn
}
fn day(raw: &str) -> NaiveDate { NaiveDate::parse_from_str(raw, "%Y-%m-%d").unwrap() }
fn log(conn: &Connection, date: &str, count: i64) { conn.execute("INSERT INTO habit_logs VALUES (1, ?1, ?2)", params![date, count]).unwrap(); }

#[test]
fn weekly_target_aggregates_and_preserves_streak_during_pending_week() {
    let conn = fixture("weekly", "at_least", 3, "2026-09-07");
    log(&conn, "2026-09-07", 1);
    log(&conn, "2026-09-10", 2);
    let stats = habit_streak_inner(1, &conn, day("2026-09-14")).unwrap();
    assert_eq!(stats.current_streak, 1);
    assert_eq!(stats.best_streak, 1);
    assert_eq!(stats.total_completions, 1);
}
#[test]
fn future_logs_do_not_inflate_daily_or_weekly_results() {
    for frequency in ["daily", "weekly"] {
        let conn = fixture(frequency, "at_least", 1, "2026-09-07");
        log(&conn, "2026-09-07", 1);
        log(&conn, "2026-10-01", 500);
        let stats = habit_streak_inner(1, &conn, day("2026-09-07")).unwrap();
        assert_eq!(stats.total_completions, 1);
        assert!(stats.completion_rate <= 1.0);
    }
}
#[test]
fn limit_includes_equal_target_but_not_unfinished_period() {
    let conn = fixture("daily", "at_most", 2, "2026-09-09");
    log(&conn, "2026-09-09", 2);
    let stats = habit_streak_inner(1, &conn, day("2026-09-10")).unwrap();
    assert_eq!(stats.current_streak, 1);
    assert_eq!(stats.total_completions, 1);
    assert_eq!(stats.completion_rate, 1.0);
}
#[test]
fn future_start_has_no_completions() {
    let conn = fixture("weekly", "at_most", 1, "2026-10-01");
    assert_eq!(habit_streak_inner(1, &conn, day("2026-09-10")).unwrap().total_completions, 0);
}
