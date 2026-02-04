import { Hono } from "hono";
import { logger } from "hono/logger";
import { getCollectedFiles } from "./file-collector.js";

/**
 * Hono API app for dev server
 * This is exported so that the type can be used by dev-ui for RPC
 * Base path is set to /__chapplin__/api
 */
export const app = new Hono()
	.use(logger())
	.get("/files", async (c) => {
		const files = await getCollectedFiles();
		return c.json(files);
	})
	.post("/tools/:name/execute", async (c) => {
		c.req.param("name");
		await c.req.json();
		// TODO: Implement tool execution
		return c.json({ success: false, error: "Not implemented" });
	})
	.get("/server/status", async (c) => {
		return c.json({ status: "running" });
	});

// Export type for RPC client
export type ApiType = typeof app;
