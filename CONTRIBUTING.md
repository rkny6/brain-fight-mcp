# Contributing

Thanks for your interest in Brain Fight MCP.

## Development setup

```bash
git clone https://github.com/rkny6/brain-fight-mcp.git
cd brain-fight-mcp
npm install
npm test
npm run typecheck
npm run build
```

Requirements: **Node.js ≥ 20**. Native module `better-sqlite3` needs a working C++ toolchain on first install (Xcode CLT on macOS, build-essential on Linux).

Optional HTTP dev server:

```bash
npm run dev         # stdio via tsx
npm run dev:http    # Streamable HTTP on :8000
```

## Project layout

| Path | Role |
| --- | --- |
| `src/core/` | Deterministic engines: conflict, personality, relationship, continuity, memory, turn director, performance-instruction builders |
| `src/db/` | SQLite schema + repositories (`relationship_state`, `conflicts`, `active_conflicts`, `debate_turns`, `decision_outcomes`) |
| `src/mcp/tools/` | MCP tools: `start_debate`, `continue_conflict_turn`, `end_inner_conflict`, `summon_*`, `record_decision_outcome`, `get_relationship`, `reset_relationship`, `clear_database` |
| `src/mcp/resources/` | MCP resources (`angel://profile`, `devil://profile`, `relationship://state[/{sessionId}]`) |
| `src/prompts/` | Topic templates + prompt helpers used by engines/tools |
| `src/server/` | MCP server wiring (stdio + Streamable HTTP), CLI, integration tests |
| `src/types/` | Shared Zod schemas / types |

## Debate model (for contributors)

Debate is **turn-only**. There is no one-shot full-skit tool and no legacy `start_inner_conflict` / `mode=full` path.

| Step | Tool | Notes |
| --- | --- | --- |
| Open | `start_debate` | One speaker per response; opens `active_conflicts` + first `debate_turns` row |
| Continue | `continue_conflict_turn` | Next speaker; optional `lastUtterance` / `userInterjection` / forced `speaker` |
| End | `end_inner_conflict` | Settles memory + relationship; Client should pass judged `winner` |
| Follow-up | `record_decision_outcome` | Only when the user later volunteers real-world choice / result |

### Contributor rules for this path

- **Client naturalness:** understand user → write **constraint-axis** `seed` (`tension` / `angelMust` / `devilMust` / optional `userDetails` / `forbidden`) → call `start_debate` with a real **`domain`** (`career` | `money` | `relationships` | `health` | `general`). No `seed` ⇒ keyword/overlap topic pick + auto-extracted `userDetails` from context (still more template-like than a real seed; generic Safety-vs-Freedom only when weak).
- Engines keep rails **plain** (no dramatize/intensify rewrites of seed wording). `performance_instructions` print **CONSTRAINT AXES** + grounding + anti-recite rules. Do not break this without updating README + `SERVER_INSTRUCTIONS` in `src/server/createServer.ts`.
- Turn director: `src/core/turnEngine.ts` (`maxTurns` low=2 / medium=4 / high=6; rare double-tap). Active debate persistence: `src/db/repositories/activeConflictRepository.ts`.
- Relationship + finished conflict memory update **only** on `end_inner_conflict`. Starting a new debate abandons any previous open debate on that session/domain path.
- `end_inner_conflict` without an explicit `winner` falls back to pre-debate `likelyWinner` — that is a last resort, not the intended product behavior. Prefer Client-judged winners in docs, prompts, and tests.
- Domain bucketing is part of the public contract: trust / annoyance / outcomes are per `(sessionId, domain)`. Don't collapse everything into `general` in examples or tests unless that is the point.
- Solo tools `summon_angel` / `summon_devil` must **not** open conflicts or mutate relationship scores.

## Guidelines

- Prefer **deterministic** engines over LLM calls on the server. This process must stay $0 inference.
- Keep tools **session-scoped** via `sessionId` (default `"default"`), and **domain-scoped** where relationship/history/outcomes apply.
- Wipe tools must cover turn-mode + outcome tables too (`active_conflicts`, `debate_turns`, `decision_outcomes`, and domain-aware `relationship_state` / `conflicts`).
- `reset_relationship` / `clear_database` require explicit `confirm: true`.
- Add or update **vitest** coverage for engine and MCP behavior changes. For debate changes, cover **open → continue → end** (and outcome recording when touching that path).
- Keep HTTP transport (`--http`, token, health) working if you touch `src/server/`.
- Run `npm test && npm run typecheck && npm run build` before opening a PR.
- If you change tool names, schemas, or `SERVER_INSTRUCTIONS`, update **README.md** (EN + 中文 sections) in the same PR.

## Pull requests

1. Fork and branch from `main`.
2. Keep changes focused; include tests for behavior changes.
3. Describe *why*, plus any session / domain / DB migration implications.
4. Do not commit build artifacts, local DB files, or zip archives (`dist/` and `*.sqlite3*` are gitignored; leave `Archive*.zip` out of the tree).

## Reporting issues

Open a GitHub issue with: Node version, OS, MCP client, `sessionId` / `domain` if relevant, and steps to reproduce. Do not paste secrets, tokens, or full private chat logs.
