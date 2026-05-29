import { createServer } from "node:http";

import { config } from "../config.js";
import { sendError, sendJson } from "../utils/http.js";
import { handleMcpSse, handleMcpMessage, getActiveSessionCount } from "../mcp/mcpServer.js";

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "external-api-service",
      phase: "fase-2",
      role: "MCP Server com ferramentas RapidAPI F1. Exposicao de ferramentas via Model Context Protocol.",
      provider: "RapidAPI F1 Live Pulse",
      keyConfigured: Boolean(config.rapidApi.key),
      liveCallsEnabled: Boolean(config.rapidApi.key) && Boolean(config.rapidApi.endpoints.driverStandings),
      mcpSessions: getActiveSessionCount(),
      mcpEndpoint: "/mcp/sse",
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/status") {
    sendJson(res, 200, {
      ok: true,
      service: "external-api-service",
      phase: "fase-2",
      role: "MCP Server com ferramentas RapidAPI F1.",
      provider: "RapidAPI F1 Live Pulse",
      keyConfigured: Boolean(config.rapidApi.key),
      liveCallsEnabled: Boolean(config.rapidApi.key),
      tools: [
        "get_driver_standings",
        "get_constructor_standings",
        "get_race_control_messages",
        "get_weather",
        "get_session_info",
      ],
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/mcp/sse") {
    await handleMcpSse(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/mcp/messages") {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      sendError(res, 400, "sessionId e obrigatorio.");
      return;
    }
    await handleMcpMessage(req, res, sessionId);
    return;
  }

  sendError(res, 404, "Rota nao encontrada no External API Service.");
});

server.listen(config.services.externalApi.port, () => {
  console.log(`External API Service (MCP Server) em http://localhost:${config.services.externalApi.port}`);
});
