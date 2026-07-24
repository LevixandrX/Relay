# Killer features

These ship in the MVP window — they are product bets, not polish.

## 1. Live Prompt (`promptBlock`)

A first-class block type. User writes an instruction; **Run** sends the structured page AST (not scraped HTML) to a runner:

- If `OPENAI_API_KEY` is set → LLM returns new blocks inserted below the prompt
- If not → **local heuristics** still work (summarize headings, turn checklist into email draft, extract action items) so the feature demos offline

Why it matters: most Notion clones paste AI into a chat sidebar. Relay treats the page as the program.

Endpoint: `POST /api/v1/pages/:id/run-prompt`

## 2. Intent Onboarding

At register, one question: *What brings you to Relay?*

| Intent | Seeded pages |
|---|---|
| `write` | Writing desk, Drafts |
| `plan` | Roadmap, Weekly plan |
| `team` | Team hub, Meeting notes |

Plus a shared **Getting started** page that demonstrates blocks and Live Prompt.

## 3. Relay Pulse

Sidebar strip of the last ~10 audit events in the workspace (`page.create`, `page.update`, `page.publish`, `member.invite`). Makes the workspace feel alive without a full activity product.

## Guardrails

- Live Prompt rate-limited (10/day/workspace without key; higher with key)
- Prompt output always validated through the same Zod AST whitelist before insert
- Heuristic mode never executes user code
