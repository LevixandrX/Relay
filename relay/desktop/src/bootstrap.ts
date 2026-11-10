const startup = document.getElementById("relay-startup")!;
const status = document.getElementById("relay-startup-status")!;
const reload = document.getElementById("relay-startup-reload")!;
const retryKey = "relay-desktop-startup-retried";
let language = navigator.language;
try {
  language = localStorage.getItem("relay-desktop-locale") ?? language;
} catch {
  // Browser storage can be unavailable while the WebView starts.
}
const ru = language.toLowerCase().startsWith("ru");
document.documentElement.lang = ru ? "ru" : "en";
startup.dataset.state = "starting";
status.textContent = ru ? "Загрузка Relay…" : "Loading Relay…";
reload.textContent = ru ? "Перезагрузить" : "Reload";
reload.hidden = true;

reload.addEventListener("click", (event) => {
  event.preventDefault();
  window.location.reload();
});

function showFailure(stage: "module" | "render", error: unknown) {
  window.clearTimeout(startupTimeout);
  console.error(`[Relay] Desktop ${stage} failure`, error);
  startup.dataset.state = "failed";
  status.textContent = ru ? "Не удалось открыть Relay" : "Relay couldn’t open";
  reload.hidden = false;
  startup.hidden = false;
  if ("__TAURI_INTERNALS__" in window) {
    void import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke("report_desktop_failure", { stage }))
      .catch(() => undefined);
  }
}

function retryModuleLoadOnce() {
  try {
    if (sessionStorage.getItem(retryKey)) return;
    sessionStorage.setItem(retryKey, "1");
    window.setTimeout(() => window.location.reload(), 700);
  } catch {
    // Keep the manual reload link if a retry can't be tracked across navigation.
  }
}

function finishStartup() {
  if (startup.hidden) return;
  window.clearTimeout(startupTimeout);
  startup.hidden = true;
  try { sessionStorage.removeItem(retryKey); } catch { /* optional */ }

  // The local interface can start even when the font server isn't reachable.
  const fonts = document.createElement("link");
  fonts.rel = "stylesheet";
  fonts.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Unbounded:wght@500;700&display=swap";
  document.head.append(fonts);
}

// Catch a stalled import as well as a rejected one.
const startupTimeout = window.setTimeout(() => {
  startup.dataset.state = "slow";
  status.textContent = ru ? "Relay загружается дольше обычного" : "Relay is taking longer to open";
  reload.hidden = false;
}, 10_000);
void import("./main").then(
  ({ mountRelay }) => {
    try {
      mountRelay(
        document.getElementById("root")!,
        finishStartup,
        (error) => showFailure("render", error),
      );
    } catch (error) {
      showFailure("render", error);
    }
  },
  (error) => {
    showFailure("module", error);
    retryModuleLoadOnce();
  },
);
