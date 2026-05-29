import { createServer } from "node:http";

import { config } from "../config.js";
import { classifyIntent } from "../core/intentClassifier.js";
import { readJsonBody, sendError, sendJson } from "../utils/http.js";
import { getJson, postJson } from "../utils/serviceClient.js";
import { createMcpClient } from "../mcp/mcpClient.js";

const services = {
  knowledge: config.services.knowledge.url,
  externalApi: config.services.externalApi.url,
  explanation: config.services.explanation.url,
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    const [knowledge, externalApi, explanation] = await Promise.all([
      getJson(`${services.knowledge}/health`),
      getJson(`${services.externalApi}/health`),
      getJson(`${services.explanation}/health`),
    ]);
    sendJson(res, 200, {
      ok: true,
      service: "orchestrator-service",
      phase: "fase-2",
      role: "Controle: coordena RAG, MCP e LLM para compor respostas.",
      dependencies: { knowledge, externalApi, explanation },
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/ask") {
    try {
      const body = await readJsonBody(req);
      const question = String(body.question || "").trim();

      if (question.length < 3) {
        sendError(res, 400, "Envie uma pergunta com pelo menos 3 caracteres.");
        return;
      }

      const result = await askDistributed(question);
      sendJson(res, 200, result);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message);
    }
    return;
  }

  sendError(res, 404, "Rota nao encontrada no Orchestrator Service.");
});

async function askDistributed(question) {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  const intent = classifyIntent(question);

  // RAG: Knowledge Base com busca vetorial
  const knowledgeResponse = await postJson(`${services.knowledge}/lookup`, { question });
  const knowledgeResults = knowledgeResponse.results || [];

  // MCP: Ferramentas externas baseadas na intencao
  let mcpToolResults = [];
  const toolsToCall = selectToolsByIntent(intent);

  if (toolsToCall.length > 0) {
    try {
      const mcp = await createMcpClient(services.externalApi);
      try {
        for (const toolName of toolsToCall) {
          const result = await mcp.callTool(toolName);
          mcpToolResults.push({
            tool: toolName,
            result: parseToolResult(result),
          });
        }
      } finally {
        await mcp.close();
      }
    } catch (mcpError) {
      console.error("[orchestrator] Erro MCP:", mcpError.message);
      mcpToolResults.push({
        tool: "mcp-error",
        error: mcpError.message,
      });
    }
  }

  // LLM: Explanation Service compoe a resposta
  const explanationResponse = await postJson(`${services.explanation}/compose`, {
    question,
    intent,
    knowledgeResults,
    mcpToolResults,
  });
  const explanation = explanationResponse.result;

  return {
    ok: true,
    requestId,
    elapsedMs: Date.now() - startedAt,
    architectureMode: "fase-2-rag-mcp-llm",
    question,
    intent,
    answer: explanation.answer,
    composer: explanation.composer,
    model: explanation.model,
    sources: knowledgeResults.map((item) => ({
      id: item.doc.id,
      title: item.doc.title,
      source: item.doc.source,
      score: item.score,
      excerpt: item.doc.text.slice(0, 200) + (item.doc.text.length > 200 ? "..." : ""),
    })),
    mcpToolsUsed: mcpToolResults.map((t) => t.tool),
    services: {
      gateway: `http://localhost:${config.services.gateway.port}`,
      orchestrator: config.services.orchestrator.url,
      knowledge: services.knowledge,
      externalApi: services.externalApi,
      explanation: services.explanation,
    },
    flow: [
      "front-web",
      "gateway-service",
      "orchestrator-service",
      "knowledge-base-service (RAG)",
      "external-api-service (MCP)",
      "explanation-service (LLM)",
    ],
  };
}

function selectToolsByIntent(intent) {
  const map = {
    standings: ["get_driver_standings", "get_constructor_standings"],
    weather: ["get_weather"],
    penalty: ["get_race_control_messages"],
  };
  return map[intent.type] || [];
}

function parseToolResult(mcpResult) {
  try {
    const text = mcpResult.content?.[0]?.text || "{}";
    return JSON.parse(text);
  } catch {
    return { raw: mcpResult };
  }
}

server.listen(config.services.orchestrator.port, () => {
  console.log(`Orchestrator Service em http://localhost:${config.services.orchestrator.port}`);
});
