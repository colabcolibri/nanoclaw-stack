import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeDb, createAgentGroup, createMessagingGroup, createSession, initTestDb, runMigrations } from '../db/index.js';
import { getHistoryCutoff } from './session-state.js';
import { createNodeConversationBackend } from './backend-node.js';
import { outboundDbPath } from '../session-manager.js';
import { initSessionFolder } from '../session-manager.js';

vi.mock('../container-runner.js', () => ({
  isContainerRunning: vi.fn(),
  killContainer: vi.fn(),
}));

vi.mock('../config.js', async () => {
  const actual = await vi.importActual('../config.js');
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-test-forget-soft' };
});

const TEST_DIR = '/tmp/nanoclaw-test-forget-soft';

function now(): string {
  return new Date().toISOString();
}

describe('forgetSoft (node conversation backend)', () => {
  beforeEach(async () => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
    const db = initTestDb();
    runMigrations(db);
    createAgentGroup({
      id: 'ag-1',
      name: 'Test',
      folder: 'test',
      agent_provider: null,
      created_at: now(),
    });
    createMessagingGroup({
      id: 'mg-1',
      channel_type: 'telegram',
      platform_id: 'telegram:-100',
      instance: 'telegram',
      name: null,
      is_group: 1,
      unknown_sender_policy: 'public',
      denied_at: null,
      created_at: now(),
    });
    createSession({
      id: 'sess-1',
      agent_group_id: 'ag-1',
      messaging_group_id: 'mg-1',
      thread_id: null,
      conversation_id: 'conv-1',
      agent_provider: null,
      status: 'active',
      container_status: 'running',
      last_active: null,
      archived_at: null,
      created_at: now(),
    });
    initSessionFolder('ag-1', 'sess-1');
    vi.clearAllMocks();
  });

  afterEach(() => {
    closeDb();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  });

  it('kills a hot container after clearing continuation and history cutoff', async () => {
    const { isContainerRunning, killContainer } = await import('../container-runner.js');
    vi.mocked(isContainerRunning).mockReturnValue(true);

    const backend = createNodeConversationBackend();
    backend.forgetSoft('ag-1', 'sess-1');

    expect(getHistoryCutoff('ag-1', 'sess-1')).toBeTruthy();
    expect(killContainer).toHaveBeenCalledWith('sess-1', 'conversation-cleared');

    const dbPath = outboundDbPath('ag-1', 'sess-1');
    const { openSqliteDatabase } = await import('../db/sqlite-compat.js');
    const db = openSqliteDatabase(dbPath);
    try {
      const cont = db
        .prepare(`SELECT 1 FROM session_state WHERE key LIKE 'continuation:%' LIMIT 1`)
        .get();
      expect(cont).toBeUndefined();
    } finally {
      db.close();
    }
  });

  it('does not kill when no container is running', async () => {
    const { isContainerRunning, killContainer } = await import('../container-runner.js');
    vi.mocked(isContainerRunning).mockReturnValue(false);

    const backend = createNodeConversationBackend();
    backend.forgetSoft('ag-1', 'sess-1');

    expect(killContainer).not.toHaveBeenCalled();
    expect(getHistoryCutoff('ag-1', 'sess-1')).toBeTruthy();
  });
});
