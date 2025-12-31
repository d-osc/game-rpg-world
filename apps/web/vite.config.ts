import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@rpg/game-engine': resolve(__dirname, '../../packages/game-engine/src'),
      '@rpg/game-core': resolve(__dirname, '../../packages/game-core/src'),
      '@rpg/networking': resolve(__dirname, '../../packages/networking/src'),
      '@rpg/shared': resolve(__dirname, '../../packages/shared/src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        useDefineForClassFields: false,
      },
    },
  },
  server: {
    port: 5173,
    fs: {
      strict: false,
    },
  },
  optimizeDeps: {
    include: ['@rpg/game-engine', '@rpg/game-core'],
    esbuildOptions: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
        },
      },
    },
  },
});
