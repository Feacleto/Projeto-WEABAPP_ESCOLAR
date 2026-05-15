import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// PWA configurada com auto-update.
// Service worker faz cache apenas do shell; dados do Firestore sempre são
// buscados online (importante porque o app depende de tempo real).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.png', 'apple-touch-icon.png', 'logo.png'],
      manifest: {
        name: 'Tio Nino Digital',
        short_name: 'Tio Nino',
        description: 'Gestão e rastreamento de transporte escolar em tempo real',
        theme_color: '#1F5F3F',
        background_color: '#F3F4F6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Inclui jpeg/jpg no precache (default só pega js/css/html/ico/png/svg).
        // Necessário pra screenshots de telas em /public/telas/.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2,mp3}'],
        // Limite por arquivo no precache. Default 2 MiB — subimos pra 10 MiB
        // porque temos imagemvanescolar.png (~8 MB) e alguns sons mais altos.
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // Não cachear chamadas ao Firestore: rastreamento precisa ser sempre online
        navigateFallbackDenylist: [/^\/__/, /firestore\.googleapis\.com/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
