#!/usr/bin/env node
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const app = createMcpExpressApp();

app.get("/health", (_req: any, res: any) => {
  res.status(200).json({ ok: true, service: "intenttext-mcp-http" });
});

app.post("/mcp", async (req: any, res: any) => {
  const server = createServer();

  try {
    // Stateless mode is simpler for hosted HTTP deployments.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    res.on("close", () => {
      transport.close().catch(() => undefined);
      server.close().catch(() => undefined);
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
    // eslint-disable-next-line no-console
    console.error("Error handling MCP request", error);
  }
});

app.get("/mcp", (_req: any, res: any) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. Use POST /mcp",
    },
    id: null,
  });
});

app.delete("/mcp", (_req: any, res: any) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. Use POST /mcp",
    },
    id: null,
  });
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

app.listen(port, host, (error?: Error) => {
  if (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to start HTTP MCP wrapper", error);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(
    `IntentText MCP HTTP wrapper listening on http://${host}:${port}/mcp`,
  );
});
