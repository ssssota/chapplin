import { parseArgs } from "node:util";
import { syncTypeGeneration } from "./vite/plugins/type-generation.js";

function printUsage() {
	console.log(`chapplin <command>

Commands:
  sync    Generate .chapplin/types from tools/resources/prompts

Options for "sync":
  --root <path>           Project root (default: current directory)
  --tools-dir <path>      Tools directory (default: tools)
  --resources-dir <path>  Resources directory (default: resources)
  --prompts-dir <path>    Prompts directory (default: prompts)
  -h, --help              Show this help
`);
}

async function main() {
	const args = parseArgs({
		allowPositionals: true,
		options: {
			help: { type: "boolean", short: "h" },
			root: { type: "string" },
			"tools-dir": { type: "string" },
			"resources-dir": { type: "string" },
			"prompts-dir": { type: "string" },
		},
	});

	const command = args.positionals[0];
	if (args.values.help || !command) {
		printUsage();
		return;
	}

	switch (command) {
		case "sync": {
			const result = await syncTypeGeneration({
				root: args.values.root ?? process.cwd(),
				toolsDir: args.values["tools-dir"],
				resourcesDir: args.values["resources-dir"],
				promptsDir: args.values["prompts-dir"],
			});
			console.log(
				`[chapplin] Generated types in ${result.outputDir} (${result.tools} tools, ${result.resources} resources, ${result.prompts} prompts)`,
			);
			return;
		}
		default:
			console.error(`[chapplin] Unknown command: ${command}`);
			printUsage();
			process.exitCode = 1;
	}
}

await main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`[chapplin] ${message}`);
	process.exitCode = 1;
});
