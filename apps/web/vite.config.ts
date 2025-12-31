import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@rpg/game-engine': resolve(__dirname, '../../packages/game-engine/src/index.ts'),
      '@rpg/game-core': resolve(__dirname, '../../packages/game-core/src/index.ts'),
      '@rpg/networking': resolve(__dirname, '../../packages/networking/src/index.ts'),
      '@rpg/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
});
