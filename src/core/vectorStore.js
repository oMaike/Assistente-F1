import { readFile, writeFile } from "node:fs/promises";

import { embedText, embedBatch } from "./embedder.js";

function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

export class VectorStore {
  constructor(documents = []) {
    this.documents = documents;
    this.items = documents;
    this.embeddings = [];
    this.ready = false;
  }

  async build({ snapshotPath } = {}) {
    if (this.documents.length === 0) {
      this.ready = true;
      if (snapshotPath) {
        await this.saveSnapshot(snapshotPath);
      }
      return;
    }
    const texts = this.documents.map((doc) => `${doc.title} ${doc.text}`);
    this.embeddings = await embedBatch(texts);
    this.ready = true;
    console.log(`[vectorStore] Indexados ${this.documents.length} documentos.`);

    if (snapshotPath) {
      await this.saveSnapshot(snapshotPath);
    }
  }

  async saveSnapshot(snapshotPath) {
    const payload = {
      ready: this.ready,
      generatedAt: new Date().toISOString(),
      documents: this.documents,
      embeddings: this.embeddings,
    };

    await writeFile(snapshotPath, JSON.stringify(payload, null, 2), "utf8");
  }

  static async loadSnapshot(snapshotPath) {
    const raw = await readFile(snapshotPath, "utf8");
    const payload = JSON.parse(raw);
    const store = new VectorStore(payload.documents || []);
    store.embeddings = payload.embeddings || [];
    store.ready = Boolean(payload.ready);
    return store;
  }

  async search(question, { limit = 3 } = {}) {
    if (!this.ready) {
      throw new Error("VectorStore nao inicializado. Chame build() antes de search().");
    }
    if (this.documents.length === 0) {
      return [];
    }

    const queryEmbedding = await embedText(question);
    const results = [];

    for (let i = 0; i < this.embeddings.length; i++) {
      const score = dotProduct(queryEmbedding, this.embeddings[i]);
      results.push({ doc: this.documents[i], score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
}
