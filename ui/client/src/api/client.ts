export interface ChatMessage {
  id: string
  seq?: number
  type: 'user' | 'assistant'
  timestamp: string
  channel: string
  senderName: string
  text: string
  model?: string
  rawJson?: any
  threadId?: string
  charCount?: number
  tokens?: number
  promptTokens?: number
  completionTokens?: number
  cacheHitTokens?: number
  cacheMissTokens?: number
  cacheHitRatio?: string
  costInUsd?: number
  costOutUsd?: number
  costInBrl?: number
  costOutBrl?: number
  costUsd?: number
  costBrl?: number
  memo?: string | null
  subRuns?: any[]
}

export interface SystemStats {
  totalMessages: number
  totalInbound: number
  totalOutbound: number
  estimatedTokens: number
  totalTokens?: number
  promptTokens?: number
  cacheHitTokens?: number
  cacheMissTokens?: number
  completionTokens?: number
  cacheHitRatio?: string
  totalApiCalls?: number
  totalRuns?: number
  usdToBrlRate?: number
  estimatedCostUsd: string
  estimatedCostBrl: string
  serviceStatus: string
  servicePid: string
  agentName: string
  modelName?: string
}

export interface MarkdownDoc {
  filename: string
  relativePath: string
  title: string
  category: string
  fallbackPath?: string
}

export interface SkillReference {
  name: string
  relativePath: string
  sizeBytes: number
  content: string
  charCount?: number
  tokenCount?: number
}

export interface SkillScript {
  name: string
  relativePath: string
  sizeBytes: number
  content?: string
  charCount?: number
  tokenCount?: number
}

export interface SkillItem {
  name: string
  description: string
  enabled: boolean
  skillMdContent: string
  skillMdChars?: number
  skillMdTokens?: number
  references: SkillReference[]
  referencesChars?: number
  referencesTokens?: number
  scripts: SkillScript[]
  scriptsChars?: number
  scriptsTokens?: number
  totalChars?: number
  totalTokens?: number
}

export interface ScheduledTask {
  id: string
  kind: string
  status: string
  createdAt: string
  processAfter?: string
  recurrence?: string
  isRecurring: boolean
  channelType: string
  platformId?: string
  prompt: string
  cleanPrompt?: string
  dbPath?: string
}

export interface CronExecutionLog {
  id: string
  timestamp: string
  status: string
  cron?: string
  channelType: string
  prompt: string
  cleanPrompt: string
  resultText?: string
}

export interface IntermediateRunItem {
  id: string
  messageId?: string
  sessionId?: string
  type: string
  purpose?: string
  timestamp: string
  model?: string
  tokens?: number
  totalTokens?: number
  charCount?: number
  promptTokens?: number
  completionTokens?: number
  cacheHitTokens?: number
  cacheMissTokens?: number
  costInUsd?: number
  costOutUsd?: number
  costUsd?: number
  costBrl?: number
  latencyMs?: number
  toolName?: string
  rawContent?: string
  preview?: string
  hasToolCalls?: boolean
  toolCallsCount?: number
}

export class ApiClient {
  private static async fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
      ...options,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    if (res.status === 401) {
      throw new Error('UNAUTHORIZED')
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  static async checkAuth(): Promise<{ authenticated: boolean; user?: any }> {
    try {
      return await this.fetchJson('/api/auth/me')
    } catch {
      return { authenticated: false }
    }
  }

  static async sendOtp(email: string): Promise<{ success: boolean; message?: string }> {
    return this.fetchJson('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  static async requestOtp(email: string): Promise<{ success: boolean; message?: string }> {
    return this.sendOtp(email)
  }

  static async verifyOtp(email: string, code: string): Promise<{ success: boolean; user?: any; error?: string }> {
    return this.fetchJson('/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })
  }

  static async logout(): Promise<{ success: boolean }> {
    return this.fetchJson('/api/auth/logout', { method: 'POST' })
  }

  static async getStats(): Promise<SystemStats> {
    return this.fetchJson('/api/stats')
  }

  static async getChatMessages(limit = 150): Promise<{ messages: ChatMessage[] }> {
    return this.fetchJson<{ messages: ChatMessage[] }>(`/api/chat?limit=${limit}`)
  }

  static async getUsage(limit = 200): Promise<{ logs: ChatMessage[]; stats: any }> {
    return this.fetchJson(`/api/usage?limit=${limit}`)
  }

  static async getRuns(limit = 150): Promise<{ runs: IntermediateRunItem[] }> {
    return this.fetchJson(`/api/runs?limit=${limit}`)
  }

  static async getDocs(group = 'barao'): Promise<{ docs: MarkdownDoc[] }> {
    return this.fetchJson(`/api/groups/${group}/docs`)
  }

  static async getDoc(group = 'barao', path = 'instructions.prepend.md'): Promise<{ content: string; path: string; exists: boolean }> {
    return this.fetchJson(`/api/groups/${group}/doc?path=${encodeURIComponent(path)}`)
  }

  static async saveDoc(group = 'barao', path: string, content: string): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/groups/${group}/doc`, {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    })
  }

  static async getConfig(group = 'barao'): Promise<{ config: any }> {
    return this.fetchJson(`/api/groups/${group}/config`)
  }

  static async saveConfig(group = 'barao', config: any): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/groups/${group}/config`, {
      method: 'POST',
      body: JSON.stringify({ config }),
    })
  }

  static async getSchedules(): Promise<{ tasks: ScheduledTask[] }> {
    return this.fetchJson('/api/scheduler/tasks')
  }

  static async cancelSchedule(taskId: string): Promise<{ success: boolean }> {
    return this.fetchJson('/api/scheduler/cancel', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    })
  }

  static async updateSchedule(taskId: string, data: { cron?: string; prompt?: string }): Promise<{ success: boolean }> {
    return this.fetchJson('/api/scheduler/update', {
      method: 'POST',
      body: JSON.stringify({ taskId, ...data }),
    })
  }

  static async getCronLogs(): Promise<{ logs: CronExecutionLog[] }> {
    return this.fetchJson('/api/scheduler/logs')
  }

  static async getSecurity(): Promise<{ users: any[]; pendingApprovals: any[] }> {
    return this.fetchJson('/api/security')
  }

  static async getLogs(lines = 100): Promise<{ logs: string[] }> {
    return this.fetchJson(`/api/service/logs?lines=${lines}`)
  }

  static async getSkills(group = 'barao'): Promise<{ mode: 'all' | 'custom'; skills: SkillItem[] }> {
    return this.fetchJson(`/api/groups/${group}/skills`)
  }

  static async saveSkills(group = 'barao', mode: 'all' | 'custom', skills: string[]): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/groups/${group}/skills`, {
      method: 'POST',
      body: JSON.stringify({ mode, skills }),
    })
  }

  static async getMcps(group = 'barao'): Promise<{ mcps: Record<string, any> }> {
    return this.fetchJson(`/api/groups/${group}/mcps`)
  }

  static async saveMcps(group = 'barao', mcps: Record<string, any>): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/groups/${group}/mcps`, {
      method: 'POST',
      body: JSON.stringify({ mcps }),
    })
  }

  static async getGoogleStatus(group = 'barao'): Promise<{ connected: boolean; email?: string }> {
    return this.fetchJson(`/api/integrations/google/status?folder=${group}`)
  }

  static async getGoogleConnectUrl(group = 'barao'): Promise<{ url: string }> {
    return this.fetchJson(`/api/integrations/google/connect?folder=${group}`)
  }

  static async disconnectGoogle(group = 'barao'): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/integrations/google/disconnect?folder=${group}`, { method: 'POST' })
  }

  static async getGooglePolicy(group = 'barao'): Promise<{ mode: string; emailSender: string }> {
    return this.fetchJson(`/api/integrations/google/policy?folder=${group}`)
  }

  static async saveGooglePolicy(group = 'barao', mode: string, emailSender: string): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/integrations/google/policy?folder=${group}`, {
      method: 'POST',
      body: JSON.stringify({ mode, emailSender }),
    })
  }

  static async getNotionStatus(group = 'barao'): Promise<{ connected: boolean; workspaceName?: string }> {
    return this.fetchJson(`/api/integrations/notion/status?folder=${group}`)
  }

  static async connectNotion(group = 'barao', apiKey: string, defaultDbId?: string): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/integrations/notion/connect?folder=${group}`, {
      method: 'POST',
      body: JSON.stringify({ apiKey, defaultDbId }),
    })
  }

  static async disconnectNotion(group = 'barao'): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/integrations/notion/disconnect?folder=${group}`, { method: 'POST' })
  }

  static async getYampiStatus(group = 'barao'): Promise<{ connected: boolean; alias?: string }> {
    return this.fetchJson(`/api/integrations/yampi/status?folder=${group}`)
  }

  static async connectYampi(group = 'barao', alias: string, userToken: string, userSecret: string): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/integrations/yampi/connect?folder=${group}`, {
      method: 'POST',
      body: JSON.stringify({ alias, userToken, userSecret }),
    })
  }

  static async disconnectYampi(group = 'barao'): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/integrations/yampi/disconnect?folder=${group}`, { method: 'POST' })
  }

  static async getMacConfig(group = 'barao'): Promise<{ apiKey: string; endpoint: string; group: string }> {
    return this.fetchJson(`/api/mac/config?group=${group}`)
  }

  static async getShippingConfig(): Promise<{ originCep: string; priceMarginPct: number; leadTimeDaysBuffer: number }> {
    return this.fetchJson('/api/shipping/config')
  }

  static async saveShippingConfig(originCep: string, priceMarginPct: number, leadTimeDaysBuffer: number): Promise<{ success: boolean }> {
    return this.fetchJson('/api/shipping/config', {
      method: 'POST',
      body: JSON.stringify({ originCep, priceMarginPct, leadTimeDaysBuffer }),
    })
  }

  static async getServiceStatus(): Promise<{ active: boolean; statusText: string; mainPid?: number; uptime?: string; dockerContainers?: string[] }> {
    return this.fetchJson('/api/service/status')
  }

  static async getContainers(): Promise<{ dockerContainers: any[] }> {
    return this.fetchJson('/api/service/status')
  }

  static async restartService(): Promise<{ success: boolean }> {
    return this.fetchJson('/api/service/restart', { method: 'POST' })
  }

  static async generateTelegramPairing(group = 'barao'): Promise<{ code: string }> {
    return this.fetchJson('/api/channels/telegram/pair', {
      method: 'POST',
      body: JSON.stringify({ folder: group }),
    })
  }
}
