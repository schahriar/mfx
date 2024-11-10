import { definitions as WebMDefinitions } from "./WebM";
import { definitions as EffectsDefinitions } from "./Effects";
import { definitions as EditingDefinitions } from "./Editing";
import { definitions as SourceDefinitions } from "./Source";
import { definitions as ContainerDefinitions } from "./Container";

export default [
  ...ContainerDefinitions,
  ...WebMDefinitions,
  ...EffectsDefinitions,
  ...EditingDefinitions,
  ...SourceDefinitions
];
