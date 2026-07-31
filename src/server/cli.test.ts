import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./cli.js";

describe("parseCliArgs", () => {
  it("defaults to stdio", () => {
    const opts = parseCliArgs([]);
    expect(opts.mode).toBe("stdio");
    expect(opts.help).toBe(false);
  });

  it("parses http flags", () => {
    const opts = parseCliArgs([
      "--http",
      "--host",
      "0.0.0.0",
      "--port",
      "3001",
      "--token",
      "secret",
      "--allowed-hosts",
      "localhost,example.com",
    ]);

    expect(opts.mode).toBe("http");
    expect(opts.host).toBe("0.0.0.0");
    expect(opts.port).toBe(3001);
    expect(opts.token).toBe("secret");
    expect(opts.allowedHosts).toEqual(["localhost", "example.com"]);
  });

  it("rejects unknown args", () => {
    expect(() => parseCliArgs(["--nope"])).toThrow(/Unknown argument/);
  });
});
