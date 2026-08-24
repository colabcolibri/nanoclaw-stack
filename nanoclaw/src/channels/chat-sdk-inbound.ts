/**
 * Conversão de mensagens do Chat SDK para o formato InboundMessage do host:
 * enriquecimento de anexos (com transcrição Whisper local para áudio),
 * contexto de reply e projeção do author em campos planos do remetente.
 */
import type { Message as ChatMessage } from 'chat';
import { log } from '../log.js';
import type { InboundMessage } from './adapter.js';
import type { ReplyContextExtractor } from './chat-sdk-bridge.js';

export async function messageToInbound(
  message: ChatMessage,
  isMention: boolean,
  isGroup: boolean | undefined,
  extractReplyContext?: ReplyContextExtractor,
): Promise<InboundMessage> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serialized = message.toJSON() as Record<string, any>;

  // Download attachment data before serialization loses fetchData()
  if (message.attachments && message.attachments.length > 0) {
    const enriched = [];
    for (const att of message.attachments) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entry: Record<string, any> = {
        type: att.type,
        name: att.name,
        mimeType: att.mimeType,
        size: att.size,
        width: (att as unknown as Record<string, unknown>).width,
        height: (att as unknown as Record<string, unknown>).height,
      };
      if (att.fetchData) {
        try {
          const buffer = await att.fetchData();
          entry.data = buffer.toString('base64');

          // Automatic speech-to-text via local Whisper service if audio attachment
          // ('voice' não existe em todas as versões do Chat SDK — checagem defensiva)
          const isAudio =
            att.type === 'audio' ||
            (att.type as string) === 'voice' ||
            (typeof att.mimeType === 'string' && att.mimeType.startsWith('audio/'));

          if (isAudio && buffer.length > 0) {
            try {
              const formData = new FormData();
              const blob = new Blob([buffer], { type: att.mimeType || 'audio/ogg' });
              formData.append('audio_file', blob, att.name || 'voice.ogg');
              const whisperRes = await fetch('http://127.0.0.1:9000/asr?task=transcribe&output=txt', {
                method: 'POST',
                body: formData,
              });
              if (whisperRes.ok) {
                const transcript = (await whisperRes.text()).trim();
                if (transcript) {
                  entry.transcript = transcript;
                  serialized.text =
                    (serialized.text ? `${serialized.text}\n\n` : '') + `🎤 [Áudio transcrito]: "${transcript}"`;
                  log.info('Voice message transcribed via local Whisper', {
                    transcriptPreview: transcript.slice(0, 60),
                  });
                }
              }
            } catch (whisperErr) {
              log.warn('Local Whisper transcription failed', { whisperErr });
            }
          }
        } catch (err) {
          log.warn('Failed to download attachment', { type: att.type, err });
        }
      }
      enriched.push(entry);
    }
    serialized.attachments = enriched;
  }

  // Extract reply context via platform-specific hook
  if (extractReplyContext && message.raw) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const replyTo = extractReplyContext(message.raw as Record<string, any>);
    if (replyTo) serialized.replyTo = replyTo;
  }

  // Project chat-sdk's nested author into the flat sender fields the router
  // expects (see src/router.ts extractAndUpsertUser). Native adapters already
  // populate these directly; this brings chat-sdk adapters in line.
  const author = serialized.author as { userId?: string; fullName?: string; userName?: string } | undefined;
  if (author) {
    const name = author.fullName ?? author.userName;
    serialized.senderId = author.userId;
    serialized.sender = name;
    serialized.senderName = name;
  }

  // Drop raw to save DB space (can be very large)
  serialized.raw = undefined;

  return {
    id: message.id,
    kind: 'chat-sdk',
    content: serialized,
    timestamp: message.metadata.dateSent.toISOString(),
    isMention,
    isGroup,
  };
}
