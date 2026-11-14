require('./rollup-wasm.cjs');

import('../node_modules/vite/bin/vite.js').catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
