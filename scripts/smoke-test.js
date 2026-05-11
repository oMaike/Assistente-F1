import assert from "node:assert/strict";

import { classifyIntent } from "../src/core/intentClassifier.js";
import { KnowledgeSearch } from "../src/core/knowledgeSearch.js";
import { ResponseComposer } from "../src/core/responseComposer.js";

const question = "O que significa track limits?";
const intent = classifyIntent(question);
const knowledge = new KnowledgeSearch();
const composer = new ResponseComposer();
const knowledgeResults = knowledge.lookup(question);

const result = composer.compose({
  question,
  intent,
  knowledgeResults,
  externalStatus: {
    ok: true,
    provider: "RapidAPI F1 Live Pulse",
    liveCallsEnabled: false,
  },
});

assert.match(result.answer, /Track limits/i);
assert.match(result.answer, /Fase 1/i);
assert.ok(knowledgeResults.length > 0);

console.log("Smoke test ok");
