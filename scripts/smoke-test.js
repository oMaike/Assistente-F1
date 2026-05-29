import assert from "node:assert/strict";

import { classifyIntent } from "../src/core/intentClassifier.js";
import { KnowledgeSearch } from "../src/core/knowledgeSearch.js";
import { embedText } from "../src/core/embedder.js";

console.log("[smoke-test] Iniciando testes Fase 2...");

// Teste 1: Embedder
console.log("[smoke-test] Testando embedder...");
const embedding = await embedText("track limits");
assert.ok(Array.isArray(embedding), "Embedding deve ser um array");
assert.ok(embedding.length > 0, "Embedding nao deve estar vazio");
console.log("[smoke-test] Embedder OK (dimensao:", embedding.length, ")");

// Teste 2: KnowledgeSearch vetorial
console.log("[smoke-test] Testando busca vetorial...");
const knowledge = new KnowledgeSearch();
await knowledge.init();
const results = await knowledge.lookup("O que significa track limits?");
assert.ok(results.length > 0, "Deve retornar documentos relevantes");
assert.match(results[0].doc.title, /Track limits/i, "Primeiro resultado deve ser sobre track limits");
console.log("[smoke-test] Busca vetorial OK (", results.length, "resultados)");

// Teste 3: Classificador de intencao
console.log("[smoke-test] Testando classificador de intencao...");
const intent1 = classifyIntent("O que significa track limits?");
assert.strictEqual(intent1.type, "rule", "Track limits deve ser classificado como rule");
const intent2 = classifyIntent("Como esta a classificacao dos pilotos?");
assert.strictEqual(intent2.type, "standings", "Classificacao deve ser standings");
const intent3 = classifyIntent("Vai chover na corrida?");
assert.strictEqual(intent3.type, "weather", "Chuva deve ser weather");
console.log("[smoke-test] Classificador OK");

// Teste 4: Ferramentas MCP
console.log("[smoke-test] Testando ferramentas MCP...");
const { executeF1Tool } = await import("../src/mcp/f1Tools.js");
const toolResult = await executeF1Tool("get_weather");
assert.ok(toolResult.content, "Ferramenta deve retornar content");
const parsed = JSON.parse(toolResult.content[0].text);
assert.ok(parsed.weather, "Resultado deve conter dados de clima");
console.log("[smoke-test] Ferramentas MCP OK");

console.log("\nSmoke test Fase 2: TUDO OK");
