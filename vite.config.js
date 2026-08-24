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
      includeAssets: [
        'brand/favicon.svg',
        'brand/favicon.ico',
        'brand/apple-touch-icon.png',
        'brand/notification-badge-96.png',
      ],
      manifest: {
        name: 'Alô Buzinou',
        short_name: 'Alô Buzinou',
        description: 'Onde a perua está agora, o que o motorista avisou e a mensalidade em dia.',
        theme_color: '#1F5F3F',
        background_color: '#EEF1EF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'pt-BR',
        // 'any' e 'maskable' em arquivos SEPARADOS: o maskable tem folga
        // maior porque o launcher do Android recorta um círculo por cima.
        // Declarar o mesmo PNG nos dois papéis é o que faz o ícone aparecer
        // cortado nas bordas em uns aparelhos e minúsculo em outros.
        icons: [
          { src: 'brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'brand/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
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
