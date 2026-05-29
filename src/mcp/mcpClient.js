import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export async function createMcpClient(baseUrl) {
  const sseUrl = new URL("/mcp/sse", baseUrl);
  const transport = new SSEClientTransport(sseUrl);
  const client = new Client(
    {
      name: "orchestrator-mcp-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);

  return {
    client,
    async listTools() {
      return await client.listTools();
    },
    async callTool(name, args = {}) {
      return await client.callTool({ name, arguments: args });
    },
    async close() {
      await client.close();
    },
  };
}
