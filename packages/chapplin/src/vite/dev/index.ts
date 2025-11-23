import type { Plugin } from "vite";
import { minifySupportPlugin, toolResolverPlugin } from "../shared/client.js";
import type { Options } from "../types.js";

const toolsDir = "src/tools";

export function chapplinDev(opts: Options): Plugin[] {
	const id = "virtual:chapplin";
	const resolveId = `\0${id}`;
	return [
		minifySupportPlugin(),
		toolResolverPlugin({
			target: opts.target,
			tsconfigPath: opts.tsconfigPath,
			// apply: "serve",
		}),
		{
			name: "chapplin:dev",
			apply: "serve",
			configureServer(server) {
				server.middlewares.use(async (req, res, next) => {
					if (req.url?.startsWith("/tools/")) {
						res.setHeader("content-type", "text/html");
						res.end(
							`<!doctype html><html><body>
<div id="app"></div>
<script type="module" src="/src${req.url}"></script>`,
						);
						return;
					}
					next();
				});
			},
			resolveId: {
				order: "pre",
				filter: { id: new RegExp(`^${id}$`) },
				async handler(source, _importer, _options) {
					if (source === id) return resolveId;
				},
			},
			load: {
				order: "pre",
				filter: { id: new RegExp(`^${resolveId}$`) },
				async handler(id, _options) {
					if (id !== resolveId) return;
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
		},
	];
}
