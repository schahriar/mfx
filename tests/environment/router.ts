import TestEnvironment from "./TestEnvironment.svelte";
import NotFound from "./NotFound.svelte";
import definitions from "../definitions";

const url = new URL(window.location.href);

console.log({definitions});

const def = definitions.filter(Boolean).find((def) => `/${def.id}` === url.pathname);

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
