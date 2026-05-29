import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { f1Tools, executeF1Tool } from "./f1Tools.js";

const transports = new Map();

const mcpServer = new Server(
  {
    name: "f1-external-api-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: f1Tools };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  const result = await executeF1Tool(name);
  return result;
});

export async function handleMcpSse(req, res) {
  const transport = new SSEServerTransport("/mcp/messages", res);
  transports.set(transport.sessionId, transport);

  transport.onclose = () => {
    transports.delete(transport.sessionId);
  };

  // Server.connect() ja chama start() automaticamente no transport
  await mcpServer.connect(transport);
}

export async function handleMcpMessage(req, res, sessionId) {
  const transport = transports.get(sessionId);
  if (!transport) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Sessao MCP nao encontrada." }));
    return;
  }
  await transport.handlePostMessage(req, res);
}

export function getActiveSessionCount() {
  return transports.size;
}
