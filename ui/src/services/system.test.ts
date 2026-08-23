import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { fetchMotorHealth, tailLogLines } from "./system.js";

describe("tailLogLines", () => {
  test("returns the last N non-empty lines", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nanoclaw-log-tail-"));
    const filePath = path.join(dir, "nanoclaw.log");
    fs.writeFileSync(filePath, "line-1\nline-2\n\nline-3\nline-4\n", "utf-8");

    expect(tailLogLines(filePath, 2)).toEqual(["line-3", "line-4"]);
    expect(tailLogLines(filePath, 10)).toEqual(["line-1", "line-2", "line-3", "line-4"]);
    expect(tailLogLines(path.join(dir, "missing.log"), 5)).toEqual([]);
  });
});

describe("fetchMotorHealth", () => {
  test("parses ok payload from /webhook/health", async () => {
    const result = await fetchMotorHealth("http://127.0.0.1:5082", async () =>
      Response.json({
        status: "ok",
        pid: 4242,
        uptimeSeconds: 10,
        startedAt: "2026-08-23T12:00:00.000Z",
      }),
    );

    expect(result).toEqual({
      status: "ok",
      pid: 4242,
      uptimeSeconds: 10,
      startedAt: "2026-08-23T12:00:00.000Z",
    });
  });

  test("returns null when fetch fails or payload is invalid", async () => {
    await expect(
      fetchMotorHealth("http://127.0.0.1:5082", async () => {
        throw new Error("ECONNREFUSED");
      }),
    ).resolves.toBeNull();

    await expect(
      fetchMotorHealth("http://127.0.0.1:5082", async () => Response.json({ status: "degraded" })),
    ).resolves.toBeNull();
  });
});
