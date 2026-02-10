import { hc } from "hono/client";
import type { ApiType } from "../../../src/vite/plugins/api-app.js";

// Create type-safe RPC client
export const client = hc<ApiType>("/api");
