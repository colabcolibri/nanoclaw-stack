import { describe, expect, test } from "bun:test";
import { SkillsManager } from "../src/services/skills-manager.js";
import { handleLoadSkill } from "../src/tools/load-skill.js";

describe("SkillsManager Automated Folder Discovery & Skills on Demand", () => {
  test("Discovers all skills from system and group folders", () => {
    const skills = SkillsManager.discoverSkills();
    expect(skills.length).toBeGreaterThan(0);

    const names = skills.map((s) => s.name);
    expect(names).toContain("gmail-inbox");
    expect(names).toContain("yampi-store");
    expect(names).toContain("notion-notes");
  });

  test("Extracts metadata, domain, tools, and operational body from SKILL.md", () => {
    const skills = SkillsManager.discoverSkills();
    const gmailSkill = skills.find((s) => s.name === "gmail-inbox");
    expect(gmailSkill).toBeDefined();
    expect(gmailSkill?.domain).toBe("google_suite");
    expect(gmailSkill?.tools).toContain("google_gmail");
    expect(gmailSkill?.instructions).toContain("Gmail Search Operator Guide");
  });

  test("Generates compact domain-grouped catalog prompt (~100 tokens)", () => {
    const catalog = SkillsManager.getCompactCatalogPrompt();
    expect(catalog).toContain("Available Skills Catalog");
    expect(catalog).toContain("load_skill");
    expect(catalog).toContain("GOOGLE SUITE");
    expect(catalog.length).toBeLessThan(1500); // Ultra compact
  });

  test("Retrieves specialized skill on demand via load_skill tool", async () => {
    const resRaw = await handleLoadSkill({ name: "store-email-attendant" });
    const res = JSON.parse(resRaw);

    expect(res.skill).toBe("store-email-attendant");
    expect(res.domain).toBe("store_attendant");
    expect(res.manual).toContain("Colibri");
  });
});
