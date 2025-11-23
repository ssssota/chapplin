import type { Plugin } from "vite";
import { chapplinBuild } from "./build/index.js";
import { chapplinDev } from "./dev/index.js";
import type { Options } from "./types.js";

export function chapplin(opts: Options = {}): Plugin[] {
	return [
		chapplinBuild(opts),
		// ...chapplinDev(opts)
	];
}
