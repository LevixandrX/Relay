import { StrictMode, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ThemeProvider } from "./theme/ThemeProvider";
import { LocaleProvider } from "./i18n/LocaleProvider";
import { AuthProvider } from "./lib/auth";
import { WorkspaceProvider } from "./lib/workspace";
import { DialogProvider } from "./components/DialogHost";
import { AppTooltips } from "@relay-ui/AppTooltips";
import "./styles/global.css";

function StartupReady({ onReady }: { onReady: () => void }) {
  useLayoutEffect(onReady, [onReady]);
  return null;
}

export function mountRelay(root: HTMLElement, onReady: () => void, onError: (error: unknown) => void) {
  createRoot(root, { onUncaughtError: onError }).render(
    <StrictMode>
      <LocaleProvider>
        <ThemeProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <DialogProvider>
                <App />
                <AppTooltips />
                <StartupReady onReady={onReady} />
              </DialogProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
      </LocaleProvider>
    </StrictMode>,
  );
}
