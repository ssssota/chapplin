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
    "oxc-parser": "*"
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

### 4.1 Tools

#### 4.1.1 基本ツール（UI なし）

```typescript
// tools/weather.ts
import { z } from "zod";

/** ツール名（一意識別子） */
export const name = "get_weather";

/** ツール設定 */
export const config = {
  title: "Weather Lookup",           // UI 表示用（オプション）
  description: "指定した都市の天気を取得", // 必須：LLM が参照
  inputSchema: {
    city: z.string().describe("都市名"),
    unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  },
  outputSchema: {                    // オプション
    temperature: z.number(),
    condition: z.string(),
  },
  annotations: {                     // オプション
    readOnlyHint: true,
  },
};

/** ツールハンドラー */
export async function handler(
  args: { city: string; unit: "celsius" | "fahrenheit" },
  extra: RequestHandlerExtra
): Promise<CallToolResult> {
  const weather = await fetchWeather(args.city, args.unit);
  return {
    content: [{ type: "text", text: `${args.city}: ${weather.temp}°` }],
    structuredContent: {
      temperature: weather.temp,
      condition: weather.condition,
    },
  };
}
```

#### 4.1.2 UI 付きツール（MCP App）

```tsx
// tools/chart.tsx
import { z } from "zod";

export const name = "show_chart";

export const config = {
  description: "データをチャートで可視化",
  inputSchema: {
    data: z.array(z.object({
      label: z.string(),
      value: z.number(),
    })),
    chartType: z.enum(["bar", "line", "pie"]).default("bar"),
  },
  outputSchema: {
    chartId: z.string(),
  },
};

export async function handler(args, extra) {
  const chartId = generateId();
  return {
    content: [{ type: "text", text: `Chart ${chartId} created` }],
    structuredContent: { chartId },
  };
}

/** MCP App のメタデータ（UI がある場合は必須） */
export const appMeta = {
  // CSP 設定（オプション）
  csp: {
    connectDomains: ["https://api.example.com"],
    resourceDomains: ["https://cdn.example.com"],
  },
  // サンドボックス権限（オプション）
  permissions: {},
  // 境界線の表示（オプション）
  prefersBorder: true,
};

/** MCP App コンポーネント */
export function App(props: {
  input: { data: Array<{ label: string; value: number }>; chartType: string };
  output: { chartId: string } | null;
  meta: Record<string, unknown> | null;
}) {
  const { input, output } = props;
  return (
    <div>
      <h1>Chart: {output?.chartId}</h1>
      <Chart type={input.chartType} data={input.data} />
    </div>
  );
}
```

#### 4.1.3 型定義

```typescript
// config の型
interface ToolConfig<TInput, TOutput> {
  title?: string;
  description: string;                    // 必須
  inputSchema?: Record<string, ZodType>;  // Zod スキーマ
  outputSchema?: Record<string, ZodType>; // Zod スキーマ
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    openWorldHint?: boolean;
  };
}

// handler の型（config.inputSchema から推論）
type ToolHandler<TInput, TOutput> = (
  args: TInput,
  extra: RequestHandlerExtra
) => Promise<CallToolResult & { structuredContent?: TOutput }>;

// CallToolResult
interface CallToolResult {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
    | { type: "resource_link"; uri: string; name: string; mimeType?: string }
  >;
  structuredContent?: object;
  isError?: boolean;
}

// appMeta の型（@modelcontextprotocol/ext-apps より）
interface AppMeta {
  csp?: {
    connectDomains?: string[];
    resourceDomains?: string[];
    frameDomains?: string[];
    baseUriDomains?: string[];
  };
  permissions?: {
    camera?: {};
    microphone?: {};
    geolocation?: {};
    clipboardWrite?: {};
  };
  domain?: string;
  prefersBorder?: boolean;
}

// App コンポーネントの props 型（handler から推論）
interface AppProps<TInput, TOutput, TMeta> {
  input: TInput;
  output: TOutput | null;
  meta: TMeta | null;
}
```

### 4.2 Resources

```typescript
// resources/config.ts
import { z } from "zod";

export const name = "app-config";

export const config = {
  uri: "config://app/settings",  // リソース URI
  title: "App Configuration",
  description: "アプリケーション設定",
  mimeType: "application/json",   // デフォルト: application/json
};

export async function handler(uri: URL): Promise<ResourceResult> {
  return {
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify({ theme: "dark", language: "ja" }),
    }],
  };
}
```

### 4.3 Prompts

```typescript
// prompts/code-review.ts
import { z } from "zod";

export const name = "code-review";

export const config = {
  title: "Code Review",
  description: "コードレビューを実施",
  argsSchema: {
    code: z.string().describe("レビュー対象のコード"),
    language: z.string().optional().describe("プログラミング言語"),
  },
};

export function handler(args: { code: string; language?: string }) {
  return {
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Please review this ${args.language || ""} code:\n\n${args.code}`,
      },
    }],
  };
}
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
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ツールのインポート（自動生成）
import * as tool_weather from "./tools/weather.ts";
import * as tool_chart from "./tools/chart.tsx";
import tool_chart_html from "virtual:chapplin-app-html:show_chart";

// リソースのインポート（自動生成）
import * as resource_config from "./resources/config.ts";

// プロンプトのインポート（自動生成）
import * as prompt_review from "./prompts/code-review.ts";

/**
 * Create a new MCP server instance with all registered tools, resources, and prompts.
 */
export function createMcpServer() {
  const server = new McpServer({
    name: "chapplin-server",
    version: "1.0.0",
  });

  // ツール登録
  server.registerTool(tool_weather.name, tool_weather.config, tool_weather.handler);

  // UI 付きツール登録
  {
    const uri = `ui://${tool_chart.name}/app.html`;
    server.registerTool(
      tool_chart.name,
      {
        ...tool_chart.config,
        _meta: { ui: { resourceUri: uri } },
      },
      tool_chart.handler
    );
    server.registerResource(
      tool_chart.name,
      uri,
      {
        description: tool_chart.config.description,
        mimeType: "text/html;profile=mcp-app",
        _meta: { ui: tool_chart.appMeta ?? {} },
      },
      async () => ({
        contents: [{
          uri,
          mimeType: "text/html;profile=mcp-app",
          text: tool_chart_html,
        }],
      })
    );
  }

  // リソース登録
  server.registerResource(
    resource_config.name,
    resource_config.config.uri,
    resource_config.config,
    resource_config.handler
  );

  // プロンプト登録
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

---

## 7. 型生成システム

### 7.1 概要

React Router や SvelteKit のように、ツール定義から型を自動生成します。

### 7.2 生成される型ファイル

```typescript
// .chapplin/types.d.ts（自動生成）

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

### 7.3 MCP App 内での型安全な callTool

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

### 9.4 開発コマンド

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
| 4.2 | 型定義ファイル生成（`.chapplin/types.d.ts`） | [x] |

### Phase 5: 開発サーバー [Medium]

| タスク | 説明 | 状態 |
|--------|------|------|
| 5.1 | プレビュー UI（ホスト側） | [x] |
| 5.2 | MCP サーバー起動 | [ ] |
| 5.3 | HMR 対応 | [ ] |

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
