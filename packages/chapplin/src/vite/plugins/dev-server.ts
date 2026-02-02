import type { Plugin } from "vite";
import { id, idRegex, resolvedId, resolvedIdRegex } from "../id.js";

const toolsDir = "src/tools";

export function devServer(): Plugin {
	return {
		name: "chapplin:dev-server",
		apply: "serve",
		configureServer: {
			order: "pre",
			async handler(server) {
				server.middlewares.use(async (req, res, next) => {
					if (!req.url) return next();
					if (req.url.startsWith("/preview/tools/")) {
						res.setHeader("content-type", "text/html");
						res.end(
							`<!doctype html><html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body>
<iframe src="${req.url.replace(/^\/preview/, "")}"></iframe>`,
						);
						return;
					}
					if (req.url.startsWith("/tools/")) {
						res.setHeader("content-type", "text/html");
						res.end(
							`<!doctype html><html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body>
<div id="app"></div>
<script type="module" src="/src${req.url}"></script>`,
						);
						return;
					}
					next();
				});
			},
		},
		resolveId: {
			order: "pre",
			filter: { id: idRegex },
			async handler(source, _importer, _options) {
				if (source === id) return resolvedId;
			},
		},
		load: {
			order: "pre",
			filter: { id: resolvedIdRegex },
			async handler(id, _options) {
				if (id !== resolvedId) return;
				const toolFiles = await this.fs.readdir(toolsDir);
				return `
const container = document.getElementById('app');
const ul = document.createElement('ul');
const tools = [${toolFiles.map((f) => JSON.stringify(`/tools/${f}`)).join(",")}];
for (const toolPath of tools) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = toolPath;
  a.innerText = toolPath;
  li.appendChild(a);
  ul.appendChild(li);
}
container.appendChild(ul);
`;
			},
		},
	};
}
