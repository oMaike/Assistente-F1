const { createApp, nextTick } = window.Vue;

createApp({
  data() {
    return {
      draft: "O que significa track limits e quando gera penalidade?",
      sending: false,
      maintenanceRunning: false,
      health: { ok: false },
      architectureMode: "microservicos",
      externalApiLabel: "checando",
      externalApiOnline: false,
      maintenance: null,
      prompts: [
        "O que significa track limits e quando gera penalidade?",
        "Qual a diferenca entre Safety Car e Virtual Safety Car?",
        "Como funciona o DRS durante uma corrida?",
        "O que e undercut na estrategia de pit stop?",
        "Qual a classificacao dos pilotos agora?",
        "Como esta o clima no circuito?",
      ],
      messages: [
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Oi. Me pergunte sobre regras, penalidades, estrategias ou termos da F1. Agora na Fase 3 uso documentos reais com busca vetorial (RAG), ferramentas externas via MCP, LLM e uma Saga para atualizar a base com compensacao.",
        },
      ],
    };
  },

  computed: {
    headerSubtitle() {
      return this.sending ? "consultando microservicos..." : "online";
    },

    maintenanceLabel() {
      if (this.maintenanceRunning) return "executando saga...";
      if (!this.maintenance) return "base pronta";
      if (this.maintenance.status === "committed") return "base atualizada";
      if (this.maintenance.status === "compensated") return "falha compensada";
      return this.maintenance.status || "base pronta";
    },
  },

  async mounted() {
    await this.loadHealth();
    this.$refs.composer?.focus();
  },

  methods: {
    usePrompt(prompt) {
      this.draft = prompt;
      nextTick(() => this.$refs.composer?.focus());
    },

    async loadHealth() {
      try {
        const response = await fetch("/api/health");
        const data = await response.json();
        this.health = data;

        const externalApi = data.downstream?.orchestrator?.body?.dependencies?.externalApi?.body;
        this.externalApiOnline = Boolean(externalApi?.ok);
        this.externalApiLabel = this.externalApiOnline ? "MCP server" : "offline";
        this.architectureMode = data.downstream?.orchestrator?.body?.phase || "fase 3";
        this.maintenance = data.downstream?.orchestrator?.body?.saga || this.maintenance;
      } catch {
        this.health = { ok: false };
        this.externalApiLabel = "offline";
      }
    },

    async runMaintenanceSaga() {
      if (this.maintenanceRunning) return;

      this.maintenanceRunning = true;
      this.messages.push({
        id: crypto.randomUUID(),
        role: "system",
        content: "Atualizacao distribuida iniciada. O orquestrador vai preparar a nova base, publicar a versao valida e compensar automaticamente se algo falhar.",
      });
      await this.scrollToBottom();

      try {
        const response = await fetch("/api/saga/reindex", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ reason: "demo-final" }),
        });

        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data.error?.message || data.saga?.error || "Falha ao executar a saga.");
        }

        this.maintenance = data.saga;
        this.messages.push({
          id: crypto.randomUUID(),
          role: "system",
          content:
            data.saga.status === "committed"
              ? `Saga concluida com sucesso em ${data.saga.elapsedMs} ms. A nova versao da base foi publicada.`
              : `Saga executada com compensacao em ${data.saga.elapsedMs} ms. O sistema manteve a ultima versao valida.`,
        });
      } catch (error) {
        this.messages.push({
          id: crypto.randomUUID(),
          role: "system",
          content: `Nao foi possivel concluir a atualizacao distribuida. ${error.message}`,
        });
      } finally {
        this.maintenanceRunning = false;
        await this.loadHealth();
        await this.scrollToBottom();
      }
    },

    async sendMessage() {
      const question = this.draft.trim();
      if (!question || this.sending) return;

      this.messages.push({
        id: crypto.randomUUID(),
        role: "user",
        content: question,
      });

      this.draft = "";
      this.sending = true;

      const assistantId = crypto.randomUUID();
      this.messages.push({
        id: assistantId,
        role: "assistant",
        content: "",
        loading: true,
      });
      await this.scrollToBottom();

      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ question }),
        });

        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data.error?.message || "Falha ao consultar.");
        }

        this.replaceMessage(assistantId, {
          role: "assistant",
          content: data.answer,
          meta: this.buildMeta(data),
        });
      } catch (error) {
        this.replaceMessage(assistantId, {
          role: "assistant",
          content: `Nao consegui completar a consulta agora.\n\n${error.message}`,
        });
      } finally {
        this.sending = false;
        await this.loadHealth();
        await this.scrollToBottom();
      }
    },

    replaceMessage(id, patch) {
      const index = this.messages.findIndex((message) => message.id === id);
      if (index === -1) return;
      this.messages[index] = {
        id,
        ...patch,
        loading: false,
      };
    },

    buildMeta(data) {
      const parts = [];

      if (data.model) {
        parts.push(`modelo: ${data.model}`);
      }

      if (data.sources && data.sources.length > 0) {
        parts.push(`fontes RAG: ${data.sources.length} documento(s)`);
      }

      if (data.mcpToolsUsed && data.mcpToolsUsed.length > 0) {
        parts.push(`ferramentas MCP: ${data.mcpToolsUsed.join(", ")}`);
      }

      if (this.maintenance?.status) {
        parts.push(`Saga: ${this.maintenance.status}`);
      }

      return {
        summary: `${data.intent?.label || "consulta"} - ${data.elapsedMs} ms`,
        sources: data.sources || [],
        flow: data.flow || [],
        external: parts.join(" | ") || "Componente externo previsto na arquitetura",
        model: data.model,
        mcpToolsUsed: data.mcpToolsUsed || [],
      };
    },

    async scrollToBottom() {
      await nextTick();
      const list = this.$refs.messageList;
      if (list) list.scrollTop = list.scrollHeight;
    },
  },
}).mount("#app");
