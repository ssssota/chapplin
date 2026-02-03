import type {
	App,
	AppNotification,
	AppRequest,
	AppResult,
	McpUiHostCapabilities,
	McpUiHostContext,
	McpUiHostContextChangedNotification,
	McpUiMessageRequest,
	McpUiOpenLinkRequest,
	McpUiRequestDisplayModeRequest,
	McpUiResourceTeardownRequest,
	McpUiResourceTeardownResult,
	McpUiSizeChangedNotification,
	McpUiToolCancelledNotification,
	McpUiToolInputNotification,
	McpUiToolInputPartialNotification,
	McpUiToolResultNotification,
	McpUiUpdateModelContextRequest,
} from "@modelcontextprotocol/ext-apps";
import type {
	Protocol,
	RequestHandlerExtra,
	RequestOptions,
} from "@modelcontextprotocol/sdk/shared/protocol.js";
import type {
	CallToolRequest,
	CallToolResult,
	ContentBlock,
	Implementation,
	ListToolsRequest,
	LoggingMessageNotification,
} from "@modelcontextprotocol/sdk/types.js";

// OpenAI Apps SDKのイベントタイプ
const SET_GLOBALS_EVENT_TYPE = "openai:set_globals";

// OpenAI Apps SDKの型定義
type OpenAiAPI = {
	callTool<T>(name: string, args: Record<string, unknown>): Promise<T>;
	sendFollowUpMessage(args: { prompt: string }): Promise<void>;
	openExternal(payload: { href: string }): void;
	requestDisplayMode(args: { mode: "pip" | "inline" | "fullscreen" }): Promise<{
		mode: "pip" | "inline" | "fullscreen";
	}>;
	setWidgetState<WidgetState>(state: WidgetState): Promise<void>;
	theme: "light" | "dark";
	userAgent: {
		device: { type: "mobile" | "tablet" | "desktop" | "unknown" };
		capabilities: {
			hover: boolean;
			touch: boolean;
		};
	};
	locale: string;
	maxHeight: number;
	displayMode: "pip" | "inline" | "fullscreen";
	safeArea: {
		insets: {
			top: number;
			bottom: number;
			left: number;
			right: number;
		};
	};
	toolInput: unknown;
	toolOutput: unknown | null;
	toolResponseMetadata: unknown | null;
	widgetState: unknown | null;
};

declare global {
	interface Window {
		openai?: OpenAiAPI;
	}
}

/**
 * Interface type for MCP Apps' {@link App} and Open AI Apps SDK's {@link ChatGptApp} class.
 *
 * @see {@link App} MCP Apps' App class
 * @see {@link Protocol} MCP SDK's Protocol class
 */
export type IApp = Omit<
	App,
	keyof Protocol<AppRequest, AppNotification, AppResult>
>;

/**
 * App class that provides a compatibility layer between OpenAI Apps SDK and MCP Apps.
 *
 * This class implements the MCP Apps' `App` interface (`IApp`) and provides functionality
 * by using the OpenAI Apps SDK's `window.openai` API internally.
 *
 * ## Background
 *
 * OpenAI Apps SDK and MCP Apps were developed through different paths, so they are not
 * directly compatible. OpenAI Apps SDK was introduced first, and MCP Apps was developed
 * to follow its patterns. This class provides the MCP Apps interface while using the
 * OpenAI Apps SDK implementation.
 *
 * ## Usage
 *
 * ```typescript
 * const app = new ChatGptApp();
 *
 * // Set up event handlers
 * app.ontoolinput = (params) => {
 *   console.log("Tool input:", params.arguments);
 * };
 *
 * app.ontoolresult = (params) => {
 *   console.log("Tool result:", params.content);
 * };
 *
 * // Call a tool
 * const result = await app.callServerTool({
 *   name: "get_weather",
 *   arguments: { location: "Tokyo" },
 * });
 * ```
 *
 * ## Limitations
 *
 * - Only works in environments where `window.openai` is available (iframe within ChatGPT)
 * - Some MCP Apps features (`onteardown`, `oncalltool`, `onlisttools`, etc.) are not
 *   implemented because OpenAI Apps SDK doesn't have directly corresponding functionality
 * - `ontoolinputpartial` is treated as complete input (no concept of partial input)
 * - `ontoolcancelled` is not implemented (OpenAI Apps SDK doesn't have cancellation notifications)
 *
 * ## API Mapping
 *
 * | MCP Apps | OpenAI Apps SDK |
 * |----------|----------------|
 * | `callServerTool()` | `window.openai.callTool()` |
 * | `sendMessage()` | `window.openai.sendFollowUpMessage()` |
 * | `openLink()` | `window.openai.openExternal()` |
 * | `requestDisplayMode()` | `window.openai.requestDisplayMode()` |
 * | `getHostContext()` | Built from `window.openai` global values |
 * | `ontoolinput` | `window.openai.toolInput` + `openai:set_globals` event |
 * | `ontoolresult` | `window.openai.toolOutput` + `openai:set_globals` event |
 * | `onhostcontextchanged` | `openai:set_globals` event |
 *
 * @see {@link https://modelcontextprotocol.github.io/ext-apps/api/classes/app.App.html MCP Apps API Documentation}
 * @see {@link https://developers.openai.com/apps-sdk/reference OpenAI Apps SDK Reference}
 * @implements {IApp}
 */
export class ChatGptApp implements IApp {
	private _toolInputCallback?: (
		params: McpUiToolInputNotification["params"],
	) => void;
	// private _toolInputPartialCallback?: (
	// 	params: McpUiToolInputPartialNotification["params"],
	// ) => void;
	private _toolResultCallback?: (
		params: McpUiToolResultNotification["params"],
	) => void;
	// private _toolCancelledCallback?: (
	// 	params: McpUiToolCancelledNotification["params"],
	// ) => void;
	private _hostContextChangedCallback?: (
		params: McpUiHostContextChangedNotification["params"],
	) => void;
	// private _teardownCallback?: (
	// 	params: McpUiResourceTeardownRequest["params"],
	// 	extra: RequestHandlerExtra<AppRequest, AppNotification>,
	// ) => McpUiResourceTeardownResult | Promise<McpUiResourceTeardownResult>;
	// private _callToolCallback?: (
	// 	params: CallToolRequest["params"],
	// 	extra: RequestHandlerExtra<AppRequest, AppNotification>,
	// ) => Promise<CallToolResult>;
	// private _listToolsCallback?: (
	// 	params: ListToolsRequest["params"],
	// 	extra: RequestHandlerExtra<AppRequest, AppNotification>,
	// ) => Promise<{ tools: string[] }>;
	private _globalsEventListener?: (event: Event) => void;
	private _resizeObserver?: ResizeObserver;
	private _resizeCleanup?: () => void;
	private _hostCapabilities?: McpUiHostCapabilities;
	private _hostVersion?: Implementation;
	private _hostContext?: McpUiHostContext;

	/**
	 * Creates an instance of ChatGptApp.
	 *
	 * The constructor performs the following operations:
	 * 1. Checks for the existence of `window.openai` (throws an error if not available)
	 * 2. Sets up the `openai:set_globals` event listener
	 * 3. Initializes host information (capabilities, version, context)
	 *
	 * @throws {Error} Thrown when `window.openai` is not available
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   const app = new ChatGptApp();
	 *   console.log("App initialized successfully");
	 * } catch (error) {
	 *   console.error("Failed to initialize app:", error);
	 *   // window.openai is not available
	 * }
	 * ```
	 */
	constructor() {
		if (typeof window === "undefined" || !window.openai) {
			throw new Error("window.openai is not available");
		}

		// Set up event listener
		this._globalsEventListener = (event: Event) => {
			if (event.type === SET_GLOBALS_EVENT_TYPE) {
				const setGlobalsEvent = event as CustomEvent<{
					globals: Partial<OpenAiAPI>;
				}>;
				this._handleGlobalsChange(setGlobalsEvent.detail.globals);
			}
		};

		window.addEventListener(SET_GLOBALS_EVENT_TYPE, this._globalsEventListener);

		// Initialize host information
		this._updateHostInfo();
	}

	private _updateHostInfo(): void {
		if (typeof window === "undefined" || !window.openai) {
			return;
		}

		const openai = window.openai;

		// Infer host capabilities
		this._hostCapabilities = {
			serverTools: {
				listChanged: false,
			}, // OpenAI Apps SDK always supports server tools
		};

		// Host version information
		this._hostVersion = {
			name: "ChatGPT",
			version: "1.0.0", // Fixed value (actual version cannot be retrieved)
		};

		// Build host context
		this._hostContext = {
			theme: openai.theme,
			displayMode: openai.displayMode,
			locale: openai.locale,
			userAgent: JSON.stringify(openai.userAgent),
			platform:
				openai.userAgent.device.type === "mobile"
					? "mobile"
					: openai.userAgent.device.type === "tablet"
						? "desktop"
						: openai.userAgent.device.type === "desktop"
							? "desktop"
							: "web",
			deviceCapabilities: {
				touch: openai.userAgent.capabilities.touch,
				hover: openai.userAgent.capabilities.hover,
			},
			containerDimensions: {
				maxHeight: openai.maxHeight,
			},
			safeAreaInsets: {
				top: openai.safeArea.insets.top,
				right: openai.safeArea.insets.right,
				bottom: openai.safeArea.insets.bottom,
				left: openai.safeArea.insets.left,
			},
		};
	}

	private _handleGlobalsChange(globals: Partial<OpenAiAPI>): void {
		if (globals.toolInput !== undefined && this._toolInputCallback) {
			this._toolInputCallback({
				arguments: globals.toolInput as Record<string, unknown>,
			});
		}

		if (globals.toolOutput !== undefined && this._toolResultCallback) {
			const toolOutput = globals.toolOutput;
			if (toolOutput !== null) {
				// Convert toolOutput to CallToolResult format
				this._toolResultCallback({
					content: [{ type: "text", text: JSON.stringify(toolOutput) }],
					isError: false,
				});
			}
		}

		if (this._hostContextChangedCallback) {
			const contextChanges: Partial<McpUiHostContext> = {};
			if (globals.theme !== undefined) {
				contextChanges.theme = globals.theme;
			}
			if (globals.displayMode !== undefined) {
				contextChanges.displayMode = globals.displayMode;
			}
			if (globals.locale !== undefined) {
				contextChanges.locale = globals.locale;
			}
			if (globals.maxHeight !== undefined) {
				contextChanges.containerDimensions = {
					maxHeight: globals.maxHeight,
				};
			}
			if (globals.safeArea !== undefined) {
				contextChanges.safeAreaInsets = {
					top: globals.safeArea.insets.top,
					right: globals.safeArea.insets.right,
					bottom: globals.safeArea.insets.bottom,
					left: globals.safeArea.insets.left,
				};
			}

			if (Object.keys(contextChanges).length > 0) {
				// Update host context
				this._hostContext = { ...this._hostContext, ...contextChanges };
				this._hostContextChangedCallback(contextChanges as McpUiHostContext);
			}
		}
	}
	getHostCapabilities(): McpUiHostCapabilities | undefined {
		return this._hostCapabilities;
	}
	getHostVersion(): Implementation | undefined {
		return this._hostVersion;
	}
	getHostContext(): McpUiHostContext | undefined {
		return this._hostContext;
	}
	/**
	 * Sets a handler to receive complete tool input arguments.
	 *
	 * This handler is called when complete tool arguments are sent from the host.
	 * It monitors changes to `window.openai.toolInput` and detects changes through
	 * the `openai:set_globals` event.
	 *
	 * When the handler is set, the callback is executed immediately if there is
	 * a current `toolInput`.
	 *
	 * @param callback - Callback function that receives tool input
	 *
	 * @example
	 * ```typescript
	 * app.ontoolinput = (params) => {
	 *   console.log("Tool arguments:", params.arguments);
	 *   // Update UI, etc.
	 * };
	 * ```
	 */
	set ontoolinput(callback: (
		params: McpUiToolInputNotification["params"],
	) => void) {
		this._toolInputCallback = callback;
		// Execute callback immediately if there is a current toolInput
		if (typeof window !== "undefined" && window.openai?.toolInput) {
			callback({
				arguments: window.openai.toolInput as Record<string, unknown>,
			});
		}
	}
	/**
	 * Sets a handler to receive partial tool input arguments.
	 *
	 * **Note**: Since OpenAI Apps SDK doesn't have the concept of partial input,
	 * this handler is treated as complete input. It behaves the same as `ontoolinput`.
	 *
	 * @param callback - Callback function that receives partial tool input
	 *
	 * @example
	 * ```typescript
	 * app.ontoolinputpartial = (params) => {
	 *   // Display preview with partial arguments
	 *   console.log("Partial arguments:", params.arguments);
	 * };
	 * ```
	 */
	set ontoolinputpartial(callback: (
		params: McpUiToolInputPartialNotification["params"],
	) => void) {
		// this._toolInputPartialCallback = callback;
		// OpenAI Apps SDK doesn't have the concept of partial input, so treat as complete input
		if (typeof window !== "undefined" && window.openai?.toolInput) {
			callback({
				arguments: window.openai.toolInput as Record<string, unknown>,
			});
		}
	}
	/**
	 * Sets a handler to receive tool execution results.
	 *
	 * This handler is called when tool execution completes.
	 * It monitors changes to `window.openai.toolOutput` and detects changes through
	 * the `openai:set_globals` event.
	 *
	 * When the handler is set, the callback is executed immediately if there is
	 * a current `toolOutput`.
	 *
	 * @param callback - Callback function that receives tool results
	 *
	 * @example
	 * ```typescript
	 * app.ontoolresult = (params) => {
	 *   if (params.isError) {
	 *     console.error("Tool execution failed:", params.content);
	 *   } else {
	 *     console.log("Tool output:", params.content);
	 *   }
	 * };
	 * ```
	 */
	set ontoolresult(callback: (
		params: McpUiToolResultNotification["params"],
	) => void) {
		this._toolResultCallback = callback;
		// Execute callback immediately if there is a current toolOutput
		if (typeof window !== "undefined" && window.openai?.toolOutput) {
			const toolOutput = window.openai.toolOutput;
			callback({
				content: [{ type: "text", text: JSON.stringify(toolOutput) }],
				isError: false,
			});
		}
	}
	set ontoolcancelled(_callback: (
		params: McpUiToolCancelledNotification["params"],
	) => void) {
		// this._toolCancelledCallback = callback;
		// Not implemented because OpenAI Apps SDK doesn't have cancellation notifications
	}
	/**
	 * Sets a handler to receive host context changes.
	 *
	 * This handler is called when the host's context (theme, locale, display mode, etc.)
	 * changes. It detects changes through the `openai:set_globals` event.
	 *
	 * @param callback - Callback function that receives host context changes
	 *
	 * @example
	 * ```typescript
	 * app.onhostcontextchanged = (params) => {
	 *   if (params.theme === "dark") {
	 *     document.body.classList.add("dark-theme");
	 *   } else {
	 *     document.body.classList.remove("dark-theme");
	 *   }
	 *   if (params.displayMode) {
	 *     console.log("Display mode changed to:", params.displayMode);
	 *   }
	 * };
	 * ```
	 */
	set onhostcontextchanged(callback: (
		params: McpUiHostContextChangedNotification["params"],
	) => void) {
		this._hostContextChangedCallback = callback;
	}
	set onteardown(_callback: (
		params: McpUiResourceTeardownRequest["params"],
		extra: RequestHandlerExtra<AppRequest, AppNotification>,
	) => McpUiResourceTeardownResult | Promise<McpUiResourceTeardownResult>) {
		// this._teardownCallback = callback;
	}
	set oncalltool(_callback: (
		params: CallToolRequest["params"],
		extra: RequestHandlerExtra<AppRequest, AppNotification>,
	) => Promise<CallToolResult>) {
		// this._callToolCallback = callback;
	}
	set onlisttools(_callback: (
		params: ListToolsRequest["params"],
		extra: RequestHandlerExtra<AppRequest, AppNotification>,
	) => Promise<{ tools: string[] }>) {
		// this._listToolsCallback = callback;
	}
	assertCapabilityForMethod(_method: AppRequest["method"]): void {
		// Check that window.openai exists
		if (typeof window === "undefined" || !window.openai) {
			throw new Error("window.openai is not available");
		}
		// Assume OpenAI Apps SDK supports all methods
	}
	assertRequestHandlerCapability(_method: AppRequest["method"]): void {
		// Assume OpenAI Apps SDK is always available
		// Implementation always succeeds
	}
	assertNotificationCapability(_method: AppNotification["method"]): void {
		// Assume OpenAI Apps SDK is always available
		// Implementation always succeeds
	}
	/**
	 * Calls a tool on the server.
	 *
	 * Executes a tool on the MCP server through the host.
	 * Internally uses `window.openai.callTool()`.
	 *
	 * @param params - Tool name and arguments
	 * @param _options - Request options (currently unused)
	 * @returns Tool execution result
	 *
	 * @throws {Error} Thrown when `window.openai` is not available
	 *
	 * @example
	 * ```typescript
	 * try {
	 *   const result = await app.callServerTool({
	 *     name: "get_weather",
	 *     arguments: { location: "Tokyo" },
	 *   });
	 *   if (result.isError) {
	 *     console.error("Tool returned error:", result.content);
	 *   } else {
	 *     console.log("Tool output:", result.content);
	 *   }
	 * } catch (error) {
	 *   console.error("Tool call failed:", error);
	 * }
	 * ```
	 */
	async callServerTool(
		params: CallToolRequest["params"],
		_options?: RequestOptions,
	): Promise<CallToolResult> {
		if (typeof window === "undefined" || !window.openai) {
			throw new Error("window.openai is not available");
		}

		try {
			const result = await window.openai.callTool<CallToolResult>(
				params.name,
				(params.arguments as Record<string, unknown>) || {},
			);
			return result;
		} catch (error) {
			return {
				content: [
					{
						type: "text",
						text: error instanceof Error ? error.message : String(error),
					},
				],
				isError: true,
			};
		}
	}
	async sendMessage(
		params: McpUiMessageRequest["params"],
		_options?: RequestOptions,
	): Promise<{ [x: string]: unknown; isError?: boolean | undefined }> {
		if (typeof window === "undefined" || !window.openai) {
			throw new Error("window.openai is not available");
		}

		try {
			// OpenAI Apps SDK's sendFollowUpMessage only accepts prompt
			// Extract text from content
			const textContent = params.content
				.filter(
					(block): block is ContentBlock & { type: "text" } =>
						block.type === "text",
				)
				.map((block) => block.text)
				.join("\n");

			await window.openai.sendFollowUpMessage({ prompt: textContent });
			return {};
		} catch (error) {
			return {
				isError: true,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
	async sendLog(params: LoggingMessageNotification["params"]): Promise<void> {
		// OpenAI Apps SDKにはログ送信機能がないため、コンソールに出力
		const level = params.level || "info";
		const data = params.data;
		const logger = params.logger || "App";

		switch (level) {
			case "error":
			case "critical":
			case "alert":
			case "emergency":
				console.error(`[${logger}]`, data);
				break;
			case "warning":
				console.warn(`[${logger}]`, data);
				break;
			case "debug":
				console.debug(`[${logger}]`, data);
				break;
			default:
				console.log(`[${logger}]`, data);
		}
	}
	async updateModelContext(
		_params: McpUiUpdateModelContextRequest["params"],
		_options?: RequestOptions,
	): Promise<{
		_meta?:
			| {
					[x: string]: unknown;
					progressToken?: string | number | undefined;
					"io.modelcontextprotocol/related-task"?:
						| { taskId: string }
						| undefined;
			  }
			| undefined;
	}> {
		// OpenAI Apps SDKにはモデルコンテキスト更新機能がないため、空のPromiseを返す
		// 実際の実装では、sendMessageを使用するか、何もしない
		return {};
	}
	async openLink(
		params: McpUiOpenLinkRequest["params"],
		_options?: RequestOptions,
	): Promise<{ [x: string]: unknown; isError?: boolean | undefined }> {
		if (typeof window === "undefined" || !window.openai) {
			throw new Error("window.openai is not available");
		}

		try {
			window.openai.openExternal({ href: params.url });
			return {};
		} catch (error) {
			return {
				isError: true,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
	sendOpenLink = this.openLink.bind(this);
	async requestDisplayMode(
		params: McpUiRequestDisplayModeRequest["params"],
		_options?: RequestOptions,
	): Promise<{ [x: string]: unknown; mode: "inline" | "fullscreen" | "pip" }> {
		if (typeof window === "undefined" || !window.openai) {
			throw new Error("window.openai is not available");
		}

		try {
			const result = await window.openai.requestDisplayMode({
				mode: params.mode,
			});
			return {
				mode: result.mode,
			};
		} catch (_error) {
			// エラーが発生した場合、現在のdisplayModeを返す
			const currentMode = window.openai?.displayMode ?? "inline";
			return {
				mode: currentMode,
				isError: true,
			};
		}
	}
	async sendSizeChanged(
		_params: McpUiSizeChangedNotification["params"],
	): Promise<void> {
		// Do nothing because OpenAI Apps SDK doesn't have size change notification functionality
		// maxHeight is automatically updated
	}

	setupSizeChangedNotifications(): () => void {
		if (typeof window === "undefined" || typeof document === "undefined") {
			return () => {};
		}

		// Monitor size changes using ResizeObserver
		let rafId: number | null = null;

		const handleResize = () => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}

			rafId = requestAnimationFrame(() => {
				// Notify size change (currently does nothing, but extensible in the future)
				// OpenAI Apps SDK doesn't have direct size change notification functionality
				// const width = document.documentElement.clientWidth;
				// const height = document.documentElement.clientHeight;
			});
		};

		this._resizeObserver = new ResizeObserver(handleResize);
		this._resizeObserver.observe(document.documentElement);
		this._resizeObserver.observe(document.body);

		this._resizeCleanup = () => {
			if (this._resizeObserver) {
				this._resizeObserver.disconnect();
				this._resizeObserver = undefined;
			}
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
		};

		return this._resizeCleanup;
	}
}
