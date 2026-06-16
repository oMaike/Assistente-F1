import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const runtimeDir = resolve(process.cwd(), ".runtime");

export const runtimePaths = {
  runtimeDir,
  knowledgeIndexActive: resolve(runtimeDir, "knowledge-index.active.json"),
  knowledgeIndexBackup: resolve(runtimeDir, "knowledge-index.backup.json"),
  getKnowledgeIndexStaging(sagaId) {
    return resolve(runtimeDir, `knowledge-index.${sagaId}.staging.json`);
  },
  f1CacheActive: resolve(runtimeDir, "f1-cache.active.json"),
  f1CacheBackup: resolve(runtimeDir, "f1-cache.backup.json"),
  getF1CacheStaging(sagaId) {
    return resolve(runtimeDir, `f1-cache.${sagaId}.staging.json`);
  },
};

export async function ensureRuntimeDir() {
  await mkdir(runtimePaths.runtimeDir, { recursive: true });
  return runtimePaths.runtimeDir;
}