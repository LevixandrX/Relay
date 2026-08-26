import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ThemeProvider } from "./theme/ThemeProvider";
import { LocaleProvider } from "./i18n/LocaleProvider";
import { AuthProvider } from "./lib/auth";
import { WorkspaceProvider } from "./lib/workspace";
import { DialogProvider } from "./components/DialogHost";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocaleProvider>
      <ThemeProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <DialogProvider>
              <App />
            </DialogProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </ThemeProvider>
    </LocaleProvider>
  </StrictMode>,
);
