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
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Tio Nino Digital',
        short_name: 'Tio Nino',
        description: 'Gestão e rastreamento de transporte escolar em tempo real',
        theme_color: '#38BDF8',
        background_color: '#F3F4F6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        // SVG escala pra qualquer tamanho — evita gerar PNGs separados.
        // Browsers modernos suportam SVG no manifest (iOS 16+, Chrome, Firefox).
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
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
