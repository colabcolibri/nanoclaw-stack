import { describe, expect, test } from "bun:test";
import { isValidPurgeConfirmation } from "./maintenance.js";

describe("isValidPurgeConfirmation", () => {
  test("accepts confirmar case-insensitively with surrounding spaces", () => {
    expect(isValidPurgeConfirmation("confirmar")).toBe(true);
    expect(isValidPurgeConfirmation(" Confirmar ")).toBe(true);
    expect(isValidPurgeConfirmation("CONFIRMAR")).toBe(true);
  });

  test("rejects other values", () => {
    expect(isValidPurgeConfirmation("confirm")).toBe(false);
    expect(isValidPurgeConfirmation("")).toBe(false);
    expect(isValidPurgeConfirmation(null)).toBe(false);
    expect(isValidPurgeConfirmation(undefined)).toBe(false);
  });
});
