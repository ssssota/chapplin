# chapplin (内部メモ)

このファイルは内部向けの簡易メモです。ユーザー向けの説明は以下を参照してください。

- `packages/chapplin/README.md`
- `packages/chapplin/docs/design-fixed.md`

## ざっくりの流れ

1. `tools/` / `resources/` / `prompts/` に `define*` を置く
2. `chapplin:register` で MCP サーバーへ一括登録
3. UI 付きツールは `defineApp` で JSX UI を定義

## 例（UI 付きツール）

```tsx
import { defineTool, defineApp } from "chapplin";
import z from "zod";

export const tool = defineTool({
  name: "get_todos",
  config: {
    description: "Get todos",
    inputSchema: {},
    outputSchema: {
      todos: z.array(z.object({ id: z.number(), title: z.string() })),
    },
  },
  async handler() {
    return {
      content: [{ type: "text", text: "ok" }],
      structuredContent: { todos: [{ id: 1, title: "Sample" }] },
    };
  },
});

export const app = defineApp<typeof tool>({
  config: { appInfo: { name: "todos", version: "1.0.0" } },
  ui: (props) => (
    <div>
      {props.output?.structuredContent?.todos.map((todo) => (
        <div key={todo.id}>{todo.title}</div>
      ))}
    </div>
  ),
});
```
