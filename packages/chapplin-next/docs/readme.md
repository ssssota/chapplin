# chapplin

chapplin is an all-in-one framework for building MCP Server includes MCP Apps (or ChatGPT Apps).

## 概要

### ディレクトリ構成

```
.
├── tools/                  # MCPツールのスクリプトを配置
│   ├── exampleTool.tsx     # MCPツールの例
│   └── ...
├── resources/              # MCPリソースを配置
│   ├── exampleResource.ts  # MCPリソースの例
│   └── ...
├── prompts/                # プロンプトテンプレートを配置
│   ├── examplePrompt.ts    # プロンプトテンプレートの例
│   └── ...
├── vite.config.ts          # chapplinはViteプラグインとして提供されるため、Viteの設定ファイルが必要
├── main.ts                 # chapplinのエントリーポイント
└── ...
```

1. `tools/**/*.tsx?` として配置したスクリプトをMCPのツールとして登録する。
    - `export {name,config,handler}` が必須
        - `@modelcontextprotocol/ext-apps/server` の `registerAppTool` でMCPサーバーに登録
    - `export {app}` でMCP Appのためのリソースが登録できる
        - appがあるとき、 `export {appMeta}` も必須
        - `@modelcontextprotocol/ext-apps/server` の `registerAppResource` でMCPサーバーに登録
    - resourcesやpromptsも同様（appやappMetaは不要）
2. Viteプラグインとして提供される
    - ビルド
    - 開発サーバー（プレビューが提供される）
3. Type-safe
    - ツールの定義で `config` から `handler` の型が推論される
    - `handler` から `app` の型が推論される
    - React RouterやSvelteKitのような型生成システム
    - ツールの定義も共有され、MCP AppでcallToolする場合も型が推論される
4. vite-plugin-singlefile
    - リソースはvite-plugin-singlefileにより単一のHTMLファイルにまとめられる

### ビルド

`main.ts` をエントリーポイントとしてViteでビルドする。

初期設定では、以下のようなコードになっている（仮）

```ts
import mcpServer from 'chapplin:mcp-server';
import { Hono } from 'hono';
const app = new Hono();
app.post('/mcp', () => {
  // ... handle MCP requests
});
export default app;
```

`chapplin:mcp-server` はchapplinが提供する仮想モジュール。MCPServerのインスタンスがdefault exportされる。
`chapplin:mcp-server` は `tools/`, `resources/`, `prompts/` 以下のファイルを自動的にインポートし、MCPサーバーに登録する。
MCP Appのためのリソースは単一HTMLファイルにした状態でリソースとして登録するので、ビルド時に、vite-plugin-singlefileでクライアントビルドも行う。出力したHTMLファイルは `export default ${JSON.stringify(htmlContent)}` のような形でモジュール化され、 `chapplin:mcp-server` 内でインポート、登録される。

### 開発サーバー

開発サーバーでは、MCP Appのプレビューと、MCPサーバーが起動する。
MCP Appのプレビューは、実際のアプリケーションを動作するiframeと、それをコントロールするホスト側UIで構築される。
MCPサーバーは `chapplin:mcp-server` をオンデマンドでビルドし、起動する。
