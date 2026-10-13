import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");

function start({ port, prepareError, requestError }: {
  port?: string;
  prepareError?: Error;
  requestError?: Error;
} = {}) {
  const env = { NODE_ENV: "development", PORT: port };
  const exit = vi.fn();
  const logError = vi.fn();
  const handle = vi.fn(async () => {
    if (requestError) throw requestError;
  });
  const prepare = vi.fn(async () => {
    if (prepareError) throw prepareError;
  });
  const next = vi.fn(() => ({ prepare, getRequestHandler: () => handle }));
  const server = { listen: vi.fn(), on: vi.fn() };
  const createServer = vi.fn((_listener: (req: unknown, res: unknown) => Promise<void>) => server);

  runInNewContext(source, {
    __dirname: "/home/cpanel/merchvision",
    process: { env, exit },
    console: { error: logError },
    require: (name: string) => {
      if (name === "next") return next;
      if (name === "node:http") return { createServer };
      throw new Error(`Unexpected module: ${name}`);
    }
  });

  return { env, exit, logError, next, server, createServer, handle };
}

describe("Passenger startup", () => {
  it("uses production mode and the project directory regardless of the working directory", async () => {
    const result = start();
    await vi.waitFor(() => expect(result.server.listen).toHaveBeenCalledWith(3100));
    expect(result.env.NODE_ENV).toBe("production");
    expect(result.next).toHaveBeenCalledWith({ dev: false, dir: "/home/cpanel/merchvision" });
  });

  it("honors a host-supplied port and forwards requests to Next.js", async () => {
    const result = start({ port: "3210" });
    await vi.waitFor(() => expect(result.server.listen).toHaveBeenCalledWith(3210));
    const listener = result.createServer.mock.calls[0][0] as (req: unknown, res: unknown) => Promise<void>;
    const req = { url: "/api/favorites" };
    const res = {};
    await listener(req, res);
    expect(result.handle).toHaveBeenCalledWith(req, res);
  });

  it("exits without opening a listener if Next.js cannot prepare the build", async () => {
    const result = start({ prepareError: new Error("Missing build") });
    await vi.waitFor(() => expect(result.exit).toHaveBeenCalledWith(1));
    expect(result.createServer).not.toHaveBeenCalled();
  });

  it("returns a generic JSON failure without exposing internal request errors", async () => {
    const result = start({ requestError: new Error("Private database details") });
    await vi.waitFor(() => expect(result.server.listen).toHaveBeenCalled());
    const listener = result.createServer.mock.calls[0][0] as (req: unknown, res: unknown) => Promise<void>;
    const res = { headersSent: false, statusCode: 200, setHeader: vi.fn(), end: vi.fn() };
    await listener({}, res);
    expect(res.statusCode).toBe(500);
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: "Internal server error." }));
  });

  it("closes a failed response whose headers were already sent", async () => {
    const result = start({ requestError: new Error("Streaming failed") });
    await vi.waitFor(() => expect(result.server.listen).toHaveBeenCalled());
    const listener = result.createServer.mock.calls[0][0] as (req: unknown, res: unknown) => Promise<void>;
    const res = { headersSent: true, destroy: vi.fn(), end: vi.fn() };
    await listener({}, res);
    expect(res.destroy).toHaveBeenCalledOnce();
    expect(res.end).not.toHaveBeenCalled();
  });
});
