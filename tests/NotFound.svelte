<script lang="ts">
  import type { TestDefinition } from "./types";

  export let definitions: TestDefinition[] = [];
</script>

<div class="container">
  {#each definitions as def}
    <a href={def.path}>
      <div>
        <h3>{def.title}</h3>
        <p>{def.description}</p>
        <hr/>
      </div>
    </a>
  {/each}
</div>

<style>
  .container {
    padding: 40px;
  }

  a {
    display: block;
    color: inherit;
    text-decoration: none;
    opacity: 0.8;
    transition: all 0.25s ease;
    padding: 16px 0;
  }

  hr {
    opacity: 0.2;
    margin: 8px 0;
  }

  a:hover {
    opacity: 1;
  }
</style>
