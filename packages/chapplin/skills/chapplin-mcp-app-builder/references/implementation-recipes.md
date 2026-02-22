# Implementation Recipes

Use these recipes for repeated MCP App tasks in existing `create-chapplin` projects.

## Recipe 1: Add a New MCP App-Enabled Tool

### When to use

Add a new tool in `tools/*.tsx` that needs both tool behavior and UI rendering.

### File to edit

- `tools/<new-tool>.tsx`

### Minimal code pattern

```tsx
import { defineApp, defineTool } from "chapplin";
import z from "zod";

export const tool = defineTool({
	name: "my_tool",
	config: {
		description: "Describe the tool",
		inputSchema: { query: z.string() },
		outputSchema: { items: z.array(z.string()) },
	},
	async handler(args) {
		const items = [args.query];
		return {
			content: [{ type: "text", text: `Found ${items.length} items` }],
			structuredContent: { items },
			_meta: { rawItems: items },
		};
	},
});

export const app = defineApp<typeof tool>({
	config: { appInfo: { name: "my-tool-app", version: "1.0.0" } },
	ui: (props) => (
		<div>
			{props.output?.structuredContent?.items.map((item) => (
				<div key={item}>{item}</div>
			))}
		</div>
	),
});
```

### Done criteria

- `defineApp<typeof tool>` generic is present.
- Tool call returns both `content` and typed `structuredContent`.
- UI renders from `props.output?.structuredContent` safely.

## Recipe 2: Add Host Interaction with `useApp` (`openLink`)

### When to use

Expose host actions (for example, opening docs) from UI.

### File to edit

- Existing `tools/<tool>.tsx` with `defineApp`

### Minimal code pattern

```tsx
import { useApp } from "chapplin/react"; // switch path per target

// inside ui:
const app = useApp();
const onClick = () => app.openLink({ url: "https://example.com/docs" });

return <button onClick={onClick}>Open docs</button>;
```

### Done criteria

- `useApp` import matches current target (`react`, `preact`, `solid`, or `hono`).
- Host action is wired to explicit UI event handler.
- Existing UI behavior remains unchanged except requested host interaction.

## Recipe 3: Keep LLM Output Compact, Move UI Payload to `_meta`

### When to use

Return rich chart/list payload to UI without bloating LLM-facing output.

### File to edit

- `tools/<tool>.tsx` handler and app UI section

### Minimal code pattern

```tsx
async handler() {
	const chartData = [{ label: "A", value: 1 }];
	return {
		content: [{ type: "text", text: "Chart ready" }],
		structuredContent: { total: chartData.length },
		_meta: { chartData },
	};
}

// in ui:
const total = props.output?.structuredContent?.total;
const chartData = props.output?._meta?.chartData;
```

### Done criteria

- `structuredContent` contains only machine-facing fields needed by tool contract.
- `_meta` carries UI-only data.
- UI handles missing output state before first tool result.
