import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      fs: 'node:fs',
      path: 'node:path',
      os: 'node:os'
    }
  }
});
