import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appUrl = env.VITE_APP_URL || '';

  return {
    plugins: [
      react(),
      {
        name: 'html-og-url',
        transformIndexHtml(html) {
          return html.replace(/__VITE_APP_URL__/g, appUrl);
        },
      },
    ],
    optimizeDeps: {
      include: ['lucide-react'],
    },
  };
});
