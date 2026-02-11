# chapplin

A framework for building MCP Servers with MCP Apps.

## Quick Start

```bash
npm create chapplin@latest
```

### How to define tools and apps

```tsx
// tools/chart.tsx
import { defineTool, defineApp } from "chapplin";
import z from "zod";

export const tool = defineTool({
  name: "show_chart",
  config: {
    description: "Visualize data",
    inputSchema: { data: z.array(z.object({ label: z.string(), value: z.number() })) },
    outputSchema: { chartId: z.string() },
  },
  async handler(args) {
    return {
      content: [{ type: "text", text: "ok" }],
      structuredContent: { chartId: "chart-1" },
      _meta: { chartData: args.data },
    };
  },
});

export const app = defineApp<typeof tool>({
  config: { appInfo: { name: "chart-app", version: "1.0.0" } },
  ui: (props) => (
    <div>
      <h1>{props.output?.structuredContent?.chartId}</h1>
      {props.output?._meta && <pre>{JSON.stringify(props.output._meta)}</pre>}
    </div>
  ),
});
```

## License

MIT
