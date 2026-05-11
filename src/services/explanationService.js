import { createServer } from "node:http";

import { config } from "../config.js";
import { ResponseComposer } from "../core/responseComposer.js";
import { readJsonBody, sendError, sendJson } from "../utils/http.js";

const composer = new ResponseComposer();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "explanation-service",
      phase: "fase-1",
      role: "Monta resposta textual com template; modelo generativo real fica para fase futura.",
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/compose") {
    try {
      const body = await readJsonBody(req);
      const result = composer.compose({
        question: body.question,
        intent: body.intent,
        knowledgeResults: body.knowledgeResults || [],
        externalStatus: body.externalStatus,
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

server.listen(config.services.explanation.port, () => {
  console.log(`Explanation Service em http://localhost:${config.services.explanation.port}`);
});
