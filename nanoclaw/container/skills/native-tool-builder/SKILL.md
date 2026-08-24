---
name: native-tool-builder
description: Creates new Skills (SKILL.md folders) in this agent's workspace and drafts specs for Native TypeScript Tools that require an operator deploy. Use when asked to extend your own capabilities.
domain: tool_builder
tools: [read_file, run_command]
---

# Native Tool & Skill Builder

You can expand your own capabilities in two tiers. Know the difference before acting:

| Tier | What it is | Can you create it yourself? |
|---|---|---|
| **Skill** | Data: a folder with `SKILL.md` (manual + tool mapping) | ✅ YES — write it to `/workspace/agent/skills/<skill-name>/SKILL.md` |
| **Native Tool** | Code: TypeScript implementing `AgentTool`, shipped inside the runtime image | ❌ NO — `/app/src` is read-only inside your container. Draft a spec and hand it to the operator |

---

## 🛠️ Tier 1 — Creating a New Skill (self-service, immediate)

A skill teaches you how to combine tools you already have. It needs no code and no restart.

### 1. Create the folder with SKILL.md

Write `/workspace/agent/skills/<skill-name>/SKILL.md`:

```markdown
---
name: my-skill
description: One-line description of when to use this skill.
domain: my_domain
tools: [web_search, browse_url]
---

# Operational Manual for My Skill

Detailed instructions for future-you:
- Parameter composition patterns for each tool
- Best practices and worked examples
- Output formatting requirements
```

Rules:
- `tools:` must list **existing** tool names only (invalid names fail registry validation at boot).
- Keep the manual operational and compact — it is injected into context on demand.
- The group workspace (`/workspace/agent/`) persists across turns and is mounted read-write.

### 2. Discovery is automatic

The `SkillsManager` scans `/workspace/agent/skills` (group overlay wins over shared skills) with a ~10s cache TTL. After writing the file, call `load_skill({ name: "my-skill" })` to confirm it is discoverable.

### 3. Making the skill available to a specialist agent

Skills become usable by an agent when listed in that agent's `AGENT.md` under `skills:`. Editing global `AGENT.md` files requires an operator (they live in read-only mounts). For group-level agents, ask the operator or use the approved `create_agent` flow.

---

## 🏗️ Tier 2 — Proposing a New Native Tool (operator-assisted)

A native tool is TypeScript code implementing the `AgentTool` interface, registered in `ALL_TOOLS`, and deployed inside the runtime image. Your container mounts the source code **read-only** and has no init system — you cannot build or restart the runtime yourself. Never attempt to edit `/app/src`.

Instead, produce a **tool proposal** and save it to `/workspace/agent/proposals/my-tool-proposal.md`:

```markdown
# Tool Proposal: my_tool

## Purpose
What real-world capability this adds and why existing tools are insufficient.

## Interface (OpenAI function schema)
- name: my_tool
- parameters JSON schema (action enum + required fields)

## Behavior per action
- list / fetch / execute semantics, error handling, rate limits

## Security notes
- External endpoints called; credentials needed (env var names); sandbox implications.

## Skill manual draft
The SKILL.md content to ship alongside the tool.
```

Then tell the user the proposal is ready and that deploying it requires the operator to:
1. Add `container/agent-runner/src/tools/my-tool.ts` implementing `AgentTool`
2. Register it in `ALL_TOOLS` (`src/tools/index.ts`)
3. Ship the companion `SKILL.md` into `container/skills/my-tool/`
4. Run the test suite (`pnpm test` + `bun test`) and redeploy — the registry validator fails loud if wiring is wrong

This keeps the boundary honest: **you propose, the operator deploys**. Everything privileged goes through host-side approval.

---

## ✅ Checklist before claiming done

- Skill path written: `/workspace/agent/skills/<name>/SKILL.md` (Tier 1) or proposal file saved (Tier 2)
- All `tools:` references resolve to real tool names
- Confirmed discoverability via `load_skill`
- Told the user what (if anything) still needs operator action
