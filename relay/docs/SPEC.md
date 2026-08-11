# Relay — техническое задание (источник правды для агентов)

> **Обязательно прочитай этот файл перед любыми изменениями кода.**  
> Цель: продукт остаётся цельным; архитектуру не ломаем «ради быстрого фикса».

Связанные документы: [PRODUCT](./PRODUCT.md) · [ARCHITECTURE](./ARCHITECTURE.md) · [API](./API.md) · [DATA-MODEL](./DATA-MODEL.md) · [DEVELOPMENT](./DEVELOPMENT.md)

---

## 1. Что это за продукт

**Relay** — SaaS-пространство «Notion + холст»:

- **Страницы** с блочным редактором (TipTap)
- **Бесконечный холст** пространства и страницы (tldraw)
- **Команды**: workspaces, роли `owner | editor | viewer`, приглашения
- **Гость** (десктоп без аккаунта) — локально и с лимитами
- **Облако** после входа — sync через API, trial Pro 14 дней

Интерфейс MVP — **русский**.

---

## 1.1 Позиция по продакшену (важно — Артём)

Текущий стек — **осознанный MVP-скелет**, не целевой прод на годы:

- App Router / Next API, Drizzle+LibSQL, JWT+sessions — нормально **допилить MVP и валидировать продукт**.
- Для серьёзного прода часть решений (монолитный Next как единственный бэкенд, ORM-выбор, модель сессий, выбор БД) **потребует эволюции** — это ожидаемо.
- **Сейчас переписывать стек невыгодно.** Порядок: добить MVP целиком → потом целевая замена слоёв по плану, а не «по чуть-чуть и вперемешку».
- **Не соглашаться** на предложения агента тащить **Redis и прочий зоопарк** «для красоты». Изучать можно; в проект — только по явному решению человека после изучения деплоя/контроля.
- **Postgres не считать автоматически go-to** для любой сложности. Выбор БД — отдельное исследование после MVP, не слепое «все так делают».
- Не строить архитектуру «как для личного pet-проекта навсегда» и не строить «как FAANG с первого дня» — держать **простой MVP**, с понятной границей, что потом меняется.

Агентам: если предлагаешь Redis / Kafka / microservices / вторую БД / полный rewrite Auth — **стоп, спроси пользователя**. Default = дописываем MVP на текущем стеке.

---

## 2. Стек (ответ на «на чём бэкенд и БД?»)


| Слой               | Технология                                                                 | Где лежит                                   |
| ------------------ | -------------------------------------------------------------------------- | ------------------------------------------- |
| **Сетевой бэкенд** | **Next.js 16** (App Router) — Route Handlers `/api/v1/`* на **TypeScript** | `relay/src/app/api/`, `relay/src/domain/`   |
| **База данных**    | **LibSQL** (SQLite-совместимый файл) через **Drizzle ORM**                 | `relay/src/db/`, файл `relay/data/relay.db` |
| **Веб UI**         | React 19 + CSS (токены в `globals.css`)                                    | `relay/src/app/`, `relay/src/components/`   |
| **Десктоп**        | **Tauri 2** + React/Vite (тот же UX, API по HTTP)                          | `relay/desktop/`                            |
| **Сессии**         | JWT (`jose`) + таблица `sessions` (`jti`, revoke на logout)                | cookie web / Bearer desktop                 |
| **Планы**          | таблица `subscriptions` + entitlements                                     | freemium + trial                            |


Локально БД — LibSQL file. **Целевую прод-БД не фиксируем жёстко** (Postgres — кандидат, не догма).  
Отдельного сервиса на Go/Python/Java **пока нет** — API живёт внутри Next.js (для MVP).

```
[ Браузер / Tauri ]
        │  HTTPS / HTTP
        ▼
[ Next.js Route Handlers  /api/v1/... ]
        │
        ▼
[ Domain (access, pages, auth, billing) ]
        │
        ▼
[ Drizzle → LibSQL file (локально) / Postgres (позже) ]
```

---

## 3. Что уже сделано (состояние проекта)

### Ядро продукта

- Workspaces, memberships, роли
- Страницы: CRUD, TipTap JSON AST, ревизии
- Холст пространства + холст страницы (tldraw snapshot)
- Публичные страницы `/p/[publicId]`
- Поиск, Live Prompt (эвристики; OpenAI опционально)
- Онбординг / чеклист на русском

### Аккаунты и облако

- Email + пароль
- OAuth: **Google, GitHub, Яндекс** (VK отложен — нужен ИНН/бизнес)
- Desktop pairing: `pair` + `claimSecret` (без JWT в URL)
- Guest-режим в десктопе с лимитами
- Invites (pending → accept), без silent auto-join
- Freemium entitlements + 14-day Pro trial

### Клиенты

- Веб-приложение (логин, workspace, board, editor)
- Десктоп Tauri (темы, titlebar, cloud/guest)
- Ярлык запуска: рабочий стол `Relay.vbs` / `Relay.bat`

### Безопасность (база)

- RBAC через membership joins (IDOR → 404)
- HttpOnly session cookie; Bearer для desktop
- Отзыв сессий (`sessions.jti`)
- Claim-secret на desktop OAuth
- Не линкуем OAuth к password-аккаунту без явного сценария
- CORS allowlist; CSP в Tauri; shell open только http(s)
- Лимиты размера content/board; entitlements по owner workspace
- Email verification (ещё нет — без почтового провайдера)
- Secure storage токена в Tauri (сейчас localStorage) — после MVP
- Прод-инфра (отдельный API, выбор БД, сессии как у зрелого SaaS) — **после** закрытия MVP, отдельным этапом

---

## 4. Архитектурные правила (НЕ НАРУШАТЬ)

1. **Бизнес-логика — в `src/domain/`**, не в React-компонентах и не «в обход» в route handler’ах.
2. **Доступ к данным пространства** — только через `requireWorkspaceAccess` / page repo с join на membership. Нельзя `select * from pages where id = ?` без проверки членства.
3. **API только под `/api/v1/...`**, ответы и ошибки — через `json` / `handleRouteError` / `ApiError`.
4. **Один источник правды для схемы** — `src/db/schema.ts` + `migrate.ts`. Не плодить параллельные SQL-скрипты.
5. **Не дублировать** веб-логику в десктопе «как получится»: десктоп ходит в тот же API; локальный store — только guest.
6. **Секреты** только в `relay/.env.local` (не в корне репо, не в git).
7. **Не класть JWT в URL / deep link.** Desktop = pair + claim.
8. **Не добавлять** второй бэкенд, вторую ORM, Redis «потому что надо», «временный» обход auth.
9. **UI**: не растить карточки/градиенты/glow без нужды; следовать существующим токенам.
10. **Перед крупным рефактором** — обновить этот SPEC и ARCHITECTURE, не «тихо» менять границы модулей.
11. **Не переписывать стек посреди MVP.** Сначала дописываем продукт, потом эволюция слоёв целиком.
12. **Лимиты workspace-фич** (страницы, инвайты, publish) считать по плану **owner** пространства, не по плану любого участника.

---

## 5. Карта модулей

```
relay/
  src/
    app/                 # Next pages + /api/v1 route handlers (тонкие)
    domain/              # auth, pages, workspaces, billing, prompts, access
    db/                  # schema, client, migrate
    editor/              # TipTap
    components/          # UI chrome
    lib/                 # session, cors, errors, rate-limit, ids
  desktop/               # Tauri + Vite React shell
  docs/                  # PRODUCT, ARCHITECTURE, SPEC, API, …
  data/relay.db          # локальная БД (gitignored)
```

---

## 6. Модель доступа и freemium


| Режим              | Данные       | Лимиты                    |
| ------------------ | ------------ | ------------------------- |
| Guest (desktop)    | localStorage | мало страниц, без команды |
| Free (после входа) | облако       | лимиты из `LIMITS.free`   |
| Pro / trialing     | облако       | лимиты Pro, trial 14 дней |


Роли в workspace: `owner` (manage), `editor` (write), `viewer` (read).

---

## 7. OAuth (актуально)

Активны в UI: Google, GitHub, Яндекс.  
VK: роуты могут остаться, **кнопок в UI нет**, пока нет бизнес-верификации VK ID.

Callback’и (local):

- `/api/v1/auth/oauth/{google|github|yandex}/callback`

Desktop: `POST /auth/desktop/pair` → browser → `POST /auth/desktop/claim` `{ code, claimSecret }`.

---

## 8. Что агентам делать / не делать

**Делать:** маленькие осмысленные диффы; читать SPEC + ARCHITECTURE; сохранять RBAC; обновлять docs при смене контракта API.

**Не делать:** god-компоненты; копипаст domain-логики в UI; новые таблицы «на всякий»; отключать auth «для проверки»; коммитить `.env`; force-push; silent architecture rewrites.

Если задача конфликтует с этим SPEC — **остановиться и спросить пользователя**, а не «упростить архитектуру».