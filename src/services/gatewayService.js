import { createServer } from "node:http";
import { resolve } from "node:path";

import { config } from "../config.js";
import { readJsonBody, sendError, sendJson, serveStatic } from "../utils/http.js";
import { getJson, postJson } from "../utils/serviceClient.js";

const publicDir = resolve(process.cwd(), "public");
const orchestratorUrl = config.services.orchestrator.url;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    const orchestrator = await getJson(`${orchestratorUrl}/health`);
    sendJson(res, 200, {
      ok: true,
      service: "gateway-service",
      role: "Entrada publica: serve front-end e repassa chamadas para o orquestrador.",
      downstream: { orchestrator },
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/architecture") {
    sendJson(res, 200, {
      ok: true,
      mode: "distributed-microservices",
      phase: "fase-2",
      services: [
        { name: "Gateway Service", port: config.services.gateway.port },
        { name: "Orchestrator Service", port: config.services.orchestrator.port },
        { name: "Knowledge Base Service (RAG)", port: config.services.knowledge.port },
        { name: "External API Service (MCP Server)", port: config.services.externalApi.port },
        { name: "Explanation Service (LLM)", port: config.services.explanation.port },
      ],
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/ask") {
    try {
      const body = await readJsonBody(req);
      const result = await postJson(`${orchestratorUrl}/ask`, body, { timeoutMs: 15000 });
      sendJson(res, 200, result);
    } catch (error) {
      sendError(res, error.statusCode || 502, error.message);
    }
    return;
  }

  if (req.method === "GET") {
    await serveStatic(req, res, publicDir);
    return;
  }

  sendError(res, 405, "Metodo nao permitido.");
});

server.listen(config.services.gateway.port, () => {
  console.log(`Gateway Service em http://localhost:${config.services.gateway.port}`);
});
