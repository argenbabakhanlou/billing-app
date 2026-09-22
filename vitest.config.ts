import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.spec.ts'],
    env: { VITE_API_BASE_URL: 'https://api.test' },
  },
});
