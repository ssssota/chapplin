# Vite plugin for Chapplin

## Plugin order (`chapplin()`)

```ts
[
  ssrBuild,        // build only
  fileCollector,
  virtualModule,
  ...appEntry,
  clientBuild,
  typeGeneration,
  ...devServer,    // serve only
]
```

## Virtual modules

| Virtual module ID | Resolved by plugin | Main use | Mode |
| --- | --- | --- | --- |
| `chapplin:register` | `chapplin:virtual-module` | Generate `register(server)` for tools/resources/prompts | dev/build |
| `virtual:chapplin-app-html:<toolName>` | `chapplin:virtual-module` | Provide built app HTML string for `defineApp` tools | dev/build |
| `virtual:chapplin-app-entry?file=...` | `chapplin:app-entry-js` | Generate runtime JS (`init(app)`) for a tool app | dev/build |
| `virtual:chapplin-app-entry.html?file=...&lang.html` | `chapplin:app-entry-html` | Generate HTML shell that loads app-entry JS | build (and internal dev fallback path) |

## Build flow

```mermaid
flowchart TD
  A["Vite build start"] --> B["chapplin:ssr-build<br/>set build.ssr = opts.entry"]
  B --> C["SSR entry module<br/>(opts.entry)"]
  C --> D["import 'chapplin:register'"]
  D --> E["chapplin:virtual-module<br/>resolve/load chapplin:register"]
  E --> F["generate register() from collected files"]

  F --> G{"tool has defineApp?"}
  G -->|No| H["registerTool only"]
  G -->|Yes| I["import virtual:chapplin-app-html:<toolName>"]

  I --> J["chapplin:virtual-module<br/>resolve/load app-html virtual module"]
  J --> K["getBuiltAppHtml(toolName)<br/>(cache + lazy build)"]
  K --> L["chapplin:client-build<br/>buildClientApp()"]
  L --> M["vite.build input =<br/>virtual:chapplin-app-entry.html?file=..."]

  M --> N["chapplin:app-entry-html<br/>create HTML with script src"]
  N --> O["chapplin:app-entry-js<br/>create JS: import app + init(app)"]
  L --> P["vite-plugin-singlefile<br/>returns single HTML"]
  P --> J
```

## Dev flow

```mermaid
flowchart TD
  A["HTTP request to Vite dev server"] --> B{"path"}

  B -->|/api/*| C["chapplin:dev-api<br/>(vite-plugin-dev-api + Hono api-app)"]

  B -->|/mcp| D["chapplin:dev-server middleware<br/>handleDevMcpRequest()"]
  D --> E["runnerImport collected modules<br/>(register tool/resource/prompt)"]
  E --> F{"tool has app?"}
  F -->|No| G["registerTool"]
  F -->|Yes| H["getBuiltAppHtml(toolName)"]

  B -->|/iframe/tools/:toolPath/app.html| I["chapplin:dev-server middleware"]
  I --> J["resolve tool file"]
  J --> K{"built app html cached?"}
  K -->|Yes| L["return cached/built HTML"]
  K -->|No| M["server.transformRequest(virtual:chapplin-app-entry?file=...)"]
  M --> N["chapplin:app-entry-js<br/>resolve/load app-entry virtual module"]
  N --> O["createAppHtml(script) and return HTML"]

  B -->|/ or /index.html| P["chapplin:dev-server<br/>serve dev-ui dist/index.html"]

  H --> Q["lazy build path (same as build graph):<br/>client-build -> app-entry-html -> app-entry-js"]
```

### Note

- `chapplin:register` is resolved by `chapplin:virtual-module` in both dev/build when the user entry imports it.
- In dev, `/mcp` registration path mainly uses `runnerImport` directly; app HTML generation still goes through `getBuiltAppHtml()` and the app-entry virtual modules.
