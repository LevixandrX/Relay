import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { Titlebar } from "./components/Titlebar";
import { Sidebar } from "./components/Sidebar";
import { HomeView } from "./components/HomeView";
import { PagesView } from "./components/PagesView";
import { PageView } from "./components/PageView";
import { BoardView } from "./components/BoardView";
import { ThemeView } from "./components/ThemeView";
import { AuthView } from "./components/AuthView";
import { TeamView } from "./components/TeamView";
import { useWorkspace } from "./lib/workspace";
import { useAuth } from "./lib/auth";
import { useDialog } from "./components/DialogHost";
import { CommandPalette } from "./components/CommandPalette";
import { useChromeMode } from "./lib/chrome";
import { HelpPanel } from "@relay-help";

export type ViewId = "home" | "board" | "pages" | "theme" | "auth" | "team";

type Route =
  | { kind: "home" }
  | { kind: "board" }
  | { kind: "pages" }
  | { kind: "theme" }
  | { kind: "auth" }
  | { kind: "team" }
  | { kind: "page"; pageId: string };

export function App() {
  const [route, setRoute] = useState<Route>({ kind: "home" });
  const { createPage } = useWorkspace();
  const auth = useAuth();
  const dialog = useDialog();
  const t = useTranslations("desktop");
  const ta = useTranslations("app");
  const chrome = useChromeMode();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [zenTop, setZenTop] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.dataset.chrome = chrome.mode;
    if (zenTop) document.documentElement.dataset.peekTop = "true";
    else delete document.documentElement.dataset.peekTop;
    return () => {
      delete document.documentElement.dataset.chrome;
      delete document.documentElement.dataset.peekTop;
    };
  }, [chrome.mode, zenTop]);

  useEffect(() => {
    if (chrome.mode !== "zen") {
      setZenTop(false);
      return;
    }
    let hide: ReturnType<typeof setTimeout> | null = null;
    const shown = { current: false };
    function show() {
      if (hide) {
        clearTimeout(hide);
        hide = null;
      }
      if (!shown.current) {
        shown.current = true;
        setZenTop(true);
      }
    }
    function scheduleHide() {
      if (hide) return;
      hide = setTimeout(() => {
        shown.current = false;
        setZenTop(false);
        hide = null;
      }, 280);
    }
    function onMove(e: PointerEvent) {
      const target = e.target as HTMLElement | null;
      const overTransientPanel = Boolean(
        target?.closest?.(".relay-activity-panel, .version-history"),
      );
      if (overTransientPanel) {
        scheduleHide();
        return;
      }
      const overChrome = Boolean(
        target?.closest?.(".titlebar, .titlebar-slot, .win-btn"),
      );
      // Hide only when the pointer is clearly in the content. Native snap /
      // caption overlays steal events without leaving the titlebar band.
      if (overChrome || e.clientY <= (shown.current ? 44 : 28)) show();
      else if (e.clientY > 52) scheduleHide();
    }
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (hide) clearTimeout(hide);
    };
  }, [chrome.mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.code === "KeyK" || e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onPage = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) setRoute({ kind: "page", pageId: id });
    };
    const onBoard = () => setRoute({ kind: "board" });
    window.addEventListener("relay:open-page", onPage);
    window.addEventListener("relay:open-board", onBoard);
    return () => {
      window.removeEventListener("relay:open-page", onPage);
      window.removeEventListener("relay:open-board", onBoard);
    };
  }, []);

  const navView: ViewId =
    route.kind === "page" ? "pages" : route.kind === "home" ? "home" : route.kind;

  const fill = route.kind === "board" || route.kind === "page";

  function openPage(id: string) {
    setRoute({ kind: "page", pageId: id });
  }

  async function createAndOpen() {
    try {
      const page = await createPage(ta("newPageTitle"));
      openPage(page.id);
    } catch (err) {
      await dialog.alert({
        title: t("createFailed"),
        body: err instanceof Error ? err.message : undefined,
      });
      setRoute({ kind: "auth" });
    }
  }

  return (
    <div className="app" data-chrome={chrome.mode} data-peek-top={zenTop || undefined}>
      <div className="titlebar-slot">
        <Titlebar activityPageId={route.kind === "page" ? route.pageId : null} />
      </div>
      <div className="shell" data-chrome={chrome.mode}>
        {/* hover target that brings the sidebar back in zen mode */}
        {chrome.mode === "zen" && <div className="shell-edge" aria-hidden />}
        <Sidebar
          view={navView}
          chrome={chrome.mode}
          onChrome={chrome.set}
          onSearch={() => setPaletteOpen(true)}
          onCreatePage={() => void createAndOpen()}
          activePageId={route.kind === "page" ? route.pageId : null}
          onOpenPage={openPage}
          onNavigate={(id) => {
            if (id === "home") setRoute({ kind: "home" });
            if (id === "board") setRoute({ kind: "board" });
            if (id === "pages") setRoute({ kind: "pages" });
            if (id === "theme") setRoute({ kind: "theme" });
            if (id === "auth") setRoute({ kind: "auth" });
            if (id === "team") setRoute({ kind: "team" });
          }}
        />
        <main className="main" data-fill={fill} data-auth={route.kind === "auth" || undefined}>
          {auth.loading && (
            <div className="page-frame">
              <section className="card">
                <p className="muted">{t("syncAccount")}</p>
              </section>
            </div>
          )}
          {!auth.loading && route.kind === "home" && (
            <HomeView
              onOpenBoard={() => setRoute({ kind: "board" })}
              onOpenPages={() => setRoute({ kind: "pages" })}
              onOpenPage={openPage}
              onNeedAuth={() => setRoute({ kind: "auth" })}
              onCreatePage={() => void createAndOpen()}
              onSearch={() => setPaletteOpen(true)}
              onOpenTeam={() => setRoute({ kind: "team" })}
            />
          )}
          {!auth.loading && route.kind === "board" && <BoardView />}
          {!auth.loading && route.kind === "pages" && (
            <PagesView
              onOpenPage={openPage}
              onCreate={() => void createAndOpen()}
              onNeedAuth={() => setRoute({ kind: "auth" })}
            />
          )}
          {!auth.loading && route.kind === "page" && (
            <PageView pageId={route.pageId} onBack={() => setRoute({ kind: "pages" })} />
          )}
          {!auth.loading && route.kind === "theme" && (
            <ThemeView chrome={chrome.mode} onChrome={chrome.set} />
          )}
          {!auth.loading && route.kind === "auth" && (
            <AuthView onDone={() => setRoute({ kind: "home" })} />
          )}
          {!auth.loading && route.kind === "team" && (
            <TeamView onNeedAuth={() => setRoute({ kind: "auth" })} />
          )}
        </main>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenPage={openPage}
        onOpenBoard={() => setRoute({ kind: "board" })}
        onCreatePage={() => void createAndOpen()}
      />
      <HelpPanel />
    </div>
  );
}
