# chapplin E2E テスト方針

## 目的
- chapplin の **Vite プラグイン（dev サーバー含む）** と **MCP Apps UI ランタイム** が、実際のサンプルプロジェクトで動作することを保証する。
- 単体テストでは拾えない「起動・通信・レンダリング・iframe 連携」までをカバーする。

## スコープ
- Vite dev サーバー起動
- `/api/*` の補助 API
- `/mcp` の JSON-RPC（tools/list・tools/call）
- `/iframe/tools/:name` の UI 配信
- dev-ui からの preview 実行（host bridge 経由）

## 非スコープ
- 低レベルな型推論・ユーティリティの単体テスト
- 個別 UI コンポーネントの見た目検証
- パフォーマンスや負荷テスト

## テスト対象プロジェクト
- `e2e/fixtures/chapplin-sample` に E2E 用フィクスチャを配置する
- `examples/chapplin-sample` をベースにコピーし、E2E 専用の依存関係・設定に固定する
- `get_todos`（UI 付き）と `get_weather`（UI なし）が揃っており、MCP + UI の基本動作を検証できる

## ツール選定
- Playwright を採用
- ブラウザ E2E と API 呼び出しを同一ランナーで扱える
- iframe 内 UI の検証が容易
- Vite dev サーバーとの統合が簡単

## ディレクトリ構成（案）
```
/e2e
  /specs
    dev-server.spec.ts
    mcp.spec.ts
    preview.spec.ts
  /helpers
    server.ts
    mcp-client.ts
  playwright.config.ts
```

## 主要シナリオ
- `GET /api/files` が tools/resources/prompts を返す
- `POST /mcp` の `tools/list` で `get_todos` と `get_weather` が取得できる
- `POST /mcp` の `tools/call` で `get_todos` が成功し、structuredContent が返る
- `GET /iframe/tools/get_todos` が HTML を返し、`#root` が存在する
- dev-ui で `get_todos` を Preview し、Run した結果が Output に表示される
- dev-ui で `get_todos` を Preview し、Run した結果が iframe 内に `TODO リスト` として表示される

## 実行フロー
- Playwright の `webServer` 機能で `examples/chapplin-sample` の dev サーバーを起動
- 起動確認は `/api/server/status` をポーリング
- テストは `baseURL` を設定して実行

## 実装方針メモ
- 速度重視で dev サーバー起動は 1 回だけ行う
- selector は `#input` / `#output` / `#frame` など固定 ID を優先
- `iframe` は `frameLocator("#frame")` を使って安定的に検証
- dev-ui が未ビルドだと `/` が 404 になるため、E2E 前に `pnpm -C packages/chapplin build:dev-ui` を実行する

## CI 想定
- `pnpm -C e2e playwright test` 形式で実行
- ブラウザは `chromium` のみから開始
- 将来的に `webkit` / `firefox` は追加検討

## 追加検討（後回し）
- build モードの E2E（`vite build` → `node dist/index.js`）
- 複数 framework target（react/preact/solid/hono）の横断テスト
- `chapplin:register` 型生成結果の実行時検証
