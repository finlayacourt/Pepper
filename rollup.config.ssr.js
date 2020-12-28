import { ssr } from "./pepper/rollup"
import resolve from "@rollup/plugin-node-resolve"
import css from "rollup-plugin-css-only"

const production = !process.env.ROLLUP_WATCH;

export default [
	{
		input: ["src/pages/Home.svelte", "src/pages/Post.svelte", "src/Layout.svelte"],
		output: {
			dir: "dist",
			format: "cjs",
			exports: "named"
		},
		plugins: [
			ssr({ production }),
			resolve({ browser: true }),
			css({ output: "bundle.css" })
		],
		watch: { clearScreen: false }
	}
]