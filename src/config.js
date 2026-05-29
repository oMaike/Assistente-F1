import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function boolEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "sim"].includes(value.toLowerCase());
}

export const config = {
  port: numberEnv("PORT", 3000),
  services: {
    gateway: {
      port: numberEnv("GATEWAY_PORT", numberEnv("PORT", 3000)),
    },
    orchestrator: {
      port: numberEnv("ORCHESTRATOR_PORT", 3001),
      url: process.env.ORCHESTRATOR_SERVICE_URL || "http://localhost:3001",
    },
    knowledge: {
      port: numberEnv("KNOWLEDGE_SERVICE_PORT", 3002),
      url: process.env.KNOWLEDGE_SERVICE_URL || "http://localhost:3002",
    },
    externalApi: {
      port: numberEnv("EXTERNAL_API_SERVICE_PORT", 3003),
      url: process.env.EXTERNAL_API_SERVICE_URL || "http://localhost:3003",
    },
    explanation: {
      port: numberEnv("EXPLANATION_SERVICE_PORT", 3004),
      url: process.env.EXPLANATION_SERVICE_URL || "http://localhost:3004",
    },
  },
  rapidApi: {
    key: process.env.RAPIDAPI_KEY || "",
    host: process.env.RAPIDAPI_HOST || "f1-live-pulse.p.rapidapi.com",
    baseUrl:
      process.env.RAPIDAPI_BASE_URL ||
      `https://${process.env.RAPIDAPI_HOST || "f1-live-pulse.p.rapidapi.com"}`,
    timeoutMs: numberEnv("RAPIDAPI_TIMEOUT_MS", 7000),
    endpoints: {
      raceControl: process.env.F1_ENDPOINT_RACE_CONTROL || "",
      fiaDocuments: process.env.F1_ENDPOINT_FIA_DOCUMENTS || "",
      sessionInfo: process.env.F1_ENDPOINT_SESSION_INFO || "",
      timingData: process.env.F1_ENDPOINT_TIMING_DATA || "",
      driverStandings: process.env.F1_ENDPOINT_DRIVER_STANDINGS || "",
      constructorStandings: process.env.F1_ENDPOINT_CONSTRUCTOR_STANDINGS || "",
      weather: process.env.F1_ENDPOINT_WEATHER || "",
    },
  },
  llm: {
    apiKey: process.env.LLM_API_KEY || process.env.GROQ_API_KEY || "",
    model: process.env.LLM_MODEL || "llama-3.3-70b-versatile",
    baseUrl: process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1",
    maxTokens: numberEnv("LLM_MAX_TOKENS", 1024),
    temperature: Number(process.env.LLM_TEMPERATURE) || 0.5,
  },
};
