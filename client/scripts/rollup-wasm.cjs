const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === '@rollup/rollup-win32-x64-msvc') {
    return originalLoad.call(
      this,
      '@rollup/wasm-node/dist/native.js',
      parent,
      isMain,
    );
  }

  return originalLoad.call(this, request, parent, isMain);
};
