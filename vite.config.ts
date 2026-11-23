import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
  plugins: [vue()],
  base: './',
  server: { port: 5173, strictPort: true },
  oxc: { target: 'es2026' },
  build: {
    target: 'es2026',
    cssTarget: ['chrome111', 'safari16.4'],
    license: true,
  },
});
