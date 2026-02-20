import type { Tool } from "@modelcontextprotocol/sdk/types.js";

type SchemaRecord = Record<string, unknown>;
type DraftValue = string | boolean;

export type ToolInputDraft = Record<string, DraftValue>;

interface ToolInputPropertySchema {
	type?: string;
	description?: string;
	default?: unknown;
	enum?: unknown[];
}

interface ToolInputFormProps {
	tool: Tool;
	draft: ToolInputDraft;
	onDraftChange: (name: string, value: DraftValue) => void;
}

function asRecord(value: unknown): SchemaRecord | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as SchemaRecord;
}

function getProperties(tool: Tool): Record<string, ToolInputPropertySchema> {
	const properties = asRecord(tool.inputSchema.properties);
	if (!properties) return {};

	const entries = Object.entries(properties).map(([name, schema]) => [
		name,
		asRecord(schema) ?? {},
	]);
	return Object.fromEntries(entries);
}

function getRequiredFields(tool: Tool): Set<string> {
	const required = tool.inputSchema.required;
	return new Set(Array.isArray(required) ? required : []);
}

function toDraftValue(schema: ToolInputPropertySchema): DraftValue {
	if (schema.default !== undefined) {
		if (schema.type === "boolean") {
			return Boolean(schema.default);
		}
		if (schema.enum && schema.enum.length > 0) {
			return JSON.stringify(schema.default);
		}
		return String(schema.default);
	}

	if (schema.enum && schema.enum.length > 0) {
		return JSON.stringify(schema.enum[0]);
	}

	if (schema.type === "boolean") {
		return false;
	}

	return "";
}

function parseEnumDraft(fieldName: string, value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		throw new Error(`Invalid enum value for '${fieldName}'`);
	}
}

export function createInitialInputDraft(tool: Tool): ToolInputDraft {
	const properties = getProperties(tool);
	const entries = Object.entries(properties).map(([name, schema]) => [
		name,
		toDraftValue(schema),
	]);
	return Object.fromEntries(entries);
}

export function buildInputFromDraft(
	tool: Tool,
	draft: ToolInputDraft,
): Record<string, unknown> {
	const properties = getProperties(tool);
	const requiredFields = getRequiredFields(tool);
	const result: Record<string, unknown> = {};

	for (const [name, schema] of Object.entries(properties)) {
		const draftValue = draft[name];
		const isRequired = requiredFields.has(name);

		if (schema.type === "boolean") {
			result[name] = Boolean(draftValue);
			continue;
		}

		const textValue = typeof draftValue === "string" ? draftValue.trim() : "";
		if (!textValue) {
			if (isRequired) {
				throw new Error(`'${name}' is required`);
			}
			continue;
		}

		if (schema.enum && schema.enum.length > 0) {
			result[name] = parseEnumDraft(name, textValue);
			continue;
		}

		if (schema.type === "number" || schema.type === "integer") {
			const num = Number(textValue);
			if (!Number.isFinite(num)) {
				throw new Error(`'${name}' must be a number`);
			}
			result[name] = schema.type === "integer" ? Math.trunc(num) : num;
			continue;
		}

		if (schema.type === "array" || schema.type === "object") {
			try {
				result[name] = JSON.parse(textValue);
			} catch {
				throw new Error(`'${name}' must be valid JSON`);
			}
			continue;
		}

		result[name] = textValue;
	}

	return result;
}

export function ToolInputForm({
	tool,
	draft,
	onDraftChange,
}: ToolInputFormProps) {
	const properties = getProperties(tool);
	const requiredFields = getRequiredFields(tool);

	if (Object.keys(properties).length === 0) {
		return (
			<div
				class="text-xs text-slate-500 dark:text-slate-400"
				data-testid="tool-input-empty"
			>
				This tool does not define input fields.
			</div>
		);
	}

	return (
		<div class="space-y-3">
			{Object.entries(properties).map(([name, schema]) => {
				const isRequired = requiredFields.has(name);
				const value = draft[name] ?? toDraftValue(schema);
				const labelClass =
					"text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
				const baseControlClass =
					"w-full border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
				const testId = `tool-input-${name}`;

				return (
					<div key={name} class="space-y-1">
						<label class={labelClass} for={testId}>
							{name}
							{isRequired ? " *" : ""}
						</label>
						{schema.description && (
							<p class="text-xs text-slate-500 dark:text-slate-500">
								{schema.description}
							</p>
						)}

						{schema.enum && schema.enum.length > 0 ? (
							<select
								id={testId}
								data-testid={testId}
								class={baseControlClass}
								value={
									typeof value === "string" ? value : JSON.stringify(value)
								}
								onChange={(e) => onDraftChange(name, e.currentTarget.value)}
							>
								{schema.enum.map((option) => {
									const optionValue = JSON.stringify(option);
									return (
										<option key={optionValue} value={optionValue}>
											{String(option)}
										</option>
									);
								})}
							</select>
						) : schema.type === "boolean" ? (
							<label
								class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200"
								for={testId}
							>
								<input
									id={testId}
									data-testid={testId}
									type="checkbox"
									checked={Boolean(value)}
									onChange={(e) => onDraftChange(name, e.currentTarget.checked)}
								/>
								Enabled
							</label>
						) : schema.type === "array" || schema.type === "object" ? (
							<textarea
								id={testId}
								data-testid={testId}
								class={`${baseControlClass} min-h-20 resize-y font-mono`}
								value={String(value)}
								onInput={(e) => onDraftChange(name, e.currentTarget.value)}
							/>
						) : (
							<input
								id={testId}
								data-testid={testId}
								type={
									schema.type === "number" || schema.type === "integer"
										? "number"
										: "text"
								}
								class={baseControlClass}
								value={typeof value === "string" ? value : String(value)}
								onInput={(e) => onDraftChange(name, e.currentTarget.value)}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}
