<script>
	export let component
	export let data
</script>

<div data-component={component} data-data={JSON.stringify(data)}><slot /></div>