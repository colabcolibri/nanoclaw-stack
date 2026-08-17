import type { AgentTool } from './types.js';
import { MemoryManager } from '../services/memory.js';

export const memoryTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'manage_memory',
      description:
        'Gerencia a memória de longo prazo do assistente. Use para memorizar fatos importantes, preferências do usuário, decisões de negócio ou regras permanentes que devem ser lembradas em conversas futuras.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['remember', 'recall'],
            description: 'remember (gravar nova informação permanente) ou recall (consultar memórias gravadas).',
          },
          fact: {
            type: 'string',
            description: 'O fato, preferência ou aprendizado a ser memorizado de forma permanente.',
          },
          category: {
            type: 'string',
            description: 'Categoria do fato (ex: "Preferências", "Clientes", "Negócios", "Pessoal").',
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
