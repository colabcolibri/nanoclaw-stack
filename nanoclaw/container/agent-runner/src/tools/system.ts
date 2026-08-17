import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { AgentTool } from './types.js';

const execAsync = promisify(exec);

export const runCommandTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Executa um comando bash / Linux dentro do ambiente seguro do contêiner para consultar status, arquivos, scripts ou ferramentas.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'O comando shell a ser executado' },
        },
        required: ['command'],
      },
    },
  },
  execute: async (args: any, cwd: string): Promise<string> => {
    const { stdout, stderr } = await execAsync(args.command, { cwd, timeout: 30000 });
    return stdout || stderr || '(comando executado com sucesso sem saída)';
  },
};

export const readFileTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lê o conteúdo de um arquivo do workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho do arquivo' },
        },
        required: ['path'],
      },
    },
  },
  execute: async (args: any, cwd: string): Promise<string> => {
    const targetPath = path.isAbsolute(args.path) ? args.path : path.join(cwd, args.path);
    if (fs.existsSync(targetPath)) {
      return fs.readFileSync(targetPath, 'utf-8');
    }
    return `Arquivo não encontrado: ${args.path}`;
  },
};
