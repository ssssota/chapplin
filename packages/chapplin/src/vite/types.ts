export type Target = "react" | "preact" | "hono";
type ArrayOr<T> = T | T[];
export type Options = {
	/** @default './src/index.ts' */
	entry?: ArrayOr<string>;
	/** @default 'tsconfig.json' */
	tsconfigPath?: string;
	target?: Target;
};
