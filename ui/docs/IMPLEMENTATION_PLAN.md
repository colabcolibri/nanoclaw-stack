# Plano de Implementação: NanoClaw UAI

## Fases do Desenvolvimento

### Fase 1: Infraestrutura Básica & Autenticação OTP
- [ ] Configuração do servidor HTTP em Bun (`src/index.ts`).
- [ ] Implementação do serviço de e-mail OTP com Resend (`src/auth/resend.ts`).
- [ ] Criação do middleware de sessão com cookies seguros (`HttpOnly`).
- [ ] Tela inicial de Login moderna e responsiva (Passo 1: E-mail, Passo 2: Código de 6 dígitos).

### Fase 2: Módulo de Gerenciamento de Soul & Configurações
- [ ] Serviço de listagem e leitura de grupos em `/opt/nanoclaw/groups/` (`src/services/groups.ts`).
- [ ] API para ler e salvar `instructions.prepend.md` (Soul) e `container.json`.
- [ ] Frontend: Editor Markdown com preview em tempo real e seletor de modelos/parâmetros.

### Fase 3: Módulo de Observabilidade & Histórico (SQLite)
- [ ] Serviço de leitura do SQLite com `bun:sqlite` (`src/services/db.ts`).
- [ ] Extração de métricas: total de chamadas, sessões ativas, mensagens recebidas/enviadas.
- [ ] Tabela/Timeline visual de histórico de mensagens e interações do bot.
- [ ] Estimador de consumo de tokens e custos estimados por modelo.

### Fase 4: Integração com Traefik & Systemd
- [ ] Configuração da rota reversa no Traefik (`/opt/traefik/dynamic_conf.yml`).
- [ ] Criação do serviço systemd `nanoclaw-uai.service` para auto-reinicialização.
- [x] Validação de ponta a ponta com proxy reverso e SSL.
