<script context="module">
	export async function preload() {
		const response = await this.fetch("https://jsonplaceholder.typicode.com/posts")
		const data = await response.json()
		return data.slice(0, 5).map(post => ({ path: `/post/${post.id}`, data: { post } }))
	}
</script>

<script>
	import Like from "../components/Like.svelte"
	export let post
</script>

<svelte:head>
	<title>Post {post.id}</title>
</svelte:head>

<article>
	<h2>{post.title}</h2>
	{#each post.body.split("\n") as paragraph}
		<p>{paragraph}</p>
	{/each}
	<Like hydrate={{ id: post.id }} />
</article>
