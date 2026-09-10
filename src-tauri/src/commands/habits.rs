use crate::db::Database;
use rusqlite::params;
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Habit {
    pub id: i64,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub frequency: String,
    pub target_count: i64,
    pub archived: bool,
    pub created_at: Option<String>,
    pub section: Option<String>,
    pub start_date: Option<String>,
    pub reminder_time: Option<String>,
    pub goal_type: String,
    pub sort_order: i64,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HabitLog {
    pub id: i64,
    pub habit_id: i64,
    pub date: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Clone)]
pub struct HabitStreak {
    pub habit_id: i64,
    pub current_streak: i64,
    pub best_streak: i64,
    pub total_completions: i64,
    pub completion_rate: f64, // 0.0–1.0
}

// ── Column list for SELECT (used in list + list_archived) ──

const HABIT_COLS: &str =
    "id, name, icon, color, frequency, target_count, archived, created_at, \
     section, start_date, reminder_time, goal_type, sort_order, notes";

fn row_to_habit(row: &rusqlite::Row) -> rusqlite::Result<Habit> {
    Ok(Habit {
        id: row.get(0)?,
        name: row.get(1)?,
        icon: row.get(2)?,
        color: row.get(3)?,
        frequency: row.get(4)?,
        target_count: row.get(5)?,
        archived: row.get::<_, i64>(6)? != 0,
        created_at: row.get(7)?,
        section: row.get(8)?,
        start_date: row.get(9)?,
        reminder_time: row.get(10)?,
        goal_type: row.get::<_, Option<String>>(11)?
            .unwrap_or_else(|| "at_least".to_string()),
        sort_order: row.get::<_, Option<i64>>(12)?.unwrap_or(0),
        notes: row.get(13)?,
    })
}

// ── Commands ──

#[tauri::command]
pub fn habits_create(
    name: String,
    icon: Option<String>,
    color: Option<String>,
    frequency: Option<String>,
    target_count: Option<i64>,
    section: Option<String>,
    start_date: Option<String>,
    reminder_time: Option<String>,
    goal_type: Option<String>,
    notes: Option<String>,
    db: State<Database>,
) -> Result<Habit, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Habit name must not be empty".into());
    }
    let icon = icon.unwrap_or_else(|| "✦".into());
    let color = color.unwrap_or_else(|| "#818cf8".into());
    let freq = frequency.unwrap_or_else(|| "daily".into());
    if freq != "daily" && freq != "weekly" {
        return Err(format!("Invalid frequency '{freq}'. Allowed: daily, weekly"));
    }
    let target = target_count.unwrap_or(1).max(1);
    let gt = goal_type.unwrap_or_else(|| "at_least".into());
    if gt != "at_least" && gt != "at_most" {
        return Err(format!("Invalid goal_type '{gt}'. Allowed: at_least, at_most"));
    }

    // Validate reminder_time format if provided
    if let Some(ref rt) = reminder_time {
        validate_time_format(rt)?;
    }

    // Validate start_date format if provided
    if let Some(ref sd) = start_date {
        validate_date_format(sd)?;
    }

    let section_clean = section.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty());

    let conn = db.conn().lock().map_err(|e| e.to_string())?;

    // Get next sort_order
    let max_sort: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) FROM habits",
            [],
            |r| r.get(0),
        )
        .unwrap_or(-1);

    conn.execute(
        "INSERT INTO habits (name, icon, color, frequency, target_count, section, start_date, reminder_time, goal_type, sort_order, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![name, icon, color, freq, target, section_clean, start_date, reminder_time, gt, max_sort + 1, notes],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    Ok(Habit {
        id,
        name,
        icon,
        color,
        frequency: freq,
        target_count: target,
        archived: false,
        created_at: None,
        section: section_clean.map(|s| s.to_string()),
        start_date,
        reminder_time,
        goal_type: gt,
        sort_order: max_sort + 1,
        notes,
    })
}

#[tauri::command]
pub fn habits_list(db: State<Database>) -> Result<Vec<Habit>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let sql = format!(
        "SELECT {HABIT_COLS} FROM habits WHERE archived = 0 ORDER BY sort_order ASC, created_at ASC"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row_to_habit(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn habits_list_archived(db: State<Database>) -> Result<Vec<Habit>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let sql = format!(
        "SELECT {HABIT_COLS} FROM habits WHERE archived = 1 ORDER BY created_at DESC"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| row_to_habit(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn habits_update(
    id: i64,
    name: Option<String>,
    icon: Option<String>,
    color: Option<String>,
    target_count: Option<i64>,
    frequency: Option<String>,
    section: Option<String>,
    start_date: Option<String>,
    reminder_time: Option<String>,
    goal_type: Option<String>,
    sort_order: Option<i64>,
    notes: Option<String>,
    db: State<Database>,
) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;

    // Build SET clauses dynamically
    let mut sets: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref n) = name {
        let trimmed = n.trim().to_string();
        if trimmed.is_empty() {
            return Err("Name must not be empty".into());
        }
        sets.push("name = ?".to_string());
        values.push(Box::new(trimmed));
    }
    if let Some(ref i) = icon {
        sets.push("icon = ?".to_string());
        values.push(Box::new(i.clone()));
    }
    if let Some(ref c) = color {
        sets.push("color = ?".to_string());
        values.push(Box::new(c.clone()));
    }
    if let Some(tc) = target_count {
        sets.push("target_count = ?".to_string());
        values.push(Box::new(tc.max(1)));
    }
    if let Some(ref f) = frequency {
        if f != "daily" && f != "weekly" {
            return Err(format!("Invalid frequency '{f}'. Allowed: daily, weekly"));
        }
        sets.push("frequency = ?".to_string());
        values.push(Box::new(f.clone()));
    }
    if let Some(ref s) = section {
        let cleaned = if s.trim().is_empty() {
            None
        } else {
            Some(s.trim().to_string())
        };
        sets.push("section = ?".to_string());
        values.push(Box::new(cleaned));
    }
    if let Some(ref sd) = start_date {
        if !sd.is_empty() {
            validate_date_format(sd)?;
        }
        let val = if sd.is_empty() { None } else { Some(sd.clone()) };
        sets.push("start_date = ?".to_string());
        values.push(Box::new(val));
    }
    if let Some(ref rt) = reminder_time {
        if !rt.is_empty() {
            validate_time_format(rt)?;
        }
        let val = if rt.is_empty() { None } else { Some(rt.clone()) };
        sets.push("reminder_time = ?".to_string());
        values.push(Box::new(val));
    }
    if let Some(ref gt) = goal_type {
        if gt != "at_least" && gt != "at_most" {
            return Err(format!(
                "Invalid goal_type '{gt}'. Allowed: at_least, at_most"
            ));
        }
        sets.push("goal_type = ?".to_string());
        values.push(Box::new(gt.clone()));
    }
    if let Some(so) = sort_order {
        sets.push("sort_order = ?".to_string());
        values.push(Box::new(so));
    }
    if let Some(ref n) = notes {
        let val = if n.trim().is_empty() {
            None
        } else {
            Some(n.clone())
        };
        sets.push("notes = ?".to_string());
        values.push(Box::new(val));
    }

    if sets.is_empty() {
        return Ok(()); // Nothing to update
    }

    values.push(Box::new(id));
    let sql = format!(
        "UPDATE habits SET {} WHERE id = ?",
        sets.join(", ")
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    let affected = conn.execute(&sql, params.as_slice()).map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(format!("Habit {} not found", id));
    }
    Ok(())
}

#[tauri::command]
pub fn habits_archive(id: i64, db: State<Database>) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "UPDATE habits SET archived = 1 WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(format!("Habit {} not found", id));
    }
    Ok(())
}

#[tauri::command]
pub fn habits_restore(id: i64, db: State<Database>) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "UPDATE habits SET archived = 0 WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(format!("Habit {} not found", id));
    }
    Ok(())
}

#[tauri::command]
pub fn habits_delete(id: i64, db: State<Database>) -> Result<(), String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    // Delete logs first (in case FK cascade isn't enabled)
    conn.execute(
        "DELETE FROM habit_logs WHERE habit_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    let affected = conn
        .execute("DELETE FROM habits WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(format!("Habit {} not found", id));
    }
    Ok(())
}

#[tauri::command]
pub fn habits_log(habit_id: i64, date: String, db: State<Database>) -> Result<(), String> {
    validate_date_format(&date)?;
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    // Upsert: increment count if already logged today, else insert 1
    conn.execute(
        "INSERT INTO habit_logs (habit_id, date, count) VALUES (?1, ?2, 1)
         ON CONFLICT(habit_id, date) DO UPDATE SET count = count + 1",
        params![habit_id, date],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn habits_unlog(habit_id: i64, date: String, db: State<Database>) -> Result<(), String> {
    validate_date_format(&date)?;
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    // Decrement count; delete if reaches 0
    let current: Option<i64> = conn
        .query_row(
            "SELECT count FROM habit_logs WHERE habit_id = ?1 AND date = ?2",
            params![habit_id, date],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    match current {
        Some(c) if c > 1 => {
            conn.execute(
                "UPDATE habit_logs SET count = count - 1 WHERE habit_id = ?1 AND date = ?2",
                params![habit_id, date],
            )
            .map_err(|e| e.to_string())?;
        }
        Some(_) => {
            conn.execute(
                "DELETE FROM habit_logs WHERE habit_id = ?1 AND date = ?2",
                params![habit_id, date],
            )
            .map_err(|e| e.to_string())?;
        }
        None => {}
    }
    Ok(())
}

#[tauri::command]
pub fn habits_logs_range(
    habit_id: i64,
    start_date: String,
    end_date: String,
    db: State<Database>,
) -> Result<Vec<HabitLog>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, habit_id, date, count FROM habit_logs
             WHERE habit_id = ?1 AND date >= ?2 AND date <= ?3
             ORDER BY date ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![habit_id, start_date, end_date], |row| {
            Ok(HabitLog {
                id: row.get(0)?,
                habit_id: row.get(1)?,
                date: row.get(2)?,
                count: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn habits_all_logs(
    start_date: String,
    end_date: String,
    db: State<Database>,
) -> Result<Vec<HabitLog>, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, habit_id, date, count FROM habit_logs
             WHERE date >= ?1 AND date <= ?2
             ORDER BY date ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![start_date, end_date], |row| {
            Ok(HabitLog {
                id: row.get(0)?,
                habit_id: row.get(1)?,
                date: row.get(2)?,
                count: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

/// Compute streak data for a single habit from all-time log history.
#[tauri::command]
pub fn habits_streak(habit_id: i64, db: State<Database>) -> Result<HabitStreak, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;
    habit_streak_inner(habit_id, &conn, chrono::Local::now().date_naive())
}

fn habit_streak_inner(habit_id: i64, conn: &rusqlite::Connection, today_date: chrono::NaiveDate) -> Result<HabitStreak, String> {
    // Get habit info for target
    let (target_count, goal_type, start_date, frequency): (i64, String, Option<String>, String) = conn
        .query_row(
            "SELECT target_count, COALESCE(goal_type, 'at_least'), COALESCE(NULLIF(start_date, ''), substr(created_at, 1, 10)), frequency FROM habits WHERE id = ?1",
            params![habit_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .map_err(|e| format!("Habit {} not found: {}", habit_id, e))?;

    // Get all logs sorted by date DESC for streak calculation
    let mut stmt = conn
        .prepare(
            "SELECT date, count FROM habit_logs WHERE habit_id = ?1 ORDER BY date DESC",
        )
        .map_err(|e| e.to_string())?;

    let logs: Vec<(String, i64)> = stmt
        .query_map(params![habit_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if logs.is_empty() && start_date.is_none() {
        return Ok(HabitStreak {
            habit_id,
            current_streak: 0,
            best_streak: 0,
            total_completions: 0,
            completion_rate: 0.0,
        });
    }

    let is_completed = |count: i64| -> bool {
        if goal_type == "at_most" {
            count <= target_count
        } else {
            count >= target_count
        }
    };

    // Build a map of date -> count
    let mut date_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for (date, count) in &logs {
        date_map.insert(date.clone(), *count);
    }

    // Determine the finite date range that the streak is allowed to inspect.
    let earliest = logs.last().map(|(d, _)| d.clone());
    let tracking_start = start_date
        .as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        .or_else(|| {
            earliest
                .as_deref()
                .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        })
        .unwrap_or(today_date);

    // Weekly goals are evaluated once per Monday-based calendar week.
    let weekly = frequency == "weekly";
    let period_days = if weekly { 7 } else { 1 };
    let period_start = |date: chrono::NaiveDate| {
        if weekly {
            date - chrono::Duration::days(chrono::Datelike::weekday(&date).num_days_from_monday() as i64)
        } else { date }
    };
    if weekly {
        date_map.clear();
        for (raw, count) in &logs {
            if let Ok(date) = chrono::NaiveDate::parse_from_str(raw, "%Y-%m-%d") {
                if date >= tracking_start && date <= today_date {
                    let key = period_start(date).format("%Y-%m-%d").to_string();
                    *date_map.entry(key).or_insert(0) += (*count).max(0);
                }
            }
        }
    }
    let tracking_start = period_start(tracking_start);
    // A limit goal cannot be finalized until its day/week has closed.
    let today_date = period_start(today_date) - chrono::Duration::days(if goal_type == "at_most" { period_days } else { 0 });
    let today = today_date.format("%Y-%m-%d").to_string();

    // Current streak: walk backwards in complete goal periods.
    let mut current_streak: i64 = 0;
    let mut check_date = today_date;

    while check_date >= tracking_start {
        let ds = check_date.format("%Y-%m-%d").to_string();
        let count = date_map.get(&ds).copied().unwrap_or(0);
        if is_completed(count) {
            current_streak += 1;
            check_date -= chrono::Duration::days(period_days);
        } else if ds == today && goal_type != "at_most" {
            // The current day/week may still be in progress.
            check_date -= chrono::Duration::days(period_days);
        } else {
            break;
        }
    }

    // Best streak and total completions: walk through the tracked date range.
    let mut best_streak: i64 = 0;
    let mut running: i64 = 0;
    let mut total_completions: i64 = 0;

    // Never count future logs or an unfinished limit period.
    let end_for_best = today_date;
    let mut d = tracking_start;
    while d <= end_for_best {
        let ds = d.format("%Y-%m-%d").to_string();
        let count = date_map.get(&ds).copied().unwrap_or(0);
        if is_completed(count) {
            total_completions += 1;
            running += 1;
            if running > best_streak {
                best_streak = running;
            }
        } else {
            running = 0;
        }
        d += chrono::Duration::days(period_days);
    }

    if current_streak > best_streak {
        best_streak = current_streak;
    }

    // Completion rate: total completions / total days tracked, inclusive of today.
    let total_periods = ((today_date - tracking_start).num_days() / period_days + 1).max(1);
    let completion_rate = (total_completions as f64 / total_periods as f64).min(1.0);

    Ok(HabitStreak {
        habit_id,
        current_streak,
        best_streak,
        total_completions,
        completion_rate: (completion_rate * 100.0).round() / 100.0, // round to 2 decimals
    })
}

#[cfg(test)]
#[path = "habit_streak_tests.rs"]
mod streak_regressions;

// ── Validation helpers ──

fn validate_time_format(time: &str) -> Result<(), String> {
    if time.is_empty() {
        return Ok(());
    }
    let parts: Vec<&str> = time.split(':').collect();
    if parts.len() != 2 {
        return Err(format!("Invalid time format '{time}'. Expected HH:MM"));
    }
    let h: u32 = parts[0]
        .parse()
        .map_err(|_| format!("Invalid hour in '{time}'"))?;
    let m: u32 = parts[1]
        .parse()
        .map_err(|_| format!("Invalid minute in '{time}'"))?;
    if h > 23 {
        return Err(format!("Hour must be 0-23, got {h}"));
    }
    if m > 59 {
        return Err(format!("Minute must be 0-59, got {m}"));
    }
    Ok(())
}

fn validate_date_format(date: &str) -> Result<(), String> {
    if date.is_empty() {
        return Ok(());
    }
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|_| format!("Invalid date format '{date}'. Expected YYYY-MM-DD"))?;
    Ok(())
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_time_ok() {
        assert!(validate_time_format("08:30").is_ok());
        assert!(validate_time_format("00:00").is_ok());
        assert!(validate_time_format("23:59").is_ok());
        assert!(validate_time_format("").is_ok());
    }

    #[test]
    fn validate_time_bad() {
        assert!(validate_time_format("25:00").is_err());
        assert!(validate_time_format("12:60").is_err());
        assert!(validate_time_format("noon").is_err());
        assert!(validate_time_format("1:2:3").is_err());
    }

    #[test]
    fn validate_date_ok() {
        assert!(validate_date_format("2026-03-08").is_ok());
        assert!(validate_date_format("2020-01-01").is_ok());
        assert!(validate_date_format("").is_ok());
    }

    #[test]
    fn validate_date_bad() {
        assert!(validate_date_format("03-08-2026").is_err());
        assert!(validate_date_format("not-a-date").is_err());
        assert!(validate_date_format("2026-13-01").is_err());
        assert!(validate_date_format("2026-02-30").is_err());
    }

    #[test]
    fn goal_type_validation() {
        // Valid types
        for gt in &["at_least", "at_most"] {
            assert!(
                *gt == "at_least" || *gt == "at_most",
                "valid goal type should be accepted"
            );
        }
        // Invalid types
        for bad in &["more_than", "less_than", "exactly", ""] {
            let valid = *bad == "at_least" || *bad == "at_most";
            assert!(!valid, "invalid goal type '{bad}' should be rejected");
        }
    }
}
