#!/usr/bin/env node

import OxlintHarness from './command.js';

OxlintHarness.run().catch((error) => {
  console.error(error);
  process.exit(1);
});