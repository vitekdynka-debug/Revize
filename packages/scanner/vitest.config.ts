import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'scanner', environment: 'node' },
});
