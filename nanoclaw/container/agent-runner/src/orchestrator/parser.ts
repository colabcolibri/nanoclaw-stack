import type { ExtractedToolCall, LLMResponse } from './types.js';

export class ResponseParser {
  /**
   * Extracts tool calls from either standard structured JSON or DSML text format.
   */
  static extractToolCalls(response: LLMResponse): ExtractedToolCall[] {
    const calls: ExtractedToolCall[] = [];

    // 1. Check standard JSON tool_calls
    if (response.tool_calls && Array.isArray(response.tool_calls) && response.tool_calls.length > 0) {
      for (const call of response.tool_calls) {
        let args = {};
        try {
          args = typeof call.function?.arguments === 'string'
            ? JSON.parse(call.function.arguments)
            : (call.function?.arguments || {});
        } catch {
          args = {};
        }
        calls.push({
          id: call.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: call.function?.name || '',
          args,
        });
      }
      return calls;
    }

    // 2. Check DSML XML format in content
    const content = response.content || '';
    if (content.includes('DSML') || content.includes('invoke')) {
      const invokeRegex = /<[｜|]{1,2}DSML[｜|]{1,2}invoke\s+name=["']([^"']+)["']>([\s\S]*?)<\/[｜|]{1,2}DSML[｜|]{1,2}invoke>/gi;
      let match: RegExpExecArray | null;
      let idx = 1;

      while ((match = invokeRegex.exec(content)) !== null) {
        const fnName = match[1];
        const body = match[2];
        const args: Record<string, any> = {};

        const paramRegex = /<[｜|]{1,2}DSML[｜|]{1,2}parameter\s+name=["']([^"']+)["'](?:\s+string=["']([^"']+)["'])?>([\s\S]*?)<\/[｜|]{1,2}DSML[｜|]{1,2}parameter>/gi;
        let paramMatch: RegExpExecArray | null;
        while ((paramMatch = paramRegex.exec(body)) !== null) {
          const paramName = paramMatch[1];
          const isString = paramMatch[2] === 'true';
          const rawVal = paramMatch[3].trim();

          if (isString) {
            args[paramName] = rawVal;
          } else {
            try {
              args[paramName] = JSON.parse(rawVal);
            } catch {
              args[paramName] = rawVal;
            }
          }
        }

        calls.push({
          id: `call_dsml_${Date.now()}_${idx++}`,
          name: fnName,
          args,
        });
      }
    }

    return calls;
  }

  /**
   * Strips all internal XML, thinking tags, and DSML artifacts, returning clean human text.
   */
  static cleanHumanText(rawText?: string | null): string {
    if (!rawText) return '';
    return rawText
      .replace(/<[｜|]{1,2}DSML[｜|]{1,2}tool_calls>[\s\S]*?<\/[｜|]{1,2}DSML[｜|]{1,2}tool_calls>/gi, '')
      .replace(/<[｜|]{1,2}DSML[｜|]{1,2}[\s\S]*?>/gi, '')
      .replace(/<\/[｜|]{1,2}DSML[｜|]{1,2}[\s\S]*?>/gi, '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .trim();
  }
}
