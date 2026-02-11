import { defineResource } from "chapplin";

export const resource = defineResource({
	name: "app-config",
	config: {
		uri: "config://app/settings",
		title: "App Configuration",
		description: "アプリケーション設定",
		mimeType: "application/json",
	},
	async handler(uri) {
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
	},
});
