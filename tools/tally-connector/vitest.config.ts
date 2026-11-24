import { defineConfig } from 'vitest/config';

// Own config so vitest does not pick up the VCFO app's config from the repo root.
export default defineConfig({
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
