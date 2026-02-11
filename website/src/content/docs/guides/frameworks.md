---
title: Framework Integration
description: Integrate Chapplin with server frameworks and UI libraries
---

Chapplin is server-framework agnostic. You can use any HTTP framework as long as it can handle the MCP transport.

## Server Frameworks

### Hono (Recommended)

```ts
// src/index.ts
import { register } from "chapplin:register";
import { StreamableHTTPTransport } from "@hono/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";

const app = new Hono();

app.all("/mcp", async (c) => {
  const server = new McpServer({ name: "my-server", version: "1.0.0" });
  register(server);
  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  return transport.handleRequest(c);
});

export default app;
```

### Express

```ts
import express from "express";
import { register } from "chapplin:register";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from
  "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();
app.use(express.json());

app.all("/mcp", async (req, res) => {
  const server = new McpServer({ name: "my-server", version: "1.0.0" });
  register(server);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3000);
```

## UI Targets

Set the UI target in `chapplin()`:

```ts
chapplin({ target: "react" }); // or preact / solid / hono
```

Supported JSX targets:
- React
- Preact
- Solid
- Hono (`hono/jsx`)
