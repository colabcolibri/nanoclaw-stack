import { Database } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';
import { CronExpressionParser } from 'cron-parser';
import type { AgentTool } from './types.js';
import { getSessionRouting } from '../db/session-routing.js';

function findInboundDbPath(cwd: string): string | null {
  const envPath = process.env.SESSION_INBOUND_DB_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidates = [
    '/workspace/inbound.db',
    path.join(cwd, 'inbound.db'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  // Search active session in v2-sessions
  const sessionsRoot = '/opt/nanoclaw-stack/nanoclaw/data/v2-sessions';
  if (fs.existsSync(sessionsRoot)) {
    try {
      const groups = fs.readdirSync(sessionsRoot);
      for (const g of groups) {
        const gPath = path.join(sessionsRoot, g);
        const sessions = fs.readdirSync(gPath).filter((s) => s.startsWith('sess-1'));
        for (const s of sessions) {
          const dbPath = path.join(gPath, s, 'inbound.db');
          if (fs.existsSync(dbPath)) return dbPath;
        }
      }
    } catch {}
  }
  return null;
}

export const schedulerTool: AgentTool = {
  domain: 'automation_scheduling',
  definition: {
    type: 'function',
    function: {
      name: 'schedule_followup',
      description:
        'Schedules future agent task follow-ups, delayed background executions, or recurring cron routines autonomously.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['schedule_delayed_task', 'schedule_recurring_routine', 'list_scheduled_tasks', 'update_recurring_routine', 'cancel_task'],
            description:
              'Action to perform: "schedule_delayed_task" (execute follow-up in X minutes), "schedule_recurring_routine" (periodic cron routine), "list_scheduled_tasks" (list active schedules), "update_recurring_routine" (update frequency or prompt of existing cron), "cancel_task" (cancel by ID).',
          },
          delay_minutes: {
            type: 'number',
            description: 'Delay time in minutes for future execution (e.g. 5, 15, 60).',
          },
          run_at: {
            type: 'string',
            description: 'Exact ISO timestamp for execution (e.g. "2026-08-17T18:00:00Z").',
          },
          cron: {
            type: 'string',
            description: 'Cron expression for recurring routine (e.g. "0 * * * *" for every hour).',
          },
          prompt: {
            type: 'string',
            description: 'Clear prompt instruction for the agent when awakened at the scheduled time.',
          },
          task_id: {
            type: 'string',
            description: 'Task ID to cancel.',
          },
        },
        required: ['action'],
      },
    },
  },
  execute: async (args: any, cwd: string): Promise<string> => {
    const dbPath = findInboundDbPath(cwd);
    if (!dbPath) {
      return JSON.stringify({ status: 'error', error: 'Banco de sessão inbound.db não encontrado para agendamento.' });
    }

    const inDb = new Database(dbPath);
    const action = args.action || 'schedule_delayed_task';

    try {
      let platformId = 'telegram:7239635872';
      let channelType = 'telegram';
      let threadId: string | null = null;

      try {
        const routeRow = inDb.query("SELECT channel_type, platform_id, thread_id FROM session_routing LIMIT 1").get() as any;
        if (routeRow) {
          platformId = routeRow.platform_id || platformId;
          channelType = routeRow.channel_type || channelType;
          threadId = routeRow.thread_id || null;
        }
      } catch {}

      // 1. SCHEDULE DELAYED TASK
      if (action === 'schedule_delayed_task') {
        if (!args.prompt || !args.prompt.trim()) {
          return JSON.stringify({ status: 'error', error: 'Parâmetro "prompt" é obrigatório para agendar a ação.' });
        }

        let processAfterDate = new Date();
        if (args.run_at) {
          processAfterDate = new Date(args.run_at);
        } else {
          const delayMinutes = Math.max(1, Number(args.delay_minutes) || 5);
          processAfterDate = new Date(Date.now() + delayMinutes * 60 * 1000);
        }

        const taskId = `task-delayed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const contentJson = JSON.stringify({
          _type: 'chat:Message',
          id: taskId,
          text: `⏰ [Ação Agendada / Continuidade Autônoma]: ${args.prompt.trim()}`,
          isScheduledFollowup: true,
          scheduledFor: processAfterDate.toISOString(),
        });

        inDb.query(
          `INSERT INTO messages_in (id, kind, timestamp, status, process_after, trigger, platform_id, channel_type, thread_id, content)
           VALUES (?, 'chat', ?, 'pending', ?, 1, ?, ?, ?, ?)`
        ).run(
          taskId,
          new Date().toISOString(),
          processAfterDate.toISOString(),
          platformId,
          channelType,
          threadId,
          contentJson
        );

        return JSON.stringify({
          status: 'ok',
          message: `Ação futura agendada com sucesso. O sistema irá acordar para continuidade em ${processAfterDate.toLocaleTimeString('pt-BR')} (${processAfterDate.toISOString()}).`,
          taskId,
          scheduledFor: processAfterDate.toISOString(),
        });
      }

      // 2. SCHEDULE RECURRING ROUTINE
      if (action === 'schedule_recurring_routine') {
        const cronExpr = args.cron || '0 * * * *';
        if (!args.prompt || !args.prompt.trim()) {
          return JSON.stringify({ status: 'error', error: 'Parâmetro "prompt" é obrigatório para rotina recorrente.' });
        }

        const routineId = `routine-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const contentJson = JSON.stringify({
          _type: 'chat:Message',
          id: routineId,
          text: `🔄 [Rotina Periódica Agendada (${cronExpr})]: ${args.prompt.trim()}`,
          isRecurringRoutine: true,
          cron: cronExpr,
        });

        let nextRunIso: string | null = null;
        try {
          nextRunIso = CronExpressionParser.parse(cronExpr).next().toISOString();
        } catch {}

        inDb.query(
          `INSERT INTO messages_in (id, kind, timestamp, status, process_after, recurrence, trigger, platform_id, channel_type, thread_id, content)
           VALUES (?, 'chat', ?, 'pending', ?, ?, 1, ?, ?, ?, ?)`
        ).run(
          routineId,
          new Date().toISOString(),
          nextRunIso,
          cronExpr,
          platformId,
          channelType,
          threadId,
          contentJson
        );

        return JSON.stringify({
          status: 'ok',
          message: `Rotina recorrente agendada com sucesso com expressão cron "${cronExpr}". Próxima execução: ${nextRunIso || 'agendada'}.`,
          routineId,
          cron: cronExpr,
          nextRun: nextRunIso,
        });
      }

      // 3. LIST SCHEDULED TASKS
      if (action === 'list_scheduled_tasks') {
        const rows = inDb.query(
          `SELECT id, timestamp, status, process_after, recurrence, content FROM messages_in 
           WHERE (process_after IS NOT NULL OR recurrence IS NOT NULL) AND status = 'pending'
           ORDER BY timestamp DESC LIMIT 20`
        ).all() as any[];

        const tasks = rows.map((r) => {
          let text = '';
          try {
            const parsed = JSON.parse(r.content);
            text = parsed.text || '';
          } catch {}
          return {
            id: r.id,
            status: r.status,
            process_after: r.process_after,
            recurrence: r.recurrence,
            prompt: text,
          };
        });

        return JSON.stringify({
          status: 'ok',
          totalScheduled: tasks.length,
          tasks,
        });
      }

      // 4. UPDATE RECURRING ROUTINE
      if (action === 'update_recurring_routine' || action === 'update_task') {
        let taskId = args.task_id;
        if (!taskId) {
          const latestRow = inDb.query("SELECT id FROM messages_in WHERE recurrence IS NOT NULL AND status != 'cancelled' ORDER BY timestamp DESC LIMIT 1").get() as any;
          if (latestRow) {
            taskId = latestRow.id;
          } else {
            return JSON.stringify({ status: 'error', error: 'Nenhuma rotina ativa encontrada para atualizar. Especifique o task_id.' });
          }
        }

        const existing = inDb.query("SELECT id, recurrence, content FROM messages_in WHERE id = ?").get(taskId) as any;
        if (!existing) {
          return JSON.stringify({ status: 'error', error: `Tarefa ${taskId} não encontrada.` });
        }

        const newCron = args.cron || existing.recurrence;
        let newPrompt = args.prompt;
        if (!newPrompt) {
          try {
            const parsed = JSON.parse(existing.content);
            newPrompt = parsed.text || '';
          } catch {
            newPrompt = existing.content;
          }
        }

        let nextRunIso: string | null = null;
        try {
          nextRunIso = CronExpressionParser.parse(newCron).next().toISOString();
        } catch {}

        const cleanPromptText = newPrompt.replace(/^🔄\s*\[.*?\]:\s*/, '').trim();
        const contentJson = JSON.stringify({
          _type: 'chat:Message',
          id: taskId,
          text: `🔄 [Rotina Periódica Agendada (${newCron})]: ${cleanPromptText}`,
          isRecurringRoutine: true,
          cron: newCron,
        });

        inDb.query("UPDATE messages_in SET recurrence = ?, process_after = ?, content = ?, status = 'pending' WHERE id = ?").run(newCron, nextRunIso, contentJson, taskId);

        return JSON.stringify({
          status: 'ok',
          message: `Rotina ${taskId} atualizada com sucesso. Nova expressão cron: "${newCron}". Próxima execução: ${nextRunIso || 'agendada'}.`,
          taskId,
          cron: newCron,
          nextRun: nextRunIso,
          prompt: cleanPromptText,
        });
      }

      // 5. CANCEL TASK
      if (action === 'cancel_task') {
        if (!args.task_id) {
          return JSON.stringify({ status: 'error', error: 'Parâmetro "task_id" é obrigatório.' });
        }
        inDb.query("UPDATE messages_in SET status = 'cancelled' WHERE id = ?").run(args.task_id);
        return JSON.stringify({ status: 'ok', message: `Tarefa ${args.task_id} cancelada com sucesso.` });
      }

      return JSON.stringify({ status: 'error', error: `Ação "${action}" não reconhecida.` });
    } finally {
      inDb.close();
    }
  },
};
