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
      description: 'Executes a bash/Linux shell command inside the container environment to query status, files, scripts, or system utilities.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command line to execute' },
        },
        required: ['command'],
      },
    },
  },
  execute: async (args: any, cwd: string): Promise<string> => {
    const { stdout, stderr } = await execAsync(args.command, { cwd, timeout: 30000 });
    return stdout || stderr || '(command executed successfully with no output)';
  },
};

export const readFileTool: AgentTool = {
  definition: {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Reads the contents of a file from the workspace filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path of the file to read' },
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
