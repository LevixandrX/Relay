use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone)]
pub(crate) struct Diagnostics(Arc<Mutex<Option<PathBuf>>>);

impl Diagnostics {
    pub(crate) fn new(dir: Option<PathBuf>) -> Self {
        Self(Arc::new(Mutex::new(dir.map(|dir| dir.join("webview.log")))))
    }

    // Only call with internal event labels and numeric error codes.
    pub(crate) fn record(&self, event: impl std::fmt::Display) {
        eprintln!("[Relay] {event}");
        let Ok(path) = self.0.lock() else { return };
        let Some(path) = path.as_ref() else { return };
        if let Some(dir) = path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if fs::metadata(path).is_ok_and(|meta| meta.len() >= 64 * 1024) {
            let _ = fs::write(path, []);
        }
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default();
            let _ = writeln!(file, "{} {event}", timestamp.as_secs());
        }
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum FailureStage {
    Module,
    Render,
}

#[tauri::command]
pub(crate) fn report_desktop_failure(
    stage: FailureStage,
    diagnostics: tauri::State<'_, Diagnostics>,
) {
    diagnostics.record(match stage {
        FailureStage::Module => "desktop module load failed",
        FailureStage::Render => "desktop react render failed",
    });
}
