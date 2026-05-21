import { defineConfig } from 'elit/config';

export default defineConfig({
  dev: {
    port: 5173,
  },
  build: {
    entry: 'src/renderer/index.ts',
    outDir: 'dist',
    format: 'esm',
    copy: [{ from: 'src/index.html', to: 'index.html' }],
  },
  desktop: {
    mode: 'native',
    native: {
      entry: './src/main/index.ts',
    },
    platform: 'windows',
  },
});
