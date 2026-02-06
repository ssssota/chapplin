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
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register } from "chapplin:register";
import { Hono } from "hono";

const server = new McpServer({ name: "my-app", version: "1.0.0" });
register(server);
// ... connect transport, serve
```

`chapplin:register` は chapplin が提供する仮想モジュールで、`register(server: McpServer): void` を export する。渡した MCP サーバーに、`tools/`・`resources/`・`prompts/` 以下の定義を一括で登録する。サーバーの生成やトランスポート接続は利用側で行う。
MCP App 用リソースは、ビルド時に vite-plugin-singlefile で単一 HTML にバンドルされ、`export default "..."` の形でモジュール化されて `chapplin:register` 内でインポート・登録される。

### 開発サーバー

開発サーバーでは、MCP App のプレビューと MCP サーバーが起動する。
MCP App のプレビューは、実際のアプリを動かす iframe と、それを操作するホスト UI で構成される。
MCP サーバーは `chapplin:register` を利用したエントリをオンデマンドでビルドし、起動する。

プレビュー UI は Preact ベースの SPA として実装される。HTML のベタ書きでは限界があるため、コンポーネントベースの設計により、機能追加や変更が容易になる。
