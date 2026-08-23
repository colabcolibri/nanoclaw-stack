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
  sessionId?: string
  agentGroupId?: string
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

export interface ChatThread {
  sessionId: string
  agentGroupId: string
  threadId: string | null
  channel: string
  status: 'active' | 'archived' | 'closed'
  conversationId: string | null
  lastActiveAt: string | null
  messageCount: number
  lastPreview: string
  lastSenderName: string
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
  source: 'custom' | 'default' | 'empty'
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
  isGlobal?: boolean
  usedByAgents?: string[]
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

export interface DepartmentItem {
  id: string
  name: string
  description: string
  icon?: string
}

export interface AgentItem {
  id: string
  name: string
  department: string
  role: string
  description: string
  skills: string[]
  allowGlobalSkills: boolean
  model?: string
  /** Modelo efetivo (override do agente ou worker do grupo). */
  effectiveModel?: string
  systemPrompt: string
  systemPromptChars?: number
  systemPromptTokens?: number
  rawYaml?: string
  isCustom?: boolean
  filePath?: string
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

export interface ConnectedChannelItem {
  id: string
  channelType: string
  platformId: string
  instance: string
  name: string | null
  isGroup: boolean
  unknownSenderPolicy: string
  createdAt: string
  deniedAt: string | null
  agentGroupId: string | null
  agentGroupName: string | null
  agentFolder: string | null
  engageMode: string | null
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
  label?: string
  shortLabel?: string
}

export interface AgentAuditTraceItem {
  id: string
  step: string
  agent?: string
  department?: string
  purpose: string
  latencyMs: number
  timestamp: string
  messageId?: string
  supervisorStep?: number
  decision?: string
  promptPreview?: string
  responsePreview?: string
  metadata?: Record<string, unknown>
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

  static async getAppConfig(): Promise<{ defaultGroupFolder: string; uiPublicUrl: string }> {
    return this.fetchJson('/api/app-config')
  }

  static async getStats(): Promise<SystemStats> {
    return this.fetchJson('/api/stats')
  }

  static async getChatThreads(limit = 50): Promise<{ threads: ChatThread[] }> {
    return this.fetchJson<{ threads: ChatThread[] }>(`/api/chat/threads?limit=${limit}`)
  }

  static async getChatMessages(limit = 150, sessionId?: string): Promise<{ messages: ChatMessage[] }> {
    const qs = new URLSearchParams({ limit: String(limit) })
    if (sessionId) qs.set('sessionId', sessionId)
    return this.fetchJson<{ messages: ChatMessage[] }>(`/api/chat?${qs}`)
  }

  static async getUsage(limit = 200): Promise<{ logs: ChatMessage[]; stats: any }> {
    return this.fetchJson(`/api/usage?limit=${limit}`)
  }

  static async getRuns(limit = 150): Promise<{ runs: IntermediateRunItem[] }> {
    return this.fetchJson(`/api/runs?limit=${limit}`)
  }

  static async getAuditTraces(limit = 300, group?: string): Promise<{ traces: AgentAuditTraceItem[] }> {
    const qs = new URLSearchParams({ limit: String(limit) })
    if (group) qs.set('group', group)
    return this.fetchJson(`/api/audit-traces?${qs}`)
  }

  static async getDocs(group: string): Promise<{ docs: MarkdownDoc[] }> {
    return this.fetchJson(`/api/groups/${group}/docs`)
  }

  static async getDoc(group: string, path = 'instructions.prepend.md'): Promise<{ content: string; path: string; exists: boolean; source: MarkdownDoc['source'] }> {
    return this.fetchJson(`/api/groups/${group}/doc?path=${encodeURIComponent(path)}`)
  }

  static async saveDoc(group: string, path: string, content: string): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/groups/${group}/doc`, {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    })
  }

  static async getConfig(group: string): Promise<{ config: any }> {
    return this.fetchJson(`/api/groups/${group}/config`)
  }

  static async getLlmRegistry(): Promise<{ updatedAt: string; providers: Record<string, any> }> {
    return this.fetchJson('/api/llm/registry')
  }

  static async saveProviderApiKey(
    providerId: string,
    apiKey: string
  ): Promise<{ success: boolean; keysStatus: Record<string, { hasKey: boolean; masked: string }> }> {
    return this.fetchJson(`/api/llm/providers/${encodeURIComponent(providerId)}/api-key`, {
      method: 'POST',
      body: JSON.stringify({ apiKey }),
    })
  }

  static async getLlmKeysStatus(): Promise<{ keysStatus: Record<string, { hasKey: boolean; masked: string }> }> {
    return this.fetchJson('/api/llm/keys-status')
  }

  static async saveConfig(group: string, config: any): Promise<{ success: boolean }> {
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

  static async getLogs(
    lines = 100,
  ): Promise<{ logs: string[]; source?: 'journalctl' | 'file' | 'none'; error?: string }> {
    return this.fetchJson(`/api/service/logs?lines=${lines}`)
  }

  static async getSkills(group: string): Promise<{ mode: 'all' | 'custom'; skills: SkillItem[] }> {
    return this.fetchJson(`/api/groups/${group}/skills`)
  }

  static async saveSkills(group: string, mode: 'all' | 'custom', skills: string[]): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/groups/${group}/skills`, {
      method: 'POST',
      body: JSON.stringify({ mode, skills }),
    })
  }

  static async getMcps(group: string): Promise<{ mcps: Record<string, any> }> {
    return this.fetchJson(`/api/groups/${group}/mcps`)
  }

  static async saveMcps(group: string, mcps: Record<string, any>): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/groups/${group}/mcps`, {
      method: 'POST',
      body: JSON.stringify({ mcps }),
    })
  }

  static async getGoogleStatus(group: string): Promise<{ connected: boolean; email?: string }> {
    return this.fetchJson(`/api/integrations/google/status?folder=${group}`)
  }

  static async getGoogleConnectUrl(group: string): Promise<{ url: string }> {
    return this.fetchJson(`/api/integrations/google/connect?folder=${group}`)
  }

  static async disconnectGoogle(group: string): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/integrations/google/disconnect?folder=${group}`, { method: 'POST' })
  }

  static async getGooglePolicy(group: string): Promise<{ mode: string; emailSender: string }> {
    const data = await this.fetchJson<{ mode?: string; signature?: string; emailSender?: string }>(
      `/api/integrations/google/policy?folder=${group}`
    )
    return {
      mode: data.mode || 'draft_approval',
      emailSender: data.signature || data.emailSender || '',
    }
  }

  static async saveGooglePolicy(group: string, mode: string, emailSender: string): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/integrations/google/policy?folder=${group}`, {
      method: 'POST',
      body: JSON.stringify({ mode, signature: emailSender }),
    })
  }

  static async getNotionStatus(group: string): Promise<{
    connected: boolean
    maskedKey?: string
    botName?: string
    defaultDatabaseId?: string
    updatedAt?: string
  }> {
    return this.fetchJson(`/api/integrations/notion/status?folder=${group}`)
  }

  static async connectNotion(group: string, apiKey: string, defaultDbId?: string): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/integrations/notion/connect?folder=${group}`, {
      method: 'POST',
      body: JSON.stringify({ apiKey, defaultDatabaseId: defaultDbId }),
    })
  }

  static async disconnectNotion(group: string): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/integrations/notion/disconnect?folder=${group}`, { method: 'POST' })
  }

  static async getYampiStatus(group: string): Promise<{
    connected: boolean
    alias?: string
    maskedUserToken?: string
    maskedUserSecret?: string
    updatedAt?: string | null
  }> {
    return this.fetchJson(`/api/integrations/yampi/status?folder=${group}`)
  }

  static async connectYampi(group: string, alias: string, userToken: string, userSecret: string): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/integrations/yampi/connect?folder=${group}`, {
      method: 'POST',
      body: JSON.stringify({ alias, userToken, userSecretKey: userSecret }),
    })
  }

  static async disconnectYampi(group: string): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/integrations/yampi/disconnect?folder=${group}`, { method: 'POST' })
  }

  static async getMacConfig(group: string): Promise<{ apiKey: string; endpoint: string; group: string }> {
    return this.fetchJson(`/api/mac/config?group=${group}`)
  }

  static async getShippingConfig(): Promise<{ originCep: string; priceMarginPct: number; leadTimeDaysBuffer: number }> {
    const data = await this.fetchJson<{
      originCep?: string
      priceMarginPercent?: number
      priceMarginPct?: number
      daysBuffer?: number
      leadTimeDaysBuffer?: number
    }>('/api/shipping/config')
    return {
      originCep: data.originCep || '12243-380',
      priceMarginPct: data.priceMarginPercent ?? data.priceMarginPct ?? 30,
      leadTimeDaysBuffer: data.daysBuffer ?? data.leadTimeDaysBuffer ?? 3,
    }
  }

  static async saveShippingConfig(originCep: string, priceMarginPct: number, leadTimeDaysBuffer: number): Promise<{ success: boolean }> {
    return this.fetchJson('/api/shipping/config', {
      method: 'POST',
      body: JSON.stringify({
        originCep,
        priceMarginPercent: priceMarginPct,
        daysBuffer: leadTimeDaysBuffer,
      }),
    })
  }

  static async getConnectedChannels(): Promise<{ channels: ConnectedChannelItem[] }> {
    return this.fetchJson('/api/channels/connected')
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

  static async purgeChatAndCosts(confirmation: string): Promise<{
    success: boolean
    result: {
      sessionsWiped: number
      archivedSessionsRemoved: number
      staleFoldersRemoved: number
      tokenLedgerRowsCleared: number
      activeSessionsRemaining: number
    }
  }> {
    return this.fetchJson('/api/maintenance/purge-chat-and-costs', {
      method: 'POST',
      body: JSON.stringify({ confirmation }),
    })
  }

  static async generateTelegramPairing(group: string): Promise<{ code: string }> {
    return this.fetchJson('/api/channels/telegram/pair', {
      method: 'POST',
      body: JSON.stringify({ folder: group }),
    })
  }

  static async getDepartmentsAndAgents(
    group: string,
  ): Promise<{ departments: DepartmentItem[]; agents: AgentItem[]; groupWorkerModel?: string }> {
    return this.fetchJson(`/api/groups/${group}/agents`)
  }

  static async getAgent(group: string, agentId: string): Promise<{ agent: AgentItem }> {
    return this.fetchJson(`/api/groups/${group}/agents/${agentId}`)
  }

  static async saveAgent(group: string, agentId: string, data: Partial<AgentItem>): Promise<{ success: boolean; agent?: AgentItem }> {
    return this.fetchJson(`/api/groups/${group}/agents/${agentId}`, {
      method: 'POST',
      body: JSON.stringify({ id: agentId, ...data }),
    })
  }

  static async createAgent(group: string, data: Partial<AgentItem>): Promise<{ success: boolean; agent?: AgentItem }> {
    return this.fetchJson(`/api/groups/${group}/agents`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  static async deleteAgent(group: string, agentId: string): Promise<{ success: boolean }> {
    return this.fetchJson(`/api/groups/${group}/agents/${agentId}`, {
      method: 'DELETE',
    })
  }
}
