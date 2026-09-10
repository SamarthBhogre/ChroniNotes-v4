use crate::commands::calendar;
use crate::db::Database;
use chrono::TimeZone;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri_plugin_notification::NotificationExt;

#[path = "habit_reminders.rs"]
mod habit_reminders;

/// Set to `true` while a scheduler thread is alive.
/// `compare_exchange` prevents double-spawn even on fast app restart.
static SCHEDULER_RUNNING: AtomicBool = AtomicBool::new(false);

/// Spawn the background notification scheduler.
///
/// Returns `Ok(ShutdownHandle)` on the first call.  The caller **must** store
/// the handle for the full app lifetime (e.g. in Tauri managed state) — a
/// dropped handle does NOT stop the scheduler.  Call `request_shutdown()` to
/// stop it explicitly.
///
/// Returns `Err("scheduler already running")` if a scheduler thread is
/// already active.  This is the safe path: it is always wrong to silently
/// hand out a disconnected handle that controls no thread.
pub fn spawn_notification_scheduler(
    app: tauri::AppHandle,
    db: Database,
) -> Result<ShutdownHandle, String> {
    let shutdown = Arc::new(AtomicBool::new(false));

    // Attempt to claim the RUNNING flag.  If another thread already set it,
    // reject the call rather than return a handle attached to a dead Arc.
    if SCHEDULER_RUNNING
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("Notification scheduler is already running".to_string());
    }

    let shutdown_clone = Arc::clone(&shutdown);

    std::thread::spawn(move || {
        log::info!("[Notifications] Scheduler started");

        loop {
            // Poll shutdown every second so the thread stops promptly when asked.
            for _ in 0..30 {
                if shutdown_clone.load(Ordering::Relaxed) {
                    log::info!("[Notifications] Shutdown signal received — stopping");
                    SCHEDULER_RUNNING.store(false, Ordering::SeqCst);
                    return;
                }
                std::thread::sleep(std::time::Duration::from_secs(1));
            }

            if let Err(e) = check_and_notify(&app, &db) {
                log::error!("[Notifications] Check error: {}", e);
            }
            if let Err(e) = habit_reminders::deliver_due(&db, chrono::Local::now().naive_local(), |title, body| {
                app.notification().builder().title(title).body(body).show().map_err(|e| e.to_string())
            }) {
                log::error!("[Notifications] Habit check error: {}", e);
            }
        }
    });

    Ok(ShutdownHandle(shutdown))
}

/// Opaque handle to the scheduler thread.
///
/// Store this in Tauri managed state for the full app lifetime.
/// The scheduler keeps running until `request_shutdown()` is called.
/// Dropping the handle does NOT stop the scheduler — this is intentional
/// so that accidental scope-end drops during setup do not kill the thread.
#[allow(dead_code)]
#[derive(Debug)]
pub struct ShutdownHandle(Arc<AtomicBool>);

impl ShutdownHandle {
    /// Signal the scheduler thread to stop cleanly.
    /// The thread will exit within the next polling second.
    #[allow(dead_code)]
    pub fn request_shutdown(&self) {
        self.0.store(true, Ordering::Relaxed);
    }

    /// Whether a shutdown has been requested on this handle.
    #[cfg(test)]
    pub fn is_shutdown_requested(&self) -> bool {
        self.0.load(Ordering::Relaxed)
    }

    /// Reset the global `SCHEDULER_RUNNING` flag.  Only for use in tests
    /// that need to call `spawn_notification_scheduler` more than once in the
    /// same process without a real scheduler thread alive.
    #[cfg(test)]
    pub fn reset_global_flag_for_test() {
        SCHEDULER_RUNNING.store(false, Ordering::SeqCst);
    }
}

// ─── Internal ────────────────────────────────────────────────────────────────

fn check_and_notify(app: &tauri::AppHandle, db: &Database) -> Result<(), String> {
    let now = chrono::Local::now();
    let today_str = now.format("%Y-%m-%d").to_string();

    let events = calendar::get_pending_notifications(db, &today_str)
        .map_err(|e| format!("DB query failed: {}", e))?;

    log::debug!(
        "[Notifications] Tick at {} — {} pending event(s)",
        now.format("%H:%M:%S"),
        events.len()
    );

    for event in events {
        let reminder_minutes = match event.reminder_minutes {
            Some(m) => m,
            None => continue,
        };

        let start_time = match &event.start_time {
            Some(t) => t.clone(),
            None => continue,
        };

        let datetime_str = if start_time.len() <= 5 {
            format!("{}T{}:00", event.date, start_time)
        } else {
            format!("{}T{}", event.date, start_time)
        };

        let event_time =
            match chrono::NaiveDateTime::parse_from_str(&datetime_str, "%Y-%m-%dT%H:%M:%S") {
                Ok(dt) => dt,
                Err(e) => {
                    log::warn!(
                        "[Notifications] Cannot parse datetime '{}' for event #{} '{}': {}",
                        datetime_str,
                        event.id,
                        event.title,
                        e
                    );
                    continue;
                }
            };

        let event_local = match chrono::Local.from_local_datetime(&event_time).single() {
            Some(dt) => dt,
            None => {
                log::warn!(
                    "[Notifications] Ambiguous local datetime for event #{} '{}'",
                    event.id,
                    event.title
                );
                continue;
            }
        };

        let notify_at = event_local - chrono::Duration::minutes(reminder_minutes);

        log::debug!(
            "[Notifications] Event #{} '{}' event_at={} notify_at={} now={}",
            event.id,
            event.title,
            event_local.format("%Y-%m-%d %H:%M"),
            notify_at.format("%Y-%m-%d %H:%M"),
            now.format("%Y-%m-%d %H:%M"),
        );

        // Fire inside [notify_at, event_start + 5 min) to tolerate missed ticks.
        let grace = event_local + chrono::Duration::minutes(5);
        if now >= notify_at && now < grace {
            let diff_minutes = (event_local - now).num_minutes().max(0);
            let body = if diff_minutes <= 0 {
                format!("{} is starting now!", event.title)
            } else if diff_minutes < 60 {
                format!(
                    "{} starts in {} minute{}",
                    event.title,
                    diff_minutes,
                    if diff_minutes == 1 { "" } else { "s" }
                )
            } else {
                let hours = diff_minutes / 60;
                let mins = diff_minutes % 60;
                if mins == 0 {
                    format!(
                        "{} starts in {} hour{}",
                        event.title,
                        hours,
                        if hours == 1 { "" } else { "s" }
                    )
                } else {
                    format!("{} starts in {}h {}m", event.title, hours, mins)
                }
            };

            let type_label = match event.event_type.as_str() {
                "reminder" => "⏰ Reminder",
                "focus" => "🎯 Focus Session",
                "task" => "📋 Task Due",
                _ => "📅 Event",
            };
            let title = format!("{} — {}", type_label, format_time_12h(&start_time));

            match app
                .notification()
                .builder()
                .title(&title)
                .body(&body)
                .show()
            {
                Ok(_) => log::info!("[Notifications] ✅ Sent: {} — {}", title, body),
                Err(e) => {
                    log::error!("[Notifications] ❌ Failed for event #{}: {}", event.id, e);
                    continue; // don't mark notified — retry next cycle
                }
            }

            calendar::mark_notified(db, event.id);
        }
    }

    Ok(())
}

fn format_time_12h(time: &str) -> String {
    let parts: Vec<&str> = time.split(':').collect();
    if parts.len() < 2 {
        return time.to_string();
    }
    let h: i32 = parts[0].parse().unwrap_or(0);
    let m: i32 = parts[1].parse().unwrap_or(0);
    let ampm = if h >= 12 { "PM" } else { "AM" };
    let h12 = if h % 12 == 0 { 12 } else { h % 12 };
    format!("{}:{:02} {}", h12, m, ampm)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::Ordering;

    // ── ShutdownHandle unit tests ─────────────────────────────────────────────

    /// Dropping a `ShutdownHandle` must NOT set the shutdown flag.
    #[test]
    fn shutdown_handle_drop_does_not_signal() {
        let flag = Arc::new(AtomicBool::new(false));
        let handle = ShutdownHandle(Arc::clone(&flag));
        drop(handle);
        assert!(
            !flag.load(Ordering::Relaxed),
            "Dropping ShutdownHandle must NOT set the shutdown flag"
        );
    }

    /// `request_shutdown()` must flip the flag.
    #[test]
    fn shutdown_handle_explicit_request_sets_flag() {
        let flag = Arc::new(AtomicBool::new(false));
        let handle = ShutdownHandle(Arc::clone(&flag));
        handle.request_shutdown();
        assert!(
            flag.load(Ordering::Relaxed),
            "request_shutdown() must set the shutdown flag to true"
        );
    }

    /// `is_shutdown_requested()` must reflect the current flag state.
    #[test]
    fn is_shutdown_requested_tracks_flag() {
        let flag = Arc::new(AtomicBool::new(false));
        let handle = ShutdownHandle(Arc::clone(&flag));
        assert!(!handle.is_shutdown_requested());
        handle.request_shutdown();
        assert!(handle.is_shutdown_requested());
    }

    // ── Duplicate-spawn guard ─────────────────────────────────────────────────

    /// A second call to `spawn_notification_scheduler` while one is already
    /// running must return `Err(...)` rather than a disconnected handle.
    ///
    /// We can't spawn a real scheduler in a unit test (no AppHandle), so we
    /// directly test the `SCHEDULER_RUNNING` guard path by setting the flag
    /// manually and resetting it in a finally-style guard.
    #[test]
    fn second_spawn_returns_err_when_already_running() {
        // Simulate the scheduler being active by setting the flag directly.
        SCHEDULER_RUNNING.store(true, Ordering::SeqCst);

        // Build a dummy Arc that mimics what a real first spawn would return.
        let first_flag = Arc::new(AtomicBool::new(false));

        // The second spawn attempt must fail.  We replicate the guard logic
        // here because we cannot call `spawn_notification_scheduler` without
        // a real AppHandle.
        let result: Result<ShutdownHandle, String> = if SCHEDULER_RUNNING
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            Err("Notification scheduler is already running".to_string())
        } else {
            Ok(ShutdownHandle(Arc::clone(&first_flag)))
        };

        assert!(result.is_err(), "Second spawn must return Err");
        assert!(
            result.unwrap_err().contains("already running"),
            "Error message must describe the cause"
        );

        // Clean up so other tests in the process are unaffected.
        ShutdownHandle::reset_global_flag_for_test();
    }

    /// After `request_shutdown()`, the handle must report shutdown is requested
    /// and the flag observed through a clone of the Arc must be `true`.
    #[test]
    fn shutdown_propagates_through_arc_clone() {
        let flag = Arc::new(AtomicBool::new(false));
        let observer = Arc::clone(&flag); // simulates what the thread holds
        let handle = ShutdownHandle(flag);
        assert!(!observer.load(Ordering::Relaxed), "should start false");
        handle.request_shutdown();
        assert!(
            observer.load(Ordering::Relaxed),
            "thread's copy must see true"
        );
    }

    // ── format_time_12h ───────────────────────────────────────────────────────

    #[test]
    fn format_time_12h_noon() {
        assert_eq!(format_time_12h("12:00"), "12:00 PM");
    }

    #[test]
    fn format_time_12h_midnight() {
        assert_eq!(format_time_12h("00:00"), "12:00 AM");
    }

    #[test]
    fn format_time_12h_afternoon() {
        assert_eq!(format_time_12h("14:30"), "2:30 PM");
    }

    #[test]
    fn format_time_12h_morning() {
        assert_eq!(format_time_12h("09:05"), "9:05 AM");
    }

    #[test]
    fn format_time_12h_invalid_returns_input() {
        assert_eq!(format_time_12h("bad"), "bad");
    }
}
