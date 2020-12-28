<script>
	export let id
	let liked = false
</script>

<style>
	button {
		font-weight: 700;
	}
</style>

<button on:click={() => liked = !liked}>{(liked) ? "Likey" : "Unlike"} {id}</button>