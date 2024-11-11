import { definitions as WebMDefinitions } from "./WebM.spec";
import { definitions as EffectsDefinitions } from "./Effects.spec";
import { definitions as EditingDefinitions } from "./Editing.spec";
import { definitions as SourceDefinitions } from "./Source.spec";
import { definitions as ContainerDefinitions } from "./Container.spec";

export default [
  ...ContainerDefinitions,
  ...WebMDefinitions,
  ...EffectsDefinitions,
  ...EditingDefinitions,
  ...SourceDefinitions
];
