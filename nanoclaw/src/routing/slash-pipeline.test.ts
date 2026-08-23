/**
 * Unit tests for the unified slash pipeline (channel + sync transports).
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
import { setDeliveryAdapter } from '../delivery.js';
import { log } from '../log.js';
import { runSlashPipeline } from './slash-pipeline.js';

vi.mock('../config.js', async () => {
  const actual = await vi.importActual('../config.js');
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-test-slash-pipeline' };
});

const TEST_DIR = '/tmp/nanoclaw-test-slash-pipeline';

function now(): string {
  return new Date().toISOString();
}

function seed(): void {
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
  createUser({ id: 'telegram:owner', kind: 'telegram', display_name: 'Owner', created_at: now() });
  grantRole({
    user_id: 'telegram:owner',
    role: 'owner',
    agent_group_id: null,
    granted_by: null,
    granted_at: now(),
  });
}

const caller = {
  agentGroupId: 'ag-1',
  messagingGroupId: 'mg-tg',
  threadId: null as string | null,
  sessionMode: 'shared' as const,
  channelType: 'telegram',
  platformId: 'telegram:-100123',
  userId: 'telegram:owner',
};

const delivery = {
  channelType: 'telegram',
  platformId: 'telegram:-100123',
  threadId: null as string | null,
};

beforeEach(() => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  const db = initTestDb();
  runMigrations(db);
  seed();
});

afterEach(() => {
  setDeliveryAdapter(null as never);
  closeDb();
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
});

describe('runSlashPipeline', () => {
  it('returns not_slash for normal text', async () => {
    const outcome = await runSlashPipeline({
      content: 'hello',
      caller,
      delivery,
      userId: 'telegram:owner',
      agentGroupId: 'ag-1',
      transport: 'channel',
    });
    expect(outcome.kind).toBe('not_slash');
  });

  it('warns when a slash command is not in the host registry', async () => {
    const delivered: string[] = [];
    setDeliveryAdapter({
      async deliver(_ct, _pid, _tid, _kind, content) {
        delivered.push(JSON.parse(content).text ?? content);
        return 'p-1';
      },
    });
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {});
    const summarizeWithLlm = vi.fn().mockResolvedValue('Resumo LLM da conversa anterior.');
    const outcome = await runSlashPipeline({
      content: JSON.stringify({ text: '/new_resume' }),
      caller,
      delivery,
      userId: 'telegram:owner',
      agentGroupId: 'ag-1',
      transport: 'channel',
      summarizeWithLlm,
      denySession: {
        id: 'sess-bootstrap',
        agent_group_id: 'ag-1',
        messaging_group_id: 'mg-tg',
        thread_id: null,
        conversation_id: null,
        agent_provider: null,
        status: 'active',
        container_status: 'stopped',
        last_active: null,
        archived_at: null,
        created_at: now(),
      },
    });
    expect(outcome.kind).toBe('handled');
    expect(warn).not.toHaveBeenCalledWith(
      'Slash command not in host registry — no ack will be sent',
      expect.anything(),
    );
    warn.mockClear();

    const unknown = await runSlashPipeline({
      content: JSON.stringify({ text: '/totally_unknown' }),
      caller,
      delivery,
      userId: 'telegram:owner',
      agentGroupId: 'ag-1',
      transport: 'channel',
    });
    expect(unknown.kind).toBe('not_slash');
    expect(warn).toHaveBeenCalledWith(
      'Slash command not in host registry — no ack will be sent',
      expect.objectContaining({ token: '/totally_unknown', channelType: 'telegram' }),
    );
    warn.mockRestore();
  });

  it('handles /new on channel transport with immediate delivery', async () => {
    const delivered: string[] = [];
    setDeliveryAdapter({
      async deliver(_ct, _pid, _tid, _kind, content) {
        delivered.push(JSON.parse(content).text ?? content);
        return 'p-1';
      },
    });

    const before = findSessionForAgent('ag-1', 'mg-tg', null);
    const denySession = before ?? {
      id: 'sess-bootstrap',
      agent_group_id: 'ag-1',
      messaging_group_id: 'mg-tg',
      thread_id: null,
      conversation_id: null,
      agent_provider: null,
      status: 'active' as const,
      container_status: 'stopped' as const,
      last_active: null,
      archived_at: null,
      created_at: now(),
    };

    const outcome = await runSlashPipeline({
      content: JSON.stringify({ text: '/new' }),
      caller,
      delivery,
      userId: 'telegram:owner',
      agentGroupId: 'ag-1',
      transport: 'channel',
      denySession,
    });

    expect(outcome.kind).toBe('handled');
    if (outcome.kind !== 'handled') return;

    expect(outcome.result.reply).toBe('Nova conversa iniciada. A conversa anterior foi arquivada.');
    expect(delivered).toContain('Nova conversa iniciada. A conversa anterior foi arquivada.');

    const after = findSessionForAgent('ag-1', 'mg-tg', null);
    expect(after?.id).toBe(outcome.result.session.id);
    if (after) {
      const outDb = new Database(outboundDbPath('ag-1', after.id));
      const row = outDb.prepare('SELECT content FROM messages_out LIMIT 1').get() as { content: string };
      outDb.close();
      expect(JSON.parse(row.content).text).toBe('Nova conversa iniciada. A conversa anterior foi arquivada.');
    }
  });

  it('handles explicitCommandId on sync transport without admin gate', async () => {
    const outcome = await runSlashPipeline({
      content: 'ignored body',
      explicitCommandId: 'new',
      caller: {
        ...caller,
        messagingGroupId: null,
        sessionMode: 'per-thread',
        channelType: 'macos',
        platformId: 'macos:default',
        threadId: 'macos:default',
        userId: 'default',
      },
      delivery: {
        channelType: 'macos',
        platformId: 'macos:default',
        threadId: 'macos:default',
      },
      userId: 'default',
      agentGroupId: 'ag-1',
      transport: 'sync',
    });

    expect(outcome.kind).toBe('handled');
    if (outcome.kind === 'handled') {
      expect(outcome.result.reply).toBe('Nova conversa iniciada. A conversa anterior foi arquivada.');
    }
  });

  it('denies non-admin on channel transport', async () => {
    const delivered: string[] = [];
    setDeliveryAdapter({
      async deliver(_ct, _pid, _tid, _kind, content) {
        delivered.push(JSON.parse(content).text ?? content);
        return 'p-deny';
      },
    });

    const { resolveSession } = await import('../session-manager.js');
    const { session } = resolveSession('ag-1', 'mg-tg', null, 'shared');

    const outcome = await runSlashPipeline({
      content: '/new',
      caller,
      delivery,
      userId: 'telegram:stranger',
      agentGroupId: 'ag-1',
      transport: 'channel',
      denySession: session,
    });

    expect(outcome.kind).toBe('denied');
    expect(delivered.some((t) => t.includes('Permissão negada'))).toBe(true);
  });
});
