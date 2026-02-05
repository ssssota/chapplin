import type { Plugin, PluginOption, ResolvedConfig } from "vite";
import { build as viteBuild } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import type { ResolvedOptions } from "../types.js";
import { getCollectedFiles } from "./file-collector.js";

/** Plugin names to exclude from client build */
const EXCLUDED_PLUGIN_NAMES = new Set(["commonjs", "alias"]);

/** Cache for built app HTML */
const builtAppHtmlCache = new Map<string, string>();

/** Pending builds */
const pendingBuilds = new Map<string, Promise<string>>();

/** Build context for lazy building */
let buildContext: {
	config: ResolvedConfig;
	opts: ResolvedOptions;
	plugins: PluginOption[];
} | null = null;

/**
 * Get built HTML for a tool (used by virtual-module.ts)
 * This builds on-demand if not already built
 */
export async function getBuiltAppHtml(
	toolName: string,
): Promise<string | null> {
	// Check cache first
	if (builtAppHtmlCache.has(toolName)) {
		return builtAppHtmlCache.get(toolName) || null;
	}
	// Check if build is pending
	if (pendingBuilds.has(toolName)) {
		return pendingBuilds.get(toolName) || null;
	}

	// Build on demand
	if (buildContext) {
		const files = await getCollectedFiles();
		const tool = files.tools.find((t) => t.name === toolName && t.hasApp);
		if (tool) {
			const buildPromise = buildClientApp({
				file: tool.path,
				name: tool.name,
				plugins: buildContext.plugins,
				target: buildContext.opts.target,
			}).then(([, html]) => {
				builtAppHtmlCache.set(toolName, html);
				pendingBuilds.delete(toolName);
				return html;
			});

			pendingBuilds.set(toolName, buildPromise);
			return buildPromise;
		}
	}

	return null;
}

/**
 * Plugin that builds UI tools into single HTML files
 */
export function clientBuild(opts: ResolvedOptions): Plugin {
	let config: ResolvedConfig;

	return {
		name: "chapplin:client-build",
		configResolved(resolvedConfig) {
			config = resolvedConfig;
		},
		buildStart() {
			// Clear cache at build start
			builtAppHtmlCache.clear();
			pendingBuilds.clear();

			// Set up build context for lazy building
			buildContext = {
				config,
				opts,
				plugins: getClientBuildPlugins(config, opts),
			};
		},
		buildEnd() {
			// Clear build context
			buildContext = null;
		},
	};
}

/**
 * Get plugins for client build
 */
function getClientBuildPlugins(
	config: ResolvedConfig,
	_opts: ResolvedOptions,
): PluginOption[] {
	// Framework plugin prefixes to keep
	const KEEP_PREFIXES = [
		"vite:react", // React (vite:react-babel, vite:react-refresh, etc.)
		"vite:preact", // Preact
		"vite:vue", // Vue
		"vite:svelte", // Svelte
		"solid", // Solid.js (vite-plugin-solid)
	];

	const plugins: PluginOption[] = [
		viteSingleFile(),
		// Filter plugins - keep framework plugins, filter out chapplin and internal vite plugins
		...config.plugins.filter((p) => {
			if (p.name.startsWith("chapplin:")) return false;
			// Keep framework plugins
			if (KEEP_PREFIXES.some((prefix) => p.name.startsWith(prefix)))
				return true;
			// Filter out other vite internal plugins
			if (p.name.startsWith("vite:")) return false;
			if (EXCLUDED_PLUGIN_NAMES.has(p.name)) return false;
			return true;
		}),
	];

	return plugins;
}

interface BuildContext {
	file: string;
	name: string;
	plugins: PluginOption[];
	target: string | undefined;
}

/**
 * Build a single MCP App into HTML
 */
async function buildClientApp(
	context: BuildContext,
): Promise<[string, string]> {
	// Create virtual IDs with null byte prefix
	const ENTRY_ID = "\0virtual:chapplin-entry.js";
	const HTML_ID = "\0virtual:chapplin-entry.html";

	// Create a virtual entry that renders the App
	const entryPlugin: Plugin = {
		name: "chapplin:client-entry",
		resolveId(id) {
			if (id === "virtual:chapplin-entry" || id === ENTRY_ID) {
				return ENTRY_ID;
			}
			if (id === "virtual:chapplin-entry.html" || id === HTML_ID) {
				return HTML_ID;
			}
		},
		load(id) {
			if (id === ENTRY_ID) {
				return generateClientEntry(context.file, context.target);
			}
			if (id === HTML_ID) {
				return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="virtual:chapplin-entry"></script>
</body>
</html>`;
			}
		},
	};

	// Determine JSX settings based on target
	const jsxConfig = getJsxConfig(context.target);

	const result = await viteBuild({
		configFile: false,
		appType: "spa",
		esbuild: {
			jsxDev: false,
			...jsxConfig,
		},
		mode: "production",
		logLevel: "warn",
		plugins: [entryPlugin, ...context.plugins],
		build: {
			write: false,
			ssr: false,
			rollupOptions: {
				input: "virtual:chapplin-entry.html",
			},
		},
	});

	if (Array.isArray(result)) {
		throw new Error("Multiple build results are not supported");
	}
	if (!("output" in result)) {
		throw new Error("No output found in build result");
	}

	const htmlAsset = result.output.find(
		(item) => item.type === "asset" && item.fileName.endsWith(".html"),
	);

	if (!htmlAsset || htmlAsset.type !== "asset") {
		throw new Error("No HTML asset found in build output");
	}

	const html = htmlAsset.source.toString();

	return [context.name, html];
}

/**
 * Get JSX configuration for esbuild based on target framework
 */
function getJsxConfig(target: string | undefined): {
	jsx?: "transform" | "preserve" | "automatic";
	jsxImportSource?: string;
	jsxFactory?: string;
	jsxFragment?: string;
} {
	switch (target) {
		case "react":
			return {
				jsx: "automatic",
				jsxImportSource: "react",
			};
		case "preact":
			return {
				jsx: "automatic",
				jsxImportSource: "preact",
			};
		case "solid":
			// Solid requires special handling - use solid-js/h
			return {
				jsx: "transform",
				jsxFactory: "h",
				jsxFragment: "Fragment",
			};
		case "hono":
			// Hono uses hono/jsx
			return {
				jsx: "automatic",
				jsxImportSource: "hono/jsx",
			};
		default:
			return {};
	}
}

/**
 * Generate client entry code based on target framework
 *
 * The entry integrates with @modelcontextprotocol/ext-apps to receive
 * tool input and results from the host application.
 *
 * Note: We use createElement instead of JSX to avoid requiring JSX transformation
 * in the sub-build process.
 */
function generateClientEntry(file: string, target: string | undefined): string {
	switch (target) {
		case "react":
			return `
import { useState, useEffect, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { app as appDef } from "${file}";
const UserApp = appDef.ui;
import { useApp, useHostStyleVariables } from "@modelcontextprotocol/ext-apps/react";

function AppWrapper() {
  const [input, setInput] = useState({});
  const [output, setOutput] = useState(null);
  const [meta, setMeta] = useState(null);

  const { app, isConnected, error } = useApp({
    appInfo: { name: "chapplin-app", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolinput = (params) => {
        setInput(params.arguments ?? {});
      };
      app.ontoolresult = (params) => {
        setOutput(params.structuredContent ?? null);
      };
      app.onhostcontextchanged = (params) => {
        setMeta((prev) => ({ ...prev, ...params }));
      };
    },
  });

  useHostStyleVariables();

  useEffect(() => {
    if (app) {
      const context = app.getHostContext();
      if (context) {
        if (context.toolInput?.arguments) {
          setInput(context.toolInput.arguments);
        }
        if (context.toolResult?.structuredContent) {
          setOutput(context.toolResult.structuredContent);
        }
        setMeta(context);
      }
    }
  }, [app, isConnected]);

  if (error) {
    return h("div", { style: { color: "red", padding: "20px" } }, "Error: " + error.message);
  }

  if (!isConnected) {
    return h("div", { style: { padding: "20px" } }, "Connecting...");
  }

  return h(UserApp, { input, output, meta });
}

const root = createRoot(document.getElementById("root"));
root.render(h(AppWrapper));
`;
		case "preact":
			return `
import { useState, useEffect } from "preact/hooks";
import { render, createElement as h } from "preact";
import { app as appDef } from "${file}";
const UserApp = appDef.ui;
import { App } from "@modelcontextprotocol/ext-apps";

function AppWrapper() {
  const [input, setInput] = useState({});
  const [output, setOutput] = useState(null);
  const [meta, setMeta] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const app = new App(
      { name: "chapplin-app", version: "1.0.0" },
      {}
    );

    app.ontoolinput = (params) => {
      setInput(params.arguments ?? {});
    };
    app.ontoolresult = (params) => {
      setOutput(params.structuredContent ?? null);
    };
    app.onhostcontextchanged = (params) => {
      setMeta((prev) => ({ ...prev, ...params }));
    };

    app.connect().then(() => {
      const context = app.getHostContext();
      if (context) {
        if (context.toolInput?.arguments) {
          setInput(context.toolInput.arguments);
        }
        if (context.toolResult?.structuredContent) {
          setOutput(context.toolResult.structuredContent);
        }
        setMeta(context);
      }
      setIsConnected(true);
    }).catch((err) => {
      setError(err);
    });

    return () => app.close();
  }, []);

  if (error) {
    return h("div", { style: { color: "red", padding: "20px" } }, "Error: " + error.message);
  }

  if (!isConnected) {
    return h("div", { style: { padding: "20px" } }, "Connecting...");
  }

  return h(UserApp, { input, output, meta });
}

render(h(AppWrapper), document.getElementById("root"));
`;
		case "solid":
			return `
import { createSignal, onMount, onCleanup, Show, createEffect } from "solid-js";
import { render } from "solid-js/web";
import { app as appDef } from "${file}";
const UserApp = appDef.ui;
import { App } from "@modelcontextprotocol/ext-apps";

function AppWrapper() {
  const [input, setInput] = createSignal({});
  const [output, setOutput] = createSignal(null);
  const [meta, setMeta] = createSignal(null);
  const [isConnected, setIsConnected] = createSignal(false);
  const [error, setError] = createSignal(null);

  let appInstance;

  onMount(() => {
    appInstance = new App(
      { name: "chapplin-app", version: "1.0.0" },
      {}
    );

    appInstance.ontoolinput = (params) => {
      setInput(params.arguments ?? {});
    };
    appInstance.ontoolresult = (params) => {
      setOutput(params.structuredContent ?? null);
    };
    appInstance.onhostcontextchanged = (params) => {
      setMeta((prev) => ({ ...prev, ...params }));
    };

    appInstance.connect().then(() => {
      const context = appInstance.getHostContext();
      if (context) {
        if (context.toolInput?.arguments) {
          setInput(context.toolInput.arguments);
        }
        if (context.toolResult?.structuredContent) {
          setOutput(context.toolResult.structuredContent);
        }
        setMeta(context);
      }
      setIsConnected(true);
    }).catch((err) => {
      setError(err);
    });
  });

  onCleanup(() => {
    if (appInstance) appInstance.close();
  });

  // Use imperative DOM manipulation for Solid without JSX
  let container;
  
  createEffect(() => {
    if (!container) return;
    container.innerHTML = "";
    
    if (error()) {
      const div = document.createElement("div");
      div.style.cssText = "color: red; padding: 20px;";
      div.textContent = "Error: " + error().message;
      container.appendChild(div);
    } else if (!isConnected()) {
      const div = document.createElement("div");
      div.style.cssText = "padding: 20px;";
      div.textContent = "Connecting...";
      container.appendChild(div);
    } else {
      // Render the user app - need to mount it
      render(() => UserApp({ input: input(), output: output(), meta: meta() }), container);
    }
  });

  return (ref) => { container = ref; return ref; };
}

const root = document.getElementById("root");
const wrapper = AppWrapper();
wrapper(root);
`;
		case "hono":
			// Hono with hono/jsx - use render from hono/jsx/dom
			return `
import { app as appDef } from "${file}";
const UserApp = appDef.ui;
import { jsx, render } from "hono/jsx/dom";
import { App, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";

const rootEl = document.getElementById("root");

const app = new App(
  { name: "chapplin-app", version: "1.0.0" },
  {}
);

let state = {
  input: {},
  output: null,
  meta: null,
};

function renderApp() {
  rootEl.innerHTML = "";
  render(jsx(UserApp, state), rootEl);
}

app.ontoolinput = (params) => {
  state.input = params.arguments ?? {};
  renderApp();
};

app.ontoolresult = (params) => {
  state.output = params.structuredContent ?? null;
  renderApp();
};

app.onhostcontextchanged = (params) => {
  state.meta = { ...state.meta, ...params };
  applyHostStyleVariables();
  renderApp();
};

app.connect().then(() => {
  const context = app.getHostContext();
  if (context) {
    if (context.toolInput?.arguments) {
      state.input = context.toolInput.arguments;
    }
    if (context.toolResult?.structuredContent) {
      state.output = context.toolResult.structuredContent;
    }
    state.meta = context;
    applyHostStyleVariables();
  }
  renderApp();
}).catch((err) => {
  rootEl.innerHTML = '<div style="color: red; padding: 20px;">Error: ' + err.message + '</div>';
});
`;
		default:
			// Generic entry (vanilla / other)
			return `
import { app as appDef } from "${file}";
const UserApp = appDef.ui;
import { App, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";

const rootEl = document.getElementById("root");

const app = new App(
  { name: "chapplin-app", version: "1.0.0" },
  {}
);

let state = {
  input: {},
  output: null,
  meta: null,
};

function renderApp() {
  const result = UserApp(state);
  if (typeof result === "string") {
    rootEl.innerHTML = result;
  } else if (result instanceof Node) {
    rootEl.innerHTML = "";
    rootEl.appendChild(result);
  }
}

app.ontoolinput = (params) => {
  state.input = params.arguments ?? {};
  renderApp();
};

app.ontoolresult = (params) => {
  state.output = params.structuredContent ?? null;
  renderApp();
};

app.onhostcontextchanged = (params) => {
  state.meta = { ...state.meta, ...params };
  applyHostStyleVariables();
  renderApp();
};

app.connect().then(() => {
  const context = app.getHostContext();
  if (context) {
    if (context.toolInput?.arguments) {
      state.input = context.toolInput.arguments;
    }
    if (context.toolResult?.structuredContent) {
      state.output = context.toolResult.structuredContent;
    }
    state.meta = context;
    applyHostStyleVariables();
  }
  renderApp();
}).catch((err) => {
  rootEl.innerHTML = '<div style="color: red; padding: 20px;">Error: ' + err.message + '</div>';
});
`;
	}
}
