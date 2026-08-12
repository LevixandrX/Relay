"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BlockEditor } from "@/editor/BlockEditor";
import { InfiniteBoard, type BoardSnapshot } from "@/components/InfiniteBoard";
import type { Doc } from "@/domain/blocks/schema";
import { BrandLockup } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";

type PageMeta = {
  id: string;
  title: string;
  icon: string | null;
  parentPageId: string | null;
  position: number;
  publicId: string | null;
};

type Checklist = {
  editedPage: boolean;
  usedSlashOrPrompt: boolean;
  openedShare: boolean;
  dismissed: boolean;
};

type PulseEvent = {
  id: number;
  action: string;
  actorName: string | null;
  createdAt: string;
  meta: { title?: string; email?: string } | null;
};

type ViewMode = "board" | "text";

type Props = {
  workspaceId: string;
  workspaceName: string;
  /** null = открыт холст пространства */
  pageId: string | null;
  role: string;
  initialPages: PageMeta[];
  initialPage: {
    id: string;
    title: string;
    icon: string | null;
    content: Doc;
    board: BoardSnapshot | null;
    updatedAt: string;
    publicId: string | null;
  } | null;
  workspaceBoard: BoardSnapshot | null;
  checklist: Checklist | null;
  defaultMode?: ViewMode;
};

export function WorkspaceApp({
  workspaceId,
  workspaceName,
  pageId,
  role,
  initialPages,
  initialPage,
  workspaceBoard,
  checklist: initialChecklist,
  defaultMode = "board",
}: Props) {
  const router = useRouter();
  const canWrite = role === "owner" || role === "editor";
  const isWorkspaceBoard = !pageId;

  const [pages, setPages] = useState(initialPages);
  const [title, setTitle] = useState(initialPage?.title ?? "");
  const [content, setContent] = useState<Doc>(
    initialPage?.content ?? { type: "doc", content: [{ type: "paragraph" }] },
  );
  const [pageBoard, setPageBoard] = useState<BoardSnapshot | null>(
    initialPage?.board ?? null,
  );
  const [wsBoard, setWsBoard] = useState<BoardSnapshot | null>(workspaceBoard);
  const [updatedAt, setUpdatedAt] = useState(initialPage?.updatedAt ?? "");
  const [publicId, setPublicId] = useState(initialPage?.publicId ?? null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [checklist, setChecklist] = useState(initialChecklist);
  const [pulse, setPulse] = useState<PulseEvent[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [compassOpen, setCompassOpen] = useState(false);
  const [compassQ, setCompassQ] = useState("");
  const [searchResults, setSearchResults] = useState<
    { pageId: string; title: string; snippet: string }[]
  >([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>(isWorkspaceBoard ? "board" : defaultMode);
  const [menuOpen, setMenuOpen] = useState(false);
  const [coach, setCoach] = useState<{ show: boolean; text: string } | null>(null);
  const updatedAtRef = useRef(initialPage?.updatedAt ?? "");
  const skipSaveRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = isWorkspaceBoard ? "relay_coach_board" : "relay_coach_page";
    if (localStorage.getItem(key) === "1") return;
    setCoach({
      show: true,
      text: isWorkspaceBoard
        ? "Колёсико — масштаб, пробел+тяни — панорама. Инструменты — слева на холсте."
        : "Переключай «Холст / Текст» сверху. В тексте клавиша / открывает блоки.",
    });
  }, [isWorkspaceBoard, pageId]);

  function dismissCoach() {
    if (!coach) return;
    const key = isWorkspaceBoard ? "relay_coach_board" : "relay_coach_page";
    localStorage.setItem(key, "1");
    setCoach(null);
  }

  useEffect(() => {
    updatedAtRef.current = updatedAt;
  }, [updatedAt]);

  useEffect(() => {
    setMode(isWorkspaceBoard ? "board" : defaultMode);
    setTitle(initialPage?.title ?? "");
    setContent(initialPage?.content ?? { type: "doc", content: [{ type: "paragraph" }] });
    setPageBoard(initialPage?.board ?? null);
    setUpdatedAt(initialPage?.updatedAt ?? "");
    setPublicId(initialPage?.publicId ?? null);
    updatedAtRef.current = initialPage?.updatedAt ?? "";
  }, [pageId, initialPage, isWorkspaceBoard, defaultMode]);

  const markChecklist = useCallback(
    async (key: "editedPage" | "usedSlashOrPrompt" | "openedShare" | "dismissed") => {
      if (!checklist || checklist[key]) return;
      setChecklist({ ...checklist, [key]: true });
      const apiKey =
        key === "editedPage"
          ? "edited_page"
          : key === "usedSlashOrPrompt"
            ? "used_slash_or_prompt"
            : key === "openedShare"
              ? "opened_share"
              : "dismissed";
      await fetch("/api/v1/me/checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKey }),
      });
    },
    [checklist],
  );

  const refreshPages = useCallback(async () => {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/pages`);
    if (!res.ok) return;
    const data = await res.json();
    setPages(data.pages);
  }, [workspaceId]);

  const refreshPulse = useCallback(async () => {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/pulse`);
    if (!res.ok) return;
    const data = await res.json();
    setPulse(data.events);
  }, [workspaceId]);

  useEffect(() => {
    void refreshPulse();
  }, [refreshPulse, pageId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCompassOpen(true);
      }
      if (e.key === "Escape") {
        setCompassOpen(false);
        setShareOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!compassOpen || compassQ.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/v1/workspaces/${workspaceId}/search?q=${encodeURIComponent(compassQ)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setSearchResults(data.results);
    }, 200);
    return () => clearTimeout(t);
  }, [compassOpen, compassQ, workspaceId]);

  // Автосохранение текста
  useEffect(() => {
    if (!pageId || !canWrite || !updatedAtRef.current || mode !== "text") return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    setSaveState("saving");
    const t = setTimeout(async () => {
      const base = updatedAtRef.current;
      const res = await fetch(`/api/v1/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, baseUpdatedAt: base }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setUpdatedAt(data.details?.serverUpdatedAt ?? base);
        setSaveState("error");
        return;
      }
      if (!res.ok) {
        setSaveState("error");
        return;
      }
      updatedAtRef.current = data.updatedAt;
      setUpdatedAt(data.updatedAt);
      setSaveState("saved");
      void markChecklist("editedPage");
      setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, title } : p)));
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, pageId, canWrite, mode, markChecklist]);

  async function createPage() {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Новая страница" }),
    });
    const data = await res.json();
    if (!res.ok) return;
    await refreshPages();
    router.push(`/w/${workspaceId}/p/${data.id}?mode=text`);
  }

  async function saveWorkspaceBoardSnapshot(board: BoardSnapshot) {
    if (!canWrite) return;
    setSaveState("saving");
    setWsBoard(board);
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/board`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ board }),
    });
    setSaveState(res.ok ? "saved" : "error");
    if (res.ok) {
      void markChecklist("editedPage");
      void refreshPulse();
    }
  }

  async function savePageBoardSnapshot(board: BoardSnapshot) {
    if (!pageId || !canWrite || !updatedAtRef.current) return;
    setSaveState("saving");
    setPageBoard(board);
    const res = await fetch(`/api/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        board,
        baseUpdatedAt: updatedAtRef.current,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSaveState("error");
      return;
    }
    updatedAtRef.current = data.updatedAt;
    setUpdatedAt(data.updatedAt);
    setSaveState("saved");
    void markChecklist("editedPage");
  }

  async function runPrompt(prompt: string) {
    if (!pageId) return;
    void markChecklist("usedSlashOrPrompt");
    const res = await fetch(`/api/v1/pages/${pageId}/run-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok) return;
    skipSaveRef.current = true;
    setContent(data.content);
    updatedAtRef.current = data.updatedAt;
    setUpdatedAt(data.updatedAt);
    void refreshPulse();
  }

  async function togglePublish() {
    if (!pageId) return;
    if (publicId) {
      await fetch(`/api/v1/pages/${pageId}/publish`, { method: "DELETE" });
      setPublicId(null);
    } else {
      const res = await fetch(`/api/v1/pages/${pageId}/publish`, { method: "POST" });
      const data = await res.json();
      if (res.ok) setPublicId(data.publicId);
    }
    void markChecklist("openedShare");
    void refreshPulse();
  }

  async function sendInvite() {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: "editor" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setInviteMsg(data.message ?? "Не удалось пригласить");
      return;
    }
    setInviteMsg(`Приглашение создано. Токен (пока без почты): ${data.acceptToken}`);
    setInviteEmail("");
    void refreshPulse();
  }

  const publicUrl = useMemo(() => {
    if (!publicId) return null;
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return `${base}/p/${publicId}`;
  }, [publicId]);

  function labelAction(action: string) {
    const map: Record<string, string> = {
      "page.create": "создал(а) страницу",
      "page.update": "изменил(а) страницу",
      "page.publish": "опубликовал(а) страницу",
      "page.prompt": "запустил(а) Live Prompt",
      "member.invite": "пригласил(а) участника",
      "workspace.create": "создал(а) пространство",
      "board.update": "рисовал(а) на холсте",
    };
    return map[action] ?? action;
  }

  const saveLabel =
    saveState === "saving" ? "Сохраняем…" : saveState === "error" ? "Ошибка сохранения" : "Сохранено";

  return (
    <div className="relay-shell">
      <aside className="relay-sidebar">
        <div className="relay-sidebar-top">
          <div>
            <BrandLockup size={26} />
            <div className="relay-ws-name">{workspaceName}</div>
          </div>
          <div className="relay-sidebar-actions">
            <ThemeToggle variant="sidebar" />
            <button
              type="button"
              className="relay-icon-btn"
              onClick={() => setCompassOpen(true)}
              title="Поиск (⌘K)"
              aria-label="Поиск"
            >
              ⌕
            </button>
            <div className="relay-menu-wrap">
              <button
                type="button"
                className="relay-icon-btn"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Меню"
                title="Ещё"
              >
                ···
              </button>
              {menuOpen && (
                <div className="relay-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void fetch("/api/v1/auth/logout", { method: "POST" }).then(() =>
                        router.push("/"),
                      );
                    }}
                  >
                    Выйти
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <Link
          href={`/w/${workspaceId}/board`}
          className="relay-page-link relay-board-nav"
          data-active={isWorkspaceBoard}
        >
          <span className="icon">∞</span>
          <span className="relay-ellipsis">Бесконечный холст</span>
        </Link>

        <div className="relay-nav-row">
          <div className="relay-nav-label">Страницы</div>
          {canWrite && (
            <button
              type="button"
              className="relay-link-btn"
              onClick={() => void createPage()}
              title="Новая страница"
            >
              + страница
            </button>
          )}
        </div>

        <div className="relay-page-list">
          {pages.length === 0 && (
            <div className="relay-empty-side">Пока пусто — оставайся на холсте или создай страницу.</div>
          )}
          {pages.map((p) => (
            <Link
              key={p.id}
              href={`/w/${workspaceId}/p/${p.id}`}
              className="relay-page-link"
              data-active={p.id === pageId}
              title={p.title || "Без названия"}
            >
              <span className="icon">{p.icon ?? "◇"}</span>
              <span className="relay-ellipsis">{p.title || "Без названия"}</span>
            </Link>
          ))}
        </div>

        <div className="relay-pulse">
          <div className="relay-nav-label">Пульс</div>
          {pulse.length === 0 && (
            <div className="relay-pulse-item">Тишина — правки появятся здесь.</div>
          )}
          {pulse.slice(0, 4).map((ev) => (
            <div key={ev.id} className="relay-pulse-item">
              <strong>{ev.actorName ?? "Кто-то"}</strong> {labelAction(ev.action)}
            </div>
          ))}
        </div>

        {checklist && !checklist.dismissed && (
          <div className="relay-checklist">
            <div className="relay-checklist-head">
              <h3>Первые шаги</h3>
              <button
                type="button"
                className="relay-link-btn"
                onClick={() => void markChecklist("dismissed")}
              >
                Скрыть
              </button>
            </div>
            <div className="relay-check-item" data-done={checklist.editedPage}>
              <span>{checklist.editedPage ? "✓" : "1"}</span>
              <span>Нарисуй или напиши</span>
            </div>
            <div className="relay-check-item" data-done={checklist.usedSlashOrPrompt}>
              <span>{checklist.usedSlashOrPrompt ? "✓" : "2"}</span>
              <span>Нажми / или Live Prompt</span>
            </div>
            <div className="relay-check-item" data-done={checklist.openedShare}>
              <span>{checklist.openedShare ? "✓" : "3"}</span>
              <span>Открой «Поделиться»</span>
            </div>
          </div>
        )}
      </aside>

      <main className="relay-main">
        <div className="relay-topbar">
          <div className="relay-topbar-left">
            {!isWorkspaceBoard && (
              <div className="relay-mode-switch" role="tablist" aria-label="Режим">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "board"}
                  data-active={mode === "board"}
                  onClick={() => setMode("board")}
                >
                  Холст
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "text"}
                  data-active={mode === "text"}
                  onClick={() => setMode("text")}
                >
                  Текст
                </button>
              </div>
            )}
            {isWorkspaceBoard && (
              <div className="relay-context-title">
                Бесконечный холст · <span>{workspaceName}</span>
              </div>
            )}
            <span className="relay-save">{saveLabel}</span>
          </div>
          <div className="relay-topbar-actions">
            <ThemeToggle variant="toolbar" />
            {pageId && (
              <button
                type="button"
                className="relay-btn"
                onClick={() => {
                  setShareOpen(true);
                  void markChecklist("openedShare");
                }}
              >
                Поделиться
              </button>
            )}
          </div>
        </div>

        {coach?.show && (
          <div className="relay-coach">
            <span>{coach.text}</span>
            <button type="button" className="relay-link-btn" onClick={dismissCoach}>
              Понятно
            </button>
          </div>
        )}

        {(isWorkspaceBoard || mode === "board") && (
          <div className="relay-board-wrap">
            <InfiniteBoard
              key={isWorkspaceBoard ? `ws-${workspaceId}` : `pg-${pageId}-board`}
              editable={canWrite}
              initialSnapshot={isWorkspaceBoard ? wsBoard : pageBoard}
              onChange={
                isWorkspaceBoard ? saveWorkspaceBoardSnapshot : savePageBoardSnapshot
              }
            />
          </div>
        )}

        {!isWorkspaceBoard && mode === "text" && initialPage && (
          <div className="relay-page">
            <input
              className="relay-title"
              value={title}
              placeholder="Название страницы"
              disabled={!canWrite}
              onChange={(e) => setTitle(e.target.value)}
            />
            <BlockEditor
              content={content}
              editable={canWrite}
              onChange={setContent}
              onSlashUsed={() => void markChecklist("usedSlashOrPrompt")}
              onRunPrompt={runPrompt}
            />
          </div>
        )}
      </main>

      {shareOpen && (
        <div className="relay-modal-backdrop" onClick={() => setShareOpen(false)}>
          <div className="relay-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Поделиться</h2>
            <p className="relay-modal-lede">
              Публичная ссылка — только чтение. Или пригласи коллегу в пространство.
            </p>
            <button type="button" className="relay-btn relay-btn-accent" onClick={() => void togglePublish()}>
              {publicId ? "Снять с публикации" : "Опубликовать ссылку"}
            </button>
            {publicUrl && (
              <input
                className="relay-input"
                style={{ marginTop: 12 }}
                readOnly
                value={publicUrl}
                onFocus={(e) => e.target.select()}
              />
            )}
            {role === "owner" && (
              <div style={{ marginTop: 16 }}>
                <div className="relay-nav-label">Пригласить</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="relay-input"
                    placeholder="коллега@компания.ru"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <button type="button" className="relay-btn" onClick={() => void sendInvite()}>
                    Ок
                  </button>
                </div>
                {inviteMsg && <p className="relay-muted">{inviteMsg}</p>}
              </div>
            )}
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button type="button" className="relay-btn" onClick={() => setShareOpen(false)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {compassOpen && (
        <div className="relay-modal-backdrop" onClick={() => setCompassOpen(false)}>
          <div className="relay-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Компас</h2>
            <input
              className="relay-input"
              autoFocus
              placeholder="Найти страницу…"
              value={compassQ}
              onChange={(e) => setCompassQ(e.target.value)}
            />
            <div style={{ marginTop: 12, display: "grid", gap: 4 }}>
              <button
                type="button"
                className="relay-page-link"
                onClick={() => {
                  setCompassOpen(false);
                  router.push(`/w/${workspaceId}/board`);
                }}
              >
                ∞ Открыть бесконечный холст
              </button>
              <button type="button" className="relay-page-link" onClick={() => void createPage()}>
                + Новая страница
              </button>
              {searchResults.map((r) => (
                <button
                  key={r.pageId}
                  type="button"
                  className="relay-page-link"
                  onClick={() => {
                    setCompassOpen(false);
                    router.push(`/w/${workspaceId}/p/${r.pageId}`);
                  }}
                >
                  <div>
                    <div>{r.title}</div>
                    <div className="relay-muted" style={{ fontSize: "0.78rem" }}>
                      {r.snippet}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
