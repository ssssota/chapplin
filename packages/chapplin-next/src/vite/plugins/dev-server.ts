import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import type { Options } from "../types.js";
import { resolveOptions } from "../utils.js";
import { getCollectedFiles } from "./file-collector.js";

/** Dev server preview UI path */
const PREVIEW_PATH = "/__chapplin__";

/**
 * Plugin that provides dev server functionality
 */
export function devServer(opts: Options): Plugin {
	const resolvedOpts = resolveOptions(opts);
	let config: ResolvedConfig;

	return {
		name: "chapplin:dev-server",
		apply: "serve",
		configResolved(resolvedConfig) {
			config = resolvedConfig;
		},
		configureServer: {
			order: "pre",
			handler(server) {
				// Serve the preview UI
				server.middlewares.use(async (req, res, next) => {
					if (!req.url) return next();

					// Preview UI index
					if (req.url === PREVIEW_PATH || req.url === `${PREVIEW_PATH}/`) {
						res.setHeader("content-type", "text/html");
						res.end(generatePreviewIndexHtml(server, config));
						return;
					}

					// API: List tools/resources/prompts
					if (req.url === `${PREVIEW_PATH}/api/files`) {
						const files = getCollectedFiles(config);
						res.setHeader("content-type", "application/json");
						res.end(JSON.stringify(files));
						return;
					}

					// Preview a specific tool
					if (req.url.startsWith(`${PREVIEW_PATH}/tools/`)) {
						const toolPath = req.url.replace(`${PREVIEW_PATH}/tools/`, "");
						res.setHeader("content-type", "text/html");
						res.end(generateToolPreviewHtml(toolPath, resolvedOpts));
						return;
					}

					// Serve tool UI directly (for iframe)
					if (req.url.startsWith("/tools/")) {
						const toolFile = req.url.replace("/tools/", "");
						res.setHeader("content-type", "text/html");
						res.end(generateToolHtml(toolFile, resolvedOpts));
						return;
					}

					next();
				});
			},
		},
	};
}

/**
 * Generate the preview UI index HTML
 */
function generatePreviewIndexHtml(
	_server: ViteDevServer,
	_config: ResolvedConfig,
): string {
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>chapplin Dev Server</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #1a1a1a; color: #fff; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
    h1 { font-size: 1.5rem; }
    .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
    .tab { padding: 8px 16px; background: #333; border: none; color: #fff; cursor: pointer; border-radius: 4px; }
    .tab.active { background: #0066ff; }
    .section { display: none; }
    .section.active { display: block; }
    .file-list { list-style: none; }
    .file-item { padding: 10px; background: #222; margin-bottom: 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; }
    .file-item a { color: #0088ff; text-decoration: none; }
    .file-item a:hover { text-decoration: underline; }
    .badge { padding: 2px 8px; background: #444; border-radius: 4px; font-size: 0.75rem; }
    .badge.app { background: #0066ff; }
    .preview-frame { width: 100%; height: 400px; border: 1px solid #333; background: #fff; border-radius: 4px; }
    .empty { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>chapplin Dev Server</h1>
    </header>
    
    <div class="tabs">
      <button class="tab active" data-tab="tools">Tools</button>
      <button class="tab" data-tab="resources">Resources</button>
      <button class="tab" data-tab="prompts">Prompts</button>
    </div>
    
    <div id="tools" class="section active">
      <h2>Tools</h2>
      <ul class="file-list" id="tools-list"></ul>
    </div>
    
    <div id="resources" class="section">
      <h2>Resources</h2>
      <ul class="file-list" id="resources-list"></ul>
    </div>
    
    <div id="prompts" class="section">
      <h2>Prompts</h2>
      <ul class="file-list" id="prompts-list"></ul>
    </div>
    
    <div id="preview" style="margin-top: 20px; display: none;">
      <h2>Preview</h2>
      <iframe class="preview-frame" id="preview-frame"></iframe>
    </div>
  </div>
  
  <script>
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });
    
    // Load files
    fetch('/__chapplin__/api/files')
      .then(res => res.json())
      .then(files => {
        renderFileList('tools-list', files.tools, true);
        renderFileList('resources-list', files.resources, false);
        renderFileList('prompts-list', files.prompts, false);
      });
    
    function renderFileList(containerId, files, showPreview) {
      const container = document.getElementById(containerId);
      if (files.length === 0) {
        container.innerHTML = '<li class="empty">No files found</li>';
        return;
      }
      container.innerHTML = files.map(file => {
        const badges = file.hasApp ? '<span class="badge app">App</span>' : '';
        const previewBtn = showPreview && file.hasApp 
          ? '<a href="javascript:void(0)" onclick="showPreview(\\'' + file.name + '\\')">[Preview]</a>'
          : '';
        return '<li class="file-item"><span>' + file.name + ' ' + badges + '</span>' + previewBtn + '</li>';
      }).join('');
    }
    
    function showPreview(toolName) {
      const preview = document.getElementById('preview');
      const frame = document.getElementById('preview-frame');
      preview.style.display = 'block';
      frame.src = '/tools/' + toolName + '.tsx';
    }
  </script>
</body>
</html>`;
}

/**
 * Generate HTML for tool preview page (with controls)
 */
function generateToolPreviewHtml(
	toolPath: string,
	_opts: ReturnType<typeof resolveOptions>,
): string {
	return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tool Preview: ${toolPath}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #1a1a1a; color: #fff; }
    .preview-container { display: flex; gap: 20px; }
    .controls { flex: 1; }
    .preview { flex: 2; }
    iframe { width: 100%; height: 500px; border: 1px solid #333; background: #fff; }
    textarea { width: 100%; height: 200px; font-family: monospace; padding: 10px; }
    button { padding: 10px 20px; margin-top: 10px; }
    h2 { margin-bottom: 10px; }
  </style>
</head>
<body>
  <h1>Tool Preview: ${toolPath}</h1>
  <div class="preview-container">
    <div class="controls">
      <h2>Input</h2>
      <textarea id="input">{}</textarea>
      <button onclick="updateInput()">Update</button>
      
      <h2>Output</h2>
      <textarea id="output" readonly></textarea>
    </div>
    <div class="preview">
      <h2>App Preview</h2>
      <iframe id="frame" src="/tools/${toolPath}"></iframe>
    </div>
  </div>
  <script>
    function updateInput() {
      // TODO: Send input to iframe via postMessage
      console.log('Input:', document.getElementById('input').value);
    }
  </script>
</body>
</html>`;
}

/**
 * Generate HTML for tool UI (served in iframe)
 */
function generateToolHtml(
	toolFile: string,
	opts: ReturnType<typeof resolveOptions>,
): string {
	const toolPath = `/${opts.toolsDir}/${toolFile}`;
	return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import { App } from "${toolPath}";
    
    // Simple render for dev preview
    const props = {
      input: {},
      output: null,
      meta: null,
    };
    
    const root = document.getElementById('root');
    
    // Try to render based on what App returns
    try {
      const result = App(props);
      if (typeof result === 'string') {
        root.innerHTML = result;
      } else if (result && typeof result === 'object') {
        // Assume it's a React/Preact element - needs proper rendering
        root.innerHTML = '<p>App component loaded. Use framework-specific rendering in production.</p>';
      }
    } catch (e) {
      root.innerHTML = '<p>Error loading App: ' + e.message + '</p>';
    }
  </script>
</body>
</html>`;
}
