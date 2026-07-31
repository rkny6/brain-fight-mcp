# Brain Fight MCP (v0.1)

[![CI](https://github.com/rkny6/brain-fight-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/rkny6/brain-fight-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/brain-fight-mcp.svg)](https://www.npmjs.com/package/brain-fight-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Languages:** [English](#brain-fight-mcp-v01) · [中文](#brain-fight-mcp-v01-中文)

A zero-cost **MCP** server that stages theatrical **Angel vs Devil** (inner **brain fight**)
debates. The server never calls an LLM: relationship state, memory, speaker turns, and
optional constraint-axis seeds come from deterministic engines + local SQLite. The
**Client LLM** performs the dialogue from `performance_instructions`.

Debate is **turn-only**:

| Step | Tool | Client LLM job |
| --- | --- | --- |
| 1 | `start_debate` | Perform **only** the returned speaker |
| 2…n | `continue_conflict_turn` | Perform **only** the next speaker |
| end | `end_inner_conflict` | Judge a real `winner`, then give one OOC next step |

There is **no** one-shot full-skit mode. It was removed because a pre-debate winner could
quietly corrupt relationship state and recorded outcomes.

Supports **stdio** (default) and optional **Streamable HTTP** (`--http`) for remote MCP
clients, tunnels, or a VPS.

## Why

Ask "should I quit my job?" and get Angel arguing caution and Devil arguing boldness —
with an evolving relationship (respect, annoyance, cooperation) that changes conflict to
conflict, occasional role swaps, domain-scoped track records, and turn-by-turn direction.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ MCP Client (Claude Desktop / Code / other)                  │
│  • understands the user                                     │
│  • writes constraint-axis seed                              │
│  • calls tools                                              │
│  • performs Angel 😇 / Devil 😈 from performance_instructions│
└───────────────────────────┬─────────────────────────────────┘
                            │ MCP (stdio or Streamable HTTP)
┌───────────────────────────▼─────────────────────────────────┐
│ brain-fight-mcp (this process — $0 inference)               │
│  tools / resources / prompts                                │
│  engines: conflict · turn · relationship · continuity ·     │
│           memory · personality · performance instructions   │
│  SQLite: ~/.brain-fight-mcp/state.sqlite3                   │
└─────────────────────────────────────────────────────────────┘
```

### Responsibility split

| Layer | Owns | Does **not** own |
| --- | --- | --- |
| **Server** | State, speaker order, seeds/templates, relationship math, memory, director notes | Spoken dialogue, final winner judgment of what was said |
| **Client LLM** | Writing lines in character, judging who argued better, OOC next step | Persisting scores / history (server does that) |

### Source layout

```text
src/
  index.ts                 # entry: stdio or --http
  server/                  # createServer, CLI, HTTP transport
  mcp/tools/               # start_debate, continue, end, summon, outcome, …
  mcp/resources/           # angel/devil profiles, relationship state
  core/                    # deterministic engines
  db/                      # SQLite + repositories
  prompts/                 # topic templates + prompt helpers
  types/                   # zod schemas / shared types
```

### Engine pipeline (one debate)

1. **Client** drafts a constraint-axis `seed` + picks a `domain`.
2. **`start_debate`** → `conflictEngine` builds stances; `turnEngine` picks first speaker
   and `maxTurns`; row lands in `active_conflicts` + first `debate_turns` row.
3. Client performs **only** that speaker from `performance_instructions`.
4. **`continue_conflict_turn`** (optional `lastUtterance` / `userInterjection` / `speaker`)
   advances one turn at a time.
5. **`end_inner_conflict`** with Client-judged `winner` → `memoryEngine.remember` +
   `relationshipEngine.applyConflictResult` + OOC next-step instructions.
6. Later, if the user volunteers what they actually did → **`record_decision_outcome`**.

### SQLite tables

| Table | Contents |
| --- | --- |
| `relationship_state` | Per-`(sessionId, domain)` respect / annoyance / cooperation |
| `conflicts` | Finished conflict history (continuity) |
| `active_conflicts` | Open turn debates (at most one open per session+domain path) |
| `debate_turns` | Spoken turns for open/closed turn debates |
| `decision_outcomes` | Real-world follow-ups the user volunteered |

Character profiles are **not** in SQLite (static in code).

Default DB path: `~/.brain-fight-mcp/state.sqlite3`. Override with `BRAIN_FIGHT_DB_PATH`.

**Retention / forgetting** (runs opportunistically on each `start_debate` via
`runStorageMaintenance` — no cron):

1. **Zombie open debates** — `open` rows idle longer than **7 days**
   (`BRAIN_FIGHT_OPEN_STALE_DAYS`) are marked `abandoned`, then hard-deleted.
2. **Active transcripts** — always drop `abandoned`; drop `completed` older than
   **14 days** (`BRAIN_FIGHT_RETENTION_DAYS`).
3. **Durable history cap** — keep newest **50** `conflicts` and **50**
   `decision_outcomes` per `(sessionId, domain)`
   (`BRAIN_FIGHT_HISTORY_KEEP` / `BRAIN_FIGHT_OUTCOME_KEEP`). Older rows are
   deleted (outcomes cascade with their conflict). `relationship_state` stays
   one row per bucket (already bounded).
4. **VACUUM** — optional freelist reclaim after deletes:
   - default `auto`: only if ≥ **25** rows deleted (`BRAIN_FIGHT_VACUUM_MIN_DELETED`)
   - `BRAIN_FIGHT_VACUUM=on` always when anything was deleted; `=off` never

Manual full wipe still: `reset_relationship` (one session/domain) or
`clear_database` (everything); both need `confirm: true`.

Continuity `recall` only reads the recent N finished conflicts (default 3–5),
so rows past the cap (or past the recall window) no longer affect dialogue.

```bash
export BRAIN_FIGHT_RETENTION_DAYS=14      # completed active transcript age
export BRAIN_FIGHT_OPEN_STALE_DAYS=7      # idle open → abandoned
export BRAIN_FIGHT_HISTORY_KEEP=50        # max conflicts per session+domain
export BRAIN_FIGHT_OUTCOME_KEEP=50        # max outcomes per session+domain
export BRAIN_FIGHT_VACUUM=auto            # auto | on | off
```

---

## Install & Run

**Requirements:** Node.js ≥ 20. First install may compile native module `better-sqlite3`
(needs Xcode Command Line Tools on macOS, or build tools on Linux/Windows).

### From npm

```bash
npx -y brain-fight-mcp
```

### From source

```bash
git clone https://github.com/rkny6/brain-fight-mcp.git
cd brain-fight-mcp
npm install
npm run build
npm start
```

### Add to an MCP client (Claude Desktop / Claude Code / etc.)

```json
{
  "mcpServers": {
    "brain-fight": {
      "command": "npx",
      "args": ["-y", "brain-fight-mcp"]
    }
  }
}
```

Local development:

```json
{
  "mcpServers": {
    "brain-fight": {
      "command": "node",
      "args": ["/absolute/path/to/brain-fight-mcp/dist/index.js"]
    }
  }
}
```

### Streamable HTTP (remote / tunnel / VPS)

Default transport is still stdio. For Streamable HTTP:

```bash
npm run build
npm run start:http
# or:
# node dist/index.js --http --port 8000 --token 'replace-me'

export BRAIN_FIGHT_HTTP_TOKEN='replace-me'
export BRAIN_FIGHT_HTTP_PORT=8000
node dist/index.js --http
```

| Path | Purpose |
| --- | --- |
| `GET /health` | Liveness + auth flag |
| `ALL /mcp` | Streamable HTTP MCP endpoint |

Auth (recommended before any public URL):

- Header: `Authorization: Bearer <token>`
- Or query: `?token=<token>`

```text
http://127.0.0.1:8000/mcp
# client header: Authorization: Bearer replace-me
```

Quick tunnel:

```bash
# terminal 1
node dist/index.js --http --host 127.0.0.1 --port 8000 --token 'replace-me'

# terminal 2
cloudflared tunnel --url http://127.0.0.1:8000
# remote client URL: https://<random>.trycloudflare.com/mcp  (+ same Bearer token)
```

Notes:

- **HTTP MCP session** (`Mcp-Session-Id`) is transport-level and separate from tool
  `sessionId` (SQLite continuity).
- Binding `--host 0.0.0.0` without a token is warned; use a token for public exposure.
- This process still does **not** call an LLM. A remote **MCP client with an LLM** must
  connect and perform the debate.

Use a **stable `sessionId`** across rounds for continuity. Different projects/users should
use different session IDs so state does not collide.

### Remote / mobile clients (self-host)

Anyone can `git clone` / `npx` this server and run it themselves. **Whether a phone app
can use it depends on that app**, not on this repo.

| Setup | Works? | Typical clients |
| --- | --- | --- |
| Local **stdio** on a computer | ✅ | Claude Desktop, Claude Code, Cursor, other desktop MCP hosts that spawn a local process |
| Self-hosted **Streamable HTTP** on a VPS / home machine + tunnel | ✅ *if the client supports remote/custom HTTP MCP* | Desktop or mobile apps that let you paste an MCP URL + auth |
| Run Node **on the phone** as a local stdio MCP | ❌ practically no | Mobile apps almost never spawn a local Node MCP process |

**Important:** this server is only the director/scoreboard. The **client still needs an
LLM** (Claude, etc.) to perform Angel/Devil lines. Server inference cost stays $0;
client usage is billed by whoever provides the model.

#### Recommended path for remote / phone-capable apps

1. Deploy HTTP somewhere reachable (VPS, or laptop + Cloudflare Tunnel).
2. Always set a strong `--token` (or `BRAIN_FIGHT_HTTP_TOKEN`) before any public URL.
3. Prefer HTTPS via reverse proxy or tunnel; do not expose bare HTTP on the open internet
   without TLS if you can avoid it.
4. In the client, add a **remote MCP / custom connector** pointing at:

```text
https://<your-host>/mcp
Authorization: Bearer <your-token>
```

5. Confirm the app speaks **Streamable HTTP MCP** (same family as this server's `/mcp`
   endpoint). If it only supports stdio, local desktop, or a closed connector catalog,
   it will not attach to your self-hosted URL.
6. Keep using a stable tool `sessionId` in debates so relationship/memory continuity
   survives across chats; that is independent of the HTTP `Mcp-Session-Id`.

#### Minimal VPS-style example

```bash
git clone https://github.com/rkny6/brain-fight-mcp.git
cd brain-fight-mcp
npm install
npm run build

# bind only as needed; put a reverse proxy / tunnel in front for TLS
export BRAIN_FIGHT_HTTP_TOKEN='long-random-secret'
node dist/index.js --http --host 127.0.0.1 --port 8000 --token "$BRAIN_FIGHT_HTTP_TOKEN"
```

Then either:

- point nginx/Caddy at `127.0.0.1:8000` with HTTPS, or
- run `cloudflared tunnel --url http://127.0.0.1:8000` and use the issued
  `https://….trycloudflare.com/mcp` URL + Bearer token in the client.

Smoke-check:

```bash
curl -sS https://<your-host>/health
# expect JSON with ok: true (and an auth flag when token mode is on)
```

#### What mobile Claude (and similar apps) can / cannot do

- **Can (sometimes):** connect to your self-hosted HTTP MCP **if** that app's settings
  expose remote/custom MCP connectors and accept Streamable HTTP + Bearer auth.
- **Cannot (usually):** install this package on the phone and run it as a local stdio
  server the way Claude Desktop does on a Mac/PC.
- **Always true:** dialogue quality still depends on the client model; this process only
  returns state + `performance_instructions`.

App support changes over time — check your client's docs for “remote MCP”, “custom MCP
server”, or “HTTP connector”. This README documents the **server** side; it cannot
guarantee every mobile Claude build will expose a hook for arbitrary self-hosted MCPs.

---

## Usage guide (Client LLM)

This server is a **director / scoreboard**, not a dual-agent system. One Client LLM still
plays both voices when asked.

### Recommended client workflow

1. **Understand the user** — restate the dilemma in their concrete details.
2. **Write a constraint-axis `seed` first** — rails, not finished monologue lines:
   `tension`, `angelMust`, `devilMust`, optional `userDetails`, `forbidden`.
3. **Pick a `domain`** — `career` \| `money` \| `relationships` \| `health` \| `general`.
   Trust and outcome history are bucketed per `(sessionId, domain)`. Don't default to
   `general` when a clearer bucket applies.
4. Call **`start_debate`** with `seed` + `domain`.
5. Perform **only** the returned speaker from `performance_instructions` — do **not**
   paste raw JSON or recite tension/must rails as spoken lines.
6. **`continue_conflict_turn`** with `lastUtterance` / optional `userInterjection` until
   `shouldEnd` / max turns / user stops.
7. **`end_inner_conflict`** with your own judged `winner` (who actually argued better).
   The silent default is a **pre-debate** `likelyWinner`, not a verdict on the dialogue.
8. If the user later volunteers what they did / how it went → **`record_decision_outcome`**.
   Never ask them to file a report.

### Seed vs no-seed

**`seed` = director rails for this debate, not finished monologue lines.**  
The server turns rails into `performance_instructions`; the **Client LLM invents the spoken dialogue**.

| Who | Role |
| --- | --- |
| **User** | States a real dilemma in their own words |
| **Client LLM** | **Writes `seed` first** (recommended), calls tools, performs speakers |
| **This server** | Never writes dialogue; converts seed/templates into director notes + state |

**Preferred constraint-axis `seed`:**

| Field | Meaning | Not |
| --- | --- | --- |
| `tension` | The real opposing axis for this round | Not an opening monologue |
| `angelMust` | Argument **obligation** Angel must hold | Not Angel's script |
| `devilMust` | Argument **obligation** Devil must hold | Not Devil's script |
| `userDetails` | Concrete nails that must appear (people / money / deadlines) | Not a summary paragraph |
| `forbidden` | Empty slogans / tropes to ban | Not style adjectives |

**Resolution order inside `start_debate`:**

1. **Has `seed`** → use it (constraint axes preferred; legacy full-stance seed still accepted).
2. **No `seed`** → score EN/ZH topic templates on `context` / `topic`:
   - **keyword** hit (longer phrases win), else
   - **token-overlap** near-miss against template rails, else
   - **`GENERIC_TOPIC`** (**Safety vs Freedom**).
3. **Always (no seed)** → auto-extract `userDetails` anchors from free-form context
   (money, times, quoted phrases, common life nouns, content tokens) into the
   debate brief / CONSTRAINT AXES, plus anti-recite `forbidden` rails.

With a seed, keyword/overlap templates are **skipped entirely** (seed overrides templates).
Legacy seeds with empty `userDetails` also get a context backfill.

| | **Constraint seed (recommended)** | **No seed, keyword/overlap** | **No seed → generic** |
| --- | --- | --- | --- |
| Where the axis comes from | Client, from the user's real facts | Best-scored canned topic template | Fixed Safety vs Freedom |
| Dialogue specificity | Highest (Client-written `userDetails`) | Medium–high (template + **auto** `userDetails`) | Low axis, but still grounded by extracted facts |
| Recite risk | Lower (rails ≠ finished lines) | Medium (canned positions + anti-recite bans) | Higher |
| Best for | Real product path | Demos / classic / near-miss dilemmas | Last-resort when nothing matches |
| Server cost | Still $0 | $0 | $0 |

**No `seed`?** Allowed — the server will not error. Quality is better than a bare
Safety-vs-Freedom dump, but still below a real constraint seed:

- Matching is still **deterministic heuristics** (keyword length + token overlap),
  not an LLM understanding of the story — messy multi-axis dilemmas can still miss.
- Generic still collapses weak-signal text onto Safety-vs-Freedom, but extracted
  `userDetails` force concrete nouns into the performance rails.
- Template stances remain fuller canned positions (easier to recite than constraint
  rails); `forbidden` + anti-recite rules push the Client LLM off pure copy-paste.
- `domain` only buckets relationship / track-record scores; it does **not** invent
  a better debate axis.
- Continuity callbacks do **not** rewrite the core tension; for unique cases still
  write `seed` / `userDetails` yourself.

Mental model:

- **Main path** = Client writes seed → specific, grounded fight.
- **Fallback** = no seed → best template + auto anchors; runnable and less empty
  than before; still weaker for one-of-a-kind situations.

### Turn-by-turn flow

```text
Client writes constraint-axis seed + domain
start_debate(seed=..., domain=...)
  → Client performs ONLY speaker A
continue_conflict_turn(lastUtterance=..., userInterjection?=...)
  → Client performs ONLY speaker B
... until turn.shouldEnd / maxTurns / user stops ...
end_inner_conflict(winner=...)   # Client-judged
  → relationship settles + OOC next-step instructions

# optional, days later, only if user volunteered:
record_decision_outcome(conflictId=..., actualChoice=..., sentiment?=...)
```

Open:

```json
{
  "name": "start_debate",
  "arguments": {
    "context": "Should I quit my job tomorrow?",
    "intensity": "medium",
    "domain": "career",
    "firstSpeaker": "devil",
    "sessionId": "my-project",
    "seed": {
      "tension": "Quit tomorrow vs secure a runway first.",
      "angelMust": "Rent runway; one dramatic day does not pay next month.",
      "devilMust": "Heat of the decision is now; delay is rehearsing fear.",
      "userDetails": ["quit tomorrow", "next month's rent", "pointless standup"],
      "forbidden": ["generic safety vs freedom slogan"]
    }
  }
}
```

Continue:

```json
{
  "name": "continue_conflict_turn",
  "arguments": {
    "sessionId": "my-project",
    "lastUtterance": "Devil: Send the email before you talk yourself out of it.",
    "userInterjection": "But rent is due next week…",
    "speaker": "angel"
  }
}
```

End:

```json
{
  "name": "end_inner_conflict",
  "arguments": {
    "sessionId": "my-project",
    "winner": "angel",
    "lastUtterance": "Angel: Pad the runway first."
  }
}
```

Record a real-world follow-up (only what the user volunteered):

```json
{
  "name": "record_decision_outcome",
  "arguments": {
    "sessionId": "my-project",
    "conflictId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "actualChoice": "angel",
    "outcomeNote": "I waited two weeks and got a written offer.",
    "sentiment": "good"
  }
}
```

### Turn rules

1. **First speaker priority:** `firstSpeaker` → opposite of `recentWinner` → high
   `devilAnnoyance` → high `angelRespect` + low `cooperation` → topic bias → default Devil
2. **Mid debate:** alternate; `speaker` force wins; rare double-tap (~12%) when tense
3. **`maxTurns` by intensity:** low=2, medium=4, high=6
4. Relationship / finished memory update **only** on `end_inner_conflict`
5. Starting a new debate abandons any previous open debate in that session/domain path
6. Prefer low intensity for trivial decisions (fewer turns) instead of inventing a one-shot mode

### Solo takes

```json
{ "name": "summon_angel", "arguments": { "context": "Should I text my ex?", "sessionId": "my-project" } }
```

```json
{ "name": "summon_devil", "arguments": { "context": "Should I text my ex?", "sessionId": "my-project" } }
```

These do **not** open a conflict or change relationship scores. Client LLM writes a
first-person monologue from `performance_instructions`.

---

## Tools

| Tool | Purpose |
| --- | --- |
| `start_debate` | Open a turn-by-turn debate (one speaker per call). |
| `continue_conflict_turn` | Next speaker after `start_debate`. |
| `end_inner_conflict` | Close debate: memory + relationship + OOC next step. Pass Client-judged `winner`. |
| `summon_angel` | Angel's solo perspective (no conflict). |
| `summon_devil` | Devil's solo perspective (no conflict). |
| `record_decision_outcome` | Record what the user later said they actually did / how it went. |
| `get_relationship` | Relationship scores + recent conflicts + track record (domain-aware). |
| `reset_relationship` | Wipe one session (optionally one domain). Requires `confirm: true`. |
| `clear_database` | Wipe **all** sessions / tables. Requires `confirm: true`. |

Most tools accept optional `sessionId` (default `"default"`). `clear_database` is global.

### Tool parameters

#### `start_debate`

| Arg | Required | Default | Description |
| --- | --- | --- | --- |
| `context` | yes | — | Dilemma / situation text |
| `topic` | no | — | Short topic label |
| `intensity` | no | `medium` | `low` \| `medium` \| `high` |
| `sessionId` | no | `default` | State isolation key |
| `domain` | no | `general` | `career` \| `money` \| `relationships` \| `health` \| `general` |
| `firstSpeaker` | no | auto | `angel` \| `devil` |
| `seed` | no | — | **Write this first** (Client LLM). Prefer constraint axes |

**Preferred `seed` (constraint axes — invent dialogue from rails, do not recite):**

| Field | Required | Description |
| --- | --- | --- |
| `tension` | yes | What this round is about in one line |
| `angelMust` | yes | Argument obligation / axis for Angel |
| `devilMust` | yes | Argument obligation / axis for Devil |
| `userDetails` | no | Concrete facts (deadlines, people, money, systems) |
| `forbidden` | no | Optional bans (e.g. generic Safety-vs-Freedom slogan) |

Legacy full-stance seed fields are still accepted but easier to accidentally recite.

#### `continue_conflict_turn`

| Arg | Required | Default | Description |
| --- | --- | --- | --- |
| `sessionId` | no | `default` | Session key |
| `conflictId` | no | open conflict | Active debate id from start |
| `speaker` | no | auto | Force `angel` or `devil` |
| `userInterjection` | no | — | User's latest remark to answer |
| `lastUtterance` | no | — | Previous performed line (stored + used for reaction) |

#### `end_inner_conflict`

| Arg | Required | Default | Description |
| --- | --- | --- | --- |
| `sessionId` | no | `default` | Session key |
| `conflictId` | no | open conflict | Active debate id |
| `winner` | no* | engine `likelyWinner` | `angel` \| `devil` \| `draw` — **prefer explicit Client judgment** |
| `lastUtterance` | no | — | Final performed line to store |

\*Omitting `winner` falls back to a pre-debate random/weighted draw. Treat that as last resort.

#### `record_decision_outcome`

| Arg | Required | Default | Description |
| --- | --- | --- | --- |
| `conflictId` | yes | — | `conflict.id` from start/end |
| `actualChoice` | yes | — | `angel` \| `devil` \| `neither` \| `mixed` (real life, not debate winner) |
| `sessionId` | no | `default` | Session key |
| `outcomeNote` | no | — | Brief note in the user's words |
| `sentiment` | no | — | `good` \| `regret` \| `mixed` \| `too_early` |

#### `summon_angel` / `summon_devil`

| Arg | Required | Default | Description |
| --- | --- | --- | --- |
| `context` | yes | — | Situation text |
| `topic` | no | — | Short label |
| `sessionId` | no | `default` | Session key |

#### `get_relationship`

| Arg | Required | Default | Description |
| --- | --- | --- | --- |
| `sessionId` | no | `default` | Session key |
| `domain` | no | `general` (+ summary) | Pin one domain, or omit for general + `all_domains_summary` |

#### `reset_relationship` / `clear_database`

| Tool | Scope | Required arg |
| --- | --- | --- |
| `reset_relationship` | One `sessionId` (optional one `domain`) | `confirm: true` |
| `clear_database` | Entire SQLite file | `confirm: true` |

```json
{ "name": "reset_relationship", "arguments": { "sessionId": "my-project", "confirm": true } }
```

```json
{ "name": "clear_database", "arguments": { "confirm": true } }
```

---

## Resources

- `angel://profile` — static Angel personality profile
- `devil://profile` — static Devil personality profile
- `relationship://state` — live relationship state for the default session
- `relationship://state/{sessionId}` — live relationship state for a specific session

## Prompts

| Prompt | Purpose |
| --- | --- |
| `brain-fight-debate` | Draft `seed` → `start_debate` → continue/end → perform from `performance_instructions` |
| `summon-angel` | Call `summon_angel`, then generate Angel's monologue |
| `summon-devil` | Call `summon_devil`, then generate Devil's monologue |

---

## How the engine works

Server side (deterministic, $0 inference):

1. **Session + domain isolation** — continuity is keyed by `(sessionId, domain)`;
   `reset_relationship` clears one session (optionally one domain);
   `clear_database` empties the whole DB. Both require `confirm: true`.
2. **Topic matching / seeds** — Client `seed` overrides templates. Otherwise score
   keyword + token-overlap topic templates (expanded EN/ZH sets), then generic
   Safety-vs-Freedom when weak; **always** extract `userDetails` from context on the
   no-seed path. Recommended: **always write `seed` first**. Output is plain seed
   stances / rails, not the final script.
3. **Intensity scaling** — `low` / `medium` / `high` → extremity 0.3 / 0.6 / 0.9, pacing
   rules in `performance_instructions`, and `maxTurns` 2 / 4 / 6.
4. **Relationship bias** — high `angelRespect` → Angel more accommodating; high
   `devilAnnoyance` → Devil more contrarian.
5. **Role reversal** — if `cooperation > 0.7`, ~15% chance Angel/Devil swap archetypes
   (`isRoleReversal: true`).
6. **Continuity** — `recall` prior finished conflicts for the same session/domain and
   inject callbacks into seeds / instructions.
7. **Turn director** — first/next speaker, double-taps; delays finished memory +
   relationship settlement until `end_inner_conflict`.
8. **Outcomes** — optional real-world follow-ups feed `get_relationship` track records
   and future continuity (only when the user volunteered them).

Client side:

9. **Script generation** — Client LLM writes dialogue from cast, beats, intensity,
   continuity, and constraint axes. Do not recite seed lines verbatim.
10. **Winner judgment** — Client decides who argued better when ending; then one
    out-of-character actionable next step.

## Relationship update rules

Applied only when a conflict is **settled** via `end_inner_conflict`:

- Angel wins → `angelRespect += 0.02`, `devilAnnoyance += 0.03`
- Devil wins → `devilRespect += 0.02`, `angelAnnoyance += 0.03`
- Draw → `cooperation += 0.05`
- Role reversal occurred → `cooperation += 0.02` (stacks)

All values clamped to `[0, 1]`.

---

## Development

```bash
npm run dev         # stdio with tsx, no build step
npm run dev:http    # Streamable HTTP with tsx on :8000
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # tsup -> dist/index.js
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for PR guidelines.

## Publish (maintainers)

```bash
npm login
npm publish --access public
```

`prepublishOnly` runs typecheck, tests, and build. Package contents are limited to
`dist/`, `LICENSE`, and `README.md` (see `"files"` in `package.json`).

## Design notes

- **Zero server LLM cost** — engines + SQLite only; no API keys on this process.
- **Plan A script generation** — server is state + constraints; Client LLM generates dialogue.
- **Turn mode is director protocol, not dual agents** — one Client LLM still performs both
  voices; the server picks speaker, tracks turns, and settles relationship on end.
- **Domain bucketing** — career trust and snack-decision trust do not share one score.
- **Client-judged winners** — pre-debate `likelyWinner` is only a fallback.
- **stdio by default**; optional HTTP for remote MCP clients (use `--token`).
- Comedy over accuracy: Devil isn't always wrong, Angel isn't always right.

## License

[MIT](LICENSE) © rkny6

---

# Brain Fight MCP (v0.1) 中文

[![CI](https://github.com/rkny6/brain-fight-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/rkny6/brain-fight-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/brain-fight-mcp.svg)](https://www.npmjs.com/package/brain-fight-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**语言：** [English](#brain-fight-mcp-v01) · [中文](#brain-fight-mcp-v01-中文)

零成本 **MCP** 服务：编排戏剧化的 **天使 vs 恶魔**（内心 **brain fight**）辩论。
服务端**从不调用 LLM**：关系状态、记忆、发言顺序、可选的约束轴 seed，全部由确定性
引擎 + 本地 SQLite 完成。**客户端 LLM** 根据 `performance_instructions` 表演对白。

辩论是 **纯回合制（turn-only）**：

| 步骤 | 工具 | 客户端 LLM 要做的事 |
| --- | --- | --- |
| 1 | `start_debate` | **只**表演返回的那一位发言者 |
| 2…n | `continue_conflict_turn` | **只**表演下一位 |
| 结束 | `end_inner_conflict` | 自行判定真实 `winner`，再给一句戏外下一步建议 |

**没有**一次性完整小品（full-skit）模式。已移除：因为辩论前抽签的 winner 会悄悄污染
关系分和后续 outcome 记录。

默认 **stdio**；可选 **Streamable HTTP**（`--http`）给远程客户端 / 隧道 / VPS。

## 为什么做这个

问「我该不该辞职？」——天使讲谨慎，恶魔讲大胆；关系（尊重、恼火、合作）会跨场次演化，
偶尔角色互换，按生活领域分桶记战绩，并按回合导演发言。

## 架构

```text
┌─────────────────────────────────────────────────────────────┐
│ MCP 客户端（Claude Desktop / Code / 其他）                   │
│  • 理解用户处境                                              │
│  • 先写约束轴 seed                                           │
│  • 调用工具                                                  │
│  • 按 performance_instructions 表演天使 😇 / 恶魔 😈         │
└───────────────────────────┬─────────────────────────────────┘
                            │ MCP（stdio 或 Streamable HTTP）
┌───────────────────────────▼─────────────────────────────────┐
│ brain-fight-mcp（本进程 — 推理费用 $0）                       │
│  tools / resources / prompts                                 │
│  引擎：conflict · turn · relationship · continuity ·         │
│        memory · personality · performance instructions       │
│  SQLite：~/.brain-fight-mcp/state.sqlite3                    │
└─────────────────────────────────────────────────────────────┘
```

### 职责划分

| 层 | 负责 | **不**负责 |
| --- | --- | --- |
| **服务端** | 状态、发言顺序、seed/模板、关系分、记忆、导演备注 | 对白正文、对「谁说得更好」的最终裁决 |
| **客户端 LLM** | 入戏写台词、判定谁更有说服力、戏外下一步 | 持久化分数/历史（服务端做） |

### 源码结构

```text
src/
  index.ts                 # 入口：stdio 或 --http
  server/                  # createServer、CLI、HTTP 传输
  mcp/tools/               # start_debate、continue、end、summon、outcome…
  mcp/resources/           # 天使/恶魔人设、关系状态
  core/                    # 确定性引擎
  db/                      # SQLite + repositories
  prompts/                 # 话题模板与 prompt 辅助
  types/                   # zod schema / 共享类型
```

### 一场辩论的流水线

1. **客户端**起草约束轴 `seed`，并选择 `domain`。
2. **`start_debate`** → `conflictEngine` 生成立场；`turnEngine` 选首位发言者与
   `maxTurns`；写入 `active_conflicts` 与首条 `debate_turns`。
3. 客户端**只**表演该发言者。
4. **`continue_conflict_turn`**（可选 `lastUtterance` / `userInterjection` / `speaker`）
   一次推进一回合。
5. **`end_inner_conflict`** 带上客户端判定的 `winner` → 记记忆 + 更新关系 + 戏外下一步。
6. 若用户事后主动说了真实选择/结果 → **`record_decision_outcome`**。

### SQLite 表

| 表 | 内容 |
| --- | --- |
| `relationship_state` | 按 `(sessionId, domain)` 的尊重 / 恼火 / 合作 |
| `conflicts` | 已结束冲突历史（连续性） |
| `active_conflicts` | 进行中的回合辩论 |
| `debate_turns` | 各回合发言记录 |
| `decision_outcomes` | 用户主动反馈的真实世界结果 |

角色人设**不**进 SQLite（代码内静态）。

默认库路径：`~/.brain-fight-mcp/state.sqlite3`。可用 `BRAIN_FIGHT_DB_PATH` 覆盖。

**保留 / 遗忘**（每次 `start_debate` 顺带跑 `runStorageMaintenance`，无 cron）：

1. **僵尸 open** — 闲置超过 **7 天**（`BRAIN_FIGHT_OPEN_STALE_DAYS`）的 `open`
   先标 `abandoned`，再硬删。
2. **进行中/已完成 transcript** — 始终删 `abandoned`；删超过 **14 天**的
   `completed`（`BRAIN_FIGHT_RETENTION_DAYS`）。
3. **持久历史上限** — 每个 `(sessionId, domain)` 只保留最新 **50** 条
   `conflicts` 与 **50** 条 `decision_outcomes`
   （`BRAIN_FIGHT_HISTORY_KEEP` / `BRAIN_FIGHT_OUTCOME_KEEP`）；更老的删除
   （outcome 随 conflict 级联）。`relationship_state` 每桶一行，本身有界。
4. **VACUUM** — 删除后可选回收空闲页：
   - 默认 `auto`：一次删 ≥ **25** 行才 VACUUM（`BRAIN_FIGHT_VACUUM_MIN_DELETED`）
   - `BRAIN_FIGHT_VACUUM=on` 有删就做；`=off` 永不

手动全清仍用：`reset_relationship`（单 session/domain）或 `clear_database`（全库），
均需 `confirm: true`。

连续性 `recall` 只读最近 N 条已结束冲突（默认 3–5），超出 cap / 窗口的不再影响对白。

```bash
export BRAIN_FIGHT_RETENTION_DAYS=14
export BRAIN_FIGHT_OPEN_STALE_DAYS=7
export BRAIN_FIGHT_HISTORY_KEEP=50
export BRAIN_FIGHT_OUTCOME_KEEP=50
export BRAIN_FIGHT_VACUUM=auto
```

---

## 安装与运行

**要求：** Node.js ≥ 20。首次安装可能编译原生模块 `better-sqlite3`
（macOS 需 Xcode Command Line Tools；Linux/Windows 需对应构建工具）。

### 用 npm

```bash
npx -y brain-fight-mcp
```

### 从源码

```bash
git clone https://github.com/rkny6/brain-fight-mcp.git
cd brain-fight-mcp
npm install
npm run build
npm start
```

### 接入 MCP 客户端

```json
{
  "mcpServers": {
    "brain-fight": {
      "command": "npx",
      "args": ["-y", "brain-fight-mcp"]
    }
  }
}
```

本地开发：

```json
{
  "mcpServers": {
    "brain-fight": {
      "command": "node",
      "args": ["/absolute/path/to/brain-fight-mcp/dist/index.js"]
    }
  }
}
```

### Streamable HTTP（远程 / 隧道 / VPS）

```bash
npm run build
npm run start:http
# 或：
# node dist/index.js --http --port 8000 --token 'replace-me'

export BRAIN_FIGHT_HTTP_TOKEN='replace-me'
export BRAIN_FIGHT_HTTP_PORT=8000
node dist/index.js --http
```

| 路径 | 用途 |
| --- | --- |
| `GET /health` | 探活 + 是否启用鉴权 |
| `ALL /mcp` | Streamable HTTP MCP 端点 |

鉴权（公网前建议开启）：

- Header：`Authorization: Bearer <token>`
- 或 query：`?token=<token>`

说明：

- HTTP 的 `Mcp-Session-Id` 是传输层会话，与工具参数 `sessionId`（SQLite 连续性）无关。
- `--host 0.0.0.0` 且无 token 会有警告；公网务必加 token。
- 本进程**仍不**调用 LLM；需要带 LLM 的 MCP 客户端来表演辩论。

跨场次请使用**稳定的 `sessionId`**。不同项目/用户用不同 session，避免状态串台。

### 远程 / 手机客户端（自建部署）

任何人都可以 `git clone` / `npx` 后自己跑这个服务。**手机 App 能不能接上，取决于该
App 是否支持远程/自定义 MCP**，不取决于本仓库有没有 HTTP 模式。

| 部署方式 | 能不能用 | 典型客户端 |
| --- | --- | --- |
| 电脑本地 **stdio** | ✅ | Claude Desktop、Claude Code、Cursor 等会拉起本地进程的桌面 MCP 宿主 |
| 自建 **Streamable HTTP**（VPS / 家里机器 + 隧道） | ✅ *前提是客户端支持远程/自定义 HTTP MCP* | 允许填写 MCP URL + 鉴权的桌面或手机 App |
| 在**手机里**跑 Node 当本地 stdio MCP | ❌ 基本不行 | 手机 App 几乎不会在本机 spawn Node MCP 进程 |

**重要：** 本服务只做导演/记分板。**客户端仍需要带 LLM**（Claude 等）来演天使/恶魔
台词。服务端推理费用 $0；模型用量按客户端提供方计费。

#### 远程 / 可能支持手机的推荐路径

1. 把 HTTP 服务部署到可访问的地方（VPS，或笔记本 + Cloudflare Tunnel）。
2. 任何公网 URL 前都设置强随机 `--token`（或 `BRAIN_FIGHT_HTTP_TOKEN`）。
3. 尽量用反向代理或隧道提供 **HTTPS**；能避免就不要把裸 HTTP 直接暴露在公网。
4. 在客户端里添加 **远程 MCP / 自定义 connector**，指向：

```text
https://<你的域名或隧道>/mcp
Authorization: Bearer <你的 token>
```

5. 确认该 App 使用的是 **Streamable HTTP MCP**（与本服务 `/mcp` 同类）。若它只支持
   stdio、仅桌面本地、或封闭的官方 connector 列表，就接不上你的自建 URL。
6. 辩论时继续使用稳定的工具参数 `sessionId`，关系/记忆连续性才能跨对话保留；这与
   HTTP 的 `Mcp-Session-Id` 无关。

#### 最小 VPS 示例

```bash
git clone https://github.com/rkny6/brain-fight-mcp.git
cd brain-fight-mcp
npm install
npm run build

# 按需绑定；前面再挂反向代理 / 隧道做 TLS
export BRAIN_FIGHT_HTTP_TOKEN='long-random-secret'
node dist/index.js --http --host 127.0.0.1 --port 8000 --token "$BRAIN_FIGHT_HTTP_TOKEN"
```

然后任选：

- 用 nginx/Caddy 反代 `127.0.0.1:8000` 并上 HTTPS，或
- 跑 `cloudflared tunnel --url http://127.0.0.1:8000`，在客户端填
  `https://….trycloudflare.com/mcp` + Bearer token。

探活：

```bash
curl -sS https://<你的主机>/health
# 期望返回带 ok: true 的 JSON（开启 token 时还会带鉴权相关字段）
```

#### 手机 Claude（及类似 App）能做什么 / 不能做什么

- **有时可以：** 若该 App 设置里开放了远程/自定义 MCP，并接受 Streamable HTTP + Bearer
  鉴权，就可以连你的自建服务。
- **通常不行：** 像桌面 Claude Desktop 那样在手机上安装本包、用本地 stdio 拉起进程。
- **始终成立：** 对白质量仍取决于客户端模型；本进程只返回状态 + `performance_instructions`。

各 App 能力会变——请查其文档里的 “remote MCP”、“自定义 MCP”、“HTTP connector” 等
说明。本 README 只保证**服务端**怎么部署；不能保证每一个手机 Claude 版本都提供挂载
任意自建 MCP 的入口。

---

## 使用指南（客户端 LLM）

服务端是**导演 / 记分板**，不是双 Agent 系统。同一个客户端 LLM 仍可扮演两边。

### 推荐工作流

1. **理解用户** — 用具体细节复述困境。
2. **先写约束轴 `seed`** — 是轨道不是成稿台词：`tension`、`angelMust`、`devilMust`，
   可选 `userDetails`、`forbidden`。
3. **选 `domain`** — `career` \| `money` \| `relationships` \| `health` \| `general`。
   信任与战绩按 `(sessionId, domain)` 分桶；能分清就不要偷懒用 `general`。
4. 调用 **`start_debate`**，带上 `seed` + `domain`。
5. **只**表演返回的发言者；**不要**粘贴原始 JSON，也**不要**把 tension/must 当台词念。
6. **`continue_conflict_turn`**，传 `lastUtterance` / 可选 `userInterjection`，直到
   `shouldEnd` / 达到 max turns / 用户叫停。
7. **`end_inner_conflict`** 传入你自己判定的 `winner`（谁在这场里更有说服力）。
   省略时的默认是**辩论前**的 `likelyWinner`，不是对台词的裁决。
8. 用户事后主动说了真实选择/结果 → **`record_decision_outcome`**。**不要**主动逼用户填表。

### Seed 有无对比

**`seed` = 本场辩论的导演轨道/约束，不是成稿独白。**  
服务端把轨道收成 `performance_instructions`；**真正说话的是客户端 LLM**。

| 角色 | 做什么 |
| --- | --- |
| **用户** | 用自己的话讲真实纠结 |
| **客户端 LLM** | **先写 `seed`**（推荐），再调工具，再按说明表演 |
| **本服务** | 不写对白；把 seed/模板变成导演备注 + 状态 |

**推荐的约束轴 `seed`：**

| 字段 | 含义 | 不是什么 |
| --- | --- | --- |
| `tension` | 本场真正对立的那一根轴 | 不是开场白 |
| `angelMust` | 天使这轮**必须守住**的论证义务 | 不是天使台词 |
| `devilMust` | 恶魔这轮**必须守住**的论证义务 | 不是恶魔台词 |
| `userDetails` | 必须写进对白的具体钉子（人/钱/期限） | 不是摘要段落 |
| `forbidden` | 禁止滑回去的空话/套路 | 不是风格形容词 |

**`start_debate` 内解析顺序：**

1. **有 `seed`** → 直接用（优先约束轴；旧版全立场 seed 仍接受）。
2. **没有 `seed`** → 对 `context` / `topic` 给中英话题模板打分：
   - **关键词**命中（更长短语优先），否则
   - **token 重叠**近邻匹配模板轨道，否则
   - **`GENERIC_TOPIC`**（**安全 vs 自由**）。
3. **无 seed 时始终** → 从自由文本自动抽取 `userDetails` 锚点（金额、时间、引号片段、
   常见生活名词、内容词）写入 brief / CONSTRAINT AXES，并附带反照念 `forbidden`。

有 seed 时，关键词/重叠模板**整段跳过**（seed 覆盖模板）。
旧版全立场 seed 若没带 `userDetails`，也会从 context 回填。

| | **约束轴 seed（推荐）** | **无 seed，关键词/重叠** | **无 seed → generic** |
| --- | --- | --- | --- |
| 争论轴从哪来 | 客户端根据用户实情写 | 得分最高的预制话题模板 | 固定「安全 vs 自由」 |
| 对白具体程度 | 最高（客户端写的 `userDetails`） | 中高（模板 + **自动** `userDetails`） | 轴偏空，但仍用抽取事实接地 |
| 照念风险 | 较低（轴不是成稿） | 中等（成品立场 + 反照念禁令） | 较高 |
| 适合 | 正式产品路径 | 演示 / 经典 / 近邻题 | 弱信号时的保底 |
| 服务端成本 | 仍 $0 | $0 | $0 |

**没有 `seed`？** 可以——服务端不会报错。比「直接掉进安全 vs 自由」好，但仍弱于真 seed：

- 匹配仍是**确定性启发式**（关键词长度 + token 重叠），不是 LLM 理解故事；多轴纠结仍可能装错。
- 弱信号仍会落到「安全 vs 自由」，但自动 `userDetails` 会把具体名词推进表演轨道。
- 模板立场更接近成品句子（比约束轴更容易照念）；`forbidden` + 反照念规则逼客户端现场写。
- `domain` 只分桶关系分/战绩，**不会**生成更贴题的争论轴。
- 连续性回调**不会**重写本场核心张力；独特处境仍应自己写 `seed` / `userDetails`。

心智模型：

- **主路径** = 客户端写 seed → 吵到点上、贴用户事实。
- **Fallback** = 没 seed → 最佳模板 + 自动锚点；能跑且比以前不那么空；一对一独特题仍偏弱。

### 回合流程

```text
客户端写 seed + domain
start_debate(seed=..., domain=...)
  → 只表演发言者 A
continue_conflict_turn(lastUtterance=..., userInterjection?=...)
  → 只表演发言者 B
... 直到 shouldEnd / maxTurns / 用户停止 ...
end_inner_conflict(winner=...)   # 客户端判定
  → 结算关系 + 戏外下一步

# 可选，数天后，仅当用户主动提起：
record_decision_outcome(conflictId=..., actualChoice=..., sentiment?=...)
```

开场示例：

```json
{
  "name": "start_debate",
  "arguments": {
    "context": "我明天要不要裸辞？",
    "intensity": "medium",
    "domain": "career",
    "firstSpeaker": "devil",
    "sessionId": "my-project",
    "seed": {
      "tension": "明天就辞 vs 先把跑道垫好。",
      "angelMust": "下月房租；戏剧性的一天付不了账单。",
      "devilMust": "热度就在现在；再拖只是排练恐惧。",
      "userDetails": ["明天辞职", "下月房租", "毫无意义的站会"],
      "forbidden": ["空泛的安全 vs 自由口号"]
    }
  }
}
```

继续：

```json
{
  "name": "continue_conflict_turn",
  "arguments": {
    "sessionId": "my-project",
    "lastUtterance": "恶魔：在你把自己说服回去之前先把邮件发出去。",
    "userInterjection": "可是下周房租就到期了…",
    "speaker": "angel"
  }
}
```

结束：

```json
{
  "name": "end_inner_conflict",
  "arguments": {
    "sessionId": "my-project",
    "winner": "angel",
    "lastUtterance": "天使：先把跑道垫好。"
  }
}
```

记录真实世界跟进（只记用户主动说的）：

```json
{
  "name": "record_decision_outcome",
  "arguments": {
    "sessionId": "my-project",
    "conflictId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "actualChoice": "angel",
    "outcomeNote": "我等了两周，拿到了书面 offer。",
    "sentiment": "good"
  }
}
```

### 回合规则

1. **首位发言优先级：** `firstSpeaker` → 与 `recentWinner` 相反 → 高 `devilAnnoyance` →
   高 `angelRespect` + 低 `cooperation` → 话题偏向 → 默认恶魔
2. **中途：** 交替；强制 `speaker` 优先；关系紧张时约 12% 同侧连击（double-tap）
3. **`maxTurns` 按 intensity：** low=2，medium=4，high=6
4. 关系分 / 完结记忆**只在** `end_inner_conflict` 更新
5. 新开辩论会放弃该 session/domain 路径上未结束的旧辩论
6. 琐碎决定用 low intensity（更少回合），不要幻想 one-shot 模式

### 单人视角

```json
{ "name": "summon_angel", "arguments": { "context": "我该不该给前任发消息？", "sessionId": "my-project" } }
```

```json
{ "name": "summon_devil", "arguments": { "context": "我该不该给前任发消息？", "sessionId": "my-project" } }
```

不会开冲突、不改关系分。客户端按 `performance_instructions` 写第一人称独白。

---

## 工具

| 工具 | 用途 |
| --- | --- |
| `start_debate` | 开启回合制辩论（每次只返回一位发言者） |
| `continue_conflict_turn` | `start_debate` 之后的下一位 |
| `end_inner_conflict` | 结束：记忆 + 关系 + 戏外下一步；传入客户端判定的 `winner` |
| `summon_angel` | 天使单人视角（无冲突） |
| `summon_devil` | 恶魔单人视角（无冲突） |
| `record_decision_outcome` | 记录用户事后主动说的真实选择/结果 |
| `get_relationship` | 关系分 + 近期冲突 + 战绩（支持 domain） |
| `reset_relationship` | 清空一个 session（可选单个 domain）。需 `confirm: true` |
| `clear_database` | 清空**全部** session / 表。需 `confirm: true` |

多数工具可选 `sessionId`（默认 `"default"`）。`clear_database` 是全局的。

### 参数摘要

#### `start_debate`

| 参数 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `context` | 是 | — | 困境 / 处境 |
| `topic` | 否 | — | 短标签 |
| `intensity` | 否 | `medium` | `low` \| `medium` \| `high` |
| `sessionId` | 否 | `default` | 状态隔离键 |
| `domain` | 否 | `general` | `career` \| `money` \| `relationships` \| `health` \| `general` |
| `firstSpeaker` | 否 | 自动 | `angel` \| `devil` |
| `seed` | 否 | — | **建议先写**；优先约束轴 |

**推荐 seed（约束轴 — 据此发明台词，不要照念）：**

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `tension` | 是 | 本场争什么（一句话） |
| `angelMust` | 是 | 天使必须守住的论证轴 |
| `devilMust` | 是 | 恶魔必须守住的论证轴 |
| `userDetails` | 否 | 具体事实（期限、人、钱、制度） |
| `forbidden` | 否 | 禁区（如空泛口号） |

#### `continue_conflict_turn`

| 参数 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `sessionId` | 否 | `default` | session |
| `conflictId` | 否 | 当前 open | 开场返回的 id |
| `speaker` | 否 | 自动 | 强制 `angel` / `devil` |
| `userInterjection` | 否 | — | 用户插话 |
| `lastUtterance` | 否 | — | 上一句已表演台词（入库 + 供反应） |

#### `end_inner_conflict`

| 参数 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `sessionId` | 否 | `default` | session |
| `conflictId` | 否 | 当前 open | 辩论 id |
| `winner` | 否* | 引擎 `likelyWinner` | `angel` \| `devil` \| `draw` — **强烈建议显式传入客户端裁决** |
| `lastUtterance` | 否 | — | 最后一句入库 |

\*省略 `winner` 会退回辩论前的加权/随机结果，只应作最后手段。

#### `record_decision_outcome`

| 参数 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `conflictId` | 是 | — | start/end 返回的 id |
| `actualChoice` | 是 | — | `angel` \| `devil` \| `neither` \| `mixed`（现实选择，不是辩论胜者） |
| `sessionId` | 否 | `default` | session |
| `outcomeNote` | 否 | — | 用户原话式短注 |
| `sentiment` | 否 | — | `good` \| `regret` \| `mixed` \| `too_early` |

#### `get_relationship`

| 参数 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `sessionId` | 否 | `default` | session |
| `domain` | 否 | `general`（+ 汇总） | 指定领域；省略则 general + `all_domains_summary` |

#### 危险操作

| 工具 | 范围 | 必填 |
| --- | --- | --- |
| `reset_relationship` | 一个 `sessionId`（可选一个 `domain`） | `confirm: true` |
| `clear_database` | 整个 SQLite 文件 | `confirm: true` |

---

## 资源

- `angel://profile` — 静态天使人设
- `devil://profile` — 静态恶魔人设
- `relationship://state` — 默认 session 的实时关系
- `relationship://state/{sessionId}` — 指定 session 的实时关系

## Prompts

| Prompt | 用途 |
| --- | --- |
| `brain-fight-debate` | 写 seed → `start_debate` → continue/end → 按说明表演 |
| `summon-angel` | 调 `summon_angel`，再写天使独白 |
| `summon-devil` | 调 `summon_devil`，再写恶魔独白 |

---

## 引擎如何工作

服务端（确定性，$0 推理）：

1. **Session + domain 隔离** — 连续性按 `(sessionId, domain)`；
   `reset_relationship` / `clear_database` 均需 `confirm: true`。
2. **话题匹配 / seed** — 客户端 seed 覆盖模板；否则按关键词 + token 重叠给扩展中英
   话题模板打分，弱信号再退回「安全 vs 自由」；**无 seed 路径始终**从 context 抽取
   `userDetails`。建议**总是先写 seed**。输出是立场种子，不是最终剧本。
3. **Intensity** — low/medium/high → 激烈度 0.3/0.6/0.9，以及 `maxTurns` 2/4/6。
4. **关系偏置** — 高 `angelRespect` 天使更迁就；高 `devilAnnoyance` 恶魔更抬杠。
5. **角色互换** — `cooperation > 0.7` 时约 15% 互换原型（`isRoleReversal: true`）。
6. **连续性** — `recall` 同 session/domain 的旧冲突，注入回调。
7. **回合导演** — 首位/下一位、连击；完结记忆与关系结算推迟到 `end_inner_conflict`。
8. **Outcome** — 用户主动反馈的真实结果进入战绩与后续连续性。

客户端：

9. **写剧本** — 根据人设、关系节拍、intensity、连续性、约束轴写对白；禁止照念 seed。
10. **判定胜者** — 结束时由客户端判断谁更有说服力，再给一句戏外可执行下一步。

## 关系分更新规则

仅在 `end_inner_conflict` 结算时应用：

- 天使胜 → `angelRespect += 0.02`，`devilAnnoyance += 0.03`
- 恶魔胜 → `devilRespect += 0.02`，`angelAnnoyance += 0.03`
- 平局 → `cooperation += 0.05`
- 发生角色互换 → `cooperation += 0.02`（可叠加）

全部夹紧到 `[0, 1]`。

---

## 开发

```bash
npm run dev         # tsx stdio，无需先 build
npm run dev:http    # tsx Streamable HTTP :8000
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # tsup -> dist/index.js
```

PR 指南见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 发布（维护者）

```bash
npm login
npm publish --access public
```

`prepublishOnly` 会跑 typecheck、测试与 build。包内容仅含 `dist/`、`LICENSE`、`README.md`。

## 设计备注

- **服务端零 LLM 成本** — 只有引擎 + SQLite；本进程无 API key。
- **Plan A 剧本生成** — 服务端管状态与约束；客户端 LLM 生成对白。
- **回合制是导演协议，不是双 Agent** — 同一客户端仍演两边；服务端选人、计回合、结束时结算。
- **Domain 分桶** — 职业信任与零食决定不共用一个分数。
- **客户端判定胜者** — 辩论前的 `likelyWinner` 只是兜底。
- **默认 stdio**；远程用 HTTP 时请加 `--token`。
- 喜剧优先于「永远正确」：恶魔不总是错，天使不总是对。

## 许可证

[MIT](LICENSE) © rkny6
