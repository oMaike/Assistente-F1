import { createServer } from "node:http";

import { config } from "../config.js";
import { KnowledgeSearch } from "../core/knowledgeSearch.js";
import { readJsonBody, sendError, sendJson } from "../utils/http.js";

const knowledge = new KnowledgeSearch();

async function startServer() {
  await knowledge.init();

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "knowledge-base-service",
        phase: "fase-2",
        role: "Base de conhecimento com RAG: documentos reais + busca vetorial por embeddings.",
        documentsIndexed: knowledge.vectorStore.documents.length,
        searchType: "vector-embedding-cosine",
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/lookup") {
      try {
        const body = await readJsonBody(req);
        const question = String(body.question || "").trim();
        const results = await knowledge.lookup(question);
        sendJson(res, 200, {
          ok: true,
          service: "knowledge-base-service",
          phase: "fase-2",
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
}

startServer().catch((err) => {
  console.error("[knowledge-base-service] Falha ao iniciar:", err.message);
  process.exit(1);
});
