import { useState } from "react";
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

  const navView: ViewId =
    route.kind === "page" ? "pages" : route.kind === "home" ? "home" : route.kind;

  const fill = route.kind === "board" || route.kind === "page";

  function openPage(id: string) {
    setRoute({ kind: "page", pageId: id });
  }

  async function createAndOpen() {
    try {
      const page = await createPage("Новая страница");
      openPage(page.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось создать");
      setRoute({ kind: "auth" });
    }
  }

  return (
    <div className="app">
      <Titlebar />
      <div className="shell">
        <Sidebar
          view={navView}
          onNavigate={(id) => {
            if (id === "home") setRoute({ kind: "home" });
            if (id === "board") setRoute({ kind: "board" });
            if (id === "pages") setRoute({ kind: "pages" });
            if (id === "theme") setRoute({ kind: "theme" });
            if (id === "auth") setRoute({ kind: "auth" });
            if (id === "team") setRoute({ kind: "team" });
          }}
        />
        <main className="main" data-fill={fill}>
          {auth.loading && (
            <section className="card">
              <p className="muted">Синхронизация аккаунта…</p>
            </section>
          )}
          {!auth.loading && route.kind === "home" && (
            <HomeView
              onOpenBoard={() => setRoute({ kind: "board" })}
              onOpenPages={() => setRoute({ kind: "pages" })}
              onOpenPage={openPage}
              onNeedAuth={() => setRoute({ kind: "auth" })}
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
          {!auth.loading && route.kind === "theme" && <ThemeView />}
          {!auth.loading && route.kind === "auth" && (
            <AuthView onDone={() => setRoute({ kind: "home" })} />
          )}
          {!auth.loading && route.kind === "team" && <TeamView />}
        </main>
      </div>
    </div>
  );
}
