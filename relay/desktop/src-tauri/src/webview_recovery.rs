use crate::diagnostics::Diagnostics;
use std::{
    cell::Cell,
    ptr::null,
    time::{Duration, Instant},
};
use webview2_com::{
    Microsoft::Web::WebView2::Win32::{
        ICoreWebView2, ICoreWebView2Controller, COREWEBVIEW2_PROCESS_FAILED_KIND,
        COREWEBVIEW2_PROCESS_FAILED_KIND_GPU_PROCESS_EXITED,
        COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED,
        COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE,
        COREWEBVIEW2_WEB_ERROR_STATUS, COREWEBVIEW2_WEB_ERROR_STATUS_OPERATION_CANCELED,
    },
    NavigationCompletedEventHandler, ProcessFailedEventHandler,
};
use windows_core::BOOL;
use windows_sys::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    Graphics::Gdi::{RedrawWindow, RDW_ALLCHILDREN, RDW_INVALIDATE},
    System::Power::{
        RegisterSuspendResumeNotification, UnregisterSuspendResumeNotification, HPOWERNOTIFY,
    },
    UI::{
        Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass},
        WindowsAndMessaging::{
            IsIconic, IsWindowVisible, KillTimer, SetTimer, DEVICE_NOTIFY_WINDOW_HANDLE,
            PBT_APMRESUMEAUTOMATIC, PBT_APMRESUMESUSPEND, SIZE_MINIMIZED, WA_INACTIVE, WM_ACTIVATE,
            WM_ACTIVATEAPP, WM_DISPLAYCHANGE, WM_NCDESTROY, WM_POWERBROADCAST, WM_SHOWWINDOW,
            WM_SIZE, WM_TIMER,
        },
    },
};

const SUBCLASS_ID: usize = 0x524C_5900;
const PRESENT_TIMER: usize = SUBCLASS_ID + 1;
const RELOAD_TIMER: usize = SUBCLASS_ID + 2;
const GPU_TIMER: usize = SUBCLASS_ID + 3;
const SETTLE_MS: u32 = 300;

struct Surface {
    controller: ICoreWebView2Controller,
    core: ICoreWebView2,
    present_pending: Cell<bool>,
    power_notification: HPOWERNOTIFY,
    failure_token: Option<i64>,
    navigation_token: Option<i64>,
    diagnostics: Diagnostics,
}

/// Called on the WebView's UI thread, with a live parent HWND.
pub(super) unsafe fn install(
    hwnd: HWND,
    controller: ICoreWebView2Controller,
    core: ICoreWebView2,
    diagnostics: Diagnostics,
) {
    let power_notification = RegisterSuspendResumeNotification(hwnd, DEVICE_NOTIFY_WINDOW_HANDLE);
    let mut surface = Box::new(Surface {
        controller,
        core,
        present_pending: Cell::new(false),
        power_notification,
        failure_token: None,
        navigation_token: None,
        diagnostics,
    });
    surface.failure_token = watch_processes(hwnd, &surface.core, surface.diagnostics.clone());
    surface.navigation_token = watch_navigation(&surface.core, surface.diagnostics.clone());
    let data = Box::into_raw(surface);
    if SetWindowSubclass(hwnd, Some(window_proc), SUBCLASS_ID, data as usize) == 0 {
        (*data).diagnostics.record("webview recovery hook failed");
        drop(Box::from_raw(data));
    }
}

unsafe fn watch_processes(
    hwnd: HWND,
    core: &ICoreWebView2,
    diagnostics: Diagnostics,
) -> Option<i64> {
    let mut last_reload: Option<Instant> = None;
    let mut last_hang: Option<Instant> = None;
    let handler = ProcessFailedEventHandler::create(Box::new(move |_, args| {
        let Some(args) = args else { return Ok(()) };
        let mut kind = COREWEBVIEW2_PROCESS_FAILED_KIND::default();
        args.ProcessFailedKind(&mut kind)?;
        diagnostics.record(format_args!("webview process failed kind={}", kind.0));
        if kind == COREWEBVIEW2_PROCESS_FAILED_KIND_GPU_PROCESS_EXITED {
            SetTimer(hwnd, GPU_TIMER, SETTLE_MS, None);
            return Ok(());
        }

        let should_reload = match kind {
            COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED => true,
            COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE => last_hang
                .replace(Instant::now())
                .is_some_and(|last| last.elapsed() < Duration::from_secs(35)),
            _ => false,
        };
        // Wait for a repeated hang so a busy renderer gets a chance to finish.
        // Run the reload outside the callback and cap retries if it crashes again.
        if should_reload
            && !last_reload.is_some_and(|last| last.elapsed() < Duration::from_secs(10))
            && SetTimer(hwnd, RELOAD_TIMER, 1, None) != 0
        {
            last_hang = None;
            last_reload = Some(Instant::now());
        }
        Ok(())
    }));
    let mut token = 0;
    core.add_ProcessFailed(&handler, &mut token).ok()?;
    Some(token)
}

unsafe fn watch_navigation(core: &ICoreWebView2, diagnostics: Diagnostics) -> Option<i64> {
    let handler = NavigationCompletedEventHandler::create(Box::new(move |_, args| {
        let Some(args) = args else { return Ok(()) };
        let mut success = BOOL(0);
        args.IsSuccess(&mut success)?;
        if !success.as_bool() {
            let mut status = COREWEBVIEW2_WEB_ERROR_STATUS::default();
            args.WebErrorStatus(&mut status)?;
            if status != COREWEBVIEW2_WEB_ERROR_STATUS_OPERATION_CANCELED {
                diagnostics.record(format_args!(
                    "webview navigation failed status={}",
                    status.0
                ));
            }
        }
        Ok(())
    }));
    let mut token = 0;
    core.add_NavigationCompleted(&handler, &mut token).ok()?;
    Some(token)
}

impl Drop for Surface {
    fn drop(&mut self) {
        unsafe {
            if let Some(token) = self.failure_token {
                let _ = self.core.remove_ProcessFailed(token);
            }
            if let Some(token) = self.navigation_token {
                let _ = self.core.remove_NavigationCompleted(token);
            }
            if self.power_notification != 0 {
                UnregisterSuspendResumeNotification(self.power_notification);
            }
        }
    }
}

unsafe extern "system" fn window_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    id: usize,
    data: usize,
) -> LRESULT {
    let surface = data as *mut Surface;
    match msg {
        msg if msg == WM_DISPLAYCHANGE
            || (msg == WM_POWERBROADCAST
                && matches!(wparam as u32, PBT_APMRESUMEAUTOMATIC | PBT_APMRESUMESUSPEND)) =>
        {
            (*surface).present_pending.set(true);
            SetTimer(hwnd, PRESENT_TIMER, SETTLE_MS, None);
        }
        msg if (*surface).present_pending.get()
            && ((msg == WM_ACTIVATE && wparam as u16 as u32 != WA_INACTIVE)
                || (msg == WM_SHOWWINDOW && wparam != 0)
                || (msg == WM_SIZE && wparam as u32 != SIZE_MINIMIZED)) =>
        {
            SetTimer(hwnd, PRESENT_TIMER, SETTLE_MS, None);
        }
        WM_ACTIVATEAPP if wparam != 0 => {
            // When the user returns, invalidate the surface without touching focus or the page.
            RedrawWindow(
                hwnd,
                null(),
                std::ptr::null_mut(),
                RDW_INVALIDATE | RDW_ALLCHILDREN,
            );
        }
        WM_TIMER if wparam == PRESENT_TIMER || wparam == GPU_TIMER => {
            KillTimer(hwnd, wparam);
            if wparam == GPU_TIMER {
                (*surface).present_pending.set(true);
            }
            if IsWindowVisible(hwnd) != 0
                && IsIconic(hwnd) == 0
                && (*surface).present_pending.replace(false)
            {
                // Clone before making calls that may dispatch window messages.
                let controller = (*surface).controller.clone();
                // Re-present the WebView surface without navigating or touching the DOM.
                let _ = controller.SetIsVisible(false);
                let _ = controller.NotifyParentWindowPositionChanged();
                let _ = controller.SetIsVisible(true);
            }
            return 0;
        }
        WM_TIMER if wparam == RELOAD_TIMER => {
            KillTimer(hwnd, RELOAD_TIMER);
            let core = (*surface).core.clone();
            let diagnostics = (*surface).diagnostics.clone();
            if let Err(error) = core.Reload() {
                diagnostics.record(format_args!(
                    "webview reload failed hresult={:#x}",
                    error.code().0
                ));
            }
            return 0;
        }
        WM_NCDESTROY => {
            RemoveWindowSubclass(hwnd, Some(window_proc), id);
            KillTimer(hwnd, PRESENT_TIMER);
            KillTimer(hwnd, RELOAD_TIMER);
            KillTimer(hwnd, GPU_TIMER);
            drop(Box::from_raw(surface));
        }
        _ => {}
    }
    DefSubclassProc(hwnd, msg, wparam, lparam)
}
