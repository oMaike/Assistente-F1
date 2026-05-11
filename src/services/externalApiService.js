import { createServer } from "node:http";

import { config } from "../config.js";
import { sendError, sendJson } from "../utils/http.js";

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, buildStatus());
    return;
  }

  if (req.method === "GET" && url.pathname === "/status") {
    sendJson(res, 200, buildStatus());
    return;
  }

  sendError(res, 404, "Rota nao encontrada no External API Service.");
});

function buildStatus() {
  return {
    ok: true,
    service: "external-api-service",
    phase: "fase-1",
    role: "Representa a ferramenta externa prevista na arquitetura.",
    provider: "RapidAPI F1 Live Pulse",
    hostConfigured: Boolean(config.rapidApi.host),
    keyConfigured: Boolean(config.rapidApi.key),
    liveCallsEnabled: false,
    note: "Na Fase 1 o servico nao invoca a API como ferramenta. A integracao operacional fica para fase futura.",
  };
}

server.listen(config.services.externalApi.port, () => {
  console.log(`External API Service em http://localhost:${config.services.externalApi.port}`);
});
