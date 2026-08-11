import { useWorkspace } from "../lib/workspace";
import { useAuth } from "../lib/auth";
import { formatRelative } from "../lib/store";

export function HomeView({
  onOpenBoard,
  onOpenPages,
  onOpenPage,
  onNeedAuth,
  onCreatePage,
}: {
  onOpenBoard: () => void;
  onOpenPages: () => void;
  onOpenPage: (id: string) => void;
  onNeedAuth: () => void;
  onCreatePage: () => void;
}) {
  const { pages, mode, guestLimit, offline } = useWorkspace();
  const auth = useAuth();
  const recent = [...pages]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  const empty = pages.length === 0;

  return (
    <>
      <div className="toprow">
        <div className="page-title">
          <h1>С чего начать</h1>
          <p className="muted" style={{ margin: "0.2rem 0 0" }}>
            {mode === "cloud"
              ? "Облачное пространство синхронизируется с сервером."
              : `Гостевой режим на этом ПК · до ${guestLimit} страниц без входа.`}
            {offline ? " Сейчас офлайн — правки могут не уйти в облако." : ""}
          </p>
        </div>
        {!auth.user && (
          <button type="button" className="btn btn-accent" onClick={onNeedAuth}>
            Войти в облако
          </button>
        )}
      </div>

      <section className="start-grid">
        <button type="button" className="start-tile" onClick={onOpenBoard}>
          <span className="start-kicker">Главное</span>
          <strong>Открыть холст</strong>
          <span className="muted">
            Бесконечная доска пространства: схемы, стикеры, стрелки.
          </span>
        </button>
        <button type="button" className="start-tile" onClick={onCreatePage}>
          <span className="start-kicker">Текст</span>
          <strong>Новая страница</strong>
          <span className="muted">Заметки и документы в блочном редакторе.</span>
        </button>
        <button type="button" className="start-tile" onClick={onOpenPages}>
          <span className="start-kicker">Список</span>
          <strong>Все страницы</strong>
          <span className="muted">
            {pages.length
              ? `Сейчас ${pages.length} · найти и открыть`
              : "Пока пусто — создай первую"}
          </span>
        </button>
        {!auth.user ? (
          <button type="button" className="start-tile" onClick={onNeedAuth}>
            <span className="start-kicker">Облако</span>
            <strong>Войти или создать аккаунт</strong>
            <span className="muted">
              Sync, команда и 14 дней Pro. Google, GitHub, Яндекс или email.
            </span>
          </button>
        ) : (
          <div className="start-tile start-tile-static">
            <span className="start-kicker">Аккаунт</span>
            <strong>{auth.user.name}</strong>
            <span className="muted">
              {auth.subscription?.isPro
                ? auth.subscription.status === "trialing"
                  ? "Pro · пробный период"
                  : "План Pro"
                : "План Free"}
              {" · "}
              {auth.user.email}
            </span>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>{empty ? "Дальше" : "Недавние страницы"}</h2>
          {!empty && (
            <button type="button" className="btn" onClick={onOpenPages}>
              Все
            </button>
          )}
        </div>
        {empty ? (
          <ol className="howto">
            <li>
              Нажми <strong>Открыть холст</strong> — это «доска» пространства.
            </li>
            <li>
              Или <strong>Новая страница</strong> — обычный текст и блоки.
            </li>
            <li>
              Слева меню: Холст, Страницы, Команда, Тема, Аккаунт.
            </li>
          </ol>
        ) : (
          <div className="page-list">
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
        )}
      </section>
    </>
  );
}
