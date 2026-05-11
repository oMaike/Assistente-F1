import { createServer } from "node:http";

import { config } from "../config.js";
import { classifyIntent } from "../core/intentClassifier.js";
import { readJsonBody, sendError, sendJson } from "../utils/http.js";
import { getJson, postJson } from "../utils/serviceClient.js";

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
      phase: "fase-1",
      role: "Controle: coordena os componentes distribuidos da arquitetura.",
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

  const knowledgeResponse = await postJson(`${services.knowledge}/lookup`, { question });
  const knowledgeResults = knowledgeResponse.results || [];

  const externalStatusResponse = await getJson(`${services.externalApi}/status`);
  const externalStatus = externalStatusResponse.body;

  const explanationResponse = await postJson(`${services.explanation}/compose`, {
    question,
    intent,
    knowledgeResults,
    externalStatus,
  });
  const explanation = explanationResponse.result;

  return {
    ok: true,
    requestId,
    elapsedMs: Date.now() - startedAt,
    architectureMode: "fase-1-distributed-architecture",
    question,
    intent,
    answer: explanation.answer,
    composer: explanation.composer,
    phaseNotice:
      "Somente Fase 1: arquitetura distribuida. Recuperacao avancada, modelo generativo externo e protocolo de ferramentas nao estao implementados nesta etapa.",
    sources: knowledgeResults.map((item) => ({
      id: item.doc.id,
      title: item.doc.title,
      source: item.doc.source,
      score: item.score,
      excerpt: item.doc.text,
    })),
    externalContext: summarizeExternalStatus(externalStatus),
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
      "knowledge-base-service",
      "external-api-service",
      "explanation-service",
    ],
  };
}

function summarizeExternalStatus(status) {
  return {
    ok: Boolean(status?.ok),
    provider: status?.provider,
    keyConfigured: Boolean(status?.keyConfigured),
    liveCallsEnabled: Boolean(status?.liveCallsEnabled),
    reason: status?.note,
  };
}

server.listen(config.services.orchestrator.port, () => {
  console.log(`Orchestrator Service em http://localhost:${config.services.orchestrator.port}`);
});
