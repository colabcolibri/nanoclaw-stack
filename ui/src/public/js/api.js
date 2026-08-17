export class ApiClient {
  static async request(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erro na requisição (${res.status})`);
    }
    return data;
  }

  static checkAuth() {
    return this.request("/api/auth/me");
  }

  static sendOtp(email) {
    return this.request("/api/auth/send-code", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  static verifyOtp(email, code) {
    return this.request("/api/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
  }

  static logout() {
    return this.request("/api/auth/logout", { method: "POST" });
  }

  static getStats() {
    return this.request("/api/stats");
  }

  static getChatMessages(limit = 100) {
    return this.request(`/api/chat?limit=${limit}`);
  }

  static getUsage(limit = 200) {
    return this.request(`/api/usage?limit=${limit}`);
  }

  static getRuns(limit = 100) {
    return this.request(`/api/runs?limit=${limit}`);
  }

  static getSecurity() {
    return this.request("/api/security");
  }

  static getLogs(lines = 100) {
    return this.request(`/api/service/logs?lines=${lines}`);
  }

  static getDocs(group = "barao") {
    return this.request(`/api/groups/${group}/docs`);
  }

  static getDoc(group = "barao", path = "instructions.prepend.md") {
    return this.request(`/api/groups/${group}/doc?path=${encodeURIComponent(path)}`);
  }

  static saveDoc(group, path, content) {
    return this.request(`/api/groups/${group}/doc`, {
      method: "POST",
      body: JSON.stringify({ path, content }),
    });
  }

  static getSoul(group = "barao") {
    return this.getDoc(group, "instructions.prepend.md");
  }

  static saveSoul(group, content) {
    return this.saveDoc(group, "instructions.prepend.md", content);
  }

  static getConfig(group = "barao") {
    return this.request(`/api/groups/${group}/config`);
  }

  static saveConfig(group, config) {
    return this.request(`/api/groups/${group}/config`, {
      method: "POST",
      body: JSON.stringify({ config }),
    });
  }

  static getSkills(group = "barao") {
    return this.request(`/api/groups/${group}/skills`);
  }

  static saveSkills(group, mode, skills) {
    return this.request(`/api/groups/${group}/skills`, {
      method: "POST",
      body: JSON.stringify({ mode, skills }),
    });
  }

  static getMcps(group = "barao") {
    return this.request(`/api/groups/${group}/mcps`);
  }

  static getGoogleConnectUrl(group = "barao") {
    return this.request(`/api/integrations/google/connect?folder=${group}`);
  }

  static getGoogleStatus(group = "barao") {
    return this.request(`/api/integrations/google/status?folder=${group}`);
  }

  static disconnectGoogle(group = "barao") {
    return this.request("/api/integrations/google/disconnect", {
      method: "POST",
      body: JSON.stringify({ folder: group }),
    });
  }

  static getNotionStatus(group = "barao") {
    return this.request(`/api/integrations/notion/status?folder=${group}`);
  }

  static connectNotion(group = "barao", apiKey, defaultDatabaseId = "") {
    return this.request("/api/integrations/notion/connect", {
      method: "POST",
      body: JSON.stringify({ folder: group, apiKey, defaultDatabaseId }),
    });
  }

  static disconnectNotion(group = "barao") {
    return this.request("/api/integrations/notion/disconnect", {
      method: "POST",
      body: JSON.stringify({ folder: group }),
    });
  }

  static getYampiStatus(group = "barao") {
    return this.request(`/api/integrations/yampi/status?folder=${group}`);
  }

  static connectYampi(group = "barao", alias, userToken, userSecretKey) {
    return this.request("/api/integrations/yampi/connect", {
      method: "POST",
      body: JSON.stringify({ folder: group, alias, userToken, userSecretKey }),
    });
  }

  static disconnectYampi(group = "barao") {
    return this.request("/api/integrations/yampi/disconnect", {
      method: "POST",
      body: JSON.stringify({ folder: group }),
    });
  }

  static getMacConfig(group = "barao") {
    return this.request(`/api/mac/config?folder=${group}`);
  }

  static getServiceStatus() {
    return this.request("/api/service/status");
  }

  static restartService() {
    return this.request("/api/service/restart", { method: "POST" });
  }

  static generateTelegramPairing(group = "barao") {
    return this.request("/api/channels/telegram/pair", {
      method: "POST",
      body: JSON.stringify({ folder: group }),
    });
  }

  static getScheduledTasks(group = "barao") {
    return this.request(`/api/scheduler/tasks?folder=${group}`);
  }

  static cancelScheduledTask(taskId) {
    return this.request("/api/scheduler/cancel", {
      method: "POST",
      body: JSON.stringify({ taskId }),
    });
  }
}
