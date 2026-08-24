# Slash commands

User-facing slash commands (`/clear`, `/new`, `/new-resume`, …) are handled on the **host** before any message reaches the agent container. The inbound command text is **never** written to `messages_in`; only the system acknowledgement may appear in thread history.

Implementation: `src/routing/slash-pipeline.ts` (transport), `src/commands/` (registry, parse, execute), `src/conversations/` (lifecycle).

---

## 1. Ack semantics

Every command returns a **reply** string. Where that reply is shown depends on `CommandReplyPersist`:

| Persist | Meaning | Example |
|---------|---------|---------|
| `ephemeral` | Deliver on the platform only; **not** stored in `messages_out` / thread UI | future `/status` |
| `current_session` | Stored in the session that was active when the command ran | `/clear` |
| `result_session` | Stored in the session **created** by the command | `/new`, `/new-resume` |

Persisted acks are written via `deliverCommandReply()` → `writeOutboundDirect()` with JSON content:

```json
{ "text": "...", "sender": "system", "command_ack": true, "ephemeral": false }
```

The UI can style `command_ack` messages separately from normal chat.

---

## 2. Built-in commands

| Command | Admin | Effect | Ack persist |
|---------|-------|--------|-------------|
| `/clear` | yes | Clears LLM continuation + sets `history_cutoff`; kills hot container so in-memory session cannot survive; audit history kept | `current_session` |
| `/new` | yes | Archives current session, creates a new one | `result_session` |
| `/new-resume` | yes | Same as `/new` plus handoff summary in the new session | `result_session` |

Admin gating uses `requiresAdmin` on each definition. `command-gate.ts` reads admin tokens from `getAdminSlashTokens()` — do not duplicate the list elsewhere.

---

## 3. Request flow

```
Inbound text
  → routing/slash-pipeline (gate on channel transport only)
  → parseSlashCommand()
  → registry handler execute()
  → deliverCommandReply() (if not ephemeral)
  → channel: deliverSessionMessages() | sync: reply in HTTP response
```

Channel adapters call `routeInbound()` which uses `runSlashPipeline({ transport: 'channel' })`.
Sync-turn (macOS / UI) uses `runSlashPipeline({ transport: 'sync' })` — admin gate skipped
because the caller is already authenticated at the HTTP boundary.

The user's slash message is **not** appended to the conversation. The next normal message goes to the session returned by the handler (unchanged for `/clear`, new id for `/new`).

---

## 4. Adding a new command

1. Add one object to the `definitions` array in `src/commands/registry.ts`.
2. Set `id`, `aliases`, `description`, `category`, `requiresAdmin`, `telegramDescription` (optional), and `execute`.
3. Return `{ reply, session, wake, persist }` from `execute`.

Example (info-only, ephemeral):

```typescript
{
  id: 'status',
  aliases: ['/status'],
  description: 'Show agent status.',
  telegramDescription: 'Show agent status',
  category: 'info',
  requiresAdmin: false,
  async execute({ caller }) {
    const { session } = resolveActiveSession(caller);
    return {
      reply: 'Online.',
      session,
      wake: false,
      persist: 'ephemeral',
    };
  },
}
```

No changes needed in `command-gate.ts` or `router.ts` unless the command needs special platform filtering.

---

## 5. Telegram compatibility

Telegram bot menus must stay in sync with the same registry:

- User types `/new` or picks **new** from the menu → same string → same `parseSlashCommand()` path.
- `getTelegramBotCommands()` exports `{ command, description }[]` for `setMyCommands` (`command` is the canonical `id` with hyphens replaced by underscores — Telegram allows only `[a-z0-9_]`). `slashAliases(id)` adds the Telegram-safe token automatically when the id contains hyphens (e.g. `new-resume` → `/new_resume`).

Platform-only Telegram commands (`/start`, `/help`, …) remain in `FILTERED_COMMANDS` inside `command-gate.ts` — they are not part of our expandable registry.

### `/new-resume` handoff (all transports)

`runSlashPipeline` auto-wires LLM summarize for `new-resume` via `buildConversationSummarizeFn()` (memo role model + OpenAI-compatible stack). Channel (Telegram, etc.) and sync (macOS/iOS) share the same path — no per-transport wiring in `router.ts` or `sync-turn-host.ts`. If the LLM fails or returns empty text, the command errors (no extractive copy fallback).

---

## 6. Related docs

- [db-session.md](db-session.md) — `messages_in` / `messages_out` per session
- [isolation-model.md](isolation-model.md) — platform thread vs session vs agent group
