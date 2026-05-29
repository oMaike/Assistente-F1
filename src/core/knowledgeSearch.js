import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { VectorStore } from "./vectorStore.js";

function loadDocuments() {
  const docsPath = resolve(process.cwd(), "src/data/f1-documents.json");
  const raw = readFileSync(docsPath, "utf8");
  return JSON.parse(raw);
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const STOP_WORDS = new Set([
  "o", "a", "os", "as", "um", "uma", "uns", "umas",
  "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
  "por", "para", "com", "sem", "sob", "sobre", "entre", "ate",
  "e", "ou", "mas", "que", "se", "como", "porque", "pois",
  "qual", "quais", "quem", "cujo", "cuja", "cujos", "cujas",
  "quando", "onde",
  "este", "esta", "estes", "estas", "esse", "essa", "esses", "essas",
  "aquele", "aquela", "aqueles", "aquelas",
  "muito", "pouco", "todo", "toda", "todos", "todas",
  "ser", "estar", "ter", "fazer", "ha", "sao", "foi", "nao", "sim",
  "ja", "ainda", "so", "apenas", "bem", "mais", "menos",
  "aqui", "ai", "la", "agora", "depois", "assim", "tambem",
  "sistema", "formula", "significa", "significar",
  "pergunta", "resposta", "explicar", "explicacao", "funcionar", "funciona",
  "significado", "significar",
]);

// Abreviacoes e termos tecnicos especificos de F1 que merecem busca direta
const F1_TECH_TERMS = [
  "ers", "drs", "vsc", "halo", "mguk", "mguh", "mguk",
  "budget cap", "parc ferme", "track limits", "safety car",
  "virtual safety car", "red flag", "blue flag", "yellow flag",
  "green flag", "black flag", "chequered flag", "pit lane",
  "undercut", "overcut", "power unit", "drag reduction",
  "formation lap", "jump start", "grid penalty",
];

function findF1Terms(question) {
  const normalized = normalize(question);
  const found = [];
  for (const term of F1_TECH_TERMS) {
    if (normalized.includes(normalize(term))) {
      found.push(term);
    }
  }
  return found;
}

function extractMeaningfulTerms(question) {
  return normalize(question)
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

function exactKeywordMatches(question, documents) {
  const queryTerms = extractMeaningfulTerms(question);
  if (queryTerms.length === 0) return new Set();

  const matchedIds = new Set();
  for (const doc of documents) {
    const tokens = normalize(`${doc.title} ${doc.tags.join(" ")}`)
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length >= 2);

    const textTokens = normalize(doc.text)
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length >= 2);

    if (queryTerms.some((term) => tokens.includes(term))) {
      matchedIds.add(doc.id);
      continue;
    }

    if (queryTerms.some((term) => term.length >= 4 && textTokens.includes(term))) {
      matchedIds.add(doc.id);
    }
  }
  return matchedIds;
}

function findDirectTermMatches(question, documents) {
  const f1Terms = findF1Terms(question);
  if (f1Terms.length === 0) return new Set();

  const matchedIds = new Set();
  for (const doc of documents) {
    const tokens = normalize(`${doc.title} ${doc.tags.join(" ")} ${doc.text.slice(0, 500)}`)
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length >= 2);

    if (f1Terms.some((term) => tokens.includes(normalize(term)))) {
      matchedIds.add(doc.id);
    }
  }
  return matchedIds;
}

export class KnowledgeSearch {
  constructor() {
    this.documents = loadDocuments();
    this.vectorStore = new VectorStore(this.documents);
  }

  async init() {
    await this.vectorStore.build();
  }

  async lookup(question, { limit = 5 } = {}) {
    const vectorResults = await this.vectorStore.search(question, { limit: limit * 3 });
    const exactMatches = exactKeywordMatches(question, this.documents);
    const directMatches = findDirectTermMatches(question, this.documents);

    const merged = new Map();

    for (const item of vectorResults) {
      merged.set(item.doc.id, { doc: item.doc, score: item.score });
    }

    for (const [id, entry] of merged) {
      if (exactMatches.has(id)) {
        entry.score += 0.4;
      }
      if (directMatches.has(id)) {
        entry.score += 0.8; // boost maior para termos tecnicos especificos
      }
    }

    for (const doc of this.documents) {
      if (!merged.has(doc.id)) {
        if (directMatches.has(doc.id)) {
          merged.set(doc.id, { doc, score: 0.8 });
        } else if (exactMatches.has(doc.id)) {
          merged.set(doc.id, { doc, score: 0.35 });
        }
      }
    }

    const sorted = Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return sorted.map((item) => ({
      doc: item.doc,
      score: Math.round(item.score * 1000) / 1000,
    }));
  }
}
