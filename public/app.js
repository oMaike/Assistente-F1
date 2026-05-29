const { createApp, nextTick } = window.Vue;

createApp({
  data() {
    return {
      draft: "O que significa track limits e quando gera penalidade?",
      sending: false,
      health: { ok: false },
      architectureMode: "microservicos",
      externalApiLabel: "checando",
      externalApiOnline: false,
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
            "Oi. Me pergunte sobre regras, penalidades, estrategias ou termos da F1. Agora na Fase 2 uso documentos reais com busca vetorial (RAG), ferramentas externas via MCP e LLM para responder.",
        },
      ],
    };
  },

  computed: {
    headerSubtitle() {
      return this.sending ? "consultando microservicos..." : "online";
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
        this.architectureMode = "fase 2";
      } catch {
        this.health = { ok: false };
        this.externalApiLabel = "offline";
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
