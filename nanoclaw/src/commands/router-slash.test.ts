/**
 * Router integration for host slash commands (/new, /clear, …).
 * Covers Telegram-style group routing (engage_mode=mention, no @mention on /new)
 * and immediate outbound delivery of command acks.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  closeDb,
  createAgentGroup,
  createMessagingGroup,
  createMessagingGroupAgent,
  initTestDb,
  runMigrations,
} from '../db/index.js';
import { findSessionForAgent } from '../db/sessions.js';
import { outboundDbPath } from '../session-manager.js';
import { createUser } from '../modules/permissions/db/users.js';
import { grantRole } from '../modules/permissions/db/user-roles.js';
import { setSenderResolver } from '../router.js';
import { setDeliveryAdapter } from '../delivery.js';
import type { InboundEvent } from '../channels/adapter.js';

vi.mock('../container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(false),
  isContainerRunning: vi.fn().mockReturnValue(false),
  getActiveContainerCount: vi.fn().mockReturnValue(0),
  killContainer: vi.fn(),
}));

vi.mock('../config.js', async () => {
  const actual = await vi.importActual('../config.js');
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-test-router-slash' };
});

const TEST_DIR = '/tmp/nanoclaw-test-router-slash';

function now(): string {
  return new Date().toISOString();
}

function seedTelegramGroupMentionWiring(): void {
  createAgentGroup({
    id: 'ag-1',
    name: 'Barão',
    folder: 'barao',
    agent_provider: null,
    created_at: now(),
  });
  createMessagingGroup({
    id: 'mg-tg',
    channel_type: 'telegram',
    platform_id: 'telegram:-100123',
    instance: 'telegram',
    name: null,
    is_group: 1,
    unknown_sender_policy: 'public',
    denied_at: null,
    created_at: now(),
  });
  createMessagingGroupAgent({
    id: 'mga-tg',
    messaging_group_id: 'mg-tg',
    agent_group_id: 'ag-1',
    engage_mode: 'mention',
    engage_pattern: null,
    sender_scope: 'all',
    ignored_message_policy: 'drop',
    session_mode: 'shared',
    priority: 0,
    created_at: now(),
  });
}

beforeEach(() => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  const db = initTestDb();
  runMigrations(db);
  seedTelegramGroupMentionWiring();
  createUser({ id: 'telegram:owner', kind: 'telegram', display_name: 'Owner', created_at: now() });
  grantRole({
    user_id: 'telegram:owner',
    role: 'owner',
    agent_group_id: null,
    granted_by: null,
    granted_at: now(),
  });
  setSenderResolver((event) => {
    try {
      const parsed = JSON.parse(event.message.content) as { senderId?: string };
      return parsed.senderId ?? null;
    } catch {
      return null;
    }
  });
});

afterEach(() => {
  setSenderResolver(null as never);
  setDeliveryAdapter(null as never);
  closeDb();
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
});

describe('router slash commands', () => {
  it('handles /new in a mention-only group without @mention and delivers the ack', async () => {
    const delivered: string[] = [];
    setDeliveryAdapter({
      async deliver(_channelType, _platformId, _threadId, _kind, content) {
        const parsed = JSON.parse(content) as { text?: string };
        delivered.push(parsed.text ?? content);
        return 'platform-msg-1';
      },
    });

    const { routeInbound } = await import('../router.js');

    // Bootstrap an active session (mention required for engage_mode=mention).
    await routeInbound({
      channelType: 'telegram',
      platformId: 'telegram:-100123',
      threadId: null,
      instance: 'telegram',
      message: {
        id: 'msg-bootstrap',
        kind: 'chat-sdk',
        content: JSON.stringify({ text: 'oi', senderId: 'telegram:owner', sender: 'Owner' }),
        timestamp: now(),
        isMention: true,
        isGroup: true,
      },
    });

    const before = findSessionForAgent('ag-1', 'mg-tg', null);
    expect(before).toBeDefined();

    const event: InboundEvent = {
      channelType: 'telegram',
      platformId: 'telegram:-100123',
      threadId: null,
      instance: 'telegram',
      message: {
        id: 'msg-new-1',
        kind: 'chat-sdk',
        content: JSON.stringify({ text: '/new', senderId: 'telegram:owner', sender: 'Owner' }),
        timestamp: now(),
        isMention: false,
        isGroup: true,
      },
    };

    const beforeId = before!.id;
    await routeInbound(event);

    const after = findSessionForAgent('ag-1', 'mg-tg', null);
    expect(after).toBeDefined();
    expect(after!.id).not.toBe(beforeId);
    expect(after!.status).toBe('active');

    const outDb = new Database(outboundDbPath('ag-1', after!.id));
    const row = outDb
      .prepare('SELECT content FROM messages_out ORDER BY timestamp DESC LIMIT 1')
      .get() as { content: string };
    outDb.close();
    expect(JSON.parse(row.content).text).toBe('Nova conversa iniciada. A conversa anterior foi arquivada.');

    expect(delivered).toContain('Nova conversa iniciada. A conversa anterior foi arquivada.');
  });

  it('delivers permission denied when a non-admin sends /new', async () => {
    const delivered: string[] = [];
    setDeliveryAdapter({
      async deliver(_channelType, _platformId, _threadId, _kind, content) {
        const parsed = JSON.parse(content) as { text?: string };
        delivered.push(parsed.text ?? content);
        return 'platform-msg-deny';
      },
    });

    const { routeInbound } = await import('../router.js');

    await routeInbound({
      channelType: 'telegram',
      platformId: 'telegram:-100123',
      threadId: null,
      instance: 'telegram',
      message: {
        id: 'msg-new-deny',
        kind: 'chat-sdk',
        content: JSON.stringify({ text: '/new', senderId: 'telegram:stranger', sender: 'Stranger' }),
        timestamp: now(),
        isMention: false,
        isGroup: true,
      },
    });

    expect(delivered.some((t) => t.includes('Permission denied'))).toBe(true);
  });
});
