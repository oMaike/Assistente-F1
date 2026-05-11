import { createServer } from "node:http";

import { config } from "../config.js";
import { KnowledgeSearch } from "../core/knowledgeSearch.js";
import { readJsonBody, sendError, sendJson } from "../utils/http.js";

const knowledge = new KnowledgeSearch();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "knowledge-base-service",
      phase: "fase-1",
      role: "Base de conhecimento local para demonstrar componente distribuido.",
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/lookup") {
    try {
      const body = await readJsonBody(req);
      const question = String(body.question || "").trim();
      const results = knowledge.lookup(question).map((item) => ({
        doc: item.doc,
        score: item.score,
      }));
      sendJson(res, 200, {
        ok: true,
        service: "knowledge-base-service",
        results,
      });
    } catch (error) {
      sendError(res, error.statusCode || 500, error.message);
    }
    return;
  }

  sendError(res, 404, "Rota nao encontrada no Knowledge Base Service.");
});

server.listen(config.services.knowledge.port, () => {
  console.log(`Knowledge Base Service em http://localhost:${config.services.knowledge.port}`);
});
