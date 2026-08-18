/**
 * PayloadSanitizer (SOLID - Open-Closed & Non-Destructive):
 * Universally and dynamically cleans technical noise (base64 blobs, raw HTML tags, network headers)
 * without hardcoded tool checks or losing any business fields.
 */
export class PayloadSanitizer {
  private static readonly SAFE_RAW_LENGTH = 1500;
  private static readonly MAX_STRING_FIELD_LENGTH = 1500;
  private static readonly MAX_ARRAY_ITEMS = 15;

  private static readonly NOISE_KEYS = new Set([
    '__v',
    'etag',
    'rawheaders',
    'headers',
    'response_metadata',
    'request_id',
    'http_status',
    'statuscode',
    'spf',
    'dkim',
    'dmarc',
    'debug_trace',
    'stack_trace',
  ]);

  /**
   * Sanitizes any tool output dynamically and non-destructively.
   */
  static sanitize(toolName: string, rawOutput: string): string {
    if (!rawOutput || !rawOutput.trim()) return '(retorno vazio)';

    const trimmed = rawOutput.trim();

    // 1. Fast-Path: If the payload is already compact, preserve 100% intact
    if (trimmed.length <= this.SAFE_RAW_LENGTH && !trimmed.includes('data:image/') && !trimmed.includes(';base64,')) {
      return trimmed;
    }

    // 2. Try JSON parsing for structural noise reduction
    try {
      const parsed = JSON.parse(trimmed);
      const cleaned = this.cleanNode(parsed);
      return JSON.stringify(cleaned);
    } catch {
      // 3. Fallback for plain text: clean HTML/Base64 noise and bound length
      return this.cleanPlainText(trimmed);
    }
  }

  /**
   * Recursively traverses any data structure to strip binary/noise blobs while preserving all business data.
   */
  private static cleanNode(node: any, depth = 0): any {
    if (node === null || node === undefined) return node;

    // Primitives
    if (typeof node !== 'object') {
      if (typeof node === 'string') {
        return this.cleanStringField(node);
      }
      return node;
    }

    // Guard against deep circular structures
    if (depth > 6) return '[Estrutura profunda truncada]';

    // Arrays: Bounded to prevent multi-thousand row dumps
    if (Array.isArray(node)) {
      const cleanedItems = node.slice(0, this.MAX_ARRAY_ITEMS).map((item) => this.cleanNode(item, depth + 1));
      if (node.length > this.MAX_ARRAY_ITEMS) {
        cleanedItems.push(`...[e mais ${node.length - this.MAX_ARRAY_ITEMS} itens adicionais preservados]`);
      }
      return cleanedItems;
    }

    // Objects: Strip technical noise keys, clean every other business key dynamically
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(node)) {
      const lowerKey = key.toLowerCase();

      // Skip known technical transport noise
      if (this.NOISE_KEYS.has(lowerKey)) {
        continue;
      }

      result[key] = this.cleanNode(value, depth + 1);
    }

    return result;
  }

  /**
   * Cleans individual string fields, collapsing Base64 blobs and bounding massive text blocks.
   */
  private static cleanStringField(str: string): string {
    // Detect and collapse Base64 image/file blobs
    if (str.startsWith('data:') && str.includes(';base64,')) {
      return `[Blob Base64 ~${Math.round(str.length / 1024)} KB omitido]`;
    }

    // Detect standalone long base64 chunks (> 200 consecutive base64 chars)
    if (str.length > 200 && /^[A-Za-z0-9+/=]{200,}$/.test(str)) {
      return `[Binário Base64 ~${Math.round(str.length / 1024)} KB omitido]`;
    }

    // Strip raw <style> and <script> tags if HTML was returned
    let text = str;
    if (text.includes('<style') || text.includes('<script')) {
      text = text
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    }

    if (text.length > this.MAX_STRING_FIELD_LENGTH) {
      return text.slice(0, this.MAX_STRING_FIELD_LENGTH) + '... [texto longo resumido]';
    }

    return text;
  }

  /**
   * Cleans plain text outputs (logs, shell outputs, HTML responses).
   */
  private static cleanPlainText(text: string): string {
    let clean = this.cleanStringField(text);
    if (clean.length > 2500) {
      return clean.slice(0, 2500) + '\n... [conteúdo longo truncado de forma segura]';
    }
    return clean;
  }
}
