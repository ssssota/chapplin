import type {
	ExportNamedDeclaration,
	Identifier,
	Node,
	VariableDeclarator,
} from "estree";
import { parse } from "oxc-parser";
import { walk } from "zimmerframe";

/** Information extracted from a tool file */
export interface ParsedToolFile {
	/** Tool name (from `export const name = "..."`) */
	name: string | null;
	/** Whether the file has a config export */
	hasConfig: boolean;
	/** Whether the file has a handler export */
	hasHandler: boolean;
	/** Whether the file has an App export */
	hasApp: boolean;
	/** Whether the file has an appMeta export */
	hasAppMeta: boolean;
	/** Raw inputSchema source (for type extraction) */
	inputSchemaSource: string | null;
	/** Raw outputSchema source (for type extraction) */
	outputSchemaSource: string | null;
}

/** Information extracted from a resource file */
export interface ParsedResourceFile {
	/** Resource name */
	name: string | null;
	/** Resource URI */
	uri: string | null;
	/** Whether the file has required exports */
	hasConfig: boolean;
	hasHandler: boolean;
}

/** Information extracted from a prompt file */
export interface ParsedPromptFile {
	/** Prompt name */
	name: string | null;
	/** Whether the file has required exports */
	hasConfig: boolean;
	hasHandler: boolean;
	/** Raw argsSchema source */
	argsSchemaSource: string | null;
}

/**
 * Parse a tool file and extract export information
 */
export async function parseToolFile(
	filePath: string,
	code: string,
): Promise<ParsedToolFile> {
	const result: ParsedToolFile = {
		name: null,
		hasConfig: false,
		hasHandler: false,
		hasApp: false,
		hasAppMeta: false,
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

			// Handle `export const name = "..."`
			if (decl.declaration?.type === "VariableDeclaration") {
				for (const declarator of decl.declaration.declarations) {
					const d = declarator as VariableDeclarator;
					if (d.id.type !== "Identifier") continue;
					const varName = (d.id as Identifier).name;

					if (varName === "name" && d.init?.type === "Literal") {
						state.name = String(d.init.value);
					} else if (varName === "config") {
						state.hasConfig = true;
						// Extract inputSchema and outputSchema from config object
						if (d.init?.type === "ObjectExpression") {
							for (const prop of d.init.properties) {
								if (
									prop.type === "Property" &&
									prop.key.type === "Identifier"
								) {
									const key = prop.key.name;
									if (key === "inputSchema" && prop.range) {
										state.inputSchemaSource = code.slice(
											prop.range[0],
											prop.range[1],
										);
									} else if (key === "outputSchema" && prop.range) {
										state.outputSchemaSource = code.slice(
											prop.range[0],
											prop.range[1],
										);
									}
								}
							}
						}
					} else if (varName === "appMeta") {
						state.hasAppMeta = true;
					}
				}
			}

			// Handle `export function handler` or `export async function handler`
			if (decl.declaration?.type === "FunctionDeclaration") {
				const funcName = decl.declaration.id?.name;
				if (funcName === "handler") {
					state.hasHandler = true;
				} else if (funcName === "App") {
					state.hasApp = true;
				}
			}

			// Handle `export { name, config, handler }` (re-exports)
			if (decl.specifiers) {
				for (const spec of decl.specifiers) {
					if (
						spec.type === "ExportSpecifier" &&
						spec.exported.type === "Identifier"
					) {
						const exportedName = spec.exported.name;
						if (exportedName === "name") {
							// Can't extract value from re-export
						} else if (exportedName === "config") {
							state.hasConfig = true;
						} else if (exportedName === "handler") {
							state.hasHandler = true;
						} else if (exportedName === "App") {
							state.hasApp = true;
						} else if (exportedName === "appMeta") {
							state.hasAppMeta = true;
						}
					}
				}
			}
		},
	});

	return result;
}

/**
 * Parse a resource file and extract export information
 */
export async function parseResourceFile(
	filePath: string,
	code: string,
): Promise<ParsedResourceFile> {
	const result: ParsedResourceFile = {
		name: null,
		uri: null,
		hasConfig: false,
		hasHandler: false,
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

					if (varName === "name" && d.init?.type === "Literal") {
						state.name = String(d.init.value);
					} else if (varName === "config") {
						state.hasConfig = true;
						// Extract URI from config object
						if (d.init?.type === "ObjectExpression") {
							for (const prop of d.init.properties) {
								if (
									prop.type === "Property" &&
									prop.key.type === "Identifier" &&
									prop.key.name === "uri" &&
									prop.value.type === "Literal"
								) {
									state.uri = String(prop.value.value);
								}
							}
						}
					}
				}
			}

			if (decl.declaration?.type === "FunctionDeclaration") {
				if (decl.declaration.id?.name === "handler") {
					state.hasHandler = true;
				}
			}
		},
	});

	return result;
}

/**
 * Parse a prompt file and extract export information
 */
export async function parsePromptFile(
	filePath: string,
	code: string,
): Promise<ParsedPromptFile> {
	const result: ParsedPromptFile = {
		name: null,
		hasConfig: false,
		hasHandler: false,
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

					if (varName === "name" && d.init?.type === "Literal") {
						state.name = String(d.init.value);
					} else if (varName === "config") {
						state.hasConfig = true;
						// Extract argsSchema from config object
						if (d.init?.type === "ObjectExpression") {
							for (const prop of d.init.properties) {
								if (
									prop.type === "Property" &&
									prop.key.type === "Identifier" &&
									prop.key.name === "argsSchema" &&
									prop.range
								) {
									state.argsSchemaSource = code.slice(
										prop.range[0],
										prop.range[1],
									);
								}
							}
						}
					}
				}
			}

			if (decl.declaration?.type === "FunctionDeclaration") {
				if (decl.declaration.id?.name === "handler") {
					state.hasHandler = true;
				}
			}
		},
	});

	return result;
}
