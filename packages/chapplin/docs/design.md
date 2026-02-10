# chapplin 設計書

> MCP Server と MCP Apps を構築するためのオールインワンフレームワーク

## 1. 概要

### 1.1 chapplin とは

chapplin は、Model Context Protocol (MCP) サーバーと MCP Apps（インタラクティブ UI）を簡単に構築するための Vite ベースのフレームワークです。

### 1.2 主要な特徴

- **ファイルベースルーティング**: `tools/`, `resources/`, `prompts/` ディレクトリにファイルを配置するだけで自動登録
- **Type-safe**: config → handler → app の型推論チェーン
- **Vite プラグイン**: ビルドと開発サーバーを提供
- **単一 HTML 出力**: MCP Apps は vite-plugin-singlefile で単一ファイルにバンドル
- **UI はすべて JSX**: MCP App の UI は React / Preact / Solid / Hono いずれも **JSX で記述**。Hono を選ぶ場合は **`hono/jsx` モジュール**を前提とし、ブラウザでは `hono/jsx/dom` の `render` で描画する。

### 1.3 依存関係

```json
{
  "peerDependencies": {
    "@modelcontextprotocol/ext-apps": ">=1.0.0",
    "@modelcontextprotocol/sdk": ">=1.22",
    "hono": ">=4.0.0",
    "preact": ">=10.0.0",
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0",
    "solid-js": ">=1.0.0",
    "vite": ">=6",
    "zod": ">=3"
  },
  "peerDependenciesMeta": {
    "@modelcontextprotocol/ext-apps": { "optional": true },
    "hono": { "optional": true },
    "preact": { "optional": true },
    "react": { "optional": true },
    "react-dom": { "optional": true },
    "solid-js": { "optional": true }
  },
  "dependencies": {
    "magic-string": "*",
    "vite-plugin-dev-api": "^0.2.1",
    "vite-plugin-singlefile": "*"
  }
}
```

---

## 2. MCP プロトコル概要

### 2.1 MCP とは

Model Context Protocol は、AI アプリケーションを外部システムに接続するためのオープンソース標準です。

### 2.2 3 つのコアプリミティブ

| プリミティブ | 説明 | 用途例 |
|-------------|------|--------|
| **Tools** | LLM が呼び出せる実行可能な関数 | API 呼び出し、DB 操作 |
| **Resources** | 読み取り専用のデータソース | ファイル内容、設定 |
| **Prompts** | 再利用可能なテンプレート | システムプロンプト |

### 2.3 MCP Apps (ext-apps)

MCP Apps は、MCP サーバーが AI チャットボット内にインタラクティブな UI を表示するための拡張仕様です。

- `@modelcontextprotocol/ext-apps` パッケージで提供
- ツールと `ui://` リソースを関連付けて登録
- ホストがリソースをサンドボックス化された iframe で表示

---

## 3. ディレクトリ構成

```
project/
├── tools/                  # MCP ツール
│   ├── weather.ts          # 基本ツール
│   ├── chart.tsx           # UI 付きツール (React/Preact/Solid)
│   └── nested/
│       └── deep.ts         # ネストも可能
├── resources/              # MCP リソース
│   └── config.ts
├── prompts/                # プロンプトテンプレート
│   └── review.ts
├── src/
│   └── index.ts            # エントリーポイント（main.ts でも可）
├── vite.config.ts          # Vite 設定
└── tsconfig.json
```

### 3.1 パス解決規則

| ディレクトリ | ファイルパターン | 説明 |
|-------------|-----------------|------|
| `tools/` | `**/*.{ts,tsx}` | MCP ツール |
| `resources/` | `**/*.ts` | MCP リソース |
| `prompts/` | `**/*.ts` | プロンプトテンプレート |

---

## 4. ファイル仕様

ツール・リソース・プロンプトは、いずれも **define\*** API で 1 ファイル 1 定義として export します。これにより「名前・設定・ハンドラー」が一括で型推論され、App は対応する tool の型を参照できます。

### 4.1 Tools

#### 4.1.1 基本ツール（UI なし）

```typescript
// tools/weather.ts
import { defineTool } from "chapplin-next";
import z from "zod";

export const tool = defineTool({
  name: "get_weather",
  config: {
    title: "Weather Lookup",
    description: "指定した都市の天気を取得",
    inputSchema: {
      city: z.string().describe("都市名"),
      unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
    },
    outputSchema: {
      temperature: z.number(),
      condition: z.string(),
    },
    annotations: { readOnlyHint: true },
  },
  async handler(args, extra) {
    const weather = await fetchWeather(args.city, args.unit);
    return {
      content: [{ type: "text", text: `${args.city}: ${weather.temp}°` }],
      structuredContent: {
        temperature: weather.temp,
        condition: weather.condition,
      },
    };
  },
});
```

#### 4.1.2 UI 付きツール（MCP App）

ツール定義に続けて、**defineApp** で UI とメタデータを定義します。ジェネリックで `typeof tool` を渡すことで、`input` / `output` の型が tool から推論されます。

```tsx
// tools/chart.tsx
import { defineTool, defineApp } from "chapplin-next";
import z from "zod";

export const tool = defineTool({
  name: "show_chart",
  config: {
    description: "データをチャートで可視化",
    inputSchema: {
      data: z.array(z.object({ label: z.string(), value: z.number() })),
      chartType: z.enum(["bar", "line", "pie"]).default("bar"),
    },
    outputSchema: { chartId: z.string() },
  },
  async handler(args, extra) {
    const chartId = generateId();
    // _meta contains UI-only data that won't be sent to the LLM
    const chartData = await fetchChartData(args.data);
    return {
      content: [{ type: "text", text: `Chart ${chartId} created` }],
      structuredContent: { chartId },
      _meta: { chartData },  // Passed to UI but not to LLM
    };
  },
});

export const app = defineApp<typeof tool>({
  config: {
    appInfo: { name: "chart-app", version: "1.0.0" },
    capabilities: {},
    options: { autoResize: true },
  },
  meta: {
    csp: {
      connectDomains: ["https://api.example.com"],
      resourceDomains: ["https://cdn.example.com"],
    },
    permissions: {},
    prefersBorder: true,
  },
  ui: (props) => (
    <div>
      <h1>Chart: {props.output?.structuredContent?.chartId}</h1>
      {/* props.output._meta is typed based on handler's _meta return */}
      {props.output?._meta && <Chart data={props.output._meta.chartData} />}
    </div>
  ),
});
```

- **config (in defineApp)**: `@modelcontextprotocol/ext-apps` の `App` 初期化に渡す設定。`appInfo` は必須で、`capabilities` / `options` は任意。`chapplin/client/*` の `init` には `defineApp` の返り値（`app`）をそのまま渡し、この `config` が内部で使われる。
- **meta (in defineApp)**: MCP App のメタデータ（CSP・権限・prefersBorder など）。`@modelcontextprotocol/ext-apps` の AppMeta に準拠。
- **ui**: すべて JSX で記述する。React/Preact/Solid は各ランタイムの JSX、**Hono は `hono/jsx` モジュールを前提とする**（後述）。`props` は `{ input, output, hostContext }` で、`output._meta` に UI 専用データが含まれる。型は `typeof tool` から推論。
- **_meta (in handler return)**: UI 専用データ。LLM に送信されず、UI のみに渡される。コンテキストの汚染を避けつつ、大きなデータや可視化用データを UI に渡す際に使用。

#### 4.1.3 型定義

```typescript
// defineTool の型（イメージ）
// TMeta is inferred from handler's _meta return type
function defineTool<TName, TInput, TOutput, TMeta>(options: {
  name: TName;
  config: { inputSchema: TInput; outputSchema: TOutput; ... };
  handler: (args: TInput) => Promise<{
    content: Content[];
    structuredContent: TOutput;
    _meta?: TMeta;  // UI-only data
  }>;
}): DefinedTool<TName, TInput, TOutput, TMeta>;

// defineApp の型（イメージ）
// TMeta is extracted from TTool and passed to AppProps
function defineApp<TTool extends DefinedTool>(options: {
  config: {
    appInfo: AppInfo;
    capabilities?: AppCapabilities;
    options?: AppOptions;
  };
  meta?: AppMeta;
  ui: (props: AppProps<TTool>) => ReactNode;
}): DefinedApp<TTool>;

// AppProps includes _meta in output and host context
interface AppProps<TInput, TOutput, TMeta> {
  input: McpUiToolInputNotification["params"] & {
    arguments?: InferShapeOutput<TInput>;
  };
  output: McpUiToolResultNotification["params"] & {
    structuredContent?: InferShapeOutput<TOutput> | null;
    _meta?: TMeta;
  };
  hostContext?: McpUiHostContext;
}
```

#### 4.1.4 `_meta` による UI 専用データの受け渡し

ツールのハンドラーから `_meta` を返すと、そのデータは UI にのみ渡され、LLM には送信されません。これにより、以下のようなユースケースに対応できます：

- **大きなデータ**: チャートの元データなど、LLM のコンテキストを圧迫するデータ
- **可視化用データ**: 画像の Base64、グラフの座標データなど
- **UI 状態**: デフォルトのタブ選択、初期ズームレベルなど

```typescript
// handler 内で _meta を返す
async handler(args) {
  const result = await processData(args);
  return {
    content: [{ type: "text", text: "処理完了" }],
    structuredContent: { summary: result.summary },
    _meta: {
      rawData: result.data,      // 大きなデータ
      chartPoints: result.chart, // 可視化用
    },
  };
}

// UI で props.output._meta として受け取る
ui: (props) => (
  <div>
    <Summary text={props.output?.structuredContent?.summary} />
    {props.output?._meta && <Chart points={props.output._meta.chartPoints} />}
  </div>
)
```

型安全性は完全に保たれ、`props.output._meta` の型は `handler` の `_meta` 戻り値から自動推論されます。

#### 4.1.5 懸念・注意点

- **ファイル収集の判定精度**: 現在の実装は AST 解析ではなく、`defineTool` / `defineApp` / `defineResource` / `definePrompt` の文字列検出（正規表現）で収集対象を判定します。コメントや文字列リテラル内の一致でもヒットし得ます。
- **export 名**: `tool` / `resource` / `prompt` / `app` を標準の export 名として扱う想定です。複数 export は想定せず、1 ファイル 1 つの define* にします。
- **型生成**: 生成される `.chapplin/types/` の参照先は「そのファイルの named export された define* の戻り値」になり、`typeof import("./tools/weather").tool` のように `tool` を参照する形に変わります（default export は対象外）。
- **Hono と hono/jsx**: target が `hono` のときは **`hono/jsx` モジュールを前提**とする。UI はすべて JSX で書くため、他 target と同様にコンポーネント（JSX）を渡す。ランタイムでは `hono/jsx/dom` の `jsx` / `render` でレンダリングする。

### 4.2 Resources

```typescript
// resources/config.ts
import { defineResource } from "chapplin-next";

export const resource = defineResource({
  name: "app-config",
  config: {
    uri: "config://app/settings",
    title: "App Configuration",
    description: "アプリケーション設定",
    mimeType: "application/json",
  },
  async handler(uri) {
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({ theme: "dark", language: "ja" }),
      }],
    };
  },
});
```

### 4.3 Prompts

```typescript
// prompts/code-review.ts
import { definePrompt } from "chapplin-next";
import z from "zod";

export const prompt = definePrompt({
  name: "code-review",
  config: {
    title: "Code Review",
    description: "コードレビューを実施",
    argsSchema: {
      code: z.string().describe("レビュー対象のコード"),
      language: z.string().optional().describe("プログラミング言語"),
    },
  },
  handler(args) {
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Please review this ${args.language ?? ""} code:\n\n${args.code}`,
        },
      }],
    };
  },
});
```

---

## 5. Vite プラグイン

### 5.1 設定

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import { chapplin } from "chapplin-next/vite";
import react from "@vitejs/plugin-react";  // または preact, solid

export default defineConfig({
  plugins: [
    chapplin({
      entry: "./src/index.ts",      // デフォルト: './src/index.ts'
      tsconfigPath: "tsconfig.json", // デフォルト: 'tsconfig.json'
      target: "react",              // 'react' | 'preact' | 'hono' | 'solid'
    }),
    react(),
  ],
});
```

### 5.2 プラグイン構成

chapplin は複数の Vite プラグインで構成されます：

```typescript
export function chapplin(opts: Options): Plugin[] {
  return [
    ssrBuild(opts),           // SSR ビルド設定
    fileCollector(opts),      // ファイル収集
    virtualModule(opts),      // chapplin:register 仮想モジュール
    appEntry(opts),           // UI 用の共通 entry/HTML 生成
    clientBuild(opts),        // UI 付きツールのクライアントビルド
    typeGeneration(opts),     // 型生成
    ...devServer(opts),       // 開発サーバー（複数プラグイン）
  ];
}
```

### 5.3 Options

```typescript
interface Options {
  /** エントリーポイント @default './src/index.ts' */
  entry?: string;
  /** tsconfig パス @default 'tsconfig.json' */
  tsconfigPath?: string;
  /** UI フレームワーク */
  target: "react" | "preact" | "hono" | "solid";
  /** ツールディレクトリ @default 'tools' */
  toolsDir?: string;
  /** リソースディレクトリ @default 'resources' */
  resourcesDir?: string;
  /** プロンプトディレクトリ @default 'prompts' */
  promptsDir?: string;
}
```

---

## 6. 仮想モジュール

### 6.1 `chapplin:register`

自動生成される **登録関数** を提供します。`register(server: McpServer): void` を呼び出すと、渡した MCP サーバーに tools / resources / prompts を一括で登録します。サーバーの生成・名前・バージョン・トランスポート接続は利用側で行うため、StreamableHTTP のように「リクエストごとに新しいサーバー」にするか、1 インスタンスを再利用するかも自由に選べます。

```typescript
// 生成されるコード（イメージ）
// defineTool / defineResource / definePrompt の戻り値から .name, .config, .handler を参照する
import * as tool_weather from "./tools/weather.ts";
import * as tool_chart from "./tools/chart.tsx";
import tool_chart_html from "virtual:chapplin-app-html:show_chart";

import * as resource_config from "./resources/config.ts";
import * as prompt_review from "./prompts/code-review.ts";

/**
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 */
export function register(server) {
  // Register tools
  server.registerTool(tool_weather.tool.name, tool_weather.tool.config, tool_weather.tool.handler);

  {
    const uri = `ui://${tool_chart.tool.name}/app.html`;
    server.registerTool(
      tool_chart.tool.name,
      {
        ...tool_chart.tool.config,
        _meta: {
          ...tool_chart.tool.config._meta,
          ui: { resourceUri: uri },
        },
      },
      tool_chart.tool.handler
    );
    server.registerResource(
      tool_chart.tool.name,
      uri,
      {
        description: tool_chart.tool.config.description,
        mimeType: "text/html;profile=mcp-app",
        _meta: { ui: tool_chart.app.meta ?? {} },
      },
      async () => ({
        contents: [{ uri, mimeType: "text/html;profile=mcp-app", text: tool_chart_html }],
      })
    );
  }

  // Register resources
  server.registerResource(
    resource_config.resource.name,
    resource_config.resource.config.uri,
    resource_config.resource.config,
    resource_config.resource.handler
  );

  // Register prompts
  server.registerPrompt(
    prompt_review.prompt.name,
    prompt_review.prompt.config,
    prompt_review.prompt.handler
  );
}
```

### 6.2 使用例

```typescript
// src/index.ts (HTTP mode with StreamableHTTPTransport)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "chapplin:register";
import { StreamableHTTPTransport } from "@hono/mcp";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.all("/mcp", async (c) => {
  const server = new McpServer({ name: "my-server", version: "1.0.0" });
  register(server);
  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  return transport.handleRequest(c);
});

serve({ fetch: app.fetch, port: 3000 });
```

```typescript
// src/index.ts (STDIO mode)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "chapplin:register";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "my-server", version: "1.0.0" });
register(server);
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 6.3 `virtual:chapplin-client`（開発サーバー用の thin entry）

開発サーバーでツールUIをiframeで表示するために使用される仮想モジュールです。実際の UI 初期化は `chapplin/client/*` に集約し、dev/build の実行経路を揃えます。

```typescript
// 仮想モジュール ID の形式
virtual:chapplin-client/{toolPath}

// 例: virtual:chapplin-client/tools/chart.tsx
// ↓
// 生成されるコード
import { init } from "chapplin/client/react";
import { app } from "/path/to/tools/chart.tsx";
init(app);
```

この仮想モジュールは、`dev-server.ts` プラグインの `load` hook で処理され、以下の動作をします：

1. 仮想モジュールIDからツールファイルのパスを抽出
2. ツールファイルから `app`（defineApp の戻り値）をインポート
3. 設定された `target`（react/preact/solid/hono）に応じた `init` を `chapplin/client/{target}` からインポート
4. `init(app)` を呼び出し、`app.ui` のレンダリングと `app.config` による App 初期化を行う

`chapplin/client/*` 側で `@modelcontextprotocol/ext-apps` の `App` 初期化・host context 同期・host style variables 適用を行うため、開発プレビューと本番ビルドの挙動を一致させる。

`/iframe/tools/{toolName}` パスでアクセスされた際に、この仮想モジュールが使用されます（ビルド済み HTML が無い場合のフォールバック）。

### 6.4 `virtual:chapplin-app-entry`（共通 entry/HTML）

dev と build で同じ entry を生成するための共通仮想モジュールです。`app-entry.ts` プラグインが提供し、`dev-server.ts` / `client-build.ts` から参照されます。

```typescript
// 仮想モジュール ID の形式
virtual:chapplin-app-entry?file={absPath}&target={react|preact|solid|hono}

// 生成されるコード（共通 entry）
import { init } from "chapplin/client/react";
import { app } from "/path/to/tools/chart.tsx";
init(app);
```

HTML テンプレートも `app-entry.ts` に集約し、dev-server と client-build が同一テンプレートを使用します：

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="virtual:chapplin-app-entry?..."></script>
</body>
</html>
```

この設計により、仮想 entry の差異を排除し、dev/build の UI 初期化が完全に一致する。

---

## 7. 型生成システム

### 7.1 概要

React Router や SvelteKit のように、ツール定義から型を自動生成します。

### 7.2 生成される型ファイル

型定義は `.chapplin/types/` ディレクトリに複数のファイルとして生成されます。各ファイルは、対応する define* ファイルの **`.tool.config` / `.resource.config` / `.prompt.config`** を参照し、`inputSchema`・`outputSchema`・`argsSchema`・`uri` などから型を推論します。

```
.chapplin/types/
├── register.d.ts      # chapplin:register の型定義
├── tools.d.ts         # chapplin:tools の型定義
├── resources.d.ts     # chapplin:resources の型定義
└── prompts.d.ts       # chapplin:prompts の型定義
```

各ファイルの内容（実装に基づくイメージ）：

```typescript
// .chapplin/types/register.d.ts（自動生成）
declare module "chapplin:register" {
  import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
  /**
   * Register all tools, resources, and prompts from this project onto the given MCP server.
   */
  export function register(server: McpServer): void;
}
```

```typescript
// .chapplin/types/tools.d.ts（自動生成）
// 各ツールの input/output は import("...").tool.config の inputSchema / outputSchema から推論
declare module "chapplin:tools" {
  export interface Tools {
    get_weather: {
      /** Import path: ../tools/weather */
      input: { city: string; unit: "celsius" | "fahrenheit" };
      output: { temperature: number; condition: string };
    };
    show_chart: {
      /** Import path: ../tools/chart */
      input: { data: Array<{ label: string; value: number }>; chartType: "bar" | "line" | "pie" };
      output: { chartId: string };
    };
  }
  export type ToolName = "get_weather" | "show_chart";
}
```

```typescript
// .chapplin/types/resources.d.ts（自動生成）
// 各リソースの uri は import("...").resource.config から推論
declare module "chapplin:resources" {
  export interface Resources {
    "app-config": { uri: "config://app/settings"; };
  }
  export type ResourceName = "app-config";
}
```

```typescript
// .chapplin/types/prompts.d.ts（自動生成）
// 各プロンプトの args は import("...").prompt.config の argsSchema から推論
declare module "chapplin:prompts" {
  export interface Prompts {
    "code-review": { args: { code: string; language?: string }; };
  }
  export type PromptName = "code-review";
}
```

### 7.3 TypeScript 設定

`tsconfig.json` で `rootDirs` を設定することで、生成された型定義を適切に解決できます：

```json
{
  "compilerOptions": {
    "rootDirs": [".", "./.chapplin/types"]
  },
  "include": ["src", "tools", "resources", "prompts", ".chapplin/types"]
}
```

### 7.4 MCP App 内での型安全な callTool

```tsx
// tools/chart.tsx 内
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { Tools } from "chapplin:tools";

export function App(props) {
  const app = useApp();

  const fetchWeather = async () => {
    // 型安全：引数と戻り値が推論される
    const result = await app.callServerTool<Tools["get_weather"]>({
      name: "get_weather",
      arguments: { city: "Tokyo", unit: "celsius" },
    });
    // result.temperature: number
    // result.condition: string
  };

  return <button onClick={fetchWeather}>天気を取得</button>;
}
```

---

## 8. ビルド

### 8.1 ビルドプロセス

1. **エントリーポイントのビルド**: `src/index.ts` を Vite でビルド
2. **ツールファイルの収集**: `tools/` 以下の `.ts`, `.tsx` を収集
3. **UI ツールのクライアントビルド**: `app` エクスポートを持つツールごとに仮想エントリを生成し、`defineApp` の返り値（`app`）を `chapplin/client/{target}` の `init` に渡す（`@modelcontextprotocol/ext-apps` の App 初期化と host context 同期をここに集約し、dev/build の構成を揃える）
4. **単一 HTML 化**: vite-plugin-singlefile で HTML をインライン化
5. **モジュール化**: HTML を `export default "<!doctype html>..."` 形式で出力
6. **仮想モジュール生成**: `chapplin:register` のコードを生成

### 8.2 出力構成

MCP App の HTML はビルド時にメモリ上で生成され、`chapplin:register` 仮想モジュール内で `virtual:chapplin-app-html:*` 経由で参照される。`dist/` に `__chapplin__` ディレクトリは出力しない。

```
dist/
└── index.js              # サーバーエントリー（SSR ビルド）
```

### 8.3 ビルドコマンド

```bash
# ビルド
vite build

# プロダクションサーバー起動
node dist/index.js
```

---

## 9. 開発サーバー

### 9.1 機能

1. **MCP App プレビュー**: iframe + ホスト UI で実際の動作を確認
2. **MCP サーバー起動**: `/mcp` エンドポイントを提供し、`chapplin:register` で収集済み定義を登録して `StreamableHTTPServerTransport` で処理
3. **MCP ツール一覧取得**: dev-ui の Tools タブは `/mcp` への `tools/list` で取得
4. **補助 API**: `/api/files`（resources/prompts 表示用）と `/api/tools/:name/execute`（未使用プレースホルダ）
5. **MCP Apps ホスト統合**: プレビューUIの iframe ホスト側で `@modelcontextprotocol/ext-apps` の `app-bridge` を使い、実 MCP（`/mcp`）へ接続して本番相当の挙動を再現

### 9.2 プレビュー UI

```
+------------------------------------------+
| chapplin Dev Server                      |
+------------------------------------------+
| Tools | Resources | Prompts              |
+------------------------------------------+
| > get_weather                            |
|   show_chart    [Preview]                |
| > nested/deep                            |
+------------------------------------------+
|  Preview Area                            |
| +--------------------------------------+ |
| |  [iframe: MCP App]                   | |
| |                                      | |
| +--------------------------------------+ |
| Input:  { "data": [...], "chartType": "bar" }
| Output: { "success": false, ... }        |
+------------------------------------------+
```

### 9.3 ホスト UI の機能

- ツール一覧の表示
- JSON 入力編集と `tools/call` 実行結果（output）の表示
- MCP App の iframe 表示
- iframe ホスト側で MCP Apps の host bridge を初期化
- host bridge 経由で `/mcp` に接続し、tool 呼び出し・resource 読み出し・host context 更新を実 MCP で検証
- ツール一覧は `tool.name` のみを表示し、ファイル名は UI に露出しない

### 9.4 プレビュー UI の実装方針

プレビュー UI は Preact ベースの SPA として実装します。HTML のベタ書きでは限界があるため、以下の理由で Preact を採用します：

- **軽量**: React より小さなバンドルサイズで、開発サーバーのオーバーヘッドを最小化
- **React 互換**: React のエコシステム（Hooks、コンポーネントパターン）をそのまま利用可能
- **開発体験**: JSX、HMR、型安全性などのモダンな開発体験を提供
- **保守性**: コンポーネントベースの設計で、機能追加や変更が容易

#### 9.4.1 ディレクトリ構成

```
packages/chapplin-next/
├── src/
│   └── vite/
│       └── plugins/
│           ├── dev-server.ts
│           └── api-app.ts
└── dev-ui/                    # 開発サーバー UI 用のディレクトリ
    ├── src/
    │   ├── components/
    │   │   ├── ToolList.tsx
    │   │   ├── ResourceList.tsx
    │   │   ├── PromptList.tsx
    │   │   └── ToolPreview.tsx
    │   ├── api/
    │   │   └── client.ts      # Hono RPC クライアント
    │   ├── mcp/
    │   │   ├── host-bridge.ts # iframe host と MCP 接続の橋渡し
    │   │   └── client.ts      # /mcp 向け MCP クライアント（StreamableHTTP）
    │   ├── App.tsx
    │   └── main.tsx
    ├── index.html
    ├── uno.config.ts
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts
```

#### 9.4.2 技術スタック

- **フレームワーク**: Preact（軽量で React 互換）
- **API サーバー**: Hono - 軽量で高速な Web フレームワーク
- **Vite プラグイン**: `vite-plugin-dev-api` - 開発サーバーに Hono を簡単に統合

#### 9.4.3 実装の詳細

- **エントリーポイント**: `dev-ui/src/main.tsx` で Preact アプリを起動
- **API 通信**: `/api/files` を resources/prompts の表示に使用（`src/vite/plugins/api-app.ts`）
- **MCP 通信**: `/mcp` へ接続し、tools/list・tools/call を含む MCP Apps の実通信で動作確認
- **配信**: `dist/dev-ui/index.html` を優先配信
- **フォールバック**: `dist/dev-ui/index.html` が無い場合は `dev-ui/index.html` を読み込み、Vite 変換を適用

#### 9.4.4 プラグインとの統合

`dev-server.ts` プラグインは以下のように動作します：

1. `vite-plugin-dev-api` を使用して Hono アプリ（`api-app.ts`）を開発サーバーに統合
2. `/` パスで dev-ui SPA を配信（ビルド済み優先、未ビルド時はソースへフォールバック）
3. `/api/*` で Hono の補助 API（主に resources/prompts 表示）を提供
4. `/mcp` で `chapplin:register` を動的ロードし、`StreamableHTTPServerTransport` で MCP リクエストを処理
5. `virtual:chapplin-client/*` を解決して iframe 用スクリプトを生成
6. `/iframe/tools/{toolName}` でツール UI を iframe として配信
7. dev-ui の host bridge からの MCP リクエストを `/mcp` で受け、実 MCP サーバーとして処理

#### 9.4.5 クライアントモジュール（dev/build 共通）

`chapplin/client/{react,preact,solid,hono}` は dev/build 共通の UI ランタイムです。`init` は `defineApp` の返り値（`app`）を受け取り、まず `app.ui` をマウントし、`AppWrapper` のライフサイクル（React/Preact/Hono は `useEffect`、Solid は `onMount`）で `app.config` を使って `@modelcontextprotocol/ext-apps` の `App` を初期化し、host bridge からのイベントを `input` / `output` / `meta` に同期します。

```typescript
import { init } from "chapplin/client/react";
import { app } from "/path/to/tools/chart.tsx";

init(app);
```

`init` の責務（共通）:

- 初期 props（`input: {}`, `output: { content: [] }`）で UI を先に描画する
- `AppWrapper` の effect/onMount 内で `new App(...)` と `App.connect()` を実行する
- `toolInput` / `toolResult` / `hostContext` を購読して UI 状態へ反映する
- `toolInput` / `toolResult` は `ontoolinput` / `ontoolresult` 通知からのみ反映する（`hostContext` からは復元しない）
- `input` / `output` / `meta` を更新してユーザー UI に渡す
- `hostContext.styles.variables` がある場合に `applyHostStyleVariables` を適用する
- 初期 `host context` 取得時は `hostContext` と style variables を同期する
- ルート要素が見つからない場合や接続失敗時は `console.error` を出力する
- `Connecting...` などの読み込み/エラー UI はフレームワーク側で固定表示せず、アプリ実装者が任意で表示する

フレームワーク差分:

- すべてのフレームワークで `@modelcontextprotocol/ext-apps` の `App` クラスを共通利用し、ホスト連携（connect / context 同期 / style variables）を共通化する
- React でも基本は共通ロジックを使い、必要なら薄いラッパ（Hook）で UI 側の都合に合わせる
- Hono は `hono/jsx` + `hono/jsx/dom` 前提（JSX で UI を記述）

`dev-server.ts` の `virtual:chapplin-client/*` と `client-build.ts` のビルドエントリは、どちらもこの `init` を呼ぶだけの薄いラッパにする。

#### 9.4.6 仮想モジュール `virtual:chapplin-client` と iframe 配信

開発サーバーでは、`/iframe/tools/{toolName}` へのアクセス時に、まずツール識別子から実ファイルを解決します。

1. 収集済み `files.tools[].name` で一致を確認
2. 一致しない場合は各 tool ファイルを `runnerImport` して `export const tool.name` と照合
3. 解決したファイル名で `getBuiltAppHtml()` を確認し、存在すればビルド済み HTML を返却
4. 未ビルド時は `virtual:chapplin-client/{toolPath}` を生成して `load` hook で解決し、HTML に埋め込んで返却

この方式により、UI は `tool.name` だけを扱い、ファイル名を `_meta` や画面表示に持ち込まずに iframe 配信できます。

```typescript
// 仮想モジュールの解決例（フォールバック）
// virtual:chapplin-client/tools/chart.tsx
// ↓
// 生成されるコード
import { init } from "chapplin/client/react";
import { app } from '/path/to/tools/chart.tsx';
init(app);
```

生成されたコードは、以下のHTMLテンプレートに埋め込まれます：

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <div id="root"></div>
  <script type="module">
    /* 生成されたコードがここに挿入される */
  </script>
</body>
</html>
```

このHTMLは、プレビューUIのiframe内で表示され、ツールの `app.ui` コンポーネントがレンダリングされます。

#### 9.4.7 API エンドポイント設計

Hono で実装する API エンドポイント（補助用途）：

```typescript
// src/vite/plugins/api-app.ts
import { Hono } from "hono";
import { getCollectedFiles } from "./file-collector.js";

export const app = new Hono()
  .get("/files", async (c) => {
    const files = await getCollectedFiles();
    return c.json(files);
  })
  .post("/tools/:name/execute", async (c) => {
    c.req.param("name");
    await c.req.json();
    return c.json({ success: false, error: "Not implemented" });
  })
  .get("/server/status", async (c) => {
    return c.json({ status: "running" });
  });

export type ApiType = typeof app;
```

`/api/*` は dev-ui の補助 API（主に resources/prompts 表示）に限定し、tools 一覧と実行は `/mcp`（`tools/list` / `tools/call`）に一本化します。

#### 9.4.8 MCP Apps ホスト統合（app-bridge）

プレビュー UI では、`iframe` の親側に `@modelcontextprotocol/ext-apps` の `app-bridge` を組み込みます。  
参照: https://github.com/modelcontextprotocol/ext-apps/blob/main/src/app-bridge.ts

- `ToolPreview` はまず `about:blank` iframe に対して host bridge を接続し、接続後に `src=/iframe/tools/{toolName}` を設定する（`ui/initialize` のタイムアウト回避）
- host bridge から `/mcp`（StreamableHTTP endpoint）へ接続する MCP クライアントを呼び出す
- tool input / tool result / host context を bridge 経由で iframe に通知する
- UI 側が `App` / `useApp` で受け取るイベントと同じ経路を通し、本番の MCP Apps ホストに近い条件でデバッグする

設計上の責務分離:

- `dev-ui/src/mcp/host-bridge.ts`: iframe と app-bridge のライフサイクル管理
- `dev-ui/src/mcp/client.ts`: `/mcp` との JSON-RPC 通信
- `ToolPreview.tsx`: JSON 入力の編集、bridge 経由の実行トリガー、結果表示

#### 9.4.9 Vite 設定例

`dev-ui/vite.config.ts` の設定例：

```typescript
// dev-ui/vite.config.ts
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import unocss from "unocss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [preact(), unocss(), viteSingleFile()],
  base: "/",
  build: {
    outDir: "../dist/dev-ui",
    emptyOutDir: false,
  },
  // API は dev-server plugin 側で提供
});
```

### 9.5 開発コマンド

```bash
# 開発サーバー起動
vite dev

# デフォルトポート: 5173
# プレビュー UI: http://localhost:5173/
# API: http://localhost:5173/api/*
# MCP サーバー: http://localhost:5173/mcp (StreamableHTTPServerTransport)
```

---

## 10. 今後の検討事項

- [x] stdio トランスポートのサポート（ユーザーが `StdioServerTransport` を利用し `register(server)` で登録すれば利用可能）
- [ ] 複数サーバーインスタンスのサポート
- [ ] テスト用ユーティリティの提供
- [ ] VS Code 拡張との連携
- [ ] デプロイターゲット（Cloudflare Workers, Vercel など）

---

## 11. 実装計画

### Phase 1: プロジェクト基盤のセットアップ [High]

| タスク | 説明 | 状態 |
|--------|------|------|
| 1.1 | `package.json` 作成（依存関係定義） | [x] |
| 1.2 | `tsconfig.json` 作成 | [x] |
| 1.3 | ディレクトリ構造作成（`src/`） | [x] |

### Phase 2: コア型定義 [High]

| タスク | 説明 | 状態 |
|--------|------|------|
| 2.1 | Tool/Resource/Prompt の型定義 | [x] |
| 2.2 | Vite プラグイン Options 型 | [x] |
| 2.3 | 仮想モジュールの型定義 | [x] |

### Phase 3: Vite プラグイン実装 [High]

| タスク | 説明 | 状態 |
|--------|------|------|
| 3.1 | メインプラグイン `chapplin()` | [x] |
| 3.2 | 仮想モジュール解決 `chapplin:register` | [x] |
| 3.3 | ファイル収集（tools/resources/prompts） | [x] |
| 3.4 | クライアントビルド（UI 付きツール） | [x] |

### Phase 4: 型生成システム [Medium]

| タスク | 説明 | 状態 |
|--------|------|------|
| 4.1 | ファイル解析（export 抽出） | [x] |
| 4.2 | 型定義ファイル生成（`.chapplin/types/`） | [x] |

### Phase 5: 開発サーバー [Medium]

| タスク | 説明 | 状態 |
|--------|------|------|
| 5.1 | プレビュー UI（ホスト側） | [x] |
| 5.1.1 | Preact SPA として再実装 | [x] |
| 5.1.2 | dev-ui ルーティング実装 | [x] |
| 5.1.3 | コンポーネント設計（ToolList, Preview など） | [x] |
| 5.1.4 | Hono による API サーバー実装 | [x] |
| 5.1.5 | vite-plugin-dev-api による統合 | [x] |
| 5.2 | クライアントモジュール実装（react/preact/solid/hono） | [x] |
| 5.3 | 仮想モジュール `virtual:chapplin-client` 実装 | [x] |
| 5.4 | iframe 配信機能（`/iframe/tools/`） | [x] |
| 5.5 | MCP サーバー起動 | [x] |
| 5.6 | MCP Apps host bridge（`app-bridge`）統合 | [x] |
| 5.7 | HMR 対応 | [ ] |

### Phase 6: テスト・ドキュメント [Low]

| タスク | 説明 | 状態 |
|--------|------|------|
| 6.1 | サンプルプロジェクト作成 | [x] |
| 6.2 | E2E テスト | [ ] |

### 依存関係

```
Phase 1 ─┬─> Phase 2 ─┬─> Phase 3 ─┬─> Phase 4
         │            │            │
         │            │            └─> Phase 5
         │            │
         └────────────┴─────────────────> Phase 6
```

- Phase 3 は Phase 2 の型定義に依存
- Phase 4, 5 は Phase 3 のプラグイン基盤に依存
- Phase 6 は他の全フェーズ完了後に実施可能

---

## 付録 A: MCP SDK API リファレンス

### McpServer

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({
  name: "server-name",
  version: "1.0.0",
});

// ツール登録
server.registerTool(name, config, handler);

// リソース登録
server.registerResource(name, uri, config, handler);

// プロンプト登録
server.registerPrompt(name, config, handler);

// トランスポート接続
await server.connect(transport);
```

### ext-apps

```typescript
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,  // "text/html;profile=mcp-app"
} from "@modelcontextprotocol/ext-apps/server";

registerAppTool(server, name, config, handler);
registerAppResource(server, name, uri, config, handler);
```

---

## 付録 B: 既存 chapplin との差分

| 項目 | 既存 (v0.2.x) | chapplin-next |
|------|--------------|---------------|
| ツール定義 | `defineTool()` 関数 | `define*` + ファイルベース自動収集 |
| 仮想モジュール | なし | `chapplin:register` |
| 型生成 | なし | 自動生成 |
| リソース/プロンプト | 未対応 | 対応 |
| UI MIME | `text/html+skybridge` | `text/html;profile=mcp-app` |
