function normalizeWhitespace(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function splitIntoSentences(text) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  return normalized.match(/[^.!?]+[.!?]*\s*/g)?.map((part) => part.trim()).filter(Boolean) || [normalized];
}

function sliceLongText(text, chunkSize, overlap) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    const chunkText = text.slice(start, end).trim();
    if (chunkText) {
      chunks.push(chunkText);
    }

    if (end === text.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

export function buildDocumentChunks(documents, { chunkSize = 420, overlap = 80 } = {}) {
  const chunks = [];

  for (const doc of documents) {
    const text = normalizeWhitespace(doc.text);
    if (!text) {
      continue;
    }

    const sentences = splitIntoSentences(text);
    const collected = [];
    let buffer = "";

    const flushBuffer = () => {
      const trimmed = buffer.trim();
      if (trimmed) {
        collected.push(trimmed);
      }
      buffer = "";
    };

    for (const sentence of sentences) {
      if (sentence.length >= chunkSize) {
        flushBuffer();
        collected.push(...sliceLongText(sentence, chunkSize, overlap));
        continue;
      }

      const projectedLength = buffer.length === 0 ? sentence.length : buffer.length + 1 + sentence.length;
      if (projectedLength > chunkSize && buffer.length > 0) {
        flushBuffer();
      }

      buffer = buffer.length === 0 ? sentence : `${buffer} ${sentence}`;
    }

    flushBuffer();

    if (collected.length === 0) {
      collected.push(text);
    }

    collected.forEach((chunkText, index) => {
      chunks.push({
        id: `${doc.id}::chunk-${index + 1}`,
        docId: doc.id,
        chunkIndex: index + 1,
        chunkCount: collected.length,
        title: doc.title,
        source: doc.source,
        tags: Array.isArray(doc.tags) ? doc.tags : [],
        text: chunkText,
      });
    });
  }

  return chunks;
}