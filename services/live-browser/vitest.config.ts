import { defineConfig } from 'vitest/config';

// The service's own tests. They import the VCFO Assist engine from extensions/vcfo-assist/src and
// the Suite contract from src/lib/live-browser, exactly as the service does.
export default defineConfig({
  // A string stops Vite reading each file's nearest tsconfig: the extension's extends a generated
  // `.wxt/tsconfig.json` that exists only after `npm install` in the extension.
  esbuild: { tsconfigRaw: '{"compilerOptions":{"target":"ES2022","useDefineForClassFields":true}}' },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 90_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
