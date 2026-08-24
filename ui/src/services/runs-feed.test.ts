import { describe, expect, test } from "bun:test";
import { queryRunsFeed } from "./runs-feed.js";

describe("queryRunsFeed (index)", () => {
  test("returns stable pagination shape", () => {
    const result = queryRunsFeed({ offset: 0, limit: 10, kind: "all" });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("offset", 0);
    expect(result).toHaveProperty("limit", 10);
    expect(result).toHaveProperty("hasMore");
    expect(result).toHaveProperty("counts");
    expect(result).toHaveProperty("scannedTotal");
    expect(result).toHaveProperty("indexSyncedAt");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.length).toBeLessThanOrEqual(10);
    if (result.items[0]) {
      expect(result.items[0].detailRef).toBeTruthy();
      expect(result.items[0].detailRef.source).toBeTruthy();
    }
  });

  test("kind filter returns only matching items", () => {
    const audit = queryRunsFeed({ offset: 0, limit: 50, kind: "audit" });
    for (const item of audit.items) {
      expect(item.kind).toBe("audit");
    }
    expect(audit.counts.audit).toBe(audit.total);
  });
});
