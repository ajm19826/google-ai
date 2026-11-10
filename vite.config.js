import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? './' : '/',
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});