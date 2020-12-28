<script>
	export let template
</script>

<svelte:head>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/dark.css">
</svelte:head>

<header><h1>A very peppery blog!</h1></header>
<main>{@html template}</main>