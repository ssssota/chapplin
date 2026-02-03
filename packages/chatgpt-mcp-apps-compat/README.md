# chatgpt-mcp-apps-compat

A compatibility layer that allows you to use the [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) interface with the [OpenAI Apps SDK](https://developers.openai.com/apps-sdk/reference) implementation.

## Background

OpenAI Apps SDK and MCP Apps were developed through different paths, so they are not directly compatible. OpenAI Apps SDK was introduced first to enable interactive UI components within ChatGPT. Later, MCP Apps was developed as a standardized extension to the MCP protocol, following similar patterns but with different interfaces.

This package bridges the gap by providing a `ChatGptApp` class that implements the MCP Apps `App` interface (`IApp`) while using the OpenAI Apps SDK's `window.openai` API internally. This allows developers to write code using the MCP Apps interface while running in ChatGPT environments.

## Installation

```bash
npm install chatgpt-mcp-apps-compat
# or
pnpm add chatgpt-mcp-apps-compat
# or
yarn add chatgpt-mcp-apps-compat
```

## Usage

### Basic Example

```typescript
import { ChatGptApp } from "chatgpt-mcp-apps-compat";

// Create an app instance
const app = new ChatGptApp();

// Set up event handlers
app.ontoolinput = (params) => {
  console.log("Tool input:", params.arguments);
  // Update your UI with tool arguments
};

app.ontoolresult = (params) => {
  if (params.isError) {
    console.error("Tool execution failed:", params.content);
  } else {
    console.log("Tool output:", params.content);
  }
};

app.onhostcontextchanged = (params) => {
  if (params.theme === "dark") {
    document.body.classList.add("dark-theme");
  }
  if (params.displayMode) {
    console.log("Display mode changed to:", params.displayMode);
  }
};

// Call a tool on the server
const result = await app.callServerTool({
  name: "get_weather",
  arguments: { location: "Tokyo" },
});

// Get host information
const capabilities = app.getHostCapabilities();
const version = app.getHostVersion();
const context = app.getHostContext();
```

### Working with Host Context

```typescript
const context = app.getHostContext();

if (context?.theme === "dark") {
  // Apply dark theme
}

if (context?.displayMode === "fullscreen") {
  // Handle fullscreen mode
}

// Request display mode change
await app.requestDisplayMode({ mode: "fullscreen" });
```

### Sending Messages

```typescript
await app.sendMessage({
  role: "user",
  content: [{ type: "text", text: "Show me details for item #42" }],
});
```

### Opening External Links

```typescript
const result = await app.openLink({ url: "https://example.com" });
if (result.isError) {
  console.warn("Link request was denied");
}
```

## API Mapping

The following table shows how MCP Apps methods map to OpenAI Apps SDK APIs:

| MCP Apps | OpenAI Apps SDK | Notes |
|----------|----------------|-------|
| `callServerTool()` | `window.openai.callTool()` | Direct mapping |
| `sendMessage()` | `window.openai.sendFollowUpMessage()` | Content is converted to prompt text |
| `openLink()` / `sendOpenLink()` | `window.openai.openExternal()` | Direct mapping |
| `requestDisplayMode()` | `window.openai.requestDisplayMode()` | Direct mapping |
| `getHostCapabilities()` | Inferred from `window.openai` | Returns inferred capabilities |
| `getHostVersion()` | Inferred from `window.openai` | Returns fixed values ("ChatGPT" / "1.0.0") |
| `getHostContext()` | Built from `window.openai` globals | Constructed from theme, locale, displayMode, etc. |
| `ontoolinput` | `window.openai.toolInput` + `openai:set_globals` event | Monitors toolInput changes |
| `ontoolinputpartial` | `window.openai.toolInput` + `openai:set_globals` event | Treated as complete input |
| `ontoolresult` | `window.openai.toolOutput` + `openai:set_globals` event | Monitors toolOutput changes |
| `onhostcontextchanged` | `openai:set_globals` event | Monitors context changes |
| `sendLog()` | `console.*` methods | Logs to browser console |
| `sendSizeChanged()` | N/A | No-op (OpenAI Apps SDK handles this automatically) |
| `setupSizeChangedNotifications()` | `ResizeObserver` | Monitors DOM size changes |

## Limitations

### Unsupported Features

The following MCP Apps features are not implemented because OpenAI Apps SDK doesn't have directly corresponding functionality:

- `onteardown` - Teardown request handler (no equivalent in OpenAI Apps SDK)
- `oncalltool` - Tool call handler (tools are called through `callServerTool` instead)
- `onlisttools` - Tool list handler (not applicable in OpenAI Apps SDK)
- `ontoolcancelled` - Tool cancellation notifications (not available in OpenAI Apps SDK)
- `updateModelContext()` - Model context updates (no direct equivalent)

### Behavioral Differences

- **Partial Input**: `ontoolinputpartial` is treated as complete input since OpenAI Apps SDK doesn't have the concept of partial/streaming tool arguments.
- **Size Changes**: `sendSizeChanged()` is a no-op because OpenAI Apps SDK automatically handles size changes through `maxHeight`.
- **Logging**: `sendLog()` outputs to the browser console instead of sending logs to the host.

### Environment Requirements

- **Browser Only**: This package only works in browser environments where `window.openai` is available (typically within ChatGPT's iframe).
- **Runtime Check**: The constructor throws an error if `window.openai` is not available.

## TypeScript Support

This package is written in TypeScript and provides full type definitions. The `ChatGptApp` class implements the `IApp` interface, which is derived from MCP Apps' `App` class by excluding low-level `Protocol` methods.

```typescript
import type { IApp } from "chatgpt-mcp-apps-compat";
import { ChatGptApp } from "chatgpt-mcp-apps-compat";

// ChatGptApp implements IApp
const app: IApp = new ChatGptApp();
```

## Related Projects

- [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) - The MCP Apps specification and SDK
- [OpenAI Apps SDK](https://developers.openai.com/apps-sdk) - OpenAI's Apps SDK documentation
- [Chapplin](https://github.com/ssssota/chapplin) - A ChatGPT Apps framework that uses this compatibility layer

## License

MIT
