# NanoClaw UAI — Interface de Controle e Monitoramento

Interface web leve, segura e responsiva para gerenciamento do **NanoClaw**, permitindo edição da personalidade (*Soul* / `.md`), parâmetros de execução e monitoramento de chamadas e histórico.

---

## 🎯 Objetivos do Projeto

1. **Desacoplamento Total**: O projeto vive em `/opt/nanoclaw-uai`, sem modificar arquivos do repositório principal `/opt/nanoclaw`, garantindo que atualizações futuras via `git pull` no NanoClaw não sofram conflitos.
2. **Autenticação Segura (OTP)**: Acesso protegido via e-mail com código de uso único (OTP) enviado pela API do **Resend**.
3. **Edição de Soul / Persona**: Interface com editor Markdown para gerenciar `instructions.prepend.md` e configurações do contêiner (`container.json`).
4. **Monitoramento e Histórico**: Leitura das sessões e mensagens registradas nos bancos SQLite do NanoClaw (`v2.db`, `inbound.db` e `outbound.db`) com cálculo de volumetria e estimativa de custos.
5. **Integração Traefik**: Roteamento automático via proxy reverso / SSL no seu domínio através do Traefik.

---

## 📂 Estrutura do Projeto

```
/opt/nanoclaw-uai/
├── docs/
│   ├── ARCHITECTURE.md          # Arquitetura e modelo de dados
│   └── IMPLEMENTATION_PLAN.md   # Roteiro passo a passo de desenvolvimento
├── src/
│   ├── auth/                    # Lógica OTP via Resend e validação de sessão
│   ├── routes/                  # Endpoints de API (soul, config, chamadas, status)
│   ├── services/                # Leitura e escrita de arquivos .md e SQLite
│   ├── public/                  # Frontend estático (HTML, CSS moderno e JS)
│   └── index.ts                 # Servidor HTTP Bun
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Como Executar

```bash
cd /opt/nanoclaw-uai
bun install
bun run src/index.ts
```
