import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/google-ai/' : '/',
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});