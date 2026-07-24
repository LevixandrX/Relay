import { useState } from "react";
import { useWorkspace } from "../lib/workspace";
import { formatRelative } from "../lib/store";

export function PagesView({
  onOpenPage,
  onCreate,
  onNeedAuth,
}: {
  onOpenPage: (id: string) => void;
  onCreate: () => void;
  onNeedAuth: () => void;
}) {
  const { pages, deletePage, mode, guestLimit } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const sorted = [...pages].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const atLimit = mode === "guest" && pages.length >= guestLimit;

  return (
    <>
      <div className="toprow">
        <div className="page-title">
          <h1>Страницы</h1>
          {mode === "guest" && (
            <span className="badge">
              {pages.length}/{guestLimit} гость
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => {
            setError(null);
            if (atLimit) {
              setError("Гостевой лимит. Войди для полного доступа.");
              onNeedAuth();
              return;
            }
            onCreate();
          }}
        >
          + Новая
        </button>
      </div>
      {error && (
        <section className="card">
          <p className="muted" style={{ margin: 0 }}>
            {error}{" "}
            <button type="button" className="btn" onClick={onNeedAuth}>
              Войти
            </button>
          </p>
        </section>
      )}
      <section className="card">
        <div className="page-list">
          {sorted.length === 0 && (
            <p className="muted" style={{ margin: 0 }}>
              Нет страниц. Нажми «+ Новая».
            </p>
          )}
          {sorted.map((p) => (
            <div key={p.id} className="page-row">
              <div>
                <strong>{p.title || "Без названия"}</strong>
                <div className="muted">
                  {p.board ? "холст · " : "текст · "}
                  {formatRelative(p.updatedAt)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn" onClick={() => onOpenPage(p.id)}>
                  Открыть
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (confirm(`Удалить «${p.title || "Без названия"}»?`)) {
                      void deletePage(p.id);
                    }
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
