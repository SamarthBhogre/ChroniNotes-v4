use crate::db::Database;
use chrono::{Datelike, Duration, NaiveDateTime, NaiveTime};
use rusqlite::params;

/// Check in once per local day at/after the configured time while the app is open.
/// A failed OS delivery remains pending; successful deliveries survive restarts.
pub(super) fn deliver_due(
    db: &Database,
    now: NaiveDateTime,
    mut notify: impl FnMut(&str, &str) -> Result<(), String>,
) -> Result<(), String> {
    let date = now.date().format("%Y-%m-%d").to_string();
    let monday = (now.date() - Duration::days(now.weekday().num_days_from_monday() as i64)).format("%Y-%m-%d").to_string();
    let pending = {
        let conn = db.conn().lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT h.id, h.name, h.reminder_time FROM habits h
             WHERE h.archived = 0 AND h.reminder_time IS NOT NULL AND h.reminder_time != ''
               AND COALESCE(NULLIF(h.start_date, ''), substr(h.created_at, 1, 10), ?1) <= ?1
               AND NOT EXISTS (SELECT 1 FROM habit_reminder_deliveries d WHERE d.habit_id = h.id AND d.date = ?1)
               AND (COALESCE(h.goal_type, 'at_least') = 'at_most' OR
                 (SELECT COALESCE(SUM(l.count), 0) FROM habit_logs l WHERE l.habit_id = h.id
                    AND l.date <= ?1 AND l.date >= CASE WHEN h.frequency = 'weekly' THEN ?2 ELSE ?1 END
                    AND l.date >= COALESCE(NULLIF(h.start_date, ''), substr(h.created_at, 1, 10), ?1)) < h.target_count)"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![date, monday], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };
    for (id, name, raw_time) in pending {
        let time = match NaiveTime::parse_from_str(&raw_time, "%H:%M") {
            Ok(time) => time,
            Err(_) => continue,
        };
        if now.time() < time { continue; }
        if let Err(error) = notify("Habit check-in", &format!("Time to check in: {name}")) {
            log::warn!("Habit reminder {id} delivery failed: {error}");
            continue;
        }
        db.conn().lock().map_err(|e| e.to_string())?.execute(
            "INSERT OR IGNORE INTO habit_reminder_deliveries (habit_id, date) VALUES (?1, ?2)",
            params![id, date],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn at(raw: &str) -> NaiveDateTime { NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M").unwrap() }
    fn fixture() -> (tempfile::TempDir, Database) {
        let dir = tempfile::tempdir().unwrap();
        let db = Database::new(&dir.path().to_path_buf());
        db.conn().lock().unwrap().execute(
            "INSERT INTO habits (name, reminder_time, start_date, goal_type) VALUES ('Read', '09:00', '2026-09-10', 'at_least')", []
        ).unwrap();
        (dir, db)
    }
    #[test]
    fn successful_delivery_is_persisted_and_resets_next_day() {
        let (dir, db) = fixture();
        let mut sent = 0;
        for time in ["2026-09-10 08:59", "2026-09-10 09:00", "2026-09-10 12:00"] {
            deliver_due(&db, at(time), |_, _| { sent += 1; Ok(()) }).unwrap();
        }
        assert_eq!(sent, 1);
        drop(db);
        let reopened = Database::new(&dir.path().to_path_buf());
        deliver_due(&reopened, at("2026-09-10 18:00"), |_, _| { sent += 1; Ok(()) }).unwrap();
        assert_eq!(sent, 1);
        deliver_due(&reopened, at("2026-09-11 09:00"), |_, _| { sent += 1; Ok(()) }).unwrap();
        assert_eq!(sent, 2);
    }
    #[test]
    fn failure_retries_and_completed_or_archived_habits_are_skipped() {
        let (_dir, db) = fixture();
        deliver_due(&db, at("2026-09-10 09:00"), |_, _| Err("notification rejected".into())).unwrap();
        let count: i64 = db.conn().lock().unwrap().query_row("SELECT COUNT(*) FROM habit_reminder_deliveries", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 0);
        db.conn().lock().unwrap().execute("INSERT INTO habit_logs (habit_id, date, count) VALUES (1, '2026-09-10', 1)", []).unwrap();
        deliver_due(&db, at("2026-09-10 10:00"), |_, _| panic!("completed build goal must not notify")).unwrap();
        db.conn().lock().unwrap().execute("UPDATE habits SET archived = 1", []).unwrap();
        deliver_due(&db, at("2026-09-11 10:00"), |_, _| panic!("archived habit must not notify")).unwrap();
    }
    #[test]
    fn limit_goal_reminds_even_without_logs_and_future_start_waits() {
        let (_dir, db) = fixture();
        db.conn().lock().unwrap().execute("UPDATE habits SET goal_type = 'at_most', start_date = '2026-09-11'", []).unwrap();
        deliver_due(&db, at("2026-09-10 10:00"), |_, _| panic!("not started yet")).unwrap();
        let mut sent = 0;
        deliver_due(&db, at("2026-09-11 10:00"), |_, _| { sent += 1; Ok(()) }).unwrap();
        assert_eq!(sent, 1);
    }
}
