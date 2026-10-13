import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the same build works at https://<user>.github.io/<repo>/ and locally.
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
