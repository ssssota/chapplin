import { definePrompt } from "chapplin-next";
import z from "zod";

export const prompt = definePrompt({
	name: "code-review",
	config: {
		description: "コードレビューを行うためのプロンプトテンプレート",
		argsSchema: {
			language: z.string().describe("プログラミング言語"),
			focus: z
				.string()
				.optional()
				.describe("レビューの焦点（例: security, performance, readability）"),
		},
	},
	handler(args) {
		const focusText = args.focus ? `特に「${args.focus}」の観点から` : "";

		return {
			messages: [
				{
					role: "user" as const,
					content: {
						type: "text" as const,
						text: `あなたは経験豊富な${args.language}開発者です。${focusText}以下のコードをレビューしてください。

以下の観点からレビューをお願いします：
1. コードの品質と可読性
2. 潜在的なバグや問題点
3. パフォーマンスの改善点
4. ベストプラクティスの遵守
${args.focus ? `5. ${args.focus}に関する具体的な改善点` : ""}

レビュー対象のコードを貼り付けてください：`,
					},
				},
			],
		};
	},
});
