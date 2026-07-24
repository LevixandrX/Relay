import { useWorkspace } from "../lib/workspace";
import { useAuth } from "../lib/auth";
import { formatRelative } from "../lib/store";

export function HomeView({
  onOpenBoard,
  onOpenPages,
  onOpenPage,
  onNeedAuth,
}: {
  onOpenBoard: () => void;
  onOpenPages: () => void;
  onOpenPage: (id: string) => void;
  onNeedAuth: () => void;
}) {
  const { pages, mode, guestLimit, offline } = useWorkspace();
  const auth = useAuth();
  const recent = [...pages]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);

  return (
    <>
      <div className="toprow">
        <div className="page-title">
          <h1>Моё пространство</h1>
          <span className="badge">
            <span className="dot" />
            {offline ? "Офлайн" : mode === "cloud" ? "Облако" : "Гость"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!auth.user && (
            <button type="button" className="btn btn-accent" onClick={onNeedAuth}>
              Войти
            </button>
          )}
          <button type="button" className="btn" onClick={onOpenPages}>
            Страницы
          </button>
          <button type="button" className="btn btn-accent" onClick={onOpenBoard}>
            Открыть холст
          </button>
        </div>
      </div>

      {mode === "guest" && (
        <section className="card">
          <p style={{ margin: 0 }}>
            Гостевой режим: до <strong>{guestLimit}</strong> локальных страниц. Войди через Google,
            GitHub или email — откроются облако, команда и пробный Pro.
          </p>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <div>
            <h2>Relay · {mode === "cloud" ? "облачная студия" : "локальная студия"}</h2>
            <p className="muted" style={{ margin: "0.25rem 0 0" }}>
              {mode === "cloud"
                ? "Страницы и холст синхронизируются с сервером. Команда видит одно пространство."
                : "Данные на этом ПК. После входа — sync и роли owner/editor/viewer."}
            </p>
          </div>
        </div>
        <div className="stat-grid">
          <div className="stat">
            <div className="stat-label">Страницы</div>
            <div className="stat-value">{pages.length}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Режим</div>
            <div className="stat-value" style={{ fontSize: "1.05rem" }}>
              {mode === "cloud" ? "cloud" : "guest"}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">План</div>
            <div className="stat-value" style={{ fontSize: "1.05rem" }}>
              {auth.subscription?.isPro ? "pro" : auth.user ? "free" : "—"}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Холст</div>
            <div className="stat-value">∞</div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>Недавние</h2>
          <button type="button" className="btn" onClick={onOpenPages}>
            Все
          </button>
        </div>
        <div className="page-list">
          {recent.length === 0 && (
            <p className="muted" style={{ margin: 0 }}>
              Пока пусто — создай первую страницу.
            </p>
          )}
          {recent.map((p) => (
            <div key={p.id} className="page-row">
              <div>
                <strong>{p.title || "Без названия"}</strong>
                <div className="muted">{formatRelative(p.updatedAt)}</div>
              </div>
              <button type="button" className="btn" onClick={() => onOpenPage(p.id)}>
                Открыть
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
