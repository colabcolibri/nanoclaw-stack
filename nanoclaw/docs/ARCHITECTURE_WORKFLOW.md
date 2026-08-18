# 🚀 Arquitetura & Fluxo de Trabalho do NanoClaw v2

Este documento descreve o fluxo de execução de ponta a ponta do agente, desde a chegada da mensagem até a entrega no canal e no painel de controle.

---

## 🗺️ 1. Diagrama de Fluxo de Ponta a Ponta

```mermaid
flowchart TD
    %% Entradas
    User([👤 Usuário via Telegram / Mac]) --> ChannelAdapter[📡 Channel Adapter]
    
    subgraph INGRESS["1. Ingress & Processamento de Entrada"]
        ChannelAdapter --> AudioCheck{Mensagem é Áudio?}
        AudioCheck -- Sim --> Whisper[🎙️ Whisper ASR Auto-Detect]
        AudioCheck -- Não --> TextExtract[📝 Extração de Texto]
        Whisper --> TextExtract
        TextExtract --> MemoIn[🏷️ Geração do Memo Inbound <br/> ≤ 300 chars]
        MemoIn --> InboundDB[(📁 messages_in <br/> + coluna memo)]
    end

    subgraph ORCHESTRATOR["2. Turn Orchestrator & Decisão"]
        InboundDB --> PollLoop[⚡ Poll Loop & Host Sweep]
        PollLoop --> RouterCheck{ToolRouter: Precisa de Ferramentas?}
        
        %% Fast-Path
        RouterCheck -- Conversa Pura (0 Tools) --> FastPath[⚡ Fast-Path Direto <br/> 1 Única Chamada com Persona]
        
        %% Tool Loop
        RouterCheck -- Requer Ações --> InitScratchpad[🗂️ Inicializa ExecutionScratchpad <br/> Puxa últimos 6 Memos do DB]
        InitScratchpad --> Stage1[🛠️ STAGE 1: Loop Técnico Lean <br/> ~300 tokens / iteração]
    end

    subgraph STAGE1_LOOP["3. Loop Técnico com Skills sob Demanda"]
        Stage1 --> LLMDecision{Decisão da IA no Stage 1}
        LLMDecision -- Precisa de Manual --> LoadSkill[📚 load_skill <br/> Carrega SKILL.md sob demanda]
        LLMDecision -- Precisa do Histórico Integral --> RetrieveCtx[🔍 retrieve_message_context <br/> Puxa mensagem completa por ID]
        LLMDecision -- Executa Ação de Negócio --> ToolExec[⚙️ Executa Tool <br/> Gmail, Calendar, Yampi, Notion, etc.]
        
        LoadSkill --> ScratchpadMemory[(🧠 Scratchpad Findings)]
        RetrieveCtx --> ScratchpadMemory
        ToolExec --> Sanitizer[🧹 PayloadSanitizer <br/> Remove Base64, HTML e headers]
        Sanitizer --> ScratchpadMemory
        ScratchpadMemory --> Stage1
    end

    subgraph SYNTHESIS["4. Síntese Final & Entrega"]
        LLMDecision -- Todas as Tools Concluídas --> Stage2[🎭 STAGE 2: Síntese Executiva <br/> Persona Barão + Memória Permanente <br/> + Relatório Consolidado do Scratchpad]
        FastPath --> DeliverOut
        Stage2 --> GenMemoOut[🏷️ Geração do Memo Outbound <br/> ≤ 300 chars]
        GenMemoOut --> OutboundDB[(📁 messages_out <br/> + coluna memo)]
        OutboundDB --> DeliverOut[🚀 Host Delivery Poller]
    end

    DeliverOut --> OutChannel([📱 Telegram / Mac do Usuário])
    OutboundDB --> Dashboard([💻 UI Control Panel & Inspector])
```

---

## ⚙️ 2. Detalhamento de Cada Etapa do Fluxo

### 1. Ingress & Extração de Memo
1. **Entrada do Canal:** Recebe a mensagem do Telegram ou macOS. Se for áudio, o Whisper ASR faz a transcrição com detecção automática de idioma.
2. **Gravação com Memo:** Salva em `messages_in` (`inbound.db`) com o texto completo e preenche a coluna **`memo`** (resumo de até 300 caracteres).

---

### 2. Roteamento Inteligente & Fast-Path
* **Conversa Pura (Fast-Path):** Se o usuário mandar um cumprimento ou pergunta direta que não precisa de ferramentas, o sistema executa **1 única chamada direta** com Persona e Memória.
* **Ações Técnicas (Tool Path):** Se precisar de ferramentas, ativa o `TurnOrchestrator` em dois estágios.

---

### 3. Stage 1 — Loop Técnico com Memória de Execução
* **Contexto Inicial Mínimo (~300 tokens):**
  - Recebe apenas o objetivo atual + índice dos últimos 6 memos.
  - Recebe o catálogo compacto de skills em 1 linha por domínio.
* **Ferramentas sob Demanda:**
  - `load_skill({ name: "..." })`: Carrega manuais específicos de regras de negócio apenas se a IA decidir.
  - `retrieve_message_context({ message_id: "..." })`: Resgata o texto completo de mensagens antigas caso a IA necessite dos dados integrais.
  - Executa as ferramentas de negócio (`google_gmail`, `google_calendar`, `yampi_store`, `notion`, etc.).
* **Higiene de Payloads (`PayloadSanitizer`):** Limpa blobs binários base64, HTML bruto e cabeçalhos de rede antes de gravar no `ExecutionScratchpad`.

---

### 4. Stage 2 — Síntese Executiva do Barão
* Quando todas as ferramentas são concluídas, o orquestrador aciona o **Stage 2**:
  - Injeta a Persona do Barão (`instructions.prepend.md`).
  - Injeta a Memória Permanente da Empresa (`memory/index.md`).
  - Injeta o relatório consolidado gerado pelo `ExecutionScratchpad`.
* Gera a resposta elegante, cria o **`memo` de saída (≤ 300 chars)** e entrega no Telegram e no Dashboard.

---

## 📊 3. Tabela Comparativa de Eficiência

| Métrica | Arquitetura Antiga | Nova Arquitetura com Memos & Skills on Demand |
| :--- | :--- | :--- |
| **Histórico de Conversas** | 6.500+ tokens (tabelas antigas acumuladas) | **~60 a 90 tokens** (Índice de Memos) |
| **Manuais de Skills** | 2.774 tokens (despejo de todos os `SKILL.md`) | **~90 tokens** (Catálogo compacto, carregamento sob demanda) |
| **Payloads de Tools** | Brutos com HTML e headers de rede | **Sanitizados** (apenas dados de negócio) |
| **Custo por Interação** | R$ 0,04 a R$ 0,08 | **R$ 0,004 a R$ 0,007** (Redução de até 85%) |
| **Resiliência de Entrega** | Sujeito a alucinações de tags XML | **100% Determinístico** (Origin Routing pelo Sistema) |
