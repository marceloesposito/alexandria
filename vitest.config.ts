import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // il nucleo condiviso arriva come sorgente TypeScript: va compilato anche da node_modules
    server: { deps: { inline: ['logos'] } },
  },
});
