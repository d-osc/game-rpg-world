import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);

// elit.config.ts
import { defineConfig } from "./node_modules/elit/dist/index.mjs";
var elit_config_default = defineConfig({
  dev: {
    port: 5173,
    host: "0.0.0.0"
  },
  build: {
    entry: "src/main.ts",
    outDir: "dist",
    format: "esm"
  }
});
export {
  elit_config_default as default
};
