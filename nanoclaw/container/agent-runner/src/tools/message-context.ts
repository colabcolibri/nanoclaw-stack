import { MemoService } from '../services/memo-service.js';
import type { ToolDefinition } from './types.js';

export const RETRIEVE_MESSAGE_CONTEXT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'retrieve_message_context',
    description:
      'Retrieves the full original content of a prior message by its message_id. Use this ONLY when you need the complete uncompressed text, full email body, or exact historical numbers referenced in a memo.',
    parameters: {
      type: 'object',
      properties: {
        message_id: {
          type: 'string',
          description: 'The exact ID of the message to retrieve (as shown in recent memos, e.g. "msg-123" or "platform:123").',
        },
      },
      required: ['message_id'],
    },
  },
};

export async function handleRetrieveMessageContext(args: { message_id?: string }): Promise<string> {
  const messageId = args.message_id?.trim();
  if (!messageId) {
    return JSON.stringify({ error: 'message_id is required' });
  }

  const fullContent = MemoService.getFullMessage(messageId);
  if (!fullContent) {
    return JSON.stringify({ error: `Message with ID "${messageId}" was not found in session history.` });
  }

  return JSON.stringify({
    message_id: messageId,
    content: fullContent,
    length: fullContent.length,
  });
}
