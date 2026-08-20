import type { AgentTool } from './types.js';
import { MemoryManager } from '../services/memory.js';

export const memoryTool: AgentTool = {
  domain: 'core_system',
  definition: {
    type: 'function',
    function: {
      name: 'manage_memory',
      description:
        'Manages the persistent long-term memory of the assistant. Use to record critical user preferences, business rules, decisions, or key facts across sessions.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['remember', 'recall'],
            description: '"remember" to store new permanent fact, or "recall" to search stored memories.',
          },
          fact: {
            type: 'string',
            description: 'The fact, user preference, or learned information to store permanently.',
          },
          category: {
            type: 'string',
            description: 'Category for the fact (e.g. "Preferences", "Clients", "Business", "Personal").',
          },
        },
        required: ['action'],
      },
    },
  },
  execute: async (args: any, cwd: string): Promise<string> => {
    const action = args.action || 'remember';

    if (action === 'remember') {
      if (!args.fact || !args.fact.trim()) {
        return JSON.stringify({ status: 'error', error: 'Parâmetro "fact" é obrigatório para remember.' });
      }
      const res = MemoryManager.remember(cwd, args.fact, args.category || 'Geral');
      return JSON.stringify({ status: res.success ? 'ok' : 'error', message: res.message });
    }

    if (action === 'recall') {
      const memoryText = MemoryManager.loadCoreMemory(cwd);
      return JSON.stringify({ status: 'ok', memory: memoryText || 'Nenhuma memória de longo prazo registrada ainda.' });
    }

    return JSON.stringify({ status: 'error', error: `Ação "${action}" não reconhecida.` });
  },
};
