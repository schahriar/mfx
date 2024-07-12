import TestEnvironment from "./TestEnvironment.svelte";
import NotFound from "./NotFound.svelte";
import definitions from "../definitions";

const url = new URL(window.location.href);

const def = definitions.find((def) => def.path === url.pathname);

if (def) {
  new (TestEnvironment as any)({
    target: document.body,
    props: {
      definition: def,
    }
  });
} else {
  new (NotFound as any)({
    target: document.body,
    props: {
      definitions
    }
  });
}
