use tauri::Manager;

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

/// WebView2: block page zoom but keep pinch → ctrl+wheel events for the canvas.
#[cfg(windows)]
fn configure_webview_zoom(window: &tauri::WebviewWindow) {
  let _ = window.with_webview(|webview| {
    unsafe {
      use webview2_com::Microsoft::Web::WebView2::Win32::*;
      use windows_core::Interface;

      let controller: ICoreWebView2Controller = webview.controller();
      let core = controller.CoreWebView2().expect("webview2 core");
      let settings = core.Settings().expect("webview2 settings");

      let _ = settings.SetIsZoomControlEnabled(false);
      if let Ok(s5) = settings.cast::<ICoreWebView2Settings5>() {
        let _ = s5.SetIsPinchZoomEnabled(true);
      }
      let _ = controller.SetZoomFactor(1.0);
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
    .plugin(
      tauri_plugin_snap_layout::init()
        .button_id("relay-snap-btn")
        .build(),
    )
    .invoke_handler(tauri::generate_handler![app_info])
    .setup(|app| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_title("Relay");
        #[cfg(windows)]
        {
          apply_corner_preference(&window);
          configure_webview_zoom(&window);
        }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Relay Desktop");
}
