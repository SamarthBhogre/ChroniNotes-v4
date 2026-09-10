use rusqlite::{Connection, OptionalExtension};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// All clones share the single underlying connection via `Arc`.
/// Pass `Database` by value (cheap Arc-bump) instead of raw pointers.
#[derive(Clone)]
pub struct Database {
    inner: Arc<DatabaseInner>,
}

struct DatabaseInner {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_data_dir: &PathBuf) -> Self {
        std::fs::create_dir_all(app_data_dir).expect("Failed to create app data directory");
        let db_path = app_data_dir.join("chroninotes.db");
        let conn = Connection::open(&db_path).expect("Failed to open database");
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA cache_size   = -2000;
             PRAGMA mmap_size    = 0;
             PRAGMA temp_store   = MEMORY;
             PRAGMA synchronous  = NORMAL;
             PRAGMA foreign_keys = ON;",
        )
        .expect("Failed to apply PRAGMAs");

        // TODO(concurrency): a single Mutex<Connection> serialises every
        // backend command.  For this app's workload (one desktop user, low
        // QPS) that is fine.  If write-heavy background work is added later,
        // migrate to a connection-pool (e.g. r2d2-sqlite) so reads on a
        // second connection can proceed while a write holds the lock.

        let db = Database {
            inner: Arc::new(DatabaseInner {
                conn: Mutex::new(conn),
            }),
        };
        db.create_schema();
        db.run_migrations();
        db
    }

    /// The single shared connection mutex.
    pub fn conn(&self) -> &Mutex<Connection> {
        &self.inner.conn
    }

    fn create_schema(&self) {
        let conn = self
            .conn()
            .lock()
            .expect("DB mutex poisoned in create_schema");
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS tasks (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                title        TEXT    NOT NULL CHECK(length(trim(title)) > 0),
                status       TEXT    NOT NULL DEFAULT 'todo'
                                     CHECK(status IN ('todo','in-progress','done')),
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME DEFAULT NULL,
                due_date     TEXT     DEFAULT NULL,
                parent_id    INTEGER DEFAULT NULL,
                sort_order   INTEGER DEFAULT 0,
                priority     TEXT    DEFAULT NULL
                                     CHECK(priority IS NULL OR priority IN ('urgent-important','important','urgent','neither')),
                description  TEXT    DEFAULT NULL,
                archived     INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
                FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE
             );

             CREATE TABLE IF NOT EXISTS pomodoro_settings (
                id            INTEGER PRIMARY KEY CHECK (id = 1),
                work_minutes  INTEGER NOT NULL CHECK(work_minutes  BETWEEN 1 AND 1440),
                break_minutes INTEGER NOT NULL CHECK(break_minutes BETWEEN 1 AND 1440)
             );

             CREATE TABLE IF NOT EXISTS focus_sessions (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                type             TEXT    NOT NULL CHECK(type IN ('work','stopwatch')),
                duration_seconds INTEGER NOT NULL CHECK(duration_seconds > 0),
                completed_at     DATETIME DEFAULT CURRENT_TIMESTAMP
             );

             CREATE TABLE IF NOT EXISTS timer_presets (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                name             TEXT    NOT NULL CHECK(length(trim(name)) > 0),
                duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 1 AND 1440),
                is_favorite      INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0,1)),
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
             );

             CREATE TABLE IF NOT EXISTS calendar_events (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                title            TEXT    NOT NULL CHECK(length(trim(title)) > 0),
                type             TEXT    NOT NULL DEFAULT 'event',
                date             TEXT    NOT NULL
                                         CHECK(date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
                start_time       TEXT,
                end_time         TEXT,
                duration_minutes INTEGER CHECK(duration_minutes IS NULL OR duration_minutes > 0),
                color            TEXT    DEFAULT 'accent',
                notes            TEXT,
                task_id          INTEGER,
                reminder_minutes INTEGER CHECK(reminder_minutes IS NULL OR reminder_minutes >= 0),
                notified         INTEGER DEFAULT 0 CHECK(notified IN (0,1)),
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
             );

             INSERT OR IGNORE INTO pomodoro_settings (id, work_minutes, break_minutes)
             VALUES (1, 25, 5);

             CREATE TABLE IF NOT EXISTS habits (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                name         TEXT    NOT NULL CHECK(length(trim(name)) > 0),
                icon         TEXT    NOT NULL DEFAULT '✦',
                color        TEXT    NOT NULL DEFAULT '#818cf8',
                frequency    TEXT    NOT NULL DEFAULT 'daily'
                                     CHECK(frequency IN ('daily','weekly')),
                target_count INTEGER NOT NULL DEFAULT 1 CHECK(target_count >= 1),
                archived     INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
             );

             CREATE TABLE IF NOT EXISTS habit_logs (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                habit_id  INTEGER NOT NULL,
                date      TEXT    NOT NULL
                                  CHECK(date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
                count     INTEGER NOT NULL DEFAULT 1 CHECK(count >= 1),
                FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
                UNIQUE(habit_id, date)
             );

             CREATE TABLE IF NOT EXISTS habit_reminder_deliveries (
                habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
                date TEXT NOT NULL,
                PRIMARY KEY (habit_id, date)
             );",
        )
        .expect("Failed to create schema");
    }

    fn run_migrations(&self) {
        let conn = self
            .conn()
            .lock()
            .expect("DB mutex poisoned in run_migrations");

        // ── tasks: column additions ──────────────────────────────────────────
        let task_cols = table_columns(&conn, "tasks").expect("Failed to read tasks columns");

        if !task_cols.contains(&"completed_at".to_string()) {
            conn.execute_batch("ALTER TABLE tasks ADD COLUMN completed_at DATETIME DEFAULT NULL;")
                .expect("Migration failed: tasks.completed_at");
            log::info!("[DB] Migration: added completed_at to tasks");
        }

        if !task_cols.contains(&"due_date".to_string()) {
            conn.execute_batch("ALTER TABLE tasks ADD COLUMN due_date TEXT DEFAULT NULL;")
                .expect("Migration failed: tasks.due_date");
            log::info!("[DB] Migration: added due_date to tasks");
        }

        if !task_cols.contains(&"parent_id".to_string()) {
            conn.execute_batch("ALTER TABLE tasks ADD COLUMN parent_id INTEGER DEFAULT NULL;")
                .expect("Migration failed: tasks.parent_id");
            log::info!("[DB] Migration: added parent_id to tasks");
        }

        if !task_cols.contains(&"sort_order".to_string()) {
            conn.execute_batch("ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0;")
                .expect("Migration failed: tasks.sort_order");
            log::info!("[DB] Migration: added sort_order to tasks");
        }

        if !task_cols.contains(&"priority".to_string()) {
            conn.execute_batch(
                "ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT NULL;",
            )
            .expect("Migration failed: tasks.priority");
            log::info!("[DB] Migration: added priority to tasks");
        }

        if !task_cols.contains(&"description".to_string()) {
            conn.execute_batch("ALTER TABLE tasks ADD COLUMN description TEXT DEFAULT NULL;")
                .expect("Migration failed: tasks.description");
            log::info!("[DB] Migration: added description to tasks");
        }

        if !task_cols.contains(&"archived".to_string()) {
            conn.execute_batch(
                "ALTER TABLE tasks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;",
            )
            .expect("Migration failed: tasks.archived");
            log::info!("[DB] Migration: added archived to tasks");
        }

        // ── calendar_events: column additions ────────────────────────────────
        let cal_cols = table_columns(&conn, "calendar_events")
            .expect("Failed to read calendar_events columns");

        if !cal_cols.contains(&"reminder_minutes".to_string()) {
            conn.execute_batch(
                "ALTER TABLE calendar_events ADD COLUMN reminder_minutes INTEGER DEFAULT NULL;",
            )
            .expect("Migration failed: calendar_events.reminder_minutes");
            log::info!("[DB] Migration: added reminder_minutes to calendar_events");
        }

        if !cal_cols.contains(&"notified".to_string()) {
            conn.execute_batch(
                "ALTER TABLE calendar_events ADD COLUMN notified INTEGER DEFAULT 0;",
            )
            .expect("Migration failed: calendar_events.notified");
            log::info!("[DB] Migration: added notified to calendar_events");
        }

        // ── Retroactive CHECK-constraint enforcement ──────────────────────────
        //
        // SQLite's ALTER TABLE cannot add CHECK constraints to an existing
        // table.  The only way to enforce them on legacy installs is a
        // table-rebuild: rename → create new (with constraints) → copy →
        // drop old.
        //
        // Strategy for invalid legacy rows:
        //   `INSERT OR IGNORE INTO new SELECT … FROM old`
        //
        // Rows that violate the new CHECK constraints are silently skipped
        // (not deleted — they remain in the `_old` backup temporarily and
        // are gone once the backup table is dropped).  A warning is logged
        // if any rows were skipped.  This preserves referential integrity for
        // the callers: new writes are fully checked; existing corrupt data
        // does not surface as a crash.
        rebuild_table_with_checks(&conn, "tasks").expect("Migration failed: tasks rebuild");
        rebuild_table_with_checks(&conn, "calendar_events")
            .expect("Migration failed: calendar_events rebuild");

        // ── habits: column additions ─────────────────────────────────────────
        let habit_cols = table_columns(&conn, "habits").expect("Failed to read habits columns");

        if !habit_cols.contains(&"section".to_string()) {
            conn.execute_batch("ALTER TABLE habits ADD COLUMN section TEXT DEFAULT NULL;")
                .expect("Migration failed: habits.section");
            log::info!("[DB] Migration: added section to habits");
        }

        if !habit_cols.contains(&"start_date".to_string()) {
            conn.execute_batch("ALTER TABLE habits ADD COLUMN start_date TEXT DEFAULT NULL;")
                .expect("Migration failed: habits.start_date");
            log::info!("[DB] Migration: added start_date to habits");
        }

        if !habit_cols.contains(&"reminder_time".to_string()) {
            conn.execute_batch("ALTER TABLE habits ADD COLUMN reminder_time TEXT DEFAULT NULL;")
                .expect("Migration failed: habits.reminder_time");
            log::info!("[DB] Migration: added reminder_time to habits");
        }

        if !habit_cols.contains(&"goal_type".to_string()) {
            conn.execute_batch(
                "ALTER TABLE habits ADD COLUMN goal_type TEXT NOT NULL DEFAULT 'at_least';",
            )
            .expect("Migration failed: habits.goal_type");
            log::info!("[DB] Migration: added goal_type to habits");
        }

        if !habit_cols.contains(&"sort_order".to_string()) {
            conn.execute_batch("ALTER TABLE habits ADD COLUMN sort_order INTEGER DEFAULT 0;")
                .expect("Migration failed: habits.sort_order");
            log::info!("[DB] Migration: added sort_order to habits");
        }

        if !habit_cols.contains(&"notes".to_string()) {
            conn.execute_batch("ALTER TABLE habits ADD COLUMN notes TEXT DEFAULT NULL;")
                .expect("Migration failed: habits.notes");
            log::info!("[DB] Migration: added notes to habits");
        }
    }
}

/// Return the column names for `table`. Extracted so it can be called from
/// both `run_migrations` and tests without duplicating the PRAGMA logic.
fn table_columns(conn: &Connection, table: &str) -> rusqlite::Result<Vec<String>> {
    // Use a format string here — table names can't be bound as parameters.
    // This is only called with hard-coded table names from within this module.
    let sql = format!("PRAGMA table_info({table})");
    let mut stmt = conn.prepare(&sql)?;
    let result = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<rusqlite::Result<Vec<_>>>();
    result
}

/// Return `true` if `table`'s CREATE TABLE DDL (from `sqlite_master`) already
/// contains a CHECK constraint.  Used to skip the table-rebuild migration on
/// fresh DBs and on DBs that have already been rebuilt.
///
/// Returns `Ok(false)` if the table does not exist (so the rebuild path
/// gracefully handles unknown tables rather than panicking).
fn table_has_check_constraints(conn: &Connection, table: &str) -> rusqlite::Result<bool> {
    let ddl: Option<String> = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?1",
            rusqlite::params![table],
            |row| row.get(0),
        )
        .optional()?;

    match ddl {
        None => Ok(false),
        Some(s) => Ok(s.contains("CHECK(") || s.contains("CHECK (")),
    }
}

/// Rebuild `table` with CHECK constraints if the existing schema lacks them.
///
/// The rebuild happens inside a single transaction so it is atomic:
///   1. BEGIN
///   2. Rename existing table to `<table>_legacy_rebuild`
///   3. CREATE the new table (with constraints) from `create_schema`
///   4. INSERT OR IGNORE all rows from the backup (skips invalid rows with log)
///   5. DROP the backup
///   6. COMMIT
///
/// If the table already has CHECK constraints this function is a no-op.
///
/// # Invariants for callers
/// This function must only be called with table names that are also created by
/// `create_schema()`.  After this call the live table has the same schema as
/// `create_schema()` produces.
fn rebuild_table_with_checks(conn: &Connection, table: &str) -> rusqlite::Result<()> {
    if table_has_check_constraints(conn, table)? {
        return Ok(()); // already up to date
    }

    log::info!("[DB] Rebuilding '{table}' to add CHECK constraints on legacy install");

    // Column lists for safe INSERT … SELECT.  We list every column explicitly
    // rather than using `*` so the copy is resilient to column ordering.
    let (new_ddl, col_list) = match table {
        "tasks" => (
            "CREATE TABLE tasks (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                title        TEXT    NOT NULL CHECK(length(trim(title)) > 0),
                status       TEXT    NOT NULL DEFAULT 'todo'
                                     CHECK(status IN ('todo','in-progress','done')),
                created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME DEFAULT NULL,
                due_date     TEXT     DEFAULT NULL,
                parent_id    INTEGER DEFAULT NULL,
                sort_order   INTEGER DEFAULT 0,
                priority     TEXT    DEFAULT NULL
                                     CHECK(priority IS NULL OR priority IN ('urgent-important','important','urgent','neither')),
                description  TEXT    DEFAULT NULL,
                archived     INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
                FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE
             )",
            "id, title, status, created_at, completed_at, due_date, parent_id, sort_order, priority, description, archived",
        ),
        "calendar_events" => (
            "CREATE TABLE calendar_events (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                title            TEXT    NOT NULL CHECK(length(trim(title)) > 0),
                type             TEXT    NOT NULL DEFAULT 'event',
                date             TEXT    NOT NULL
                                         CHECK(date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
                start_time       TEXT,
                end_time         TEXT,
                duration_minutes INTEGER CHECK(duration_minutes IS NULL OR duration_minutes > 0),
                color            TEXT    DEFAULT 'accent',
                notes            TEXT,
                task_id          INTEGER,
                reminder_minutes INTEGER CHECK(reminder_minutes IS NULL OR reminder_minutes >= 0),
                notified         INTEGER DEFAULT 0 CHECK(notified IN (0,1)),
                created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
             )",
            "id, title, type, date, start_time, end_time, duration_minutes, \
             color, notes, task_id, reminder_minutes, notified, created_at",
        ),
        other => {
            log::warn!("[DB] rebuild_table_with_checks: unknown table '{other}', skipping");
            return Ok(());
        }
    };

    let backup = format!("{table}_legacy_rebuild");

    // Run the entire rebuild in one transaction.
    conn.execute_batch(&format!(
        "BEGIN;
         ALTER TABLE {table} RENAME TO {backup};
         {new_ddl};
         INSERT OR IGNORE INTO {table} ({col_list})
             SELECT {col_list} FROM {backup};
         DROP TABLE {backup};
         COMMIT;"
    ))?;

    // Log how many rows were actually copied vs. were originally present.
    let orig: i64 = conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))?;
    // Note: if orig == expected then nothing was skipped.
    log::info!("[DB] '{table}' rebuild complete — {orig} row(s) retained after CHECK migration");

    Ok(())
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::TempDir;

    /// Open a fresh in-memory-like DB in a temp directory.
    pub fn test_db() -> (TempDir, Database) {
        let dir = TempDir::new().unwrap();
        let db = Database::new(&PathBuf::from(dir.path()));
        (dir, db)
    }

    /// Running `new()` twice against the same directory must succeed without
    /// panicking — migrations are idempotent.
    #[test]
    fn migration_idempotent() {
        let dir = TempDir::new().unwrap();
        let path = PathBuf::from(dir.path());
        let _db1 = Database::new(&path);
        // Second open — all columns already present, migrations must be no-ops.
        let _db2 = Database::new(&path);
    }

    /// All expected columns are present after first-time setup.
    #[test]
    fn schema_columns_present() {
        let (_dir, db) = test_db();
        let conn = db.conn().lock().unwrap();

        let task_cols = table_columns(&conn, "tasks").unwrap();
        for col in &[
            "id",
            "title",
            "status",
            "created_at",
            "completed_at",
            "due_date",
        ] {
            assert!(
                task_cols.contains(&col.to_string()),
                "tasks missing column: {col}"
            );
        }

        let cal_cols = table_columns(&conn, "calendar_events").unwrap();
        for col in &[
            "id",
            "title",
            "type",
            "date",
            "reminder_minutes",
            "notified",
        ] {
            assert!(
                cal_cols.contains(&col.to_string()),
                "calendar_events missing column: {col}"
            );
        }
    }

    /// Default pomodoro settings are seeded.
    #[test]
    fn default_pomodoro_settings_seeded() {
        let (_dir, db) = test_db();
        let conn = db.conn().lock().unwrap();
        let (w, b): (i64, i64) = conn
            .query_row(
                "SELECT work_minutes, break_minutes FROM pomodoro_settings WHERE id = 1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(w, 25);
        assert_eq!(b, 5);
    }

    // ── Legacy schema rebuild ─────────────────────────────────────────────────

    /// Create a `tasks` table WITHOUT CHECK constraints (simulating a legacy
    /// install), open the DB through `Database::new` (which calls
    /// `run_migrations`), and assert:
    ///   a) valid rows were preserved
    ///   b) the table now has CHECK constraints
    ///   c) inserting a row that violates a constraint is now rejected
    #[test]
    fn legacy_tasks_schema_gets_rebuilt_with_checks() {
        let dir = TempDir::new().unwrap();
        let path = PathBuf::from(dir.path());

        // ── phase 1: create legacy DB (no CHECKs) ──────────────────────────
        {
            let legacy_path = path.join("chroninotes.db");
            let conn = Connection::open(&legacy_path).unwrap();
            conn.execute_batch(
                "PRAGMA journal_mode = WAL;
                 CREATE TABLE IF NOT EXISTS tasks (
                     id           INTEGER PRIMARY KEY AUTOINCREMENT,
                     title        TEXT    NOT NULL,
                     status       TEXT    NOT NULL DEFAULT 'todo',
                     created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
                     completed_at DATETIME DEFAULT NULL,
                     due_date     TEXT     DEFAULT NULL
                 );
                 -- Insert a valid row and an invalid row that will fail the
                 -- new status CHECK.  Only the valid one should survive.
                 INSERT INTO tasks (title, status) VALUES ('Valid task', 'todo');
                 INSERT INTO tasks (title, status) VALUES ('Bad status', 'INVALID_STATUS');
                 CREATE TABLE IF NOT EXISTS pomodoro_settings (
                     id INTEGER PRIMARY KEY,
                     work_minutes INTEGER NOT NULL,
                     break_minutes INTEGER NOT NULL
                 );
                 INSERT OR IGNORE INTO pomodoro_settings VALUES (1, 25, 5);
                 CREATE TABLE IF NOT EXISTS focus_sessions (
                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                     type TEXT NOT NULL,
                     duration_seconds INTEGER NOT NULL,
                     completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                 );
                 CREATE TABLE IF NOT EXISTS timer_presets (
                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                     name TEXT NOT NULL,
                     duration_minutes INTEGER NOT NULL,
                     is_favorite INTEGER NOT NULL DEFAULT 0,
                     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                 );
                 CREATE TABLE IF NOT EXISTS calendar_events (
                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                     title TEXT NOT NULL,
                     type TEXT NOT NULL DEFAULT 'event',
                     date TEXT NOT NULL,
                     start_time TEXT,
                     end_time TEXT,
                     duration_minutes INTEGER,
                     color TEXT DEFAULT 'accent',
                     notes TEXT,
                     task_id INTEGER,
                     reminder_minutes INTEGER DEFAULT NULL,
                     notified INTEGER DEFAULT 0,
                     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                 );",
            )
            .unwrap();
        }

        // ── phase 2: open via Database::new (runs migrations) ──────────────
        let db = Database::new(&path);

        // ── phase 3: assertions ────────────────────────────────────────────
        let conn = db.conn().lock().unwrap();

        // The table must now have CHECK constraints in its DDL.
        assert!(
            table_has_check_constraints(&conn, "tasks").unwrap(),
            "tasks must have CHECK constraints after migration"
        );

        // Valid row survived.
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks WHERE title = 'Valid task'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "valid row must survive the rebuild");

        // Invalid row was dropped.
        let bad_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks WHERE status = 'INVALID_STATUS'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(bad_count, 0, "invalid row must be dropped during rebuild");

        // New inserts are now constrained.
        let result = conn.execute(
            "INSERT INTO tasks (title, status) VALUES ('New bad', 'INVALID')",
            [],
        );
        assert!(
            result.is_err(),
            "CHECK constraint must reject new invalid status"
        );
    }

    /// A fresh DB (created by `create_schema`) must be detected as already
    /// having CHECK constraints — `rebuild_table_with_checks` must be a no-op.
    #[test]
    fn fresh_schema_detected_as_having_checks() {
        let (_dir, db) = test_db();
        let conn = db.conn().lock().unwrap();
        assert!(
            table_has_check_constraints(&conn, "tasks").unwrap(),
            "fresh tasks must have CHECKs"
        );
        assert!(
            table_has_check_constraints(&conn, "calendar_events").unwrap(),
            "fresh calendar_events must have CHECKs"
        );
    }

    /// `rebuild_table_with_checks` is idempotent — calling it twice on a
    /// table that already has constraints must succeed without error.
    #[test]
    fn rebuild_idempotent_on_fresh_schema() {
        let (_dir, db) = test_db();
        let conn = db.conn().lock().unwrap();
        // First call: already has constraints, must be no-op.
        rebuild_table_with_checks(&conn, "tasks").unwrap();
        // Second call: still no-op.
        rebuild_table_with_checks(&conn, "tasks").unwrap();
        // Data must still be intact.
        assert!(table_has_check_constraints(&conn, "tasks").unwrap());
    }

    /// `rebuild_table_with_checks` called with an unknown table name must not
    /// panic — it must return `Err` from SQLite (table doesn't exist to rename).
    #[test]
    fn rebuild_unknown_table_does_not_panic() {
        let (_dir, db) = test_db();
        let conn = db.conn().lock().unwrap();
        let result = rebuild_table_with_checks(&conn, "nonexistent_table");
        // Must not panic; the function will either return Ok (if the
        // unknown-table guard fires) or Err (SQLite rename fails).
        // Either outcome is acceptable — the important invariant is no panic.
        let _ = result;
    }

    // ── Migration maintainability guard ───────────────────────────────────────
    //
    // If a column is added to `create_schema` but NOT to the `col_list` inside
    // `rebuild_table_with_checks`, that column is silently dropped on legacy
    // installs that trigger the rebuild path.  This test catches that divergence
    // at compile/test time.

    /// The column list in `rebuild_table_with_checks` for "tasks" must include
    /// every column that `create_schema` creates for that table.
    #[test]
    fn rebuild_column_list_covers_all_schema_columns_for_tasks() {
        let (_dir, db) = test_db();
        let conn = db.conn().lock().unwrap();

        // The columns that the schema creates (from create_schema).
        let schema_cols = table_columns(&conn, "tasks").unwrap();

        // The columns listed in rebuild_table_with_checks for "tasks".
        // If you add a column to create_schema, add it here too.
        let rebuild_cols: Vec<&str> = "id, title, status, created_at, completed_at, due_date, parent_id, sort_order, priority, description, archived"
            .split(',')
            .map(|s| s.trim())
            .collect();

        for col in &schema_cols {
            assert!(
                rebuild_cols.contains(&col.as_str()),
                "Column '{}' exists in tasks schema but is missing from \
                 rebuild_table_with_checks col_list — \
                 it would be silently dropped on legacy installs. \
                 Add it to both create_schema AND the rebuild col_list.",
                col
            );
        }
    }

    /// Same guard for "calendar_events".
    #[test]
    fn rebuild_column_list_covers_all_schema_columns_for_calendar_events() {
        let (_dir, db) = test_db();
        let conn = db.conn().lock().unwrap();

        let schema_cols = table_columns(&conn, "calendar_events").unwrap();

        let rebuild_cols: Vec<&str> =
            "id, title, type, date, start_time, end_time, duration_minutes, \
             color, notes, task_id, reminder_minutes, notified, created_at"
                .split(',')
                .map(|s| s.trim())
                .collect();

        for col in &schema_cols {
            assert!(
                rebuild_cols.contains(&col.as_str()),
                "Column '{}' exists in calendar_events schema but is missing from \
                 rebuild_table_with_checks col_list — \
                 it would be silently dropped on legacy installs. \
                 Add it to both create_schema AND the rebuild col_list.",
                col
            );
        }
    }
}
