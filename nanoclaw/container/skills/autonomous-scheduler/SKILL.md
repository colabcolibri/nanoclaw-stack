---
name: autonomous-scheduler
description: Guia operacional de agendamento de rotinas periódicas (cron), follow-ups com delay e tarefas autônomas no NanoClaw.
domain: notion_management
tools:
  - schedule_followup
keywords:
  - cron
  - agendamento
  - agendar
  - rotina
  - recorrente
  - periodicidade
  - followup
  - follow-up
  - alarme
  - lembrete
  - periodicamente
---

# SKILL: AGENDAMENTO E ROTINAS AUTÔNOMAS (CRON & FOLLOW-UPS)

## 1. Arquitetura de Agendamento no NanoClaw
O ambiente de execução do agente roda em containers Docker isolados e efêmeros.
- **NUNCA tente configurar `crontab -e`, `/etc/cron.d/` ou arquivos no sistema operacional host via `run_command`**. Esses comandos não persistem e não acordam o agente.
- O agendamento real e persistente do NanoClaw é gerenciado diretamente pela ferramenta nativa `schedule_followup`.

---

## 2. Ações Disponíveis na Ferramenta `schedule_followup`

### A. Criar Rotina Recorrente (Cron)
Para tarefas que devem rodar periodicamente (ex: checagem de e-mails a cada 2 horas, resumo matinal diário, monitoramento):
- **Ferramenta:** `schedule_followup`
- **Parâmetros:**
  - `action`: `"schedule_recurring_routine"`
  - `cron`: Expressão cron padrão de 5 campos (minuto hora dia mês dia-da-semana) em UTC.
    - Exemplo a cada 2 horas: `"0 */2 * * *"`
    - Exemplo diário às 09:00 UTC (06:00 Brasília): `"0 9 * * *"`
    - Exemplo dias úteis às 11:00 UTC (08:00 Brasília): `"0 11 * * 1-5"`
  - `prompt`: Instrução clara, rica em detalhes e autônoma para quando o sistema acordar.
    - *Exemplo de prompt:* `"Verificar e-mails não lidos no Gmail através da ferramenta google_gmail. Para cada e-mail relevante, criar um rascunho de resposta na mesma thread e enviar uma notificação de resumo ao Sérgio."`

### B. Criar Tarefa Futura com Delay (One-Shot Follow-up)
Para tarefas pontuais que devem executar após um intervalo de tempo:
- **Ferramenta:** `schedule_followup`
- **Parâmetros:**
  - `action`: `"schedule_delayed_task"`
  - `delay_minutes`: Minutos para a execução (ex: `15`, `60`, `120`).
  - `run_at` (opcional): Data/hora exata em ISO string (ex: `"2026-08-20T18:00:00Z"`).
  - `prompt`: Instrução do que deve ser verificado ou continuado.

### C. Listar Rotinas e Tarefas Agendadas (Ativas)
Quando o usuário perguntar o status, quais rotinas ou cron jobs estão ativos na agenda:
- **Ferramenta:** `schedule_followup`
- **Parâmetros:**
  - `action`: `"list_scheduled_tasks"`
- **Interpretação Estrita:** Esta ação retorna apenas as rotinas **ativas e pendentes** de execução (`status: 'pending'`).
- **Como Responder:** Informe com clareza quantas rotinas estão ativas, seus IDs, periodicidade (ex: a cada 3 horas) e horário do próximo disparo (`process_after`). Não confunda execuções passadas com rotinas ativas.

### D. Alterar / Atualizar Rotina Recorrente (Cron)
Quando o usuário pedir para mudar a frequência, horário ou o que a rotina faz:
- **Ferramenta:** `schedule_followup`
- **Parâmetros:**
  - `action`: `"update_recurring_routine"`
  - `task_id` (opcional): ID da rotina. Se omitido, a rotina ativa mais recente será atualizada.
  - `cron` (opcional): Nova expressão cron (ex: `"0 */1 * * *"` para mudar para a cada 1 hora).
  - `prompt` (opcional): Nova instrução de execução para a tarefa.

### E. Cancelar Agendamento
- **Ferramenta:** `schedule_followup`
- **Parâmetros:**
  - `action`: `"cancel_task"`
  - `task_id`: ID retornado na criação ou listagem da rotina (ex: `"routine-1787208..."`).

---

## 3. Diretrizes de Validação e Ground Truth
1. **Sempre execute a ferramenta antes de responder:** Nunca afirme ao usuário que uma rotina foi criada, alterada ou cancelada sem antes receber a confirmação `{ "status": "ok" }` da ferramenta `schedule_followup`.
2. **Diferencie Rotinas Ativas de Histórico de Execuções:**
   - **Agendamentos / Rotinas Ativas:** São as tarefas pendentes na fila para serem executadas no futuro.
   - **Execuções / Runs:** São os disparos que já ocorreram e foram concluídos no passado. Apenas as tarefas `pending` continuam no ciclo do cron.
3. **Reporte o ID e a Periodicidade:** Ao confirmar a criação ou alteração, informe ao usuário a periodicidade configurada e o identificador da rotina para facilitar o rastreamento.
