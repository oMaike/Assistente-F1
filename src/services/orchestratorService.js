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

let lastMaintenanceSaga = null;

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
      phase: "fase-3",
      role: "Controle: coordena RAG, MCP, LLM e a Saga de manutencao distribuida.",
      dependencies: { knowledge, externalApi, explanation },
      saga: lastMaintenanceSaga,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/saga/status") {
    sendJson(res, 200, {
      ok: true,
      service: "orchestrator-service",
      saga: lastMaintenanceSaga,
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/saga/reindex") {
    try {
      const result = await runMaintenanceSaga();
      sendJson(res, 200, result);
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message);
    }
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

  const knowledgeResponse = await postJson(`${services.knowledge}/lookup`, { question });
  const knowledgeResults = knowledgeResponse.results || [];

  const mcpToolResults = [];
  const toolsToCall = selectToolsByContext(question, intent);

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
    architectureMode: "fase-3-rag-mcp-llm-saga",
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
      chunkId: item.doc.chunkId,
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

async function runMaintenanceSaga() {
  const sagaId = crypto.randomUUID();
  const startedAt = Date.now();
  const steps = [];
  let knowledgeStarted = false;
  let knowledgeCommitted = false;
  let externalStarted = false;
  let externalCommitted = false;

  const record = (service, action, status, details = undefined) => {
    steps.push({ service, action, status, details, at: new Date().toISOString() });
  };

  try {
    const knowledgeStart = await postJson(`${services.knowledge}/saga/reindex/start`, { sagaId });
    knowledgeStarted = true;
    record("knowledge-base-service", "start", "ok", knowledgeStart.result);

    const externalStart = await postJson(`${services.externalApi}/saga/cache/start`, { sagaId });
    externalStarted = true;
    record("external-api-service", "start", "ok", externalStart.result);

    const knowledgeCommit = await postJson(`${services.knowledge}/saga/reindex/commit`, { sagaId });
    knowledgeCommitted = true;
    record("knowledge-base-service", "commit", "ok", knowledgeCommit.result);

    const externalCommit = await postJson(`${services.externalApi}/saga/cache/commit`, { sagaId });
    externalCommitted = true;
    record("external-api-service", "commit", "ok", externalCommit.result);

    const saga = {
      sagaId,
      status: "committed",
      startedAt: new Date(startedAt).toISOString(),
      elapsedMs: Date.now() - startedAt,
      steps,
    };

    lastMaintenanceSaga = saga;
    return { ok: true, service: "orchestrator-service", saga };
  } catch (error) {
    const rollbackResults = [];

    if (externalStarted) {
      try {
        const response = await postJson(`${services.externalApi}/saga/cache/rollback`, {
          sagaId,
          restoreActive: externalCommitted,
        });
        rollbackResults.push({ service: "external-api-service", status: "rolled-back", result: response.result });
      } catch (rollbackError) {
        rollbackResults.push({ service: "external-api-service", status: "rollback-failed", error: rollbackError.message });
      }
    }

    if (knowledgeStarted) {
      try {
        const response = await postJson(`${services.knowledge}/saga/reindex/rollback`, {
          sagaId,
          restoreActive: knowledgeCommitted,
        });
        rollbackResults.push({ service: "knowledge-base-service", status: "rolled-back", result: response.result });
      } catch (rollbackError) {
        rollbackResults.push({ service: "knowledge-base-service", status: "rollback-failed", error: rollbackError.message });
      }
    }

    const saga = {
      sagaId,
      status: rollbackResults.some((item) => item.status === "rollback-failed") ? "failed" : "compensated",
      startedAt: new Date(startedAt).toISOString(),
      elapsedMs: Date.now() - startedAt,
      steps,
      rollbackResults,
      error: error.message,
    };

    lastMaintenanceSaga = saga;
    return {
      ok: saga.status !== "failed",
      service: "orchestrator-service",
      saga,
    };
  }
}

function selectToolsByContext(question, intent) {
  const normalized = question.toLowerCase();
  const tools = new Set();

  if (intent.type === "standings" || /piloto|drivers?|pontos|classificacao/.test(normalized)) {
    tools.add("get_driver_standings");
  }

  if (intent.type === "standings" || /equipes|construtor|construtores/.test(normalized)) {
    tools.add("get_constructor_standings");
  }

  if (intent.type === "weather" || /clima|chuva|temperatura|tempo/.test(normalized)) {
    tools.add("get_weather");
  }

  if (intent.type === "penalty" || /penal|race control|comiss|investig|bandeira/.test(normalized)) {
    tools.add("get_race_control_messages");
  }

  if (/sessao|voltas?|circuito|treino|qualificacao|corrida/.test(normalized)) {
    tools.add("get_session_info");
  }

  return Array.from(tools);
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
