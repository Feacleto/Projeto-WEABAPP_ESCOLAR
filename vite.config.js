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
        // O QUE ENTRA NO PRECACHE É O QUE TODO MUNDO BAIXA PRA INSTALAR.
        //
        // Isto não é ajuste de vaidade: o primeiro acesso do responsável
        // acontece pelo link do WhatsApp, em dado móvel, num aparelho barato —
        // e é ali que ele decide se o app presta. Cada MB aqui é MB que ele
        // paga antes de ver a primeira tela.
        //
        // Inclui jpeg/jpg porque há screenshots de telas em /public/telas/.
        //
        // Som fica FORA. Os arquivos de /sounds somam ~3,7 MB e a maioria é
        // sazonal (natal, páscoa, halloween, aniversário): som que toca
        // algumas vezes por ano não pertence ao pacote de instalação. Eles
        // passam a ser buscados quando tocam e ficam em cache a partir daí
        // (ver runtimeCaching). Offline no primeiro uso, o efeito falha
        // calado — é a coisa menos importante da tela.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}'],
        // Limite por arquivo NO PADRÃO do workbox (2 MiB), de propósito.
        //
        // Ele tinha sido subido pra 10 MiB pra caber imagemvanescolar.png
        // (7,9 MB) — 55% do precache inteiro, servindo uma página que já
        // tinha saído do ar. Em vez de a restrição apontar o problema, a
        // restrição foi afrouxada até o problema caber; é o mesmo padrão que
        // produziu os furos de segurança desta semana. A imagem foi apagada
        // junto com a página.
        //
        // Deixar no padrão faz o build RECLAMAR se alguém puser um arquivo
        // gigante no precache de novo. Esse aviso é o que a gente perdeu.
        // Não cachear chamadas ao Firestore: rastreamento precisa ser sempre online
        navigateFallbackDenylist: [/^\/__/, /firestore\.googleapis\.com/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Som: buscado quando toca, guardado depois. Fora do precache
            // porque som sazonal não pode pesar na instalação de quem só
            // abriu o app pra ver uma mensalidade.
            urlPattern: ({ url }) => url.pathname.startsWith('/sounds/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'alo-buzinou-sons',
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 180 },
            },
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
