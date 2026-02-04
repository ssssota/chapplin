import { z } from "zod";

/** プロンプト名 */
export const name = "code-review";

/** プロンプト設定 */
export const config = {
	description: "コードレビューを行うためのプロンプトテンプレート",
	arguments: [
		{
			name: "language",
			description: "プログラミング言語",
			required: true,
		},
		{
			name: "focus",
			description: "レビューの焦点（例: security, performance, readability）",
			required: false,
		},
	],
};

/** プロンプトハンドラー */
export async function handler(args: { language: string; focus?: string }) {
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
}
