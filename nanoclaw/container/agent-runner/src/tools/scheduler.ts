import { Database } from 'bun:sqlite';
import path from 'path';
import fs from 'fs';
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
  definition: {
    type: 'function',
    function: {
      name: 'schedule_followup',
      description:
        'Agenda continuações, ações futuras ou rotinas recorrentes de forma autônoma no sistema sem depender de esperar o cron geral. Use quando precisar continuar uma tarefa daqui a X minutos ou configurar rotinas recorrentes.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['schedule_delayed_task', 'schedule_recurring_routine', 'list_scheduled_tasks', 'cancel_task'],
            description:
              'Ação a realizar: schedule_delayed_task (executar follow-up em X minutos), schedule_recurring_routine (rotina periódica cron), list_scheduled_tasks (listar agendamentos ativos), cancel_task (cancelar por ID).',
          },
          delay_minutes: {
            type: 'number',
            description: 'Tempo de espera em minutos para a execução futura (ex: 5, 15, 60).',
          },
          run_at: {
            type: 'string',
            description: 'Data e hora exata em formato ISO (ex: "2026-08-17T18:00:00Z").',
          },
          cron: {
            type: 'string',
            description: 'Expressão cron para rotina recorrente (ex: "0 * * * *" para a cada 1 hora).',
          },
          prompt: {
            type: 'string',
            description: 'Instrução clara do que o agente deve verificar ou executar quando for acordado no momento agendado.',
          },
          task_id: {
            type: 'string',
            description: 'ID da tarefa para cancelamento.',
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

        inDb.query(
          `INSERT INTO messages_in (id, kind, timestamp, status, recurrence, trigger, platform_id, channel_type, thread_id, content)
           VALUES (?, 'chat', ?, 'pending', ?, 1, ?, ?, ?, ?)`
        ).run(
          routineId,
          new Date().toISOString(),
          cronExpr,
          platformId,
          channelType,
          threadId,
          contentJson
        );

        return JSON.stringify({
          status: 'ok',
          message: `Rotina recorrente agendada com sucesso com expressão cron "${cronExpr}".`,
          routineId,
          cron: cronExpr,
        });
      }

      // 3. LIST SCHEDULED TASKS
      if (action === 'list_scheduled_tasks') {
        const rows = inDb.query(
          `SELECT id, timestamp, status, process_after, recurrence, content FROM messages_in 
           WHERE (process_after IS NOT NULL OR recurrence IS NOT NULL) AND status != 'done'
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

      // 4. CANCEL TASK
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
