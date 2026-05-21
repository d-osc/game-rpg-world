import { defineConfig } from 'elit/config';

export default defineConfig({
  dev: {
    port: 5173,
    host: '0.0.0.0',
  },
  build: {
    entry: 'src/main.ts',
    outDir: 'dist',
    format: 'esm',
    copy: [{ from: 'src/index.html', to: 'index.html' }],
  },
  mobile: {
    appId: 'com.rpg.game',
    appName: 'RPG Game',
    webDir: 'dist',
    mode: 'hybrid',
  },
});
