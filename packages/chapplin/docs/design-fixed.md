# chapplin 設計書（清書）

> MCP Server と MCP Apps を構築するためのオールインワンフレームワーク

**目的**
- MCP サーバーと MCP Apps（UI）を、ファイルベースの定義と Vite プラグインで一体的に扱う。
- define* API から型を推論し、UI と MCP を型安全に繋ぐ。

**対象外**
- MCP ホスト（チャット UI 側）の実装
- 本番用の UI ホスト UI（dev-ui 以外の UI）

---

**概要**
chapplin は Vite ベースのフレームワークで、`tools/`・`resources/`・`prompts/` のファイルを自動収集し、MCP サーバーへの登録関数と型定義を生成する。UI 付きツールは MCP Apps としてビルドされ、`chapplin:register` が MCP に登録する。

**主要特徴**
- ファイルベース収集（tools/resources/prompts）
- `defineTool` → `defineApp` の型推論チェーン
- Vite プラグイン群で SSR ビルド・UI ビルド・型生成・dev サーバーを提供
- UI は React / Preact / Solid / Hono の JSX をサポート

---

**依存関係**
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
  "dependencies": {
    "vite-plugin-dev-api": "^0.2.1",
    "vite-plugin-singlefile": "*"
  }
}
```

---

**MCP 概要（前提）**
- **Tools**: LLM が呼び出せる関数。
- **Resources**: 読み取り専用データ。
- **Prompts**: 再利用可能なテンプレート。
- **MCP Apps**: `@modelcontextprotocol/ext-apps` による UI 表示機能。

---

**ディレクトリ構成**
```
project/
├── tools/                  # MCP ツール
│   ├── weather.ts
│   ├── chart.tsx           # UI 付きツール
│   └── nested/deep.ts
├── resources/              # MCP リソース
│   └── config.ts
├── prompts/                # プロンプト
│   └── review.ts
├── src/
│   └── index.ts            # MCP サーバーのエントリ
├── vite.config.ts
└── tsconfig.json
```

**ファイル収集規則**
- `tools/`: `**/*.{ts,tsx}` かつ `defineTool` を含むファイル
- `resources/`: `**/*.ts` かつ `defineResource` を含むファイル
- `prompts/`: `**/*.ts` かつ `definePrompt` を含むファイル

**名前解決**
- 収集時の `name` は **ファイルパス由来**（例: `tools/nested/deep.ts` → `nested/deep`）
- MCP のツール名は `defineTool({ name: ... })` で決まる

---

**define* API**

**Tools**
```ts
// tools/weather.ts
import { defineTool } from "chapplin";
import z from "zod";

export const tool = defineTool({
  name: "get_weather",
  config: {
    title: "Weather Lookup",
    description: "指定した都市の天気を取得",
    inputSchema: {
      city: z.string(),
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
      _meta: { raw: weather.raw },
    };
  },
});
```

- `inputSchema` / `outputSchema` は `defineTool` で必須
- `structuredContent` は `outputSchema` と一致することを想定
- `_meta` は UI 側でのみ使う拡張データ（型推論対象）

**Apps（UI 付きツール）**
```tsx
// tools/chart.tsx
import { defineTool, defineApp } from "chapplin";
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
  async handler(args) {
    const chartId = generateId();
    const chartData = await fetchChartData(args.data);
    return {
      content: [{ type: "text", text: `Chart ${chartId} created` }],
      structuredContent: { chartId },
      _meta: { chartData },
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
    prefersBorder: true,
  },
  ui: (props) => (
    <div>
      <h1>Chart: {props.output?.structuredContent?.chartId}</h1>
      {props.output?._meta && <Chart data={props.output._meta.chartData} />}
    </div>
  ),
});
```

- `defineApp` は **`defineApp<typeof tool>` が必須**（型推論のため）
- `config` は `new App(appInfo, capabilities, options)` に渡すパラメータ
- `meta` は MCP App のメタ情報（CSP 等）
- `ui` は JSX で記述（Hono の場合は `hono/jsx`）

**Resources**
```ts
import { defineResource } from "chapplin";

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
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ theme: "dark", language: "ja" }),
        },
      ],
    };
  },
});
```

**Prompts**
```ts
import { definePrompt } from "chapplin";
import z from "zod";

export const prompt = definePrompt({
  name: "code-review",
  config: {
    title: "Code Review",
    description: "コードレビューを実施",
    argsSchema: {
      code: z.string(),
      language: z.string().optional(),
    },
  },
  handler(args) {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please review this ${args.language ?? ""} code:\n\n${args.code}`,
          },
        },
      ],
    };
  },
});
```

**Export ルール**
- `tool` / `app` / `resource` / `prompt` を **named export** で公開する
- 複数 export を前提にしていない（1 ファイル 1 定義）

---

**UI ランタイム（chapplin/client/*）**

**共通仕様**
- `init(appDef)` が UI を `#root` にマウントする
- `@modelcontextprotocol/ext-apps` の `App` を生成し `connect()` する
- `ontoolinput` / `ontoolresult` / `onhostcontextchanged` を購読して UI に反映
- `hostContext.styles.variables` があれば `applyHostStyleVariables` を適用
- 初期描画時の `input` / `output` / `hostContext` は `undefined`

**フレームワーク別**
- React: `chapplin/client/react`
- Preact: `chapplin/client/preact`
- Solid: `chapplin/client/solid`
- Hono: `chapplin/client/hono`（`hono/jsx` + `hono/jsx/dom`）

UI 側では `chapplin/react` などの `useApp()` を使用できる。

---

**Vite プラグイン構成**

```ts
export function chapplin(opts: Options): Plugin[] {
  return [
    ssrBuild(opts),
    fileCollector(opts),
    virtualModule(opts),
    ...appEntry(opts),
    clientBuild(opts),
    typeGeneration(opts),
    ...devServer(),
  ];
}
```

**各プラグインの役割**
- `ssrBuild`: `build.ssr` に `opts.entry` を設定
- `fileCollector`: tools/resources/prompts を収集（`define*` の文字列検出）
- `virtualModule`: `chapplin:register` と `virtual:chapplin-app-html:*` を提供
- `appEntry`: `virtual:chapplin-app-entry` と `.html` を提供
- `clientBuild`: UI ツールを単一 HTML にビルド（オンデマンド）
- `typeGeneration`: `.chapplin/types/` を生成
- `devServer`: dev UI / MCP / iframe 配信

---

**仮想モジュール**

**`chapplin:register`**
- MCP サーバーに tools/resources/prompts を登録する関数を生成
- UI 付きツールは `ui://{tool.name}/app.html` をリソースとして登録

**`virtual:chapplin-app-html:{fileName}`**
- UI ツールの HTML を返す仮想モジュール
- `clientBuild` がオンデマンドで `vite build` を実行して HTML を生成

**`virtual:chapplin-app-entry` / `virtual:chapplin-app-entry.html`**
- dev サーバー / client ビルド共通の entry
- `init(app)` を呼ぶだけの薄いラッパ

---

**ビルドフロー**
1. SSR エントリ（`opts.entry`）を Vite でビルド
2. `chapplin:register` 生成時に UI ツールの HTML をオンデマンド生成
3. HTML はモジュール内にインライン化され、`dist/` に別出力はしない

**出力**
```
dist/
└── index.js   # サーバーエントリ
```

---

**開発サーバー**

**主要エンドポイント**
- `/` : dev-ui（`packages/chapplin/dist/index.html` を配信）
- `/mcp` : MCP エンドポイント（StreamableHTTP）
- `/iframe/tools/:name` : MCP App iframe 表示
- `/api/*` : dev-ui 用補助 API

**/api**
- `GET /api/files` : 収集済み tools/resources/prompts
- `POST /api/tools/:name/execute` : 未実装プレースホルダ
- `GET /api/server/status` : 稼働確認

**/mcp の挙動**
- リクエストごとに `McpServer` を作成
- 収集済みファイルを `runnerImport` で読み込み、登録
- `StreamableHTTPServerTransport` で処理

**/iframe/tools/:name の挙動**
1. 収集済み `name`（ファイルパス由来）で一致を試す
2. 一致しなければ `tool.name` を読み込み照合
3. ビルド済み HTML があれば返却
4. それ以外は `virtual:chapplin-app-entry` を変換して埋め込み

---

**型生成**

`.chapplin/types/` に以下を生成する。
- `register.d.ts` : `chapplin:register` の型
- `tools.d.ts` : `chapplin:tools`（input/output の型）
- `resources.d.ts` : `chapplin:resources`（uri の型）
- `prompts.d.ts` : `chapplin:prompts`（args の型）

**tsconfig 設定例**
```json
{
  "compilerOptions": {
    "rootDirs": [".", "./.chapplin/types"]
  },
  "include": ["src", "tools", "resources", "prompts", ".chapplin/types"]
}
```

---

**制約・注意点**
- 収集は AST 解析ではなく **文字列検出** のため誤検出の可能性がある
- `tool` / `app` / `resource` / `prompt` の **named export が必須**
- dev-ui がビルドされていない場合、`/` は 404 になる
- UI ツールの HTML はビルド時にメモリ生成され、`dist/` には出力されない
- Solid は `jsxFactory: "h"` / `jsxFragment: "Fragment"` を使用
- Hono は `hono/jsx` を前提とし、`hono/jsx/dom` の `render` で描画
