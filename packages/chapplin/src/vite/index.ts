import type { Plugin } from "vite";
import { build } from "./plugins/build.js";
import { clientToolResolver } from "./plugins/client-tool-resolver.js";
import { devServer } from "./plugins/dev-server.js";
import type { Options } from "./types.js";

export function chapplin(opts: Options = {}): Plugin[] {
	return [build(opts), clientToolResolver(opts), devServer()];
}
