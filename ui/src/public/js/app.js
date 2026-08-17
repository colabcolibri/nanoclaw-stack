import { ApiClient } from "./api.js";
import { Toast } from "./toast.js";
import { LateralSheet } from "./sheet.js";

class App {
  static currentEmail = "";
  static currentGroup = "barao";
  static currentDocPath = "instructions.prepend.md";
  static cachedSkills = [];
  static activeNav = "nav-chat";

  static init() {
    LateralSheet.init();
    this.bindEvents();
    this.checkAuth();
  }

  static bindEvents() {
    // Nav Items (Sidebar)
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetView = btn.dataset.view;
        this.switchView(targetView, btn);
      });
    });

    // Step 1: Send OTP
    document.getElementById("form-email")?.addEventListener("submit", (e) => this.handleSendOtp(e));

    // Step 2: Back to email
    document.getElementById("btn-back-email")?.addEventListener("click", () => {
      document.getElementById("step-otp")?.classList.add("hidden");
      document.getElementById("step-email")?.classList.remove("hidden");
    });

    // Step 2: OTP Inputs auto-advance & paste
    this.bindOtpInputs();

    // Verify OTP Submit
    document.getElementById("form-otp")?.addEventListener("submit", (e) => this.handleVerifyOtp(e));

    // Logout
    document.getElementById("btn-logout")?.addEventListener("click", () => this.handleLogout());

    // Refresh Chat
    document.getElementById("btn-refresh-chat")?.addEventListener("click", () => {
      this.loadChat();
      this.loadStats();
    });

    // Refresh Usage
    document.getElementById("btn-refresh-usage")?.addEventListener("click", () => {
      this.loadUsage();
      this.loadRuns();
      this.loadStats();
    });

    // Usage Tabs (Messages vs Runs)
    document.getElementById("tab-usage-messages")?.addEventListener("click", () => {
      document.getElementById("tab-usage-messages")?.classList.add("active");
      document.getElementById("tab-usage-runs")?.classList.remove("active");
      document.getElementById("container-table-messages")?.classList.remove("hidden");
      document.getElementById("container-table-runs")?.classList.add("hidden");
    });

    document.getElementById("tab-usage-runs")?.addEventListener("click", () => {
      document.getElementById("tab-usage-runs")?.classList.add("active");
      document.getElementById("tab-usage-messages")?.classList.remove("active");
      document.getElementById("container-table-runs")?.classList.remove("hidden");
      document.getElementById("container-table-messages")?.classList.add("hidden");
      this.loadRuns();
    });

    // Security Refresh
    document.getElementById("btn-refresh-security")?.addEventListener("click", () => this.loadSecurity());

    // Logs Controls
    document.getElementById("btn-refresh-logs")?.addEventListener("click", () => this.loadLogs());
    document.getElementById("btn-copy-logs")?.addEventListener("click", () => {
      const logs = document.getElementById("logs-terminal-container")?.innerText;
      if (logs) {
        navigator.clipboard.writeText(logs);
        Toast.show("Logs copiados!");
      }
    });

    // Save Soul / Markdown Docs
    document.getElementById("btn-save-soul")?.addEventListener("click", () => this.handleSaveSoul());
    document.getElementById("soul-editor")?.addEventListener("input", (e) => this.renderSoulPreview(e.target.value));
    document.getElementById("doc-selector")?.addEventListener("change", (e) => this.handleDocSwitch(e.target.value));

    // Save Skills
    document.getElementById("btn-save-skills")?.addEventListener("click", () => this.handleSaveSkills());

    // Save MCPs
    document.getElementById("btn-save-mcps")?.addEventListener("click", () => this.handleSaveMcps());

    // Google 1-Click Connect
    document.getElementById("btn-connect-google")?.addEventListener("click", () => this.handleConnectGoogle());
    document.getElementById("btn-disconnect-google")?.addEventListener("click", () => this.handleDisconnectGoogle());

    // Notion Integration
    document.getElementById("btn-toggle-notion-modal")?.addEventListener("click", () => {
      document.getElementById("notion-config-drawer")?.classList.toggle("hidden");
    });
    document.getElementById("btn-cancel-notion")?.addEventListener("click", () => {
      document.getElementById("notion-config-drawer")?.classList.add("hidden");
    });
    document.getElementById("btn-save-notion")?.addEventListener("click", () => this.handleSaveNotion());
    document.getElementById("btn-disconnect-notion")?.addEventListener("click", () => this.handleDisconnectNotion());

    // Mac & Apple Shortcuts Integration
    document.getElementById("btn-toggle-mac-modal")?.addEventListener("click", () => {
      document.getElementById("mac-config-drawer")?.classList.toggle("hidden");
    });
    document.getElementById("btn-copy-mac-endpoint")?.addEventListener("click", () => {
      const endpoint = document.getElementById("input-mac-endpoint")?.value;
      if (endpoint) {
        navigator.clipboard.writeText(endpoint);
        Toast.show("Endpoint copiado!");
      }
    });
    document.getElementById("btn-copy-mac-key")?.addEventListener("click", () => {
      const key = document.getElementById("input-mac-api-key")?.value;
      if (key) {
        navigator.clipboard.writeText(key);
        Toast.show("Chave de API do Mac copiada!");
      }
    });

    // Save Config
    document.getElementById("form-config")?.addEventListener("submit", (e) => this.handleSaveConfig(e));

    // Service Controls
    document.getElementById("btn-restart-service")?.addEventListener("click", () => this.handleRestartService());
    document.getElementById("btn-generate-pairing")?.addEventListener("click", () => this.handleGeneratePairing());
    document.getElementById("btn-copy-pairing")?.addEventListener("click", () => {
      const code = document.getElementById("pairing-code-display")?.innerText;
      if (code) {
        navigator.clipboard.writeText(code);
        Toast.show("Código copiado!");
      }
    });

    // Quick Action: Open Sheet
    document.getElementById("btn-open-meta-sheet")?.addEventListener("click", () => {
      LateralSheet.open({
        title: "⚡ Informações do Agente",
        contentHtml: `
          <div style="display:flex; flex-direction:column; gap:14px; font-size:13px;">
            <div><strong>Grupo Ativo:</strong> <code>${this.currentGroup}</code></div>
            <div><strong>Diretório:</strong> <code>/opt/nanoclaw/groups/${this.currentGroup}</code></div>
            <div><strong>Banco SQLite:</strong> <code>/opt/nanoclaw/data/v2.db</code></div>
            <p style="color:var(--text-muted); line-height:1.5;">
              As alterações realizadas no Soul e nos parâmetros são lidas diretamente pelos contêineres do NanoClaw.
            </p>
          </div>
        `,
      });
    });
  }

  static hideLoader() {
    const el = document.getElementById("app-loading");
    if (el) el.style.display = "none";
  }

  static async checkAuth() {
    try {
      const data = await ApiClient.checkAuth();
      if (data.authenticated) {
        this.currentEmail = data.user.email;
        this.showDashboard();
        return;
      }
    } catch {}
    this.showAuth();
  }

  static showAuth() {
    this.hideLoader();
    document.getElementById("auth-view")?.classList.remove("hidden");
    document.getElementById("dashboard-view")?.classList.add("hidden");
  }

  static showDashboard() {
    this.hideLoader();
    document.getElementById("auth-view")?.classList.add("hidden");
    document.getElementById("dashboard-view")?.classList.remove("hidden");
    const emailEl = document.getElementById("user-email-display");
    if (emailEl) emailEl.innerText = this.currentEmail;
    this.loadAllData();
    this.restoreActiveView();
  }

  static restoreActiveView() {
    let targetView = "view-chat";
    if (window.location.search.includes("google_auth=success") || window.location.hash.includes("google_auth=success")) {
      targetView = "view-mcps";
      setTimeout(() => Toast.show("🎉 Conta Google conectada com sucesso!"), 300);
      try {
        history.replaceState(null, "", "#mcps");
      } catch {}
    } else if (window.location.hash) {
      const hashView = "view-" + window.location.hash.replace("#", "");
      if (document.getElementById(hashView)) targetView = hashView;
    } else {
      const saved = localStorage.getItem("nanoclaw_active_view");
      if (saved && document.getElementById(saved)) targetView = saved;
    }

    const btn = document.querySelector(`.nav-item[data-view="${targetView}"]`);
    if (btn) {
      this.switchView(targetView, btn, false);
    }
  }

  static switchView(viewId, clickedBtn, updateHash = true) {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".view-panel").forEach((v) => v.classList.add("hidden"));

    clickedBtn.classList.add("active");
    const targetEl = document.getElementById(viewId);
    if (targetEl) targetEl.classList.remove("hidden");

    const pageTitle = document.getElementById("current-page-title");
    if (pageTitle) {
      pageTitle.innerText = clickedBtn.innerText.trim();
    }

    try {
      localStorage.setItem("nanoclaw_active_view", viewId);
      if (updateHash) {
        history.replaceState(null, "", `#${viewId.replace("view-", "")}`);
      }
    } catch {}
  }

  static bindOtpInputs() {
    const inputs = document.querySelectorAll(".otp-digit");
    inputs.forEach((input, idx) => {
      input.addEventListener("input", (e) => {
        const val = e.target.value;
        if (val && idx < inputs.length - 1) inputs[idx + 1].focus();
        this.checkAutoSubmitOtp();
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !input.value && idx > 0) {
          inputs[idx - 1].focus();
        }
      });

      input.addEventListener("paste", (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text").trim();
        if (/^\d{6}$/.test(text)) {
          text.split("").forEach((char, i) => {
            if (inputs[i]) inputs[i].value = char;
          });
          this.checkAutoSubmitOtp();
        }
      });
    });
  }

  static getOtpCode() {
    let code = "";
    document.querySelectorAll(".otp-digit").forEach((input) => (code += input.value));
    return code;
  }

  static checkAutoSubmitOtp() {
    if (this.getOtpCode().length === 6) {
      document.getElementById("form-otp")?.requestSubmit();
    }
  }

  static async handleSendOtp(e) {
    e.preventDefault();
    const email = document.getElementById("input-email")?.value.trim();
    const btn = document.getElementById("btn-send-code");
    if (!btn || !email) return;

    btn.disabled = true;
    btn.innerHTML = "<span>Enviando código...</span>";

    try {
      const res = await ApiClient.sendOtp(email);
      if (res.success) {
        this.currentEmail = email;
        document.getElementById("step-email")?.classList.add("hidden");
        document.getElementById("step-otp")?.classList.remove("hidden");
        const subtitle = document.getElementById("otp-subtitle");
        if (subtitle) subtitle.innerText = `Enviamos o código para seu e-mail.`;
        document.querySelector(".otp-digit[data-idx='0']")?.focus();
        Toast.show("Código enviado com sucesso!");
      }
    } catch (err) {
      Toast.show(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = "<span>Enviar Código de Acesso</span>";
    }
  }

  static async handleVerifyOtp(e) {
    e.preventDefault();
    const code = this.getOtpCode();
    if (code.length !== 6) return Toast.show("Digite os 6 dígitos", "error");

    const btn = document.getElementById("btn-verify-otp");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = "<span>Verificando...</span>";
    }

    try {
      const res = await ApiClient.verifyOtp(this.currentEmail, code);
      if (res.success) {
        Toast.show("Autenticado com sucesso!");
        this.showDashboard();
      }
    } catch (err) {
      Toast.show(err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "<span>Entrar no Painel</span>";
      }
    }
  }

  static async handleLogout() {
    await ApiClient.logout();
    this.showAuth();
    document.getElementById("step-otp")?.classList.add("hidden");
    document.getElementById("step-email")?.classList.remove("hidden");
  }

  static async loadAllData() {
    this.loadStats();
    this.loadChat();
    this.loadUsage();
    this.loadRuns();
    this.loadSecurity();
    this.loadLogs();
    this.loadDocs();
    this.loadSkills();
    this.loadMcps();
    this.loadGoogleStatus();
    this.loadNotionStatus();
    this.loadConfig();
    this.loadServiceStatus();
    this.startLogsAutoRefresh();
  }

  static async loadRuns() {
    const tbody = document.getElementById("runs-table-tbody");
    if (!tbody) return;

    try {
      const data = await ApiClient.getRuns(100);
      const runs = data.runs || [];

      const subEl = document.getElementById("usage-total-runs-sub");
      if (subEl) subEl.innerText = `${runs.length} runs intermediárias`;

      if (runs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-dim);">Nenhuma run intermediária registrada.</td></tr>`;
        return;
      }

      tbody.innerHTML = runs
        .map((r) => {
          const timeStr = new Date(r.timestamp).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          const isTool = r.type === "tool_use" || r.type === "tool_result";
          const badgeStyle = isTool
            ? "background:rgba(245,158,11,0.15); color:var(--warning);"
            : "background:rgba(56,189,248,0.15); color:var(--accent);";

          return `
            <tr style="border-bottom:1px solid var(--border-color); cursor:pointer;" class="run-row" data-id="${r.id}">
              <td style="padding:10px 16px;">
                <span style="padding:2px 8px; font-size:11px; border-radius:4px; font-weight:700; ${badgeStyle}">
                  ${(r.type || "TURN").toUpperCase()}
                </span>
              </td>
              <td style="padding:10px 16px; font-size:12px; color:var(--text-muted);">${timeStr}</td>
              <td style="padding:10px 16px;"><code style="font-size:11px; color:var(--text-dim);">${r.id}</code></td>
              <td style="padding:10px 16px; font-family:var(--font-mono); font-size:12px; color:var(--accent);">${r.tokens.toLocaleString()}</td>
              <td style="padding:10px 16px; font-family:var(--font-mono); font-size:12px; color:#38bdf8;">$${r.costUsd.toFixed(6)}</td>
              <td style="padding:10px 16px; max-width:320px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:12px; color:var(--text-main);" title="Clique para detalhes">${(r.preview || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
            </tr>
          `;
        })
        .join("");

      tbody.querySelectorAll(".run-row").forEach((row) => {
        row.addEventListener("click", () => {
          const runItem = runs.find((r) => r.id === row.dataset.id);
          if (runItem) {
            LateralSheet.open({
              title: "🔄 Detalhes da Run Intermediária",
              contentHtml: `
                <div style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
                  <div><strong>ID da Parte (Part ID):</strong> <code>${runItem.id}</code></div>
                  <div><strong>ID da Mensagem Pai:</strong> <code>${runItem.messageId}</code></div>
                  <div><strong>Tipo de Execução:</strong> <span class="badge-status">${runItem.type.toUpperCase()}</span></div>
                  <div><strong>Data / Hora:</strong> <code>${new Date(runItem.timestamp).toLocaleString("pt-BR")}</code></div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:6px;">
                    <div style="background:var(--bg-input); padding:10px; border-radius:var(--radius-sm);">
                      <div style="font-size:11px; color:var(--text-dim);">Tokens da Run</div>
                      <div style="font-size:16px; font-weight:700; color:var(--accent);">${runItem.tokens}</div>
                    </div>
                    <div style="background:var(--bg-input); padding:10px; border-radius:var(--radius-sm);">
                      <div style="font-size:11px; color:var(--text-dim);">Custo Estimado</div>
                      <div style="font-size:16px; font-weight:700; color:var(--success);">$${runItem.costUsd.toFixed(6)}</div>
                    </div>
                  </div>
                  ${
                    runItem.systemPrompt
                      ? `
                    <div style="margin-top:10px;"><strong>Prompt de Sistema Injetado:</strong></div>
                    <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:12px; font-family:var(--font-mono); font-size:11px; white-space:pre-wrap; max-height:160px; overflow-y:auto;">${runItem.systemPrompt.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                  `
                      : ""
                  }
                  ${
                    runItem.toolName
                      ? `
                    <div style="margin-top:10px;"><strong>Ferramenta Executada:</strong> <code>${runItem.toolName}</code></div>
                    <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:10px; font-family:var(--font-mono); font-size:11px; max-height:140px; overflow-y:auto;">${JSON.stringify(runItem.toolArgs || {}, null, 2)}</div>
                  `
                      : ""
                  }
                  <div style="margin-top:10px;"><strong>Payload Completo da Run:</strong></div>
                  <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:12px; font-family:var(--font-mono); font-size:11px; white-space:pre-wrap; max-height:220px; overflow-y:auto;">${runItem.rawContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                </div>
              `,
            });
          }
        });
      });
    } catch {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--danger);">Falha ao carregar runs.</td></tr>`;
    }
  }

  static async loadSecurity() {
    const usersContainer = document.getElementById("security-users-list");
    const approvalsContainer = document.getElementById("security-approvals-list");

    try {
      const data = await ApiClient.getSecurity();

      if (usersContainer) {
        if (!data.users || data.users.length === 0) {
          usersContainer.innerHTML = "<p style='color:var(--text-dim); padding:8px 0;'>Nenhum usuário cadastrado.</p>";
        } else {
          usersContainer.innerHTML = data.users
            .map(
              (u) => `
            <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:12px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; font-family:var(--font-mono); color:var(--accent);">${u.id}</div>
                <div style="font-size:11px; color:var(--text-dim);">Tipo: ${u.type} • Desde: ${new Date(u.createdAt).toLocaleDateString("pt-BR")}</div>
              </div>
              <span class="badge-status" style="background:rgba(16,185,129,0.15); color:var(--success);">Autorizado</span>
            </div>
          `
            )
            .join("");
        }
      }

      if (approvalsContainer) {
        const totalPending = (data.pendingApprovals || []).length + (data.unregisteredSenders || []).length;
        if (totalPending === 0) {
          approvalsContainer.innerHTML = "<p style='color:var(--text-dim); text-align:center; padding:16px;'>✅ Nenhuma solicitação pendente de aprovação no momento.</p>";
        } else {
          let html = "";
          for (const app of data.pendingApprovals || []) {
            html += `
              <div style="background:var(--bg-surface); border:1px solid var(--warning); border-radius:var(--radius-sm); padding:12px;">
                <div style="font-weight:700; color:var(--warning);">📦 Instalação de Pacote: ${app.type}</div>
                <div style="font-size:11px; font-family:var(--font-mono); margin:6px 0; color:var(--text-muted);">${app.payload}</div>
                <div style="font-size:11px; color:var(--text-dim);">${new Date(app.createdAt).toLocaleString("pt-BR")}</div>
              </div>
            `;
          }
          for (const s of data.unregisteredSenders || []) {
            html += `
              <div style="background:var(--bg-surface); border:1px solid var(--warning); border-radius:var(--radius-sm); padding:12px;">
                <div style="font-weight:700; color:var(--warning);">👤 Remetente Desconhecido (${s.channel})</div>
                <div style="font-size:11px; font-family:var(--font-mono); margin:4px 0; color:var(--accent);">${s.senderId}</div>
                <div style="font-size:11px; color:var(--text-dim);">${new Date(s.createdAt).toLocaleString("pt-BR")}</div>
              </div>
            `;
          }
          approvalsContainer.innerHTML = html;
        }
      }
    } catch {}
  }

  static async loadLogs() {
    const term = document.getElementById("logs-terminal-container");
    if (!term) return;

    try {
      const data = await ApiClient.getLogs(100);
      const lines = data.logs || [];
      if (lines.length === 0) {
        term.innerText = "Nenhum log disponível.";
        return;
      }

      term.innerHTML = lines
        .map((l) => {
          let color = "#94a3b8";
          if (l.includes("ERROR") || l.includes("Failed") || l.includes("error")) color = "#f87171";
          else if (l.includes("WARN") || l.includes("warning")) color = "#fbbf24";
          else if (l.includes("Started") || l.includes("rodando") || l.includes("Listening")) color = "#34d399";
          const safe = l.replace(/</g, "&lt;").replace(/>/g, "&gt;");
          return `<div style="color:${color};">${safe}</div>`;
        })
        .join("");

      term.scrollTop = term.scrollHeight;
    } catch {
      term.innerText = "Erro ao carregar logs do serviço.";
    }
  }

  static startLogsAutoRefresh() {
    if (this.logsInterval) clearInterval(this.logsInterval);
    this.logsInterval = setInterval(() => {
      const autoEl = document.getElementById("logs-auto-refresh");
      const logsView = document.getElementById("view-logs");
      if (autoEl && autoEl.checked && logsView && !logsView.classList.contains("hidden")) {
        this.loadLogs();
      }
    }, 3000);
  }

  static async loadUsage() {
    const tbody = document.getElementById("usage-table-tbody");
    if (!tbody) return;

    try {
      const data = await ApiClient.getUsage(200);
      const stats = data.stats || {};
      const logs = data.logs || [];

      const setTxt = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.innerText = txt;
      };

      setTxt("usage-total-usd", `$${stats.estimatedCostUsd || "0.0000"}`);
      setTxt("usage-total-brl", `R$ ${stats.estimatedCostBrl || "0.0000"} BRL`);
      setTxt("usage-total-tokens", (stats.estimatedTokens || 0).toLocaleString());
      setTxt("usage-io-breakdown", `${stats.totalInbound || 0} input • ${stats.totalOutbound || 0} output`);
      setTxt("usage-total-calls", stats.totalMessages || 0);

      if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--text-dim);">Nenhum registro de consumo encontrado.</td></tr>`;
        return;
      }

      tbody.innerHTML = logs
        .map((m) => {
          const isUser = m.type === "user";
          const timeStr = new Date(m.timestamp).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          const safePreview = (m.text || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          const costUsdFmt = (m.costUsd || 0).toFixed(6);
          const costBrlFmt = (m.costBrl || 0).toFixed(5);

          return `
            <tr style="border-bottom:1px solid var(--border-color); cursor:pointer;" class="usage-row" data-id="${m.id}">
              <td style="padding:10px 16px;">
                <span class="${isUser ? "badge-in" : "badge-out"}" style="padding:2px 8px; font-size:11px; border-radius:4px; font-weight:700; ${
            isUser ? "background:rgba(56,189,248,0.15); color:var(--accent);" : "background:rgba(16,185,129,0.15); color:var(--success);"
          }">
                  ${isUser ? "ENTRADA" : "RESPOSTA"}
                </span>
              </td>
              <td style="padding:10px 16px; font-size:12px; color:var(--text-muted);">${timeStr}</td>
              <td style="padding:10px 16px;"><code style="color:var(--accent); font-size:12px;">${m.channel}</code></td>
              <td style="padding:10px 16px; font-weight:600; font-size:12px;">${m.senderName}</td>
              <td style="padding:10px 16px; font-family:var(--font-mono); font-size:12px;">${m.charCount || 0}</td>
              <td style="padding:10px 16px; font-family:var(--font-mono); font-size:12px; color:var(--accent);">${(m.tokens || 0).toLocaleString()}</td>
              <td style="padding:10px 16px; font-family:var(--font-mono); font-size:12px; color:#38bdf8;">$${costUsdFmt}</td>
              <td style="padding:10px 16px; font-family:var(--font-mono); font-size:12px; color:#10b981;">R$ ${costBrlFmt}</td>
              <td style="padding:10px 16px; max-width:260px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:12px; color:var(--text-dim);" title="Clique para ver detalhes">${safePreview}</td>
            </tr>
          `;
        })
        .join("");

      tbody.querySelectorAll(".usage-row").forEach((row) => {
        row.addEventListener("click", () => {
          const item = logs.find((l) => l.id === row.dataset.id);
          if (item) {
            LateralSheet.open({
              title: "📊 Detalhes da Chamada & Consumo",
              contentHtml: `
                <div style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
                  <div><strong>ID da Mensagem:</strong> <code>${item.id}</code></div>
                  <div><strong>Tipo:</strong> <span>${item.type === "user" ? "Entrada (Input)" : "Resposta (Output)"}</span></div>
                  <div><strong>Canal:</strong> <code>${item.channel}</code></div>
                  <div><strong>Remetente:</strong> <code>${item.senderName}</code></div>
                  <div><strong>Data / Hora:</strong> <code>${new Date(item.timestamp).toLocaleString("pt-BR")}</code></div>
                  <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px;">
                    <div style="background:var(--bg-input); padding:10px; border-radius:var(--radius-sm);">
                      <div style="font-size:11px; color:var(--text-dim);">Tokens Estimados</div>
                      <div style="font-size:16px; font-weight:700; color:var(--accent);">${item.tokens}</div>
                    </div>
                    <div style="background:var(--bg-input); padding:10px; border-radius:var(--radius-sm);">
                      <div style="font-size:11px; color:var(--text-dim);">Custo Estimado</div>
                      <div style="font-size:16px; font-weight:700; color:var(--success);">$${(item.costUsd || 0).toFixed(6)}</div>
                    </div>
                  </div>
                  <div style="margin-top:10px;"><strong>Conteúdo Completo:</strong></div>
                  <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:12px; font-family:var(--font-mono); font-size:12px; white-space:pre-wrap; max-height:220px; overflow-y:auto;">${item.text}</div>
                </div>
              `,
            });
          }
        });
      });
    } catch {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:var(--danger);">Falha ao carregar extrato de consumo.</td></tr>`;
    }
  }

  static async loadStats() {
    try {
      const stats = await ApiClient.getStats();
      const setTxt = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.innerText = txt;
      };
      setTxt("stat-total-msgs", stats.totalMessages);
      setTxt("stat-msg-sub", `${stats.totalInbound} recebidas • ${stats.totalOutbound} enviadas`);
      setTxt("stat-tokens", stats.estimatedTokens.toLocaleString());
      setTxt("stat-cost", `$${stats.estimatedCostUsd}`);
    } catch {}
  }

  static parseMarkdown(text) {
    if (!text) return "";
    try {
      if (window.marked) {
        const renderer = new window.marked.Renderer();
        renderer.link = ({ href, title, text }) => {
          const titleAttr = title ? ` title="${title}"` : "";
          return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
        };
        const rawHtml = window.marked.parse(text, { renderer, breaks: true, gfm: true });
        if (window.DOMPurify) {
          return window.DOMPurify.sanitize(rawHtml, {
            ADD_ATTR: ["target", "rel"],
          });
        }
        return rawHtml;
      }
    } catch (e) {
      console.warn("Markdown parse error:", e);
    }
    return (text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  }

  static async loadChat() {
    const container = document.getElementById("chat-bubbles-container");
    if (!container) return;

    try {
      const data = await ApiClient.getChatMessages(100);
      if (!data.messages || data.messages.length === 0) {
        container.innerHTML = "<div style='text-align:center; color:var(--text-dim); margin-top:40px;'>Nenhuma mensagem trocada ainda.</div>";
        return;
      }

      container.innerHTML = data.messages
        .map((m) => {
          const isUser = m.type === "user";
          const timeStr = new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          const renderedContent = this.parseMarkdown(m.text || "");
          let channelLabel = m.channel || "telegram";
          if (channelLabel === "macos") channelLabel = "💻 macOS";
          else if (channelLabel === "telegram") channelLabel = "📱 Telegram";
          else if (channelLabel === "cli") channelLabel = "💻 Terminal";
          else if (channelLabel === "webhook") channelLabel = "🌐 Web";

          return `
            <div class="chat-bubble-row ${isUser ? "user" : "assistant"}">
              <div class="chat-meta">
                <strong style="color:${isUser ? "var(--accent)" : "var(--text-main)"}">${m.senderName}</strong>
                <span>•</span>
                <span>${timeStr}</span>
                <span>•</span>
                <span class="badge-status" style="font-size:10px; padding:2px 8px; font-family:var(--font-mono);">${channelLabel}</span>
              </div>
              <div class="chat-bubble ${isUser ? "user" : "assistant"}" data-id="${m.id}" title="Clique para detalhes">
                ${renderedContent}
              </div>
            </div>
          `;
        })
        .join("");

      // Add click listeners to chat bubbles to open lateral sheet with message inspector!
      container.querySelectorAll(".chat-bubble").forEach((bubble) => {
        bubble.addEventListener("click", (e) => {
          if (e.target.closest("a")) return; // Don't trigger drawer when clicking markdown links
          const msgId = bubble.dataset.id;
          const msgObj = data.messages.find((m) => m.id === msgId);
          if (msgObj) {
            LateralSheet.open({
              title: "🔍 Detalhes da Mensagem",
              contentHtml: `
                <div style="display:flex; flex-direction:column; gap:12px; font-size:13px;">
                  <div><strong>ID da Mensagem:</strong> <code>${msgObj.id}</code></div>
                  <div><strong>Tipo:</strong> <span class="badge-status">${msgObj.type.toUpperCase()}</span></div>
                  <div><strong>Remetente:</strong> <code>${msgObj.senderName}</code></div>
                  <div><strong>Canal:</strong> <code>${msgObj.channel}</code></div>
                  <div><strong>Timestamp:</strong> <code>${msgObj.timestamp}</code></div>
                  <div style="margin-top:10px;"><strong>Conteúdo Integral:</strong></div>
                  <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:12px; font-family:var(--font-mono); font-size:12px; white-space:pre-wrap; max-height:220px; overflow-y:auto;">${msgObj.text}</div>
                </div>
              `,
            });
          }
        });
      });

      container.scrollTop = container.scrollHeight;
    } catch {
      container.innerHTML = "<div style='text-align:center; color:var(--danger); margin-top:40px;'>Falha ao carregar chat.</div>";
    }
  }

  static async loadDocs() {
    const selector = document.getElementById("doc-selector");
    if (!selector) return;

    try {
      const data = await ApiClient.getDocs(this.currentGroup);
      const docs = data.docs || [];

      // Group by category
      const categories = {};
      for (const d of docs) {
        const cat = d.category || "Geral";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(d);
      }

      selector.innerHTML = Object.entries(categories)
        .map(
          ([catName, items]) => `
          <optgroup label="${catName}">
            ${items
              .map(
                (d) => `<option value="${d.relativePath}" ${d.relativePath === this.currentDocPath ? "selected" : ""}>${d.title}</option>`
              )
              .join("")}
          </optgroup>
        `
        )
        .join("");

      if (!docs.some((d) => d.relativePath === this.currentDocPath) && docs.length > 0) {
        this.currentDocPath = docs[0].relativePath;
      }

      this.loadDocContent(this.currentDocPath);
    } catch {}
  }

  static async loadDocContent(relPath) {
    this.currentDocPath = relPath;
    const filenameEl = document.getElementById("doc-current-filename");
    if (filenameEl) filenameEl.innerText = relPath;

    try {
      const data = await ApiClient.getDoc(this.currentGroup, relPath);
      const editor = document.getElementById("soul-editor");
      if (editor) {
        editor.value = data.content || "";
        this.renderSoulPreview(data.content || "");
      }
    } catch {}
  }

  static handleDocSwitch(relPath) {
    this.loadDocContent(relPath);
  }

  static renderSoulPreview(md) {
    const preview = document.getElementById("soul-preview");
    const charEl = document.getElementById("doc-char-count");
    const tokenEl = document.getElementById("doc-token-count");
    const lineEl = document.getElementById("doc-line-count");

    const chars = md ? md.length : 0;
    const lines = md ? md.split("\n").length : 0;
    const tokens = chars > 0 ? Math.max(1, Math.round(chars / 3.5)) : 0;

    if (charEl) charEl.innerText = `${chars.toLocaleString()} caracteres`;
    if (tokenEl) tokenEl.innerText = `~${tokens.toLocaleString()} tokens`;
    if (lineEl) lineEl.innerText = `${lines.toLocaleString()} linhas`;

    if (!preview) return;
    if (!md.trim()) {
      preview.innerHTML = "<p style='color:var(--text-dim)'>Nenhuma instrução definida.</p>";
      return;
    }
    preview.innerHTML = this.parseMarkdown(md);
  }

  static async handleSaveSoul() {
    const editor = document.getElementById("soul-editor");
    const btn = document.getElementById("btn-save-soul");
    if (!editor || !btn) return;

    btn.disabled = true;
    btn.innerHTML = "<span>Salvando...</span>";
    try {
      await ApiClient.saveDoc(this.currentGroup, this.currentDocPath, editor.value);
      Toast.show("Documento Markdown salvo com sucesso!");
    } catch (err) {
      Toast.show(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = "<span>💾 Salvar Alterações</span>";
    }
  }

  static async loadSkills() {
    const container = document.getElementById("skills-container");
    if (!container) return;

    try {
      const data = await ApiClient.getSkills(this.currentGroup);
      this.cachedSkills = data.skills || [];
      const modeAll = document.getElementById("skill-mode-all");
      const modeCustom = document.getElementById("skill-mode-custom");

      if (data.mode === "all" && modeAll) modeAll.checked = true;
      if (data.mode === "custom" && modeCustom) modeCustom.checked = true;

      container.innerHTML = this.cachedSkills
        .map(
          (s) => `
        <div class="skill-card ${s.enabled ? "active" : ""}">
          <div class="skill-card-top">
            <span class="skill-name">🛠️ ${s.name}</span>
            <label class="switch">
              <input type="checkbox" class="skill-toggle" data-name="${s.name}" ${s.enabled ? "checked" : ""}>
              <span class="slider"></span>
            </label>
          </div>
          <p class="skill-desc">${s.description}</p>
        </div>
      `
        )
        .join("");

      document.querySelectorAll(".skill-toggle").forEach((t) => {
        t.addEventListener("change", () => {
          if (modeCustom) modeCustom.checked = true;
        });
      });
    } catch {}
  }

  static async handleSaveSkills() {
    const isAll = document.getElementById("skill-mode-all")?.checked;
    const selected = [];
    document.querySelectorAll(".skill-toggle:checked").forEach((t) => selected.push(t.dataset.name));

    const btn = document.getElementById("btn-save-skills");
    if (btn) btn.disabled = true;

    try {
      await ApiClient.saveSkills(this.currentGroup, isAll ? "all" : "custom", selected);
      Toast.show("Skills atualizadas com sucesso!");
    } catch (err) {
      Toast.show(err.message, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  static async loadMcps() {
    try {
      const data = await ApiClient.getMcps(this.currentGroup);
      const editor = document.getElementById("mcp-json-editor");
      if (editor) editor.value = JSON.stringify(data.mcps || {}, null, 2);
    } catch {}
  }

  static async handleSaveMcps() {
    const editor = document.getElementById("mcp-json-editor");
    if (!editor) return;

    let parsed = {};
    try {
      parsed = JSON.parse(editor.value);
    } catch {
      return Toast.show("JSON inválido no editor de MCPs", "error");
    }

    const payload = parsed && typeof parsed === "object" && parsed.mcpServers ? parsed.mcpServers : parsed;

    try {
      await ApiClient.saveMcps(this.currentGroup, payload);
      Toast.show("Servidores MCP salvos com sucesso!");
      this.loadMcps();
      this.loadGoogleStatus();
      this.loadNotionStatus();
    } catch (err) {
      Toast.show(err.message, "error");
    }
  }

  static async loadGoogleStatus() {
    try {
      const data = await ApiClient.getGoogleStatus(this.currentGroup);
      const badge = document.getElementById("google-status-badge");
      const desc = document.getElementById("google-status-desc");
      const btnConnect = document.getElementById("btn-connect-google");
      const btnDisconnect = document.getElementById("btn-disconnect-google");

      if (data.connected) {
        if (badge) {
          badge.innerText = `Conectado (${data.email})`;
          badge.style.background = "rgba(16, 185, 129, 0.15)";
          badge.style.color = "var(--success)";
        }
        if (desc) desc.innerText = `Conta vinculada: ${data.email}. O Barão pode ler e agendar compromissos e ler e-mails.`;
        if (btnConnect) btnConnect.classList.add("hidden");
        if (btnDisconnect) btnDisconnect.classList.remove("hidden");
      } else {
        if (badge) {
          badge.innerText = "Desconectado";
          badge.style.background = "rgba(239, 68, 68, 0.15)";
          badge.style.color = "var(--danger)";
        }
        if (desc) desc.innerText = "Permite ao Barão ler sua agenda, criar reuniões e checar seus e-mails.";
        if (btnConnect) btnConnect.classList.remove("hidden");
        if (btnDisconnect) btnDisconnect.classList.add("hidden");
      }
    } catch {}
  }

  static async handleConnectGoogle() {
    try {
      const data = await ApiClient.getGoogleConnectUrl(this.currentGroup);
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      Toast.show(err.message, "error");
    }
  }

  static async handleDisconnectGoogle() {
    if (!confirm("Deseja realmente desconectar a conta do Google?")) return;
    try {
      await ApiClient.disconnectGoogle(this.currentGroup);
      Toast.show("Conta Google desconectada");
      this.loadGoogleStatus();
    } catch (err) {
      Toast.show(err.message, "error");
    }
  }

  static async loadNotionStatus() {
    try {
      const data = await ApiClient.getNotionStatus(this.currentGroup);
      const badge = document.getElementById("notion-status-badge");
      const desc = document.getElementById("notion-status-desc");
      const btnToggle = document.getElementById("btn-toggle-notion-modal");
      const btnDisconnect = document.getElementById("btn-disconnect-notion");
      const inputKey = document.getElementById("input-notion-api-key");
      const inputDb = document.getElementById("input-notion-db-id");

      if (data.connected) {
        if (badge) {
          badge.innerText = `Conectado (${data.botName || data.maskedKey})`;
          badge.style.background = "rgba(16, 185, 129, 0.15)";
          badge.style.color = "var(--success)";
        }
        if (desc) desc.innerText = `Integração ativa. O Barão pode criar páginas, atas de reunião e consultar tabelas no Notion.`;
        if (btnToggle) btnToggle.innerHTML = "<span>⚙️ Alterar Configuração</span>";
        if (btnDisconnect) btnDisconnect.classList.remove("hidden");
        if (inputDb && data.defaultDatabaseId) inputDb.value = data.defaultDatabaseId;
      } else {
        if (badge) {
          badge.innerText = "Desconectado";
          badge.style.background = "rgba(239, 68, 68, 0.15)";
          badge.style.color = "var(--danger)";
        }
        if (desc) desc.innerText = "Permite ao Barão criar notas estruturadas, salvar resumos e gerenciar tabelas no Notion.";
        if (btnToggle) btnToggle.innerHTML = "<span>⚙️ Configurar Notion</span>";
        if (btnDisconnect) btnDisconnect.classList.add("hidden");
        if (inputKey) inputKey.value = "";
      }
    } catch {}
  }

  static async handleSaveNotion() {
    const inputKey = document.getElementById("input-notion-api-key");
    const inputDb = document.getElementById("input-notion-db-id");
    const apiKey = inputKey?.value?.trim();
    const defaultDatabaseId = inputDb?.value?.trim();

    if (!apiKey) {
      Toast.show("Insira o token de integração do Notion (secret_...)", "error");
      return;
    }

    try {
      Toast.show("Testando conexão com o Notion...", "info");
      const res = await ApiClient.connectNotion(this.currentGroup, apiKey, defaultDatabaseId);
      if (res.success) {
        Toast.show(`🎉 Notion conectado com sucesso! (${res.botName || 'Pronto'})`);
        document.getElementById("notion-config-drawer")?.classList.add("hidden");
        this.loadNotionStatus();
      } else {
        Toast.show(res.error || "Erro ao conectar com o Notion", "error");
      }
    } catch (err) {
      Toast.show(err.message, "error");
    }
  }

  static async handleDisconnectNotion() {
    if (!confirm("Deseja realmente desconectar a integração com o Notion?")) return;
    try {
      await ApiClient.disconnectNotion(this.currentGroup);
      Toast.show("Notion desconectado");
      this.loadNotionStatus();
    } catch (err) {
      Toast.show(err.message, "error");
    }
  }

  static async loadConfig() {
    try {
      const data = await ApiClient.getConfig(this.currentGroup);
      if (data.config) {
        const c = data.config;
        const nameInput = document.getElementById("cfg-name");
        const providerSelect = document.getElementById("cfg-provider");
        const modelSelect = document.getElementById("cfg-model");
        const baseUrlInput = document.getElementById("cfg-base-url");
        const maskedKeyEl = document.getElementById("cfg-masked-key");

        if (nameInput) nameInput.value = c.assistantName || c.groupName || "Barão";
        if (providerSelect && c.provider) providerSelect.value = c.provider;
        if (modelSelect && c.model) modelSelect.value = c.model;
        if (baseUrlInput) baseUrlInput.value = c.baseUrl || "https://api.deepseek.com";
        if (maskedKeyEl) {
          maskedKeyEl.innerText = c.maskedApiKey ? c.maskedApiKey : "(Não configurada)";
        }
      }
    } catch {}
  }

  static async handleSaveConfig(e) {
    e.preventDefault();
    const assistantName = document.getElementById("cfg-name")?.value.trim() || "Barão";
    const provider = document.getElementById("cfg-provider")?.value || "deepseek";
    const model = document.getElementById("cfg-model")?.value || "deepseek-v4-flash";
    const baseUrl = document.getElementById("cfg-base-url")?.value.trim() || "https://api.deepseek.com";
    const apiKey = document.getElementById("cfg-api-key")?.value.trim();

    const payload = {
      assistantName,
      groupName: assistantName,
      provider,
      model,
      baseUrl,
    };
    if (apiKey) payload.apiKey = apiKey;

    try {
      await ApiClient.saveConfig(this.currentGroup, payload);
      Toast.show("Parâmetros do modelo salvos com sucesso!");
      const badge = document.getElementById("agent-active-badge");
      if (badge) badge.innerText = `${assistantName} (Online)`;
      document.getElementById("cfg-api-key").value = "";
      this.loadConfig();
    } catch (err) {
      Toast.show(err.message, "error");
    }
  }

  static async loadServiceStatus() {
    try {
      const data = await ApiClient.getServiceStatus();
      const statusEl = document.getElementById("stat-service-status");
      const pidEl = document.getElementById("stat-service-pid");
      const dockerEl = document.getElementById("docker-status-list");

      if (statusEl) statusEl.innerText = data.statusText;
      if (pidEl) pidEl.innerText = data.mainPid ? `PID: ${data.mainPid}` : "Inativo";
      if (dockerEl) {
        if (data.dockerContainers && data.dockerContainers.length > 0) {
          dockerEl.innerHTML = data.dockerContainers.map((c) => `<div>🐳 ${c}</div>`).join("");
        } else {
          dockerEl.innerText = "Nenhum contêiner rodando no momento.";
        }
      }
    } catch {}
  }

  static async handleRestartService() {
    if (!confirm("Deseja realmente reiniciar o serviço do NanoClaw?")) return;
    const btn = document.getElementById("btn-restart-service");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = "<span>Reiniciando...</span>";
    }

    try {
      await ApiClient.restartService();
      Toast.show("NanoClaw reiniciado com sucesso!");
      setTimeout(() => this.loadServiceStatus(), 2000);
    } catch (err) {
      Toast.show(err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "<span>🔄 Reiniciar Serviço NanoClaw</span>";
      }
    }
  }

  static async handleGeneratePairing() {
    const btn = document.getElementById("btn-generate-pairing");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = "<span>Gerando código...</span>";
    }

    try {
      const res = await ApiClient.generateTelegramPairing(this.currentGroup);
      if (res.code) {
        const display = document.getElementById("pairing-code-display");
        const copyBtn = document.getElementById("btn-copy-pairing");
        if (display) display.innerText = res.code;
        if (copyBtn) copyBtn.disabled = false;
        Toast.show("Código de pareamento gerado!");
      }
    } catch (err) {
      Toast.show(err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "<span>🔑 Gerar Código de Pareamento</span>";
      }
    }
  }
}

// Bootstrap
document.addEventListener("DOMContentLoaded", () => App.init());
