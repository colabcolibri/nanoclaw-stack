import type { Migration } from './index.js';

/**
 * Conversation lifecycle: stable conversation_id across session rotations.
 * Sessions can be archived (/new, /new-resume) while keeping audit history.
 */
export const migration025: Migration = {
  version: 25,
  name: 'conversation-lifecycle',
  up(db) {
    db.exec(`
      ALTER TABLE sessions ADD COLUMN conversation_id TEXT;
      ALTER TABLE sessions ADD COLUMN archived_at TEXT;
    `);
    db.exec(`
      UPDATE sessions SET conversation_id = id WHERE conversation_id IS NULL;
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_conversation ON sessions(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_active_agent_thread
        ON sessions(agent_group_id, messaging_group_id, thread_id, status);
    `);
  },
};
