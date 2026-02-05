# chapplin-next 設計書

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
    "@modelcontextprotocol/sdk": ">=1.23",
    "vite": ">=6",
    "zod": ">=4"
  },
  "optionalPeerDependencies": {
    "hono": ">=4",
    "react": ">=18",
    "react-dom": ">=18",
    "preact": ">=10",
    "solid-js": ">=1.9"
  },
  "dependencies": {
    "@modelcontextprotocol/ext-apps": "^1.0.1",
    "vite-plugin-singlefile": "*",
    "magic-string": "*",
    "oxc-parser": "*",
    "preact-iso": "*",
    "vite-plugin-dev-api": "*"
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
import { z } from "zod";

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
import { z } from "zod";

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
    return {
      content: [{ type: "text", text: `Chart ${chartId} created` }],
      structuredContent: { chartId },
    };
  },
});

export const app = defineApp<typeof tool>({
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
      <h1>Chart: {props.output?.chartId}</h1>
      <Chart type={props.input.chartType} data={props.input.data} />
    </div>
  ),
});
```

- **meta**: MCP App のメタデータ（CSP・権限・prefersBorder など）。`@modelcontextprotocol/ext-apps` の AppMeta に準拠。
- **ui**: すべて JSX で記述する。React/Preact/Solid は各ランタイムの JSX、**Hono は `hono/jsx` モジュールを前提とする**（後述）。`props` は `{ input, output, meta }` で、型は `typeof tool` から推論。

#### 4.1.3 型定義

```typescript
// defineTool の型（イメージ）
function defineTool<TConfig extends ToolConfig>(options: {
  name: string;
  config: TConfig;
  handler: ToolHandler<InferInput<TConfig>, InferOutput<TConfig>>;
}): DefinedTool<TConfig>;

// defineApp の型（イメージ）
// ui はすべて JSX。Hono の場合は hono/jsx の JSXNode / Child を返す
function defineApp<TTool extends DefinedTool>(options: {
  meta?: AppMeta;
  ui: (props: AppProps<TTool>) => ReactNode;  // React/Preact/Solid: 各 JSX。Hono: hono/jsx の Child
}): DefinedApp<TTool>;

// CallToolResult / AppMeta / AppProps 等は従来どおり
interface ToolConfig<TInput, TOutput> { ... }
interface AppMeta { ... }
interface AppProps<TInput, TOutput, TMeta> { input: TInput; output: TOutput | null; meta: TMeta | null; }
```

#### 4.1.4 懸念・注意点

- **既存実装との差**: 現在の実装は `export const name` / `export const config` / `export function handler` 等の**個別 export** をパースしています。define* 形式に合わせるには、ファイル収集・型生成・仮想モジュール生成のいずれも「`defineTool` / `defineResource` / `definePrompt` の呼び出し」および「`defineApp<typeof tool>` の有無」を解析する形に変更する必要があります。
- **export 名**: `tool` / `resource` / `prompt` / `app` を標準の export 名として扱う想定です。複数 export は想定せず、1 ファイル 1 つの define* にします。
- **型生成**: 生成される `.chapplin/types/` の参照先は「そのファイルの default または named export された define* の戻り値」になり、`typeof import("./tools/weather").tool` のように `tool` を参照する形に変わります。
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
import { z } from "zod";

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
import { chapplin } from "chapplin/vite";
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
    build(opts),              // ビルド時の処理
    clientToolResolver(opts), // クライアント側ツール解決
    devServer(),              // 開発サーバー
    virtualModules(),         // 仮想モジュール
    typeGeneration(),         // 型生成
  ];
}
```

### 5.3 Options

```typescript
interface Options {
  /** エントリーポイント @default './src/index.ts' */
  entry?: string | string[];
  /** tsconfig パス @default 'tsconfig.json' */
  tsconfigPath?: string;
  /** UI フレームワーク */
  target?: "react" | "preact" | "hono" | "solid";
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

### 6.1 `chapplin:mcp-server`

自動生成される MCP サーバーファクトリ関数を提供します。`createMcpServer()` を呼び出すたびに新しいサーバーインスタンスが生成されます。これは `StreamableHTTPTransport` のように、リクエストごとに新しいサーバーインスタンスが必要なトランスポートをサポートするためです。

```typescript
// 生成されるコード（イメージ）
// defineTool / defineResource / definePrompt の戻り値から .name, .config, .handler を参照する
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { tool as tool_weather } from "./tools/weather.ts";
import { tool as tool_chart, app as app_chart } from "./tools/chart.tsx";
import tool_chart_html from "virtual:chapplin-app-html:show_chart";

import { resource as resource_config } from "./resources/config.ts";
import { prompt as prompt_review } from "./prompts/code-review.ts";

export function createMcpServer() {
  const server = new McpServer({
    name: "chapplin-server",
    version: "1.0.0",
  });

  server.registerTool(tool_weather.name, tool_weather.config, tool_weather.handler);

  {
    const uri = `ui://${tool_chart.name}/app.html`;
    server.registerTool(
      tool_chart.name,
      { ...tool_chart.config, _meta: { ui: { resourceUri: uri } } },
      tool_chart.handler
    );
    server.registerResource(
      tool_chart.name,
      uri,
      {
        description: tool_chart.config.description,
        mimeType: "text/html;profile=mcp-app",
        _meta: { ui: app_chart.meta ?? {} },
      },
      async () => ({
        contents: [{ uri, mimeType: "text/html;profile=mcp-app", text: tool_chart_html }],
      })
    );
  }

  server.registerResource(
    resource_config.name,
    resource_config.config.uri,
    resource_config.config,
    resource_config.handler
  );

  server.registerPrompt(
    prompt_review.name,
    prompt_review.config,
    prompt_review.handler
  );

  return server;
}

export default createMcpServer;
```

### 6.2 使用例

```typescript
// src/index.ts (HTTP mode with StreamableHTTPTransport)
import { createMcpServer } from "chapplin:mcp-server";
import { StreamableHTTPTransport } from "@hono/mcp";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.all("/mcp", async (c) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  return transport.handleRequest(c);
});

serve({ fetch: app.fetch, port: 3000 });
```

```typescript
// src/index.ts (STDIO mode)
import { createMcpServer } from "chapplin:mcp-server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = createMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 6.3 `virtual:chapplin-client`（開発サーバー専用）

開発サーバーでツールUIをiframeで表示するために使用される仮想モジュールです。

```typescript
// 仮想モジュール ID の形式
virtual:chapplin-client/{toolPath}

// 例: virtual:chapplin-client/tools/chart.tsx
// ↓
// 生成されるコード
import { init } from 'chapplin-next/client/react';
import { App } from '/path/to/tools/chart.tsx';
init(App);
```

この仮想モジュールは、`dev-server.ts` プラグインの `load` hook で処理され、以下の動作をします：

1. 仮想モジュールIDからツールファイルのパスを抽出
2. ツールファイルから `App` コンポーネントをインポート
3. 設定された `target`（react/preact/solid/hono）に応じた `init` 関数をインポート
4. `init(App)` を呼び出してDOMにレンダリング

`/iframe/tools/{toolFile}` パスでアクセスされた際に、この仮想モジュールが使用されます。

---

## 7. 型生成システム

### 7.1 概要

React Router や SvelteKit のように、ツール定義から型を自動生成します。

### 7.2 生成される型ファイル

型定義は `.chapplin/types/` ディレクトリに複数のファイルとして生成されます：

```
.chapplin/types/
├── mcp-server.d.ts    # chapplin:mcp-server の型定義
├── tools.d.ts         # chapplin:tools の型定義
├── resources.d.ts     # chapplin:resources の型定義
└── prompts.d.ts       # chapplin:prompts の型定義
```

各ファイルの内容：

```typescript
// .chapplin/types/mcp-server.d.ts（自動生成）
declare module "chapplin:mcp-server" {
  import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
  /**
   * Create a new MCP server instance with all registered tools, resources, and prompts.
   * Each call creates a fresh instance, which is needed for transports like StreamableHTTPTransport
   * that require a new server per request.
   */
  export function createMcpServer(): McpServer;
  export default createMcpServer;
}
```

```typescript
// .chapplin/types/tools.d.ts（自動生成）
declare module "chapplin:tools" {
  export interface Tools {
    get_weather: {
      input: { city: string; unit: "celsius" | "fahrenheit" };
      output: { temperature: number; condition: string };
    };
    show_chart: {
      input: { data: Array<{ label: string; value: number }>; chartType: "bar" | "line" | "pie" };
      output: { chartId: string };
    };
  }
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
3. **UI ツールのクライアントビルド**: `app` エクスポートを持つツールをクライアントビルド
4. **単一 HTML 化**: vite-plugin-singlefile で HTML をインライン化
5. **モジュール化**: HTML を `export default "<!doctype html>..."` 形式で出力
6. **仮想モジュール生成**: `chapplin:mcp-server` のコードを生成

### 8.2 出力構成

```
dist/
├── index.js              # サーバーエントリー
├── __chapplin__/
│   └── mcp/
│       ├── chart.js      # export default "<html>..."
│       └── other-ui.js
└── ...
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
2. **MCP サーバー**: `chapplin:mcp-server` をオンデマンドビルドして起動
3. **HMR**: ツール/リソース/プロンプトの変更を検知してリロード

### 9.2 プレビュー UI

```
+------------------------------------------+
| chapplin Dev Server                      |
+------------------------------------------+
| Tools | Resources | Prompts | Server Log |
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
| Output: { "chartId": "abc123" }          |
+------------------------------------------+
```

### 9.3 ホスト UI の機能

- ツール一覧の表示
- ツール入力（input）のフォーム生成
- ツール実行と出力（output）の表示
- MCP App の iframe 表示
- ホスト ↔ App 間の通信シミュレーション

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
│           └── dev-server.ts
└── dev-ui/                    # 開発サーバー UI 用のディレクトリ
    ├── src/
    │   ├── api/
    │   │   └── index.ts       # Hono アプリの定義
    │   ├── components/
    │   │   ├── ToolList.tsx
    │   │   ├── ResourceList.tsx
    │   │   ├── PromptList.tsx
    │   │   ├── ToolPreview.tsx
    │   │   └── ServerLog.tsx
    │   ├── App.tsx
    │   └── main.tsx
    ├── index.html
    ├── vite.config.ts
    └── package.json
```

#### 9.4.2 技術スタック

- **フレームワーク**: Preact（軽量で React 互換）
- **ルーティング**: `preact-iso` - Preact のためのルーティングライブラリ
- **API サーバー**: Hono - 軽量で高速な Web フレームワーク
- **Vite プラグイン**: `vite-plugin-dev-api` - 開発サーバーに Hono を簡単に統合

#### 9.4.3 実装の詳細

- **エントリーポイント**: `dev-ui/src/main.tsx` で Preact アプリを起動
- **ルーティング**: `preact-iso` を使用したクライアントサイドルーティング
- **API 通信**: `/__chapplin__/api/*` エンドポイントと通信（Hono で実装）
- **ビルド**: Vite で開発サーバー UI をビルドし、プラグイン内で配信
- **HMR**: Vite の HMR を活用して開発中の UI 変更を即座に反映

#### 9.4.4 プラグインとの統合

`dev-server.ts` プラグインは以下のように動作します：

1. 開発モード時、`dev-ui/` を Vite のサブビルドとして起動
2. `/__chapplin__/` パスで Preact SPA を配信
3. `vite-plugin-dev-api` を使用して Hono アプリを開発サーバーに統合
4. `/__chapplin__/api/*` で Hono の API エンドポイントを提供
5. ビルド済みの HTML/JS/CSS をメモリ上に保持して配信
6. `/iframe/tools/{toolFile}` パスでツールUIをiframeとして配信

#### 9.4.5 クライアントモジュール

開発サーバーでは、各フレームワーク用のクライアントモジュール `chapplin-next/client/{target}` を提供します。

```typescript
// chapplin-next/client/react
import type { ComponentType } from "react";
import { jsx } from "react/jsx-runtime";
import { createRoot } from "react-dom/client";

export function init(App: ComponentType<AppProps>): void {
  const root = document.getElementById("root");
  if (!root) return;
  const reactRoot = createRoot(root);
  reactRoot.render(jsx(App, { input: {}, output: null, meta: null }));
}

// chapplin-next/client/preact
import type { ComponentType } from "preact";
import { render } from "preact";
import { jsx } from "preact/jsx-runtime";

export function init(App: ComponentType<AppProps>): void {
  const root = document.getElementById("root");
  if (!root) return;
  render(jsx(App, { input: {}, output: null, meta: null }), root);
}

// chapplin-next/client/solid
import type { Component } from "solid-js";
import { createComponent, render } from "solid-js/web";

export function init(App: Component<AppProps>): void {
  const root = document.getElementById("root");
  if (!root) return;
  render(
    () => createComponent(App, { input: {}, output: null, meta: null }),
    root
  );
}

// chapplin-next/client/hono
import type { Child, JSXNode } from "hono/jsx";
import { jsx, render } from "hono/jsx/dom";

export function init(App: (props: AppProps) => Child): void {
  const root = document.getElementById("root");
  if (!root) return;
  render(jsx(App as Component, { input: {}, output: null, meta: null }), root);
}

interface AppProps {
  input: Record<string, unknown>;
  output: unknown;
  meta: unknown;
}
```

`init` 関数は、開発プレビュー用に App コンポーネントを DOM にレンダリングします。各フレームワークの特性に応じて、適切なレンダリング方法を使用します：

- **React**: `createRoot` と `react/jsx-runtime` の `jsx` 関数を使用（JSX記法を使わない）
- **Preact**: `render` と `preact/jsx-runtime` の `jsx` 関数を使用（JSX記法を使わない）
- **Solid**: `createComponent` を使用（JSX記法を使わない）
- **Hono**: **`hono/jsx` モジュール前提**。`hono/jsx/dom` の `jsx` と `render` でレンダリングする。UI も他 target と同様に JSX で記述する。

これにより、ランタイムでのJSX変換を避け、パフォーマンスを最適化します。

#### 9.4.6 仮想モジュール `virtual:chapplin-client` と iframe 配信

開発サーバーでは、ツールUIをiframeで表示するために `virtual:chapplin-client/{toolPath}` という仮想モジュールを提供します。

**パス**: `/iframe/tools/{toolFile}`

このパスにアクセスすると、以下の処理が行われます：

1. `toolFile` からツールファイルのパスを構築（例: `chart.tsx` → `/tools/chart.tsx`）
2. `virtual:chapplin-client/tools/chart.tsx` という仮想モジュールIDを生成
3. `dev-server.ts` プラグインの `load` hook で仮想モジュールを解決
4. 解決されたコードをHTMLに埋め込み、iframeとして配信

```typescript
// 仮想モジュールの解決例
// virtual:chapplin-client/tools/chart.tsx
// ↓
// 生成されるコード
import { init } from 'chapplin-next/client/react';
import { App } from '/path/to/tools/chart.tsx';
init(App);
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

このHTMLは、プレビューUIのiframe内で表示され、ツールの `App` コンポーネントがレンダリングされます。

#### 9.4.7 API エンドポイント設計

Hono で実装する API エンドポイント：

```typescript
// dev-ui/src/api/index.ts
import { Hono } from "hono";

const app = new Hono();

// ファイル一覧取得
app.get("/api/files", async (c) => {
  const files = getCollectedFiles();
  return c.json(files);
});

// ツール実行
app.post("/api/tools/:name/execute", async (c) => {
  const { name } = c.req.param();
  const args = await c.req.json();
  const result = await executeTool(name, args);
  return c.json(result);
});

// MCP サーバー状態
app.get("/api/server/status", async (c) => {
  return c.json({ status: "running" });
});

export default app;
```

#### 9.4.8 Vite 設定例

`dev-ui/vite.config.ts` の設定例：

```typescript
// dev-ui/vite.config.ts
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { devApi } from "vite-plugin-dev-api";
import api from "./src/api/index.ts";

export default defineConfig({
  plugins: [
    preact(),
    devApi({
      handler: api,
      path: "/__chapplin__/api",
    }),
  ],
  build: {
    outDir: "../dist/dev-ui",
    emptyOutDir: false,
  },
});
```

### 9.5 開発コマンド

```bash
# 開発サーバー起動
vite dev

# デフォルトポート: 5173
# プレビュー UI: http://localhost:5173/__chapplin__/
# MCP サーバー: http://localhost:5173/mcp (SSE)
```

---

## 10. 今後の検討事項

- [ ] stdio トランスポートのサポート
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
| 3.2 | 仮想モジュール解決 `chapplin:mcp-server` | [x] |
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
| 5.1.2 | preact-iso によるルーティング実装 | [x] |
| 5.1.3 | コンポーネント設計（ToolList, Preview など） | [x] |
| 5.1.4 | Hono による API サーバー実装 | [x] |
| 5.1.5 | vite-plugin-dev-api による統合 | [x] |
| 5.2 | クライアントモジュール実装（react/preact/solid/hono） | [x] |
| 5.3 | 仮想モジュール `virtual:chapplin-client` 実装 | [x] |
| 5.4 | iframe 配信機能（`/iframe/tools/`） | [x] |
| 5.5 | MCP サーバー起動 | [ ] |
| 5.6 | HMR 対応 | [ ] |

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
| ツール定義 | `defineTool()` 関数 | ファイルベース (export) |
| 仮想モジュール | なし | `chapplin:mcp-server` |
| 型生成 | なし | 自動生成 |
| リソース/プロンプト | 未対応 | 対応 |
| UI MIME | `text/html+skybridge` | `text/html;profile=mcp-app` |
