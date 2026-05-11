import { spawn } from "node:child_process";

const services = [
  ["knowledge-base-service", "src/services/knowledgeBaseService.js"],
  ["external-api-service", "src/services/externalApiService.js"],
  ["explanation-service", "src/services/explanationService.js"],
  ["orchestrator-service", "src/services/orchestratorService.js"],
  ["gateway-service", "src/services/gatewayService.js"],
];

let shuttingDown = false;

const children = services.map(([name, entry]) => {
  const child = spawn(process.execPath, [entry], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`[${name}] saiu com code=${code} signal=${signal}`);
      shutdown(1);
    }
  });

  return child;
});

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 250);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Subindo arquitetura distribuida em JavaScript...");
console.log("Front/Gateway: http://localhost:3000");
