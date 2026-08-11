# Relay Desktop

Лёгкий десктопный шелл на **Tauri 2 + React (Vite)**.

## Режимы

| Режим | Что доступно |
|---|---|
| **Гость** | Локальные страницы/холст, лимит **3 страницы**, без команды |
| **Облако** | После входа (email / Google / GitHub): sync, пространства, команда, trial Pro |

API: `VITE_API_URL` (по умолчанию `http://127.0.0.1:3000`). Нужен запущенный веб-бэкенд (`cd relay && npm run dev`).

## Запуск

Нужны: Node 20+, Rust, на Windows — **VS Build Tools** (`link.exe`).

```bash
# один раз
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

```bash
cd relay
npm run db:migrate
npm run dev                 # API :3000

cd desktop
npm install
# optional: echo VITE_API_URL=http://127.0.0.1:3000 > .env
npm run dev                 # UI :1420
npm run tauri:dev           # нативное окно
```

Из корня `relay/`: `npm run desktop:dev` / `desktop:tauri`.

## OAuth на desktop

1. Настрой `GOOGLE_*` / `GITHUB_*` в `relay/.env.local` (см. `.env.example`).
2. В консолях провайдеров добавь redirect:
   - `http://localhost:3000/api/v1/auth/oauth/google/callback`
   - `http://localhost:3000/api/v1/auth/oauth/github/callback`
3. В приложении: **Аккаунт → Продолжить с Google/GitHub/Яндекс/VK**. Откроется системный браузер; после
   подтверждения приложение само подхватит сессию (одноразовый `code` + `claimSecret` через
   `/api/v1/auth/desktop/pair` + `/claim`), регистрировать `relay://` в системе не нужно.

Callback URLs (локально):
- `http://localhost:3000/api/v1/auth/oauth/google/callback`
- `http://localhost:3000/api/v1/auth/oauth/github/callback`
- `http://localhost:3000/api/v1/auth/oauth/yandex/callback`
- `http://localhost:3000/api/v1/auth/oauth/vk/callback`

## Темы

Раздел **Тема**: светлая / тёмная / системная + акценты + свой цвет.
