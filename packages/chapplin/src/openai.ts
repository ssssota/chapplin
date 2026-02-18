/**
 * @see https://developers.openai.com/apps-sdk/reference
 */

export const SECURITY_SCHEMES = "securitySchemes";
export const OUTPUT_TEMPLATE = "openai/outputTemplate";
export const WIDGET_ACCESSIBILE = "openai/widgetAccessible";
export const TOOL_INVOCATION_INVOKING = "openai/toolInvocation/invoking";
export const TOOL_INVOCATION_INVOKED = "openai/toolInvocation/invoked";
/**
 * @see https://developers.openai.com/apps-sdk/reference#tool-descriptor-parameters
 */
export type ToolDescriptorMeta = {
	[SECURITY_SCHEMES]?: string[];
	/** Resource URI for component HTML template */
	[OUTPUT_TEMPLATE]?: string;
	/**
	 * Allow component→tool calls through the client bridge
	 * @default false
	 */
	[WIDGET_ACCESSIBILE]?: boolean;
	/**
	 * Short status text while the tool runs
	 * @maxLength 64
	 */
	[TOOL_INVOCATION_INVOKING]?: string;
	/**
	 * Short status text after the tool completes
	 * @maxLength 64
	 */
	[TOOL_INVOCATION_INVOKED]?: string;
};

export const WIDGET_DESCRIPTION = "openai/widgetDescription";
export const WIDGET_PREFERS_BORDER = "openai/widgetPrefersBorder";
export const WIDGET_CSP = "openai/widgetCSP";
export const WIDGET_DOMAIN = "openai/widgetDomain";
/**
 * @see https://developers.openai.com/apps-sdk/reference#component-resource-_meta-fields
 */
export type ComponentResourceMeta = {
	/**
	 * Human-readable summary surfaced to the model when the component loads, reducing redundant assistant narration
	 */
	[WIDGET_DESCRIPTION]?: string;
	/**
	 * Hint that the component should render inside a bordered card when supported
	 */
	[WIDGET_PREFERS_BORDER]?: boolean;
	/**
	 * Define `connect_domains` and `resource_domains` arrays for the component’s CSP snapshot
	 */
	[WIDGET_CSP]?: {
		connect_domains?: string[];
		resource_domains?: string[];
	};
	/**
	 * Optional dedicated subdomain for hosted components
	 */
	[WIDGET_DOMAIN]?: string;
};

export const LOCALE = "openai/locale";
export const USER_AGENT = "openai/userAgent";
export const USER_LOCATION = "openai/userLocation";
export const SUBJECT = "openai/subject";
/**
 * @see https://developers.openai.com/apps-sdk/reference#_meta-fields-the-client-provides
 */
export type ClientProvidedMeta = {
	/**
	 * Requested locale (BCP 47)
	 */
	[LOCALE]?: string;
	/**
	 * User agent hint for analytics or formatting
	 */
	[USER_AGENT]?: string;
	/**
	 * Coarse location hint
	 */
	[USER_LOCATION]?: {
		city?: string;
		region?: string;
		country?: string;
		timezone?: string;
		longitude?: number;
		latitude?: number;
	};
	/**
	 * Anonymized user id sent to MCP servers for the purposes of rate limiting and identification
	 */
	[SUBJECT]?: string;
};

/**
 * @see https://developers.openai.com/apps-sdk/build/custom-ux#understand-the-windowopenai-api
 */
declare global {
	interface Window {
		openai: API & OpenAiGlobals;
	}

	interface WindowEventMap {
		[SET_GLOBALS_EVENT_TYPE]: SetGlobalsEvent;
	}
}
export const SET_GLOBALS_EVENT_TYPE = "openai:set_globals";
type UnknownObject = Record<string, unknown>;
export type OpenAiGlobals<
	ToolInput extends UnknownObject = UnknownObject,
	ToolOutput extends UnknownObject = UnknownObject,
	ToolResponseMetadata extends UnknownObject = UnknownObject,
	WidgetState extends UnknownObject = UnknownObject,
> = {
	readonly theme: Theme;
	readonly userAgent: UserAgent;
	readonly locale: string;

	// layout
	readonly maxHeight: number;
	readonly displayMode: DisplayMode;
	readonly safeArea: SafeArea;

	// state
	readonly toolInput: ToolInput;
	readonly toolOutput: ToolOutput | null;
	readonly toolResponseMetadata: ToolResponseMetadata | null;
	readonly widgetState: WidgetState | null;
};
export type Theme = "light" | "dark";
export type UserAgent = {
	device: { type: DeviceType };
	capabilities: {
		hover: boolean;
		touch: boolean;
	};
};
export type DeviceType = "mobile" | "tablet" | "desktop" | "unknown";
export type DisplayMode = "pip" | "inline" | "fullscreen";
export type SafeArea = {
	insets: SafeAreaInsets;
};
export type SafeAreaInsets = {
	top: number;
	bottom: number;
	left: number;
	right: number;
};
export class SetGlobalsEvent extends CustomEvent<{
	globals: Partial<OpenAiGlobals>;
}> {
	readonly type = SET_GLOBALS_EVENT_TYPE;
}
type API = {
	/** Calls a tool on your MCP. Returns the full response. */
	callTool<T>(name: string, args: Record<string, unknown>): Promise<T>;

	/** Triggers a followup turn in the ChatGPT conversation */
	sendFollowUpMessage(args: { prompt: string }): Promise<void>;

	/** Opens an external link, redirects web page or mobile app */
	openExternal(payload: { href: string }): void;

	/** For transitioning an app from inline to fullscreen or pip */
	requestDisplayMode(args: { mode: DisplayMode }): Promise<{
		/**
		 * The granted display mode. The host may reject the request.
		 * For mobile, PiP is always coerced to fullscreen.
		 */
		mode: DisplayMode;
	}>;

	setWidgetState<WidgetState>(state: WidgetState): Promise<void>;
};
