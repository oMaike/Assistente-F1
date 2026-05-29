import { pipeline } from "@xenova/transformers";

let extractorPromise = null;

async function getExtractor() {
  if (!extractorPromise) {
    console.log("[embedder] Carregando modelo Xenova/all-MiniLM-L6-v2 (primeira vez pode demorar)...");
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      revision: "main",
      quantized: true,
    });
  }
  return extractorPromise;
}

export async function embedText(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data);
}

export async function embedBatch(texts) {
  const extractor = await getExtractor();
  const output = await extractor(texts, {
    pooling: "mean",
    normalize: true,
  });

  // Output e um Tensor unico com shape [batchSize, embeddingDim]
  const [batchSize, embeddingDim] = output.dims;
  const embeddings = [];
  for (let i = 0; i < batchSize; i++) {
    const start = i * embeddingDim;
    const end = start + embeddingDim;
    embeddings.push(Array.from(output.data.slice(start, end)));
  }
  return embeddings;
}
