# Contributing

Thanks for your interest in Angel & Devil MCP.

## Development setup

```bash
git clone https://github.com/jxz6/angel-devil-mcp.git
cd angel-devil-mcp
npm install
npm test
npm run typecheck
npm run build
```

Requirements: **Node.js ≥ 20**. Native module `better-sqlite3` needs a working C++ toolchain on first install (Xcode CLT on macOS, build-essential on Linux).

## Project layout

| Path | Role |
| --- | --- |
| `src/core/` | Rule engines (conflict, personality, relationship, continuity, memory) |
| `src/db/` | SQLite schema + repositories |
| `src/mcp/tools/` | MCP tool handlers |
| `src/mcp/resources/` | MCP resources |
| `src/prompts/` | Prompt / performance text builders |
| `src/server/` | MCP server wiring |
| `src/types/` | Shared Zod schemas / types |

## Guidelines

- Prefer **deterministic** engines over LLM calls on the server.
- Keep tools **session-scoped** via `sessionId` (default `"default"`).
- Add or update **vitest** coverage for engine and MCP behavior changes.
- Run `npm test && npm run typecheck && npm run build` before opening a PR.

## Pull requests

1. Fork and branch from `main`.
2. Keep changes focused; include tests for behavior changes.
3. Describe *why* and any session/DB implications.

## Reporting issues

Open a GitHub issue with: Node version, OS, MCP client, `sessionId` if relevant, and steps to reproduce. Do not paste secrets or full private chat logs.
