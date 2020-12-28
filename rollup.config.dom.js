import { dom } from "./pepper/rollup"
import resolve from "@rollup/plugin-node-resolve"
import livereload from "rollup-plugin-livereload"
import { terser } from "rollup-plugin-terser"
import { babel, getBabelOutputPlugin } from '@rollup/plugin-babel'
import multiInput from 'rollup-plugin-multi-input';

const production = !process.env.ROLLUP_WATCH;

const defaultConfig = {
	input: "_pepper/components/*",
	watch: { clearScreen: false }
}

const defaultOutput = {
	format: "esm",
	sourcemap: !production	
}

const defaultPlugins = [
	multiInput({ relative: '_pepper/components/' }),
	dom({ production }),
	resolve({ browser: true }),
	production && terser(),
]

const defaultBabel = {
	extensions: ['.js', '.mjs', '.html', '.svelte'],
	babelHelpers: 'runtime',
	exclude: ['node_modules/@babel/**'],
	plugins: [
		'@babel/plugin-syntax-dynamic-import',
		['@babel/plugin-transform-runtime', { useESModules: true }]
	]
}

export default [
	{	
		...defaultConfig,
		output: {
			...defaultOutput,
			dir: "dist/components/module"
		},
		plugins: [
			...defaultPlugins,
			babel({
				...defaultBabel,
				presets: [
					['@babel/preset-env', { targets: { esmodules: true } }]
				]
			}),
			!production && livereload(),
		]
	},
	{
		...defaultConfig,
		output: {
			...defaultOutput,
			dir: "dist/components/nomodule",
			plugins: [
				getBabelOutputPlugin({
					plugins: ["@babel/plugin-transform-modules-systemjs"]
				})
			]
		},
		plugins: [
			...defaultPlugins,
			babel({
				...defaultBabel,
				presets: [
					['@babel/preset-env', { targets: 'IE 11' }]
				]
			})
		]
	}
]