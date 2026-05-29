import { createServer } from "node:http";

import { config } from "../config.js";
import { generateChatCompletion } from "../core/llmClient.js";
import { readJsonBody, sendError, sendJson } from "../utils/http.js";

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "explanation-service",
      phase: "fase-2",
      role: "Compoe respostas com LLM (Groq) usando contexto RAG e dados MCP.",
      llmConfigured: Boolean(config.llm?.apiKey),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/compose") {
    try {
      const body = await readJsonBody(req);
      const result = await composeAnswer({
        question: body.question,
        intent: body.intent,
        knowledgeResults: body.knowledgeResults || [],
        mcpToolResults: body.mcpToolResults || [],
      });
      sendJson(res, 200, {
        ok: true,
        service: "explanation-service",
        result,
      });
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message);
    }
    return;
  }

  sendError(res, 404, "Rota nao encontrada no Explanation Service.");
});

async function composeAnswer({ question, intent, knowledgeResults, mcpToolResults }) {
  const llmConfigured = Boolean(config.llm?.apiKey);

  if (!llmConfigured) {
    return fallbackComposer({ question, intent, knowledgeResults, mcpToolResults });
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(question, intent, knowledgeResults, mcpToolResults);

  try {
    const completion = await generateChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      maxTokens: 800,
    });

    return {
      intent: intent.label,
      answer: completion.content.trim(),
      composer: "fase2-llm-groq",
      model: completion.model,
      usage: completion.usage,
    };
  } catch (llmError) {
    console.error("[explanation-service] Erro LLM:", llmError.message);
    return fallbackComposer({ question, intent, knowledgeResults, mcpToolResults });
  }
}

function buildSystemPrompt() {
  return `Voce e um assistente especializado em Formula 1. Responda perguntas com naturalidade, como se estivesse consultando fontes ao vivo e documentos oficiais.

Regras:
- Responda em portugues do Brasil.
- Seja direto, objetivo e tecnico quando apropriado.
- NUNCA mencione nomes internos de ferramentas, APIs, protocolos, codigos ou sistemas (ex: nao fale "get_driver_standings", "MCP", "ferramenta externa", etc.).
- Cite fontes de forma natural: "De acordo com o Regulamento FIA...", "Os dados ao vivo indicam...", "A Race Control informou...".
- Se os documentos nao tiverem a resposta, informe que nao ha informacao suficiente.
- Use os dados ao vivo para complementar a resposta quando relevante.
- Nao invente informacoes que nao estejam nos documentos ou dados fornecidos.
- Nao use meta-linguagem sobre como a resposta foi construida.`;
}

function buildUserPrompt(question, intent, knowledgeResults, mcpToolResults) {
  const parts = [
    `Pergunta do usuario: ${question}`,
    ``,
    `Intencao detectada: ${intent.label}`,
    ``,
  ];

  if (knowledgeResults.length > 0) {
    parts.push(`Documentos relevantes (RAG):`);
    for (const item of knowledgeResults) {
      parts.push(`- [${item.doc.title} | ${item.doc.source}] ${item.doc.text}`);
    }
    parts.push(``);
  }

  if (mcpToolResults.length > 0) {
    parts.push(`Dados ao vivo do campeonato:`);
    for (const tool of mcpToolResults) {
      if (tool.error) {
        parts.push(`- Indisponivel: ${tool.error}`);
      } else {
        const label = toolLabel(tool.tool);
        parts.push(`- ${label}:`);
        parts.push(JSON.stringify(tool.result, null, 2));
      }
    }
    parts.push(``);
  }

  parts.push(`Responda a pergunta com base nas informacoes acima.`);

  return parts.join("\n");
}

function toolLabel(toolName) {
  const map = {
    get_driver_standings: "Classificacao de Pilotos",
    get_constructor_standings: "Classificacao de Construtores",
    get_race_control_messages: "Mensagens da Race Control",
    get_weather: "Condicoes Meteorologicas",
    get_session_info: "Informacoes da Sessao",
    "mcp-error": "Erro na conexao",
  };
  return map[toolName] || toolName;
}

function fallbackComposer({ question, intent, knowledgeResults, mcpToolResults }) {
  const main = knowledgeResults[0]?.doc;
  const related = knowledgeResults.slice(1).map((item) => item.doc.title);

  const lines = [
    `Pergunta: ${question}`,
    "",
    main
      ? `${main.title}: ${main.text}`
      : "Nao ha documentos relevantes na base de conhecimento.",
    related.length ? `Conceitos relacionados: ${related.join(", ")}.` : "",
    "",
  ];

  if (mcpToolResults.length > 0) {
    lines.push("Dados externos:");
    for (const tool of mcpToolResults) {
      if (tool.error) {
        lines.push(`- ${tool.tool}: erro`);
      } else {
        lines.push(`- ${tool.tool}: ${JSON.stringify(tool.result, null, 2).slice(0, 200)}`);
      }
    }
    lines.push("");
  }

  lines.push("(Modo fallback: LLM nao configurado ou indisponivel. Resposta baseada apenas nos documentos e dados externos.)");

  const answer = lines.filter(Boolean).join("\n");

  return {
    intent: intent.label,
    answer,
    composer: "fase2-fallback-template",
    model: null,
    usage: null,
  };
}

server.listen(config.services.explanation.port, () => {
  console.log(`Explanation Service em http://localhost:${config.services.explanation.port}`);
});
