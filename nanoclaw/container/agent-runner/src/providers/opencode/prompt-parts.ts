import { existsSync } from 'fs';
import { pathToFileURL } from 'url';
import type { FilePartInput } from '@opencode-ai/sdk';

import { log } from './shared.js';

/**
 * One channel attachment, in structured form: a display name, a MIME type, a
 * path to the staged file inside the container, a remote URL — each present
 * only when the channel supplied it.
 *
 * Declared here rather than imported from `./types.js` because this file is
 * also installed onto agent-runners whose shared types carry no attachment
 * shape at all. Structural typing makes the two interchangeable wherever both
 * exist, so nothing is lost by keeping the declaration local, while an install
 * that predates the shared one still compiles.
 *
 * Attachments are ALSO described inline in the prompt text the formatter
 * produces, and that text rendering stays the contract every provider relies
 * on. Everything below is an additive view for OpenCode's file parts: when no
 * structured attachment arrives, the provider behaves exactly as it did before.
 */
export interface OpenCodePromptAttachment {
  filename?: string;
  mime?: string;
  path?: string;
  url?: string;
}

/** Extension → MIME fallback, for adapters that report no `mimeType`. */
const ATTACHMENT_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.pdf': 'application/pdf',
};

function attachmentMime(att: OpenCodePromptAttachment): string | undefined {
  if (att.mime) return att.mime;
  const name = att.path || att.filename || '';
  const dot = name.lastIndexOf('.');
  return dot < 0 ? undefined : ATTACHMENT_MIME_BY_EXT[name.slice(dot).toLowerCase()];
}

/**
 * Turn a turn's attachments into OpenCode file parts, so the model sees the
 * media itself rather than only the `[image: cat.png — saved to …]` line the
 * formatter already renders into the prompt text.
 *
 * The URL is a `file://` path, NOT a data: URI, deliberately: OpenCode resolves
 * a file: part server-side — packages/opencode/src/session/prompt.ts (v1.4.14)
 * `case "file:"` at :1043 does `fileURLToPath(part.url)` at :1045 and, for a
 * mime that is neither text/plain nor a directory, re-emits the part as
 * `data:${part.mime};base64,` + the file it read (:1197-1199). Base64-ing here
 * would only duplicate that work and inflate the request body. The server
 * shares this container's filesystem (spawnOpencodeServer), so the path resolves.
 *
 * Only images and PDFs are forwarded; PDFs go through even though a given
 * backend may reject them, since the alternative is silently withholding a
 * document the user did send. Anything skipped is still described in the
 * prompt text, so it is never lost — just not handed over as media.
 *
 * `exists` is injectable so tests can drive resolvability without touching disk.
 */
export function buildAttachmentFileParts(
  attachments: OpenCodePromptAttachment[] | undefined,
  exists: (path: string) => boolean = existsSync,
): FilePartInput[] {
  const parts: FilePartInput[] = [];
  for (const att of attachments ?? []) {
    const mime = attachmentMime(att);
    if (!mime) continue;
    if (!mime.startsWith('image/') && mime !== 'application/pdf') continue;
    if (!att.path || !exists(att.path)) {
      const label = att.filename || att.path || att.url || 'unnamed';
      log(`Attachment has no readable local file, not sent as media: ${label}`);
      continue;
    }
    parts.push({ type: 'file', mime, filename: att.filename, url: pathToFileURL(att.path).href });
  }
  return parts;
}

/**
 * The prompt body for one turn: the text the formatter produced, plus any
 * media that came with it. Both the opening prompt and every mid-turn push go
 * through here, so an attachment reaches the model the same way whichever path
 * carried it — OpenCode holds one query open per session, so in practice most
 * real messages arrive as pushes.
 */
export function buildPromptParts(
  text: string,
  attachments?: OpenCodePromptAttachment[],
  exists: (path: string) => boolean = existsSync,
): Array<{ type: 'text'; text: string } | FilePartInput> {
  return [{ type: 'text', text }, ...buildAttachmentFileParts(attachments, exists)];
}

export function wrapPromptWithContext(text: string, systemInstructions?: string): string {
  let out = text;
  if (systemInstructions) {
    out = `<system>\n${systemInstructions}\n</system>\n\n${out}`;
  }
  return out;
}
