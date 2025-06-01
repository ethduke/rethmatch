import { createStash } from "@latticexyz/stash/internal";

import raw_config from "contracts/mud.config";
// For some reason when importing config in Node.js, instead of just
// being the object, it's wrapped in an object with a `default` property.
const config = "default" in raw_config ? (raw_config.default as typeof raw_config) : raw_config;

export const stash: ReturnType<typeof createStash<typeof config>> = createStash(config);
