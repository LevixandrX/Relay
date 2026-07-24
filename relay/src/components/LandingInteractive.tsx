"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Scene = {
  id: string;
  title: string;
  blurb: string;
  nodes: { id: string; label: string; x: number; y: number; tone: "a" | "b" | "c" }[];
  links: [string, string][];
};

const SCENES: Scene[] = [
  {
    id: "map",
    title: "Майндмэп",
    blurb: "Идея в центре — ветки разлетаются по холсту.",
    nodes: [
      { id: "c", label: "Идея", x: 50, y: 48, tone: "a" },
      { id: "1", label: "Исслед.", x: 22, y: 28, tone: "b" },
      { id: "2", label: "Прототип", x: 78, y: 30, tone: "b" },
      { id: "3", label: "Запуск", x: 70, y: 72, tone: "c" },
      { id: "4", label: "Метрики", x: 28, y: 74, tone: "c" },
    ],
    links: [
      ["c", "1"],
      ["c", "2"],
      ["c", "3"],
      ["c", "4"],
    ],
  },
  {
    id: "flow",
    title: "Процесс",
    blurb: "Шаги и стрелки — как настоящая схема в Relay.",
    nodes: [
      { id: "a", label: "Заявка", x: 18, y: 50, tone: "b" },
      { id: "b", label: "Разбор", x: 42, y: 32, tone: "a" },
      { id: "c", label: "Сборка", x: 66, y: 50, tone: "b" },
      { id: "d", label: "Релиз", x: 86, y: 36, tone: "c" },
    ],
    links: [
      ["a", "b"],
      ["b", "c"],
      ["c", "d"],
    ],
  },
  {
    id: "team",
    title: "Команда",
    blurb: "Роли, зоны ответственности — всё на одном поле.",
    nodes: [
      { id: "p", label: "Продукт", x: 50, y: 26, tone: "a" },
      { id: "d", label: "Дизайн", x: 24, y: 58, tone: "b" },
      { id: "e", label: "Инжен.", x: 50, y: 72, tone: "c" },
      { id: "g", label: "Рост", x: 76, y: 58, tone: "b" },
    ],
    links: [
      ["p", "d"],
      ["p", "e"],
      ["p", "g"],
      ["d", "e"],
      ["e", "g"],
    ],
  },
];

export function LandingInteractive() {
  const [sceneId, setSceneId] = useState(SCENES[0].id);
  const [focus, setFocus] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const scene = useMemo(
    () => SCENES.find((s) => s.id === sceneId) ?? SCENES[0],
    [sceneId],
  );

  useEffect(() => {
    setFocus(null);
  }, [sceneId]);

  const byId = Object.fromEntries(scene.nodes.map((n) => [n.id, n]));

  return (
    <div className="relay-landing">
      <div className="relay-landing-aurora" aria-hidden />
      <div className="relay-landing-noise" aria-hidden />

      <nav className="relay-landing-nav">
        <div className="relay-brand">
          Relay<span className="relay-brand-dot" />
        </div>
        <div className="relay-landing-nav-actions">
          <Link href="/login" className="relay-btn relay-btn-ghost">
            Войти
          </Link>
          <Link href="/register" className="relay-btn relay-btn-accent">
            Начать бесплатно
          </Link>
        </div>
      </nav>

      <main className="relay-landing-hero">
        <div className="relay-landing-copy">
          <p className="relay-kicker" style={{ "--i": 0 } as React.CSSProperties}>
            холст · схемы · текст
          </p>
          <h1 style={{ "--i": 1 } as React.CSSProperties}>
            Думай руками.
            <br />
            <em>Без краёв.</em>
          </h1>
          <p className="lede" style={{ "--i": 2 } as React.CSSProperties}>
            Relay — пространство, где схема и текст живут рядом. Переключай сцены справа — так
            выглядит мышление на бесконечном холсте.
          </p>
          <div className="relay-landing-cta" style={{ "--i": 3 } as React.CSSProperties}>
            <Link href="/register" className="relay-btn relay-btn-accent">
              Создать пространство
            </Link>
            <Link href="/login" className="relay-btn">
              У меня уже есть аккаунт
            </Link>
          </div>
        </div>

        <div className="relay-demo" data-scene={scene.id} data-ready={mounted}>
          <div className="relay-demo-scenes">
            {SCENES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="relay-demo-scene"
                data-active={scene.id === s.id}
                onClick={() => setSceneId(s.id)}
              >
                {s.title}
              </button>
            ))}
          </div>

          <p className="relay-demo-blurb">{scene.blurb}</p>

          <svg className="relay-demo-links" viewBox="0 0 100 100" preserveAspectRatio="none">
            {scene.links.map(([a, b]) => {
              const from = byId[a];
              const to = byId[b];
              if (!from || !to) return null;
              const hot = focus === a || focus === b;
              return (
                <line
                  key={`${a}-${b}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className="relay-demo-line"
                  data-hot={hot}
                />
              );
            })}
          </svg>

          {scene.nodes.map((n, i) => (
            <button
              key={n.id}
              type="button"
              className={`relay-demo-node relay-demo-tone-${n.tone} relay-demo-breathe`}
              data-focus={focus === n.id}
              style={
                {
                  left: `${n.x}%`,
                  top: `${n.y}%`,
                  "--i": i,
                } as React.CSSProperties
              }
              onMouseEnter={() => setFocus(n.id)}
              onMouseLeave={() => setFocus(null)}
              onFocus={() => setFocus(n.id)}
              onBlur={() => setFocus(null)}
            >
              {n.label}
            </button>
          ))}
        </div>
      </main>

      <section className="relay-landing-strip">
        {[
          {
            t: "Бесконечный холст",
            d: "Стрелки, фигуры, стикеры — схемы без лимита по краям.",
          },
          {
            t: "Текст рядом",
            d: "Режим «Текст»: блоки, чеклисты и Live Prompt.",
          },
          {
            t: "Сразу в работу",
            d: "После входа — холст, а не пустой дашборд.",
          },
        ].map((f, i) => (
          <article key={f.t} className="relay-strip-card" style={{ "--i": i } as React.CSSProperties}>
            <h2>{f.t}</h2>
            <p>{f.d}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
