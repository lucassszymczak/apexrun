import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// O Vitest roda só os testes de tests/. Os testes do motor da análise
// (analise/*.test.mjs) são scripts Node (`node analise/x.test.mjs`) que terminam
// com process.exit — por isso ficam fora daqui e rodam em `npm run test:analise`.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['tests/**/*.{test,spec}.{ts,tsx,js,mjs}'],
    },
  }),
);
