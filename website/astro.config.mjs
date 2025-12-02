// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	base: "/chapplin/",
	integrations: [
		starlight({
			title: "Chapplin",
			description: "Build ChatGPT Apps with type-safe JSX and MCP servers",
			logo: {
				light: "./public/logo.svg",
				dark: "./public/logo-dark.svg",
				replacesTitle: true,
			},
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/ssssota/chapplin",
				},
			],
			editLink: {
				baseUrl: "https://github.com/ssssota/chapplin/edit/main/website/",
			},
			sidebar: [
				{
					label: "Getting Started",
					items: [{ label: "Quick Start", slug: "guides/getting-started" }],
				},
				{
					label: "Guides",
					items: [
						{ label: "Framework Integration", slug: "guides/frameworks" },
					],
				},
				{
					label: "Reference",
					items: [{ label: "API Reference", slug: "reference/api" }],
				},
			],
		}),
	],
});
