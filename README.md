# Brain Fight MCP

An Angel and a Devil, staged as a turn-by-turn debate over whatever you're stuck on — with two things most "AI debate" tools don't have: **they remember how things have gone with you**, and **you can tell them how it actually turned out**.

```
😇 Angel: Don't quit yet — line something up first.
😈 Devil: Quit. Today. Send the email.
```

## Why this and not just asking Claude directly

Most multi-perspective decision tools are stateless: you ask, you get an analysis, it's forgotten. Brain Fight keeps a small relationship state (trust, annoyance, cooperation) per topic area that evolves across your actual conversations, and — if you come back later and mention what you did or how it went — it remembers that too. That memory doesn't just sit in a report: Devil might taunt you mid-debate with "last time you didn't listen to me and—", and the two of them notice their own history out loud the first time something rare happens — a freak run of agreement, one side winning five in a row, the tenth time you've hashed out a career decision together. That's the part nothing else here does.

It makes **zero LLM calls of its own**. The debate content is written by whichever model is calling it (Claude, in the normal case) — this server is just a fast, local, $0 state engine: it hands back structured performance instructions and tracks state in a local SQLite file.

## Install

### Claude Desktop / Claude Code

Add to your MCP config (`claude_desktop_config.json` or equivalent):

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

Restart your client. No API keys, no accounts, no network calls required.

### Run it yourself

```bash
npx brain-fight-mcp            # stdio transport (default)
npx brain-fight-mcp --http     # Streamable HTTP on 127.0.0.1:8000
```

## Tools

| Tool | What it does |
|---|---|
| `start_debate` | Opens a turn-by-turn Angel vs Devil debate. Returns the first speaker's line to perform. |
| `continue_conflict_turn` | Advances the debate by one speaker. Call once per line until it says to stop. |
| `end_inner_conflict` | Closes the debate, settles relationship state, and returns one concrete next step. |
| `record_decision_outcome` | Records what you actually did and (later) how it went, linked to a past debate. |
| `get_relationship` | Shows current trust/annoyance/cooperation, recent history, track record, and any milestones reached for a domain (or a summary across all of them). |
| `reset_relationship` | Wipes history/relationship state for a session, or just one domain. Requires `confirm: true`. |
| `clear_database` | Debug tool: wipes everything, all sessions. Requires `confirm: true`. |
| `summon_angel` / `summon_devil` | One-off single-character perspective, no debate, no state change. |

You generally won't call these by name yourself — you just tell Claude what you're stuck on, and it decides when to reach for these based on the server's built-in instructions (things like "should I..." or "I can't decide..." trigger it automatically; venting like "I'm so stressed" gets offered as an option rather than sprung on you).

## Topic domains

Relationship trust and track record are bucketed by life area, so a mishandled snack decision doesn't dilute the trust built up around a real career call. The buckets: `career`, `money`, `relationships`, `health`, `general` (default). There's no keyword classifier picking this for you — the model driving the conversation (Claude) chooses the domain based on what you're actually asking about when it calls `start_debate`. You don't have to specify it yourself, but if it ever picks the wrong bucket, just say so and ask it to use a different one.

## Track record & milestones

Two things carry across debates within a domain, and both are used *sparingly by design* — the instructions given to the model explicitly say "most turns should NOT mention this," because a callback that fires constantly stops feeling like memory and starts feeling like a stat sheet:

- **Track record.** If you've told it (via `record_decision_outcome`) how past decisions actually turned out, Angel or Devil may — rarely, when it genuinely fits — bring that up mid-debate ("last time you didn't listen to me and—"), not just in a closing summary. When you left a specific note on an outcome, it can reference that directly ("you said you bought the laptop on impulse and returned it a week later") instead of just a tally. Older outcomes fade rather than vanish: a regret from a year ago barely moves things, one from last week moves them a lot, and the framing is honest about how long ago it was ("a while back," not "last time," for anything more than a few months old).
- **Milestones.** A handful of one-time narrative beats, each fired at most once ever per domain: cooperation crossing an unusually high level for the first time, either side winning five debates in a row, or hitting the 10th debate in a domain. When one fires, Angel and Devil briefly react to it in character — genuinely surprised, not a scripted congratulations message — right before you get the actionable next step.

None of this is configurable per-milestone right now; it's meant to be a small set of rare, earned moments rather than a feature you tune.

## Data & privacy

Everything is stored locally in a single SQLite file — nothing is sent anywhere except to the model that's already driving your conversation.

- Default location: `~/.brain-fight-mcp/state.sqlite3`
- Override with `BRAIN_FIGHT_DB_PATH=/path/to/file.sqlite3`
- Wipe it any time with `reset_relationship` (one domain or everything — this also resets any milestones reached, so they can genuinely happen again from scratch) or `clear_database` (everything, all sessions)
- Completed debate transcripts are auto-pruned after 30 days by default (the durable summary — context, positions, winner — is kept indefinitely; only the raw turn-by-turn transcript is pruned). Adjust with `BRAIN_FIGHT_RETENTION_DAYS=<n>`, or set it very high to keep everything.

## Running over HTTP

For remote/web clients instead of local stdio:

```bash
npx brain-fight-mcp --http --port 3000 --token <secret>
```

| Flag | Env var | Default |
|---|---|---|
| `--host <host>` | `BRAIN_FIGHT_HTTP_HOST` | `127.0.0.1` |
| `--port <port>` | `BRAIN_FIGHT_HTTP_PORT` | `8000` |
| `--token <token>` | `BRAIN_FIGHT_HTTP_TOKEN` | *(none — strongly recommended if binding to `0.0.0.0`, see below)* |
| `--allowed-hosts a,b` | `BRAIN_FIGHT_ALLOWED_HOSTS` | *(none)* |

If you bind to `0.0.0.0` (or `::`) without a `--token`, the server logs a loud warning and starts anyway — anyone who can reach the port can call your tools. Set a token before exposing this beyond your own machine.

Health check: `GET /health`. MCP endpoint: `ALL /mcp`.

## Development

```bash
npm install
npm run build       # tsup → dist/
npm test            # vitest
```

> These assume standard `build`/`test` script names in `package.json`. Adjust if yours are named differently — this README was written without seeing your actual `package.json`, since it wasn't part of what you shared with me.

## License

*(add your license here)*
