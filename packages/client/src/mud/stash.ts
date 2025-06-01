import { createStash } from "@latticexyz/stash/internal";
import config from "contracts/mud.config";

// For some reason when importing config in Node.js, instead of just
// being the object, it's wrapped in an object with a `default` property.
export const stash: ReturnType<typeof createStash<typeof config>> = createStash(
  "default" in config ? (config.default as typeof config) : config
);
