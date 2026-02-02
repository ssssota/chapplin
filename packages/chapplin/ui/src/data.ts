import * as v from "valibot";

const toolPreviewSchema = v.object({
	kind: v.literal("toolPreview"),
	tool: v.string(),
});
const toolListSchema = v.object({
	kind: v.literal("toolList"),
	tools: v.array(v.string()),
});
const dataSchema = v.union([toolPreviewSchema, toolListSchema]);

export type DataOutput = v.InferOutput<typeof dataSchema>;
export type DataInput = v.InferInput<typeof dataSchema>;

export function resolve(data: string): DataOutput | undefined {
	try {
		return v.parse(dataSchema, JSON.parse(data));
	} catch {
		return undefined;
	}
}
