<script context="module">
	export async function preload() {
		const response = await this.fetch("https://jsonplaceholder.typicode.com/posts")
		const data = await response.json()
		return [{ path: "/", data: { posts: data.slice(0, 5) } }]
	}
</script>

<script>
	export let posts
</script>

<svelte:head>
	<title>Home</title>
</svelte:head>

<style>
	a {
		display: block;
		margin-bottom: 0.6rem;
	}
</style>

<nav>
	{#each posts as post} 
		<a href="/post/{post.id}">{post.title}</a>
	{/each}
</nav>
