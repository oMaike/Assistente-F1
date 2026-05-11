import { ruleKnowledgeBase } from "./ruleKnowledgeBase.js";
import { normalize } from "./intentClassifier.js";

export class KnowledgeSearch {
  constructor(documents = ruleKnowledgeBase) {
    this.documents = documents;
  }

  lookup(question, { limit = 3 } = {}) {
    const queryTokens = tokenize(question);
    const results = this.documents
      .map((doc) => ({
        doc,
        score: scoreDocument(doc, queryTokens),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (results.length > 0) return results;
    return this.documents.slice(0, 2).map((doc) => ({ doc, score: 0.1 }));
  }
}

function scoreDocument(doc, queryTokens) {
  const haystack = tokenize(`${doc.title} ${doc.tags.join(" ")} ${doc.text}`);
  let score = 0;

  for (const token of queryTokens) {
    if (haystack.has(token)) score += 2;
    for (const tag of doc.tags) {
      const normalizedTag = normalize(tag);
      if (normalizedTag.includes(token) || token.includes(normalizedTag)) {
        score += 3;
      }
    }
  }

  return score;
}

function tokenize(value) {
  return new Set(
    normalize(value)
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length >= 3)
      .filter((token) => !STOP_WORDS.has(token)),
  );
}

const STOP_WORDS = new Set([
  "que",
  "quando",
  "como",
  "com",
  "para",
  "por",
  "uma",
  "um",
  "das",
  "dos",
  "de",
  "em",
  "ele",
  "ela",
  "isso",
  "significa",
  "gerar",
  "gera",
]);
