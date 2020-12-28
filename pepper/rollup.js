import path from "path"
import { compile, parse, preprocess} from "svelte/compiler"
import vm from "vm"
import fs from "fs"
import fetch from "node-fetch"

import htmlmin from "html-minifier"
import postcss from "postcss"
import cssnano from "cssnano"
import autoprefixer from "autoprefixer"

const copyDir = (src, dest) => {
	if (!fs.existsSync(dest)) fs.mkdirSync(dest)
	const files = fs.readdirSync(src)
	for(var i = 0; i < files.length; i++) {
		const current = fs.lstatSync(path.join(src, files[i]))
		if (current.isDirectory()) {
			copyDir(path.join(src, files[i]), path.join(dest, files[i]))
		} else {
			fs.copyFileSync(path.join(src, files[i]), path.join(dest, files[i]))
		}
	}
}

const writeFile = (filename, content) => {
	const filepath = filename.replace(/\\/g,'/')

	let root = ""
	if (filepath[0] === "/") {
		root = "/"
		filepath = filepath.slice(1)
	}

	const folders = filepath.split("/").slice(0, -1)
	folders.reduce((acc, folder) => {
		const folderPath = `${acc}${folder}/`
		if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath)
		return folderPath
	}, root)

	fs.writeFileSync(`${root}${filepath}`, content)
}

const hasher = str => {
	str = str.replace(/\r/g, '')
	let hash = 5381
	let i = str.length
	while (i--) hash = ((hash << 5) - hash) ^ str.charCodeAt(i)
	return (hash >>> 0).toString(36)
}

export function ssr({ production }) {
	const cssCache = new Map
	const componentByPage = new Map
	const componentIds = new Set

	return { 
		name: "ssr",

		buildStart() {
			copyDir("./src/static", "./dist")
		},

		resolveId(importee) { 
			if (cssCache.has(importee)) return importee;
		},

		load(id) {
			if (cssCache.has(id)) return cssCache.get(id)
		},

		async transform(code, id) {
			const extension = path.extname(id)
			if (extension !== ".svelte") return null

			const dependencies = []
			
			if (this.getModuleInfo(id).isEntry) {
				const components = []

				const hydrateableComponentPattern = /<([a-zA-Z]+)[^>]+hydrate={([^]*?})}[^/>]*\/>/gim
				const matches = [...code.matchAll(hydrateableComponentPattern)]

				// Import hydrate component if needed
				if (matches.length > 0) {
					const hydrateComponentPath = path.resolve(process.cwd(), "pepper/Hydrate.svelte")
					code = code.replace("<script>", `<script>\n\timport Hydrate from "${hydrateComponentPath}"`)
				}

				const ast = parse(code).instance.content.body

				matches.forEach(([ wholeMatch, specifier, props ]) => {
					for (const node of ast) {
						if (
							node.type == "ImportDeclaration" &&
							node.specifiers.some(s => s.local.name == specifier)
						) {
							const componentId = path.resolve(id, "../", node.source.value)
							const hash = hasher(componentId)
							const filename = `${path.basename(componentId, ".svelte")}.${hasher(componentId)}.js`

							components.push({ componentId, filename })
							componentIds.add(componentId)
							
							code = code.replace(
								wholeMatch, 
								`<Hydrate component="${hash}" data={${props}}>
									<${specifier} {...${props}} />
								</Hydrate>`
							)
							return
						}
					}
				})

				componentByPage.set(id, components)
			}

			const processed = await preprocess(code, {
				style: async ({ content, attributes, filename }) => {
					if (attributes.type !== 'text/postcss') return
					const result = await postcss([cssnano, autoprefixer]).process(content, {
						from: filename,
						map: { inline: false }
					})
					return {
						code: result.css.toString(),
						map: result.map.toString()
					}
				}
			})

			const compiled = compile(processed.code, {
				hydratable: true,
				generate: "ssr",
				css: true,
				format: "esm",
				filename: path.relative(process.cwd(), id)
			})

			if (componentIds.has(id)) {
				const hydraterPath = path.resolve(process.cwd(), "pepper/hydrater.js")

				const source = 
				`import hydrater from "${hydraterPath}";\n` +
				`import component, { update } from "${id}";\n` +
				`hydrater(component, "${hasher(id)}", update)`

				writeFile(`./_pepper/components/${path.basename(id, ".svelte")}.${hasher(id)}.js`, source)
			}

			if (compiled.css.code) {
				const fname = id.replace(new RegExp(`\\${extension}$`), ".css")
				compiled.js.code += `\nimport ${JSON.stringify(fname)}\n`
				cssCache.set(fname, compiled.css)
			}

			if (this.addWatchFile) {
				dependencies.forEach(this.addWatchFile)
			} else {
				compiled.js.dependencies = dependencies
			}
			
			return compiled.js
		},

		async generateBundle(_, bundle) {
			const requireCache = new Map

			const wrapExport = code => {
				const sandbox = { exports: {}, require: wrapRequire }
				vm.runInNewContext(code, sandbox)
				return sandbox.exports
			}

			const wrapRequire = source => {
				if (requireCache.has(source)) return requireCache.get(source)
				if (source.startsWith(".")) {
					const filename = path.basename(source)
					const chunk = bundle[filename]
					const exported = wrapExport(chunk.code)
					requireCache.set(source, exported)
					return exported
				} else {
					return require(source)
				}
			}

			const template = fs.readFileSync("./pepper/template.html", {encoding: "utf-8"})

			const layoutFilename = path.resolve(process.cwd(), "src/Layout.svelte")
			const layoutChunk = Object.values(bundle).find(chunk => chunk.facadeModuleId === layoutFilename)
			const layoutRenderer = wrapExport(layoutChunk.code)
			const layoutComponents = componentByPage.get(layoutFilename)
			delete bundle[layoutChunk.fileName]

			const chunkPromises = Object.values(bundle).map(async chunk => {
				if (chunk.isEntry) {
					const renderer = wrapExport(chunk.code)
					const pages = await renderer.preload.bind({ fetch })()

					const pageComponents = componentByPage.get(chunk.facadeModuleId)
					const components = layoutComponents.filter(component => !pageComponents.includes(component)).concat(pageComponents)

					const scripts =
						`<script nomodule src="https://polyfill.io/v3/polyfill.min.js?features=fetch%2CPromise%2Cdefault"></script>\n` +
						`<script nomodule src="https://cdnjs.cloudflare.com/ajax/libs/systemjs/6.8.2/s.min.js"></script>\n` +
						components.map(({ filename }) => 
							`<script type="module" src="/components/module/${filename}"></script>\n`+
							`<script nomodule type="systemjs-module" src="/components/nomodule/${filename}"></script>\n`
						).join("\n")

					const pagePromises = pages.map(({ path, data }) => {
						const pageRendered = renderer.default.render(data)
						const layoutRendered = layoutRenderer.default.render({ template: pageRendered.html })

						const templateRendered = template
						.replace("%pepper.head%", pageRendered.head + layoutRendered.head)
						.replace("%pepper.html%", layoutRendered.html)
						.replace("%pepper.scripts%", (components.length) ? scripts : "")

						const minifyOptions = {
							collapseWhitespace: true,
							collapseInlineTagWhitespace: true,
						}

						this.emitFile({
							type: "asset",
							source: production ? htmlmin.minify(templateRendered, minifyOptions) : templateRendered,
							fileName: path.substring(1) + (path.endsWith("/") ? "" : "/") + "index.html"
						})
					})
					await Promise.all(pagePromises)
				}
				delete bundle[chunk.fileName]
			})
			await Promise.all(chunkPromises)
		}
	}
}

export function dom({ production }) {
	return {
		name: "dom",

		async transform(code, id) {
			const extension = path.extname(id)
			if (extension !== ".svelte") return null

			const compiled = compile(code, {
				hydratable: true,
				generate: "dom",
				css: false,
				format: "esm",
				filename: path.relative(process.cwd(), id),
				dev: production
			})
			return compiled.js	
		}
	}
}