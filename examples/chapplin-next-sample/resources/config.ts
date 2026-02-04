/** リソース名 */
export const name = "app-config";

/** リソース設定 */
export const config = {
	uri: "config://app/settings",
	title: "App Configuration",
	description: "アプリケーション設定",
	mimeType: "application/json",
};

/** リソースハンドラー */
export async function handler(uri: URL) {
	const settings = {
		theme: "dark",
		language: "ja",
		version: "1.0.0",
	};

	return {
		contents: [
			{
				uri: uri.href,
				mimeType: "application/json",
				text: JSON.stringify(settings, null, 2),
			},
		],
	};
}
