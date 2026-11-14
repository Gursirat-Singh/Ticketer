require('./rollup-wasm.cjs');

import('../node_modules/vitest/vitest.mjs').catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
