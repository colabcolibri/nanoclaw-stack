import type { AgentTool, ToolDefinition } from './types.js';

export const WEB_SEARCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Performs a real-time web search. Returns up to max_results (1 to 10) sources with titles, snippets, and URLs. Use max_results=5 to 10 to gather broad context in a single query rather than doing multiple repeated searches.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query.',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (1 to 10, default: 5). Request 5-10 for comprehensive research in one go.',
        },
      },
      required: ['query'],
    },
  },
};

export const BROWSE_URL_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browse_url',
    description:
      'Fetches and extracts clean readable text from a specific web page URL. Strips ads, scripts, and HTML noise.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full URL to read (e.g. "https://example.com/article").',
        },
      },
      required: ['url'],
    },
  },
};

export const WEB_RESEARCH_TOOL: ToolDefinition = {
  ...WEB_SEARCH_TOOL,
  function: {
    ...WEB_SEARCH_TOOL.function,
    name: 'web_research',
  },
};

export async function performWebSearch(query: string, maxResults = 5): Promise<string> {
  if (!query || !query.trim()) {
    return JSON.stringify({ error: 'query parameter is required' });
  }

  const limit = Math.min(Math.max(Number(maxResults) || 5, 1), 10);

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query.trim())}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) {
      return JSON.stringify({ error: `Search service returned HTTP ${res.status}` });
    }

    const html = await res.text();
    const results: Array<{ title: string; url: string; snippet: string }> = [];

    const regex =
      /<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = regex.exec(html)) !== null && results.length < limit) {
      let rawUrl = match[1];
      if (rawUrl.startsWith('//duckduckgo.com/l/?uddg=')) {
        try {
          const u = new URL('https:' + rawUrl);
          rawUrl = decodeURIComponent(u.searchParams.get('uddg') || rawUrl);
        } catch {}
      } else if (rawUrl.startsWith('/l/?uddg=')) {
        try {
          const u = new URL('https://duckduckgo.com' + rawUrl);
          rawUrl = decodeURIComponent(u.searchParams.get('uddg') || rawUrl);
        } catch {}
      }

      const snippet = match[3]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      results.push({
        title: match[2].replace(/<[^>]+>/g, '').trim(),
        url: rawUrl,
        snippet,
      });
    }

    if (results.length === 0) {
      return JSON.stringify({
        status: 'ok',
        query,
        results_count: 0,
        message: 'No direct results found for this query.',
      });
    }

    return JSON.stringify({
      status: 'ok',
      query,
      results_count: results.length,
      results,
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Failed to perform web search: ${err.message || String(err)}` });
  }
}

export async function performBrowseUrl(targetUrl: string): Promise<string> {
  if (!targetUrl || !targetUrl.trim()) {
    return JSON.stringify({ error: 'url parameter is required' });
  }

  let formattedUrl = targetUrl.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = 'https://' + formattedUrl;
  }

  try {
    const res = await fetch(formattedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return JSON.stringify({ error: `Webpage returned HTTP ${res.status}` });
    }

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

    const cleanText = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();

    return JSON.stringify({
      status: 'ok',
      url: formattedUrl,
      title,
      content: cleanText.slice(0, 3000),
    });
  } catch (err: any) {
    return JSON.stringify({ error: `Failed to read webpage: ${err.message || String(err)}` });
  }
}

export const webSearchTool: AgentTool = {
  definition: WEB_SEARCH_TOOL,
  execute: async (args: any) => performWebSearch(args.query, args.max_results),
};

export const browseUrlTool: AgentTool = {
  definition: BROWSE_URL_TOOL,
  execute: async (args: any) => performBrowseUrl(args.url),
};
