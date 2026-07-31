export type RunMode = "stdio" | "http";

export interface CliOptions {
  mode: RunMode;
  host: string;
  port: number;
  token?: string;
  allowedHosts?: string[];
  help: boolean;
}

function envString(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function envPort(name: string, fallback: number): number {
  const raw = envString(name);
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    throw new Error(`${name} must be an integer port 0-65535, got: ${raw}`);
  }
  return n;
}

/**
 * Parses argv for stdio (default) vs Streamable HTTP mode.
 *
 * Flags:
 *   --http              enable Streamable HTTP transport
 *   --host <host>       bind host (default 127.0.0.1 or BRAIN_FIGHT_HTTP_HOST)
 *   --port <port>       bind port (default 8000 or BRAIN_FIGHT_HTTP_PORT)
 *   --token <token>     auth token (or BRAIN_FIGHT_HTTP_TOKEN)
 *   --allowed-hosts a,b Host allow-list (or BRAIN_FIGHT_ALLOWED_HOSTS)
 *   -h, --help
 */
export function parseCliArgs(argv: string[] = process.argv.slice(2)): CliOptions {
  const args = [...argv];
  let mode: RunMode = "stdio";
  let host = envString("BRAIN_FIGHT_HTTP_HOST") ?? "127.0.0.1";
  let port = envPort("BRAIN_FIGHT_HTTP_PORT", 8000);
  let token = envString("BRAIN_FIGHT_HTTP_TOKEN");
  let allowedHosts = envString("BRAIN_FIGHT_ALLOWED_HOSTS")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--http":
        mode = "http";
        break;
      case "--host": {
        const value = args[++i];
        if (!value) throw new Error("--host requires a value");
        host = value;
        break;
      }
      case "--port": {
        const value = args[++i];
        if (!value) throw new Error("--port requires a value");
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0 || n > 65535) {
          throw new Error(`--port must be an integer 0-65535, got: ${value}`);
        }
        port = n;
        break;
      }
      case "--token": {
        const value = args[++i];
        if (!value) throw new Error("--token requires a value");
        token = value;
        break;
      }
      case "--allowed-hosts": {
        const value = args[++i];
        if (!value) throw new Error("--allowed-hosts requires a comma-separated value");
        allowedHosts = value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      }
      case "-h":
      case "--help":
        help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    mode,
    host,
    port,
    token,
    allowedHosts: allowedHosts?.length ? allowedHosts : undefined,
    help,
  };
}

export function printHelp(): void {
  console.error(`Brain Fight MCP

Usage:
  brain-fight-mcp                 # stdio (default, for Claude Desktop / Cursor)
  brain-fight-mcp --http          # Streamable HTTP on 127.0.0.1:8000
  brain-fight-mcp --http --port 3000 --token secret

HTTP options:
  --http                 Start Streamable HTTP transport instead of stdio
  --host <host>          Bind address (default: 127.0.0.1)
  --port <port>          Port (default: 8000)
  --token <token>        Require Authorization: Bearer <token> or ?token=
  --allowed-hosts a,b    Optional Host header allow-list
  -h, --help             Show this help

Environment:
  BRAIN_FIGHT_DB_PATH         SQLite path (default: ~/.brain-fight-mcp/state.sqlite3)
  BRAIN_FIGHT_HTTP_HOST       Default --host
  BRAIN_FIGHT_HTTP_PORT       Default --port
  BRAIN_FIGHT_HTTP_TOKEN      Default --token
  BRAIN_FIGHT_ALLOWED_HOSTS   Default --allowed-hosts (comma-separated)

Endpoints (HTTP mode):
  GET  /health
  ALL  /mcp                  Streamable HTTP MCP endpoint
`);
}
