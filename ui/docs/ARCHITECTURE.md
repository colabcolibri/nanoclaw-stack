# Arquitetura do NanoClaw UAI

## 1. Visão Geral

O **NanoClaw UAI** atua como uma camada de gerenciamento e observabilidade externa sobre a instalação do **NanoClaw**.

```
                           [ Navegador do Usuário ]
                                      │ (HTTPS)
                                      ▼
                        [ Traefik (Portas 80 / 443) ]
                                      │ (https://seu-dominio.com)
                                      ▼
                  [ NanoClaw UAI (Bun Server :3000) ]
                    ├── Auth Gate (Resend OTP + JWT)
                    └── API / Web Dashboard
                             │           │
           (Lê/Escreve .md & .json)      (Lê SQLite)
                     ▼                         ▼
          /opt/nanoclaw/groups/      /opt/nanoclaw/data/
          └── <grupo>/               ├── v2.db
              ├── instructions.prepend.md (Soul)
              └── container.json (Model/Config)
```

---

## 2. Pontos de Integração com o NanoClaw

### A. Persona e Alma (Markdown)
* **Local:** `/opt/nanoclaw/groups/<folder>/instructions.prepend.md`
* **Comportamento:** O NanoClaw compõe o prompt do sistema no momento em que uma sessão é iniciada. Ao alterar este arquivo pela interface, a nova persona entra em vigor na próxima interação.

### B. Configuração do Modelo e Skills (JSON)
* **Local:** `/opt/nanoclaw/groups/<folder>/container.json`
* **Campos Principais:**
  * `model`: Modelo utilizado (ex: `deepseek-chat`, `claude-3-5-sonnet-20241022`, etc.)
  * `provider`: Provedor configurado (`opencode`, `claude`, etc.)
  * `skills`: Skills habilitadas (`all` ou lista de skills)
  * `assistantName`: Nome público do assistente

### C. Chamadas, Histórico e Sessões (SQLite)
* **Banco Geral:** `/opt/nanoclaw/data/v2.db`
  * Tabelas: `agent_groups`, `messaging_groups`, `sessions`, `users`, `user_roles`.
* **Bancos de Sessão:** `/opt/nanoclaw/data/v2-sessions/<agent_group_id>/<session_id>/`
  * `inbound.db`: Mensagens recebidas (`messages_in`).
  * `outbound.db`: Mensagens respondidas (`messages_out`).

---

## 3. Segurança & Autenticação

1. **OTP via Resend:**
   * Usuário submete o e-mail autorizado (definido via `.env` ex: `ALLOWED_EMAILS`).
   * Código criptograficamente seguro de 6 dígitos gerado com validade de 10 minutos.
   * E-mail enviado via API do Resend (`https://api.resend.com/emails`).
2. **Sessão:**
   * Cookie `HttpOnly`, `SameSite=Lax`, `Secure` com assinatura HMAC/JWT.
   * Endpoints protegidos exigem o cookie válido.
