import { access, copyFile, readFile, rename, unlink } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildDocumentChunks } from "./documentChunker.js";
import { VectorStore } from "./vectorStore.js";
import { ensureRuntimeDir, runtimePaths } from "../utils/runtimePaths.js";

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
  "significado",
]);

const F1_TECH_TERMS = [
  "ers", "drs", "vsc", "halo", "mguk", "mguh",
  "budget cap", "parc ferme", "track limits", "safety car",
  "virtual safety car", "red flag", "blue flag", "yellow flag",
  "green flag", "black flag", "chequered flag", "pit lane",
  "undercut", "overcut", "power unit", "drag reduction",
  "formation lap", "jump start", "grid penalty",
];

function findF1Terms(question) {
  const normalized = normalize(question);
  return F1_TECH_TERMS.filter((term) => normalized.includes(normalize(term)));
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
    const tokens = normalize(`${doc.title} ${Array.isArray(doc.tags) ? doc.tags.join(" ") : ""}`)
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
    const tokens = normalize(`${doc.title} ${Array.isArray(doc.tags) ? doc.tags.join(" ") : ""} ${doc.text.slice(0, 500)}`)
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length >= 2);

    if (f1Terms.some((term) => tokens.includes(normalize(term)))) {
      matchedIds.add(doc.id);
    }
  }

  return matchedIds;
}

function groupChunksByDocument(chunks) {
  const grouped = new Map();
  for (const chunk of chunks) {
    const list = grouped.get(chunk.docId) || [];
    list.push(chunk);
    grouped.set(chunk.docId, list);
  }
  return grouped;
}

function buildResponseDoc(original, chunk) {
  return {
    ...original,
    text: chunk.text,
    chunkId: chunk.id,
    chunkIndex: chunk.chunkIndex,
    chunkCount: chunk.chunkCount,
  };
}

export class KnowledgeSearch {
  constructor() {
    this.documents = loadDocuments();
    this.chunkedDocuments = buildDocumentChunks(this.documents);
    this.vectorStore = new VectorStore(this.chunkedDocuments);
    this.snapshotState = {
      active: null,
      pending: null,
      history: [],
    };
  }

  async init({ useSnapshot = true } = {}) {
    await ensureRuntimeDir();

    if (useSnapshot && await this.snapshotExists(runtimePaths.knowledgeIndexActive)) {
      this.vectorStore = await VectorStore.loadSnapshot(runtimePaths.knowledgeIndexActive);
      this.chunkedDocuments = this.vectorStore.documents;
      this.snapshotState.active = this.buildSnapshotMeta("active", runtimePaths.knowledgeIndexActive, this.vectorStore.documents.length);
      return;
    }

    await this.rebuildIndex({ persistPath: runtimePaths.knowledgeIndexActive, stageLabel: "initial" });
  }

  async snapshotExists(snapshotPath) {
    try {
      await access(snapshotPath);
      return true;
    } catch {
      return false;
    }
  }

  buildSnapshotMeta(status, path, chunks) {
    return {
      status,
      path,
      chunks,
      updatedAt: new Date().toISOString(),
    };
  }

  async rebuildIndex({ persistPath, stageLabel = "reindex" } = {}) {
    this.chunkedDocuments = buildDocumentChunks(this.documents);
    this.vectorStore = new VectorStore(this.chunkedDocuments);
    await this.vectorStore.build({ snapshotPath: persistPath });
    this.snapshotState.active = this.buildSnapshotMeta(stageLabel, persistPath || null, this.vectorStore.documents.length);
    this.snapshotState.pending = null;
    return this.snapshotState.active;
  }

  async stageSagaReindex(sagaId) {
    await ensureRuntimeDir();
    const stagingPath = runtimePaths.getKnowledgeIndexStaging(sagaId);
    const stagedChunks = buildDocumentChunks(this.documents);
    const stagedStore = new VectorStore(stagedChunks);
    await stagedStore.build({ snapshotPath: stagingPath });

    this.snapshotState.pending = {
      sagaId,
      status: "staged",
      stagingPath,
      chunks: stagedStore.documents.length,
      createdAt: new Date().toISOString(),
    };

    return {
      sagaId,
      status: "staged",
      chunks: stagedStore.documents.length,
      stagingPath,
    };
  }

  async commitSagaReindex(sagaId) {
    const pending = this.snapshotState.pending;
    if (!pending || pending.sagaId !== sagaId) {
      throw new Error("Nao existe saga de conhecimento em andamento para commit.");
    }

    const activePath = runtimePaths.knowledgeIndexActive;
    const backupPath = runtimePaths.knowledgeIndexBackup;

    if (await this.snapshotExists(activePath)) {
      await copyFile(activePath, backupPath);
    }

    await rename(pending.stagingPath, activePath);
    this.vectorStore = await VectorStore.loadSnapshot(activePath);
    this.chunkedDocuments = this.vectorStore.documents;
    this.snapshotState.active = this.buildSnapshotMeta("active", activePath, this.vectorStore.documents.length);
    this.snapshotState.pending = null;

    return {
      sagaId,
      status: "committed",
      activePath,
      chunks: this.vectorStore.documents.length,
    };
  }

  async rollbackSagaReindex(sagaId, { restoreActive = false } = {}) {
    const pending = this.snapshotState.pending;
    const stagingPath = pending?.stagingPath || runtimePaths.getKnowledgeIndexStaging(sagaId);

    try {
      if (await this.snapshotExists(stagingPath)) {
        await unlink(stagingPath);
      }
    } catch {
      // limpeza best-effort
    }

    if (restoreActive) {
      const activePath = runtimePaths.knowledgeIndexActive;
      const backupPath = runtimePaths.knowledgeIndexBackup;
      if (await this.snapshotExists(backupPath)) {
        await copyFile(backupPath, activePath);
        this.vectorStore = await VectorStore.loadSnapshot(activePath);
        this.chunkedDocuments = this.vectorStore.documents;
        this.snapshotState.active = this.buildSnapshotMeta("restored", activePath, this.vectorStore.documents.length);
      }
    }

    this.snapshotState.pending = null;
    return {
      sagaId,
      status: restoreActive ? "restored" : "rolled-back",
    };
  }

  getHealthSnapshot() {
    return {
      documents: this.documents.length,
      chunks: this.chunkedDocuments.length,
      active: this.snapshotState.active,
      pending: this.snapshotState.pending,
    };
  }

  async lookup(question, { limit = 5 } = {}) {
    const vectorResults = await this.vectorStore.search(question, { limit: limit * 4 });
    const exactMatches = exactKeywordMatches(question, this.documents);
    const directMatches = findDirectTermMatches(question, this.documents);
    const chunksByDocument = groupChunksByDocument(this.chunkedDocuments);

    const merged = new Map();

    for (const item of vectorResults) {
      const chunk = item.doc;
      const original = this.documents.find((doc) => doc.id === chunk.docId);
      if (!original) {
        continue;
      }

      const score = item.score + (directMatches.has(original.id) ? 0.2 : 0) + (exactMatches.has(original.id) ? 0.1 : 0);
      const existing = merged.get(original.id);
      const responseDoc = buildResponseDoc(original, chunk);

      if (!existing || score > existing.score) {
        merged.set(original.id, { doc: responseDoc, score });
      }
    }

    for (const [id, entry] of merged) {
      if (exactMatches.has(id)) {
        entry.score += 0.4;
      }
      if (directMatches.has(id)) {
        entry.score += 0.8;
      }
    }

    for (const doc of this.documents) {
      if (!merged.has(doc.id)) {
        const firstChunk = chunksByDocument.get(doc.id)?.[0];
        if (directMatches.has(doc.id) && firstChunk) {
          merged.set(doc.id, { doc: buildResponseDoc(doc, firstChunk), score: 0.8 });
        } else if (exactMatches.has(doc.id) && firstChunk) {
          merged.set(doc.id, { doc: buildResponseDoc(doc, firstChunk), score: 0.35 });
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
