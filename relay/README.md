# Relay (app)

This folder is the **Relay application**. Parent repo README: [../README.md](../README.md).

## Run

```bash
cp .env.example .env.local
npm install
npm run db:migrate
npm run dev
```

→ http://localhost:3000

## Layout

```
src/           Next.js app, API, domain, editor
desktop/       Tauri + Vite desktop shell
docs/          Product & engineering docs
scripts/       Dev helpers (port cleanup, etc.)
```

## Docs

| Doc | Contents |
|---|---|
| [PRODUCT](docs/PRODUCT.md) | Scope, activation, principles |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Stack, modules, security |
| [DATA-MODEL](docs/DATA-MODEL.md) | Tables + content format |
| [API](docs/API.md) | REST endpoints |
| [UX](docs/UX.md) | Design & onboarding |
| [KILLER-FEATURES](docs/KILLER-FEATURES.md) | Live Prompt, Intent, Pulse |
| [DEVELOPMENT](docs/DEVELOPMENT.md) | Setup for humans & agents |
| [desktop/README](desktop/README.md) | Desktop / Tauri |

## Environment

Copy [`.env.example`](./.env.example) → `.env.local`. Never commit secrets.
