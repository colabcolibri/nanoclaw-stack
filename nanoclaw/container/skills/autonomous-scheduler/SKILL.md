---
name: autonomous-scheduler
description: Persistent cron routines, delayed one-shot tasks, and follow-ups via ncl tasks. Not host crontab.
domain: automation_scheduling
tools:
  - run_command
---

# Autonomous scheduler

Persistence = `ncl tasks` only. Containers are ephemeral — host `crontab` does not wake the agent.

Use the **schedule timezone** from `<context timezone="..."/>` and from `## Temporal & Geographic Context` (`Schedule timezone (ncl tasks …)`). Cron and naive `--process-after` always use that IANA zone — not the host OS clock unless they match.

## Timezones

| User says | You do |
| :--- | :--- |
| "6h", "às 15h" (no zone named) | Treat as schedule timezone |
| "6h Brasília", "BRT", "horário do Brasil" | Convert to schedule timezone before `ncl tasks` |
| Always uses another country | Suggest `ncl groups config update --timezone America/Sao_Paulo` (or their IANA id) |

**One-shot with explicit zone** — ISO + offset; `ncl` stores UTC correctly:

```bash
ncl tasks create --name "…" --process-after "2026-08-24T06:00:00-03:00" --prompt "…"
```

**Cron** — hours in the **schedule timezone**. Example: user wants 06:00–18:00 BRT every 3h but group is `Europe/Brussels` (CEST): convert 6,9,12,15,18 BRT → 11,14,17,20,23 Brussels → `0 11,14,17,20,23 * * *`. Tell the user both the original and translated hours.

**Preferred fix** when the user lives in Brazil: set group timezone to `America/Sao_Paulo` so `0 6,9,12,15,18 * * *` means what they said.

## Decision map

| User intent | Command |
| :--- | :--- |
| Recurring job (cron) | `ncl tasks create --name "<short label>" --recurrence "<5-field cron>" --prompt "<self-contained instruction>"` |
| One-shot after delay | `ncl tasks create --name "<short label>" --process-after "<ISO or local time>" --prompt "<instruction>"` |
| List active schedules | `ncl tasks list` |
| Inspect runs / failures | `ncl tasks get <series-id>` |
| Change schedule or prompt | `ncl tasks update <series-id> --recurrence "..."` and/or `--prompt "..."` |
| Pause / resume | `ncl tasks pause <series-id>` / `ncl tasks resume <series-id>` |
| Cancel | `ncl tasks cancel <series-id>` |
| Fire once now (test) | `ncl tasks run <series-id>` |

## Cron examples (group timezone)

| Pattern | Expression |
| :--- | :--- |
| Every 2 hours | `0 */2 * * *` |
| Daily 09:00 | `0 9 * * *` |
| Weekdays 11:00 | `0 11 * * 1-5` |

## Execution rules

1. CALL `run_command` with `ncl tasks …` before claiming create/update/cancel.
2. SUCCESS only when the command exits 0 and output is not an error. Report `series_id` / task id, cron, `process_after`, `next_run` when present.
3. `ncl tasks list` → pending/paused series only. Do not confuse with past runs (`ncl tasks get` for history).
4. NEVER `crontab` / `/etc/cron.d` / SDK cron builtins.
5. Task `prompt` must be self-contained: which tools to call, where to deliver (`telegram`, etc.), what to report. Example: `Check unread Gmail via google_gmail; summarize; send summary to telegram.`
6. Frequent polling needs a `--script` gate — see `ncl tasks create --help`. Do not override recurrence limits without user consent.
7. DONE + structured summary. No user small-talk.
