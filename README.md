# Relay

**Pages + infinite canvas** in one workspace — for people and small teams.  
Russian UI · Next.js web · Tauri desktop · Google / GitHub / email auth.

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#desktop">Desktop</a> ·
  <a href="#authentication">Auth</a> ·
  <a href="#documentation">Docs</a>
</p>

---

## What’s inside

| Path | Role |
|---|---|
| [`relay/`](./relay/) | **The application** (web API, UI, desktop shell) |
| Root `package.json` | Thin wrapper — `npm run dev` forwards into `relay/` |

Everything product-related lives under **`relay/`**. Open that folder on a new machine after clone.

### Product highlights

- **Infinite canvas** (tldraw) as the home screen of a workspace  
- **Block pages** (TipTap) with Холст / Текст modes  
- **Teams** — workspaces, roles (`owner` / `editor` / `viewer`), invites  
- **Freemium foundation** — 14-day Pro trial, plan limits on the API  
- **Guest mode** on desktop (limited local pages) → full cloud after sign-in  

---

## Quick start

**Requirements:** Node.js 20+, npm.

```bash
git clone https://github.com/LevixandrX/Relay.git
cd Relay/relay

cp .env.example .env.local
# edit .env.local — at least set AUTH_SECRET (32+ characters)

npm install
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

From the repository root you can also run:

```bash
npm run dev          # → relay
npm run db:migrate
```

### Minimal `relay/.env.local`

> Env vars are read from **`relay/.env.local`** only — the root of the repo is just a wrapper.

```env
AUTH_SECRET=replace-with-a-long-random-string
DATABASE_URL=file:./data/relay.db
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
CORS_ORIGINS=http://127.0.0.1:1420,http://localhost:1420,tauri://localhost,https://tauri.localhost
```

Optional later: `GOOGLE_*`, `GITHUB_*`, `YANDEX_*`, `VK_*`, `OPENAI_API_KEY`.  
See [`relay/.env.example`](./relay/.env.example) for the full list and OAuth redirect URLs.

---

## Desktop

Tauri 2 + React (Vite). Guest mode works offline; cloud needs the web API running.

```bash
# terminal 1 — API
cd relay && npm run dev

# terminal 2 — UI
cd relay/desktop
cp .env.example .env   # optional; defaults to http://127.0.0.1:3000
npm install
npm run dev            # http://127.0.0.1:1420
# or: npm run tauri:dev
```

On Windows, native builds need **Visual Studio Build Tools** (C++ workload) and Rust (`rustup`).

More detail: [`relay/desktop/README.md`](./relay/desktop/README.md).

---

## Authentication

| Method | Notes |
|---|---|
| Email + password | Works out of the box |
| Google / GitHub / Yandex / VK | Create **Web** OAuth clients; set env vars |

Redirect URIs (local):

- `http://localhost:3000/api/v1/auth/oauth/google/callback`
- `http://localhost:3000/api/v1/auth/oauth/github/callback`
- `http://localhost:3000/api/v1/auth/oauth/yandex/callback`
- `http://localhost:3000/api/v1/auth/oauth/vk/callback`

API accepts session **cookie** or `Authorization: Bearer` (desktop).

**Desktop OAuth** uses a browser handshake: the app asks
`POST /api/v1/auth/desktop/pair` for a one-time `{ code, claimSecret }`, opens the provider in the system browser,
and polls `POST /api/v1/auth/desktop/claim` until the token is ready. Nothing to register in the OS.

---

## Documentation

All docs are under [`relay/docs/`](./relay/docs/):

| Doc | Contents |
|---|---|
| [SPEC](./relay/docs/SPEC.md) | **ТЗ / source of truth для агентов** |
| [PRODUCT](./relay/docs/PRODUCT.md) | Scope & principles |
| [ARCHITECTURE](./relay/docs/ARCHITECTURE.md) | Stack & module boundaries |
| [API](./relay/docs/API.md) | REST `/api/v1` |
| [DATA-MODEL](./relay/docs/DATA-MODEL.md) | Schema |
| [UX](./relay/docs/UX.md) | Design notes |
| [DEVELOPMENT](./relay/docs/DEVELOPMENT.md) | Dev workflow |
| [KILLER-FEATURES](./relay/docs/KILLER-FEATURES.md) | Live Prompt, Pulse, onboarding |

---

## Scripts (`relay/`)

| Script | Purpose |
|---|---|
| `npm run dev` | Web app + API (frees port 3000) |
| `npm run dev:clean` | Same + clear `.next` |
| `npm run db:migrate` | Apply LibSQL schema |
| `npm run build` / `npm start` | Production web |
| `npm run desktop:dev` | Desktop Vite UI |
| `npm run desktop:tauri` | Native Tauri window |

---

## Stack

- **Web:** Next.js (App Router), TipTap, tldraw, Drizzle + LibSQL, jose JWT  
- **Desktop:** Tauri 2, React, Vite  
- **Auth:** email + Google + GitHub  

---

## License

Private repository — all rights reserved unless otherwise noted.
