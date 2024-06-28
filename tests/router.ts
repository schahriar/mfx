import TestWrapper from "./TestWrapper.svelte";
import NotFound from "./NotFound.svelte";
import definitions from "./definitions";

const url = new URL(window.location.href);

const def = definitions.find((def) => def.path === url.pathname);

if (def) {
  new (TestWrapper as any)({
    target: document.body,
    props: {
      input: def.input,
      process: def.process,
      output: def.output,
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
