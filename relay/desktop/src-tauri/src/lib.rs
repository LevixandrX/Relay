use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

mod diagnostics;
#[cfg(windows)]
mod webview_recovery;

/// The destination always comes from the native Save dialog, never from JS.
#[tauri::command]
async fn save_code(window: tauri::WebviewWindow, name: String, text: String) -> Result<bool, String> {
  if text.len() > 5 * 1024 * 1024 { return Err("Code is too large".into()); }
  let name: String = name.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '.' || *c == '-' || *c == '_').take(80).collect();
  tauri::async_runtime::spawn_blocking(move || {
    let Some(file) = window.dialog().file().set_file_name(if name.is_empty() { "code.txt" } else { &name }).blocking_save_file() else { return Ok(false); };
    let path = file.into_path().map_err(|error| error.to_string())?;
    std::fs::write(path, text).map_err(|error| error.to_string())?;
    Ok(true)
  }).await.map_err(|error| error.to_string())?
}

#[cfg(windows)]
fn apply_corner_preference(window: &tauri::WebviewWindow) {
  use windows_sys::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE};

  let Ok(hwnd) = window.hwnd() else {
    return;
  };
  let preference: u32 = 2; // DWMWCP_ROUND
  unsafe {
    let _ = DwmSetWindowAttribute(
      hwnd.0 as _,
      DWMWA_WINDOW_CORNER_PREFERENCE as u32,
      &preference as *const u32 as *const _,
      std::mem::size_of::<u32>() as u32,
    );
  }
}

/// Configure WebView2 lifecycle and leave pinch → ctrl+wheel events for the canvas.
#[cfg(windows)]
fn configure_webview(window: &tauri::WebviewWindow, diagnostics: diagnostics::Diagnostics) {
  let hwnd = window.hwnd().ok().map(|hwnd| hwnd.0 as usize);
  let _ = window.with_webview(move |webview| {
    unsafe {
      use webview2_com::Microsoft::Web::WebView2::Win32::*;
      use windows_core::Interface;

      let controller: ICoreWebView2Controller = webview.controller();
      let Ok(core) = controller.CoreWebView2() else { return };
      if let Ok(settings) = core.Settings() {
        let _ = settings.SetIsZoomControlEnabled(false);
        if let Ok(s5) = settings.cast::<ICoreWebView2Settings5>() {
          let _ = s5.SetIsPinchZoomEnabled(true);
        }
      }
      let _ = controller.SetZoomFactor(1.0);
      if let Some(hwnd) = hwnd {
        webview_recovery::install(hwnd as _, controller, core, diagnostics);
      }
    }
  });
}

#[tauri::command]
fn app_info() -> serde_json::Value {
  serde_json::json!({
    "name": "Relay Desktop",
    "version": env!("CARGO_PKG_VERSION"),
    "engine": "tauri2"
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(
      tauri_plugin_snap_layout::init()
        .button_id("relay-snap-btn")
        .build(),
    )
    .invoke_handler(tauri::generate_handler![app_info, save_code, diagnostics::report_desktop_failure])
    .setup(|app| {
      let diagnostics = diagnostics::Diagnostics::new(app.path().app_log_dir().ok());
      app.manage(diagnostics.clone());
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title("Relay");
        #[cfg(windows)]
        {
          apply_corner_preference(&window);
          configure_webview(&window, diagnostics);
        }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Relay Desktop");
}
