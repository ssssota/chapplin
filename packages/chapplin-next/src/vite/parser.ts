import type {
	CallExpression,
	ExportNamedDeclaration,
	Identifier,
	Node,
	ObjectExpression,
	Property,
	VariableDeclarator,
} from "estree";
import { parse } from "oxc-parser";
import { walk } from "zimmerframe";

/** Information extracted from a tool file (defineTool / defineApp format) */
export interface ParsedToolFile {
	/** Tool name (from defineTool({ name: "..." })) */
	name: string | null;
	/** Whether the file has a tool export (defineTool) */
	hasTool: boolean;
	/** Whether the file has an app export (defineApp) */
	hasApp: boolean;
	/** Raw inputSchema source (for type extraction) */
	inputSchemaSource: string | null;
	/** Raw outputSchema source (for type extraction) */
	outputSchemaSource: string | null;
}

/** Information extracted from a resource file (defineResource format) */
export interface ParsedResourceFile {
	/** Resource name */
	name: string | null;
	/** Resource URI */
	uri: string | null;
	/** Whether the file has a resource export (defineResource) */
	hasResource: boolean;
}

/** Information extracted from a prompt file (definePrompt format) */
export interface ParsedPromptFile {
	/** Prompt name */
	name: string | null;
	/** Whether the file has a prompt export (definePrompt) */
	hasPrompt: boolean;
	/** Raw argsSchema source */
	argsSchemaSource: string | null;
}

function getObjectProperty(
	obj: ObjectExpression,
	keyName: string,
): unknown {
	for (const prop of obj.properties) {
		if (prop.type !== "Property") continue;
		const key = (prop as Property).key;
		const name =
			key.type === "Identifier"
				? key.name
				: key.type === "Literal"
					? String(key.value)
					: null;
		if (name === keyName) {
			return (prop as Property).value;
		}
	}
	return undefined;
}

function extractFromDefineToolObject(
	obj: ObjectExpression,
	code: string,
): {
	name: string | null;
	inputSchemaSource: string | null;
	outputSchemaSource: string | null;
} {
	let name: string | null = null;
	let inputSchemaSource: string | null = null;
	let outputSchemaSource: string | null = null;

	const nameVal = getObjectProperty(obj, "name");
	if (nameVal && typeof nameVal === "object" && "value" in nameVal) {
		name = String((nameVal as { value: unknown }).value);
	}

	const configVal = getObjectProperty(obj, "config");
	if (
		configVal &&
		typeof configVal === "object" &&
		configVal.type === "ObjectExpression"
	) {
		const config = configVal as ObjectExpression;
		const inputProp = getObjectProperty(config, "inputSchema");
		if (inputProp && typeof inputProp === "object" && "range" in inputProp) {
			const r = (inputProp as { range: [number, number] }).range;
			if (r && r[0] != null && r[1] != null) {
				inputSchemaSource = code.slice(r[0], r[1]);
			}
		}
		const outputProp = getObjectProperty(config, "outputSchema");
		if (outputProp && typeof outputProp === "object" && "range" in outputProp) {
			const r = (outputProp as { range: [number, number] }).range;
			if (r && r[0] != null && r[1] != null) {
				outputSchemaSource = code.slice(r[0], r[1]);
			}
		}
	}

	return { name, inputSchemaSource, outputSchemaSource };
}

/**
 * Parse a tool file and extract export information (defineTool / defineApp format)
 */
export async function parseToolFile(
	filePath: string,
	code: string,
): Promise<ParsedToolFile> {
	const result: ParsedToolFile = {
		name: null,
		hasTool: false,
		hasApp: false,
		inputSchemaSource: null,
		outputSchemaSource: null,
	};

	const parsed = await parse(filePath, code, {
		sourceType: "module",
		range: true,
	});

	walk(parsed.program as Node, result, {
		ExportNamedDeclaration(node, { state }) {
			const decl = node as ExportNamedDeclaration;

			if (decl.declaration?.type === "VariableDeclaration") {
				for (const declarator of decl.declaration.declarations) {
					const d = declarator as VariableDeclarator;
					if (d.id.type !== "Identifier") continue;
					const varName = (d.id as Identifier).name;

					if (varName === "tool" && d.init?.type === "CallExpression") {
						const call = d.init as CallExpression;
						const callee =
							call.callee.type === "Identifier"
								? call.callee.name
								: null;
						if (callee === "defineTool" && call.arguments[0]?.type === "ObjectExpression") {
							state.hasTool = true;
							const extracted = extractFromDefineToolObject(
								call.arguments[0] as ObjectExpression,
								code,
							);
							if (extracted.name) state.name = extracted.name;
							if (extracted.inputSchemaSource)
								state.inputSchemaSource = extracted.inputSchemaSource;
							if (extracted.outputSchemaSource)
								state.outputSchemaSource = extracted.outputSchemaSource;
						}
					} else if (varName === "app" && d.init?.type === "CallExpression") {
						const call = d.init as CallExpression;
						const callee =
							call.callee.type === "Identifier"
								? call.callee.name
								: null;
						if (callee === "defineApp") {
							state.hasApp = true;
						}
					}
				}
			}
		},
	});

	return result;
}

function extractFromDefineResourceObject(
	obj: ObjectExpression,
): { name: string | null; uri: string | null } {
	let name: string | null = null;
	let uri: string | null = null;

	const nameVal = getObjectProperty(obj, "name");
	if (nameVal && typeof nameVal === "object" && "value" in nameVal) {
		name = String((nameVal as { value: unknown }).value);
	}

	const configVal = getObjectProperty(obj, "config");
	if (
		configVal &&
		typeof configVal === "object" &&
		configVal.type === "ObjectExpression"
	) {
		const uriVal = getObjectProperty(
			configVal as ObjectExpression,
			"uri",
		);
		if (uriVal && typeof uriVal === "object" && "value" in uriVal) {
			uri = String((uriVal as { value: unknown }).value);
		}
	}

	return { name, uri };
}

/**
 * Parse a resource file and extract export information (defineResource format)
 */
export async function parseResourceFile(
	filePath: string,
	code: string,
): Promise<ParsedResourceFile> {
	const result: ParsedResourceFile = {
		name: null,
		uri: null,
		hasResource: false,
	};

	const parsed = await parse(filePath, code, {
		sourceType: "module",
		range: true,
	});

	walk(parsed.program as Node, result, {
		ExportNamedDeclaration(node, { state }) {
			const decl = node as ExportNamedDeclaration;

			if (decl.declaration?.type === "VariableDeclaration") {
				for (const declarator of decl.declaration.declarations) {
					const d = declarator as VariableDeclarator;
					if (d.id.type !== "Identifier") continue;
					const varName = (d.id as Identifier).name;

					if (varName === "resource" && d.init?.type === "CallExpression") {
						const call = d.init as CallExpression;
						const callee =
							call.callee.type === "Identifier"
								? call.callee.name
								: null;
						if (callee === "defineResource" && call.arguments[0]?.type === "ObjectExpression") {
							state.hasResource = true;
							const extracted = extractFromDefineResourceObject(
								call.arguments[0] as ObjectExpression,
							);
							if (extracted.name) state.name = extracted.name;
							if (extracted.uri) state.uri = extracted.uri;
						}
					}
				}
			}
		},
	});

	return result;
}

function extractFromDefinePromptObject(
	obj: ObjectExpression,
	code: string,
): { name: string | null; argsSchemaSource: string | null } {
	let name: string | null = null;
	let argsSchemaSource: string | null = null;

	const nameVal = getObjectProperty(obj, "name");
	if (nameVal && typeof nameVal === "object" && "value" in nameVal) {
		name = String((nameVal as { value: unknown }).value);
	}

	const configVal = getObjectProperty(obj, "config");
	if (
		configVal &&
		typeof configVal === "object" &&
		configVal.type === "ObjectExpression"
	) {
		const argsProp = getObjectProperty(
			configVal as ObjectExpression,
			"argsSchema",
		);
		if (argsProp && typeof argsProp === "object" && "range" in argsProp) {
			const r = (argsProp as { range: [number, number] }).range;
			if (r && r[0] != null && r[1] != null) {
				argsSchemaSource = code.slice(r[0], r[1]);
			}
		}
	}

	return { name, argsSchemaSource };
}

/**
 * Parse a prompt file and extract export information (definePrompt format)
 */
export async function parsePromptFile(
	filePath: string,
	code: string,
): Promise<ParsedPromptFile> {
	const result: ParsedPromptFile = {
		name: null,
		hasPrompt: false,
		argsSchemaSource: null,
	};

	const parsed = await parse(filePath, code, {
		sourceType: "module",
		range: true,
	});

	walk(parsed.program as Node, result, {
		ExportNamedDeclaration(node, { state }) {
			const decl = node as ExportNamedDeclaration;

			if (decl.declaration?.type === "VariableDeclaration") {
				for (const declarator of decl.declaration.declarations) {
					const d = declarator as VariableDeclarator;
					if (d.id.type !== "Identifier") continue;
					const varName = (d.id as Identifier).name;

					if (varName === "prompt" && d.init?.type === "CallExpression") {
						const call = d.init as CallExpression;
						const callee =
							call.callee.type === "Identifier"
								? call.callee.name
								: null;
						if (callee === "definePrompt" && call.arguments[0]?.type === "ObjectExpression") {
							state.hasPrompt = true;
							const extracted = extractFromDefinePromptObject(
								call.arguments[0] as ObjectExpression,
								code,
							);
							if (extracted.name) state.name = extracted.name;
							if (extracted.argsSchemaSource)
								state.argsSchemaSource = extracted.argsSchemaSource;
						}
					}
				}
			}
		},
	});

	return result;
}
