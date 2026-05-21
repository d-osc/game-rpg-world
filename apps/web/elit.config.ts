import { defineConfig } from 'elit/config';

export default defineConfig({
  dev: {
    port: 5173,
  },
  build: {
    entry: 'src/main.ts',
    outDir: 'dist',
    format: 'esm',
    copy: [{ from: 'index.html', to: 'index.html' }],
  },
});
