# Ноут в дорогу — Relay + Cursor

Срочный чеклист: чистая Windows-машина и перенос контекста чата.

## 1. Contributors / cursoragent

В истории `main` сейчас **только** `LexandrX`. GitHub API `/contributors` тоже отдаёт одного автора.

Если на странице репо всё ещё видно `cursoragent` — это **кэш UI** после старых коммитов с `Co-authored-by: Cursor`. Сделай hard refresh (Ctrl+F5) или открой в инкогнито. Переписывать историю снова не нужно.

В новых коммитах **не оставляй** строки `Co-authored-by: Cursor` / `cursoragent` — иначе агент снова появится в Contributors.

## 2. Софт на ноуте (автоматически)

На ноуте (PowerShell, лучше от админа):

```powershell
# 1) Поставь Git вручную, если winget ещё нет: https://git-scm.com
# 2) Клонируй репо ИЛИ скопируй папку с флешки
cd $HOME
git clone https://github.com/LevixandrX/Relay.git "Notion 2"
cd "Notion 2\relay"
powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows-dev.ps1 -RepoDir "$HOME\Notion 2"
```

Скрипт ставит через winget: **Git**, **Node LTS**, **Rust**, **WebView2**, делает `npm install`, миграции БД, `.env.local` из example.

Только сайт без Rust/Tauri:

```powershell
powershell -File .\scripts\setup-windows-dev.ps1 -SkipRust -SkipDesktop
```

После первой установки winget-пакетов **закрой терминал и открой новый** (PATH), потом снова запусти скрипт.

### Вручную (если winget глючит)

1. [Node.js LTS](https://nodejs.org)
2. [Git](https://git-scm.com)
3. [Rust](https://rustup.rs) + Visual Studio Build Tools (C++), если `tauri` ругается на linker
4. [Cursor](https://cursor.com)
5. Edge WebView2 Runtime (обычно уже есть на Win10/11)

Потом:

```powershell
cd "$HOME\Notion 2\relay"
npm install
copy .env.example .env.local   # если ещё нет
# впиши AUTH_SECRET (длинная случайная строка)
npm run db:migrate
npm run dev                    # http://localhost:3000

# десктоп
cd desktop; npm install; cd ..
npm run desktop:start
```

## 3. Чат Cursor на втором ноуте

**Важно:** история агента **не синхронизируется** через аккаунт Cursor. Settings Sync ≠ чаты.

Рабочие варианты:

### A. Быстро (рекомендую сегодня вечером)

На этом ПК запусти упаковку:

```powershell
cd "G:\Notion 2\relay"
powershell -ExecutionPolicy Bypass -File .\scripts\pack-cursor-chat.ps1
```

Получишь папку `cursor-travel-pack\` (или на флешке). На ноуте:

1. Поставь Cursor, войди в **тот же аккаунт**.
2. Открой репо (лучше тот же относительный путь или см. ниже `subst`).
3. Закрой Cursor полностью.
4. Запусти `restore-cursor-chat.ps1` из пакета.
5. Открой Cursor → Agent → прошлые transcripts могут появиться в истории проекта.

Если путь другой (`C:\Users\...\Notion 2` вместо `G:\Notion 2`), Cursor создаёт **другой** hash папки проекта — тогда restore кладёт файлы в правильный ключ автоматически (скрипт считает hash по пути, который ты укажешь).

### B. Стабильный путь как на десктопе

Если хочешь максимально совпасть с `G:\Notion 2`:

```powershell
# один раз после клона, от админа
subst G: C:\Users\ТВОЙ_ЮЗЕР\Notion 2
# потом открывай в Cursor именно G:\Notion 2
```

### C. Без переноса UI-истории

Открой на ноуте этот файл + `docs/SPEC.md` / `docs/ARCHITECTURE.md` — агент подхватит правила репо. Старый длинный чат не обязателен для работы.

## 4. Что положить на флешку сегодня

| Что | Зачем |
|-----|--------|
| Весь репо `Notion 2` (или свежий `git clone` на ноуте) | код |
| `relay/.env.local` | секреты (не коммить!) |
| `cursor-travel-pack\` | история чата |
| Установщики offline (по желанию): Node LTS MSI, Cursor, rustup-init | если в поезде нет нормального интернета |

## 5. Проверка «готово к выезду»

На ноуте должны открываться:

- [ ] `node -v` / `npm -v` / `git --version`
- [ ] `cd relay && npm run dev` → localhost:3000
- [ ] (опционально) `npm run desktop:start` — окно Tauri
- [ ] Cursor открывает папку проекта, Agent отвечает
- [ ] Contributors на GitHub: только ты (после Ctrl+F5)
