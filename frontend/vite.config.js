import { defineConfig } from 'vite';

const proxy = {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
};

export default defineConfig({
  server: { proxy },
  preview: { proxy },
});
