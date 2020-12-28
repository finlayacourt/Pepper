export default (component, hash) => {
	const targets = document.querySelectorAll(`[data-component="${hash}"]`)
	targets.forEach(async target => {
		const data = JSON.parse(target.dataset.data)
		new component({
			target, 
			hydrate: true, 
			props: data
		})
	})
}