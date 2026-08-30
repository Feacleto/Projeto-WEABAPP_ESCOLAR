import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'functions/node_modules', 'dev-dist']),

  // Cloud Functions rodam em Node (CommonJS), não no browser. Sem este bloco
  // o eslint marcava require/module/exports como no-undef — 11 erros falsos.
  {
    files: ['functions/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
      ecmaVersion: 2022,
    },
  },

  // vite.config.js roda no Node durante o build — não no browser. Sem este
  // bloco, o `process.cwd()` da trava que exige a config do Firebase virava
  // no-undef. É o mesmo caso das functions: arquivo de Node caindo na regra
  // do browser porque casava com o padrão '*.{js,jsx}' da raiz.
  {
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    files: ['src/**/*.{js,jsx}', '*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // ── A FRONTEIRA DE CAMADA, VERIFICADA ─────────────────────────────────────
  //
  // A regra do projeto é `tela → hook → service → Firestore`, e até aqui ela
  // era mantida por disciplina: um parágrafo no CLAUDE.md e a boa vontade de
  // quem escreve. Disciplina não sobrevive a pressa nem a sessão nova.
  //
  // `docs/arquitetura.md` (seção 4) diz onde está a alavanca com todas as
  // letras: **a fronteira que importa é a de import**, não a de `package.json`.
  // Esta regra é essa frase executável — e ela vale hoje, sem monorepo, sem
  // TypeScript e sem mover um arquivo.
  //
  // POR QUE AGORA É BARATO
  // Ela nasce quase verde: sobraram 6 importações de `firebase/*` fora da
  // camada, todas explicáveis, listadas uma a uma abaixo. Ligar a regra com o
  // débito conhecido e nomeado é o oposto de ligar com 40 erros e um
  // `eslint-disable` no topo de cada arquivo.
  //
  // O QUE ELA COMPRA
  // Não conserta as 6. Impede a SÉTIMA — a que alguém adiciona com pressa,
  // numa tela, porque "é só uma leitura rápida". Foi assim que a mesma query
  // `users where role == 'admin'` acabou escrita à mão em duas telas do dono,
  // com tratamento de erro divergente.
  {
    files: ['src/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['firebase', 'firebase/*'],
              message:
                'Firebase só em src/services/ e src/firebase/. Tela e componente ' +
                'falam com hook, hook fala com service, service fala com o banco. ' +
                'Ver docs/arquitetura.md, seção 4.',
            },
          ],
        },
      ],
    },
  },

  // A CAMADA QUE PODE. `services/` é quem fala com o banco por definição, e
  // `firebase/config.js` é onde o SDK é instanciado.
  {
    files: ['src/services/**/*.js', 'src/firebase/**/*.js'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // ── AS SEIS EXCEÇÕES, UMA A UMA ───────────────────────────────────────────
  //
  // Cada arquivo aqui é uma dívida com prazo ou uma decisão. Nenhuma entra sem
  // o porquê escrito — lista de exceção sem razão vira lista de permissão, e
  // aí a regra não mede mais nada.
  //
  // `AuthContext` é DECISÃO, não dívida: `onAuthStateChanged` é a raiz da
  // sessão. É ali que a camada nasce, e ela não pode nascer dentro de si mesma.
  {
    files: ['src/context/AuthContext.jsx'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // Os dois hooks que assinam o Firestore sem passar por service. São hooks e
  // não telas — a camada está torta, não furada —, mas são os ÚNICOS 2 de 23.
  // O conserto é `watchLiveLocation` em `locationService` e `watchLimite` em
  // `userService`; está em docs/arquitetura.md, seção 13.
  {
    files: ['src/hooks/useLiveLocation.js', 'src/hooks/useLimiteCriancas.js'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // Três telas chamando callable direto. Não tocam o banco, então o risco é
  // menor — mas `AdminPanel` chama sem passar pelo `exigirCloud()` de
  // `callableError`, e sem Blaze o erro chega ao usuário como "falha de rede".
  // `Home` e `Familia` fazem a MESMA chamada (`getShowcase`), duplicada.
  {
    files: [
      'src/pages/Home.jsx',
      'src/pages/Familia.jsx',
      'src/pages/admin/AdminPanel.jsx',
    ],
    rules: { 'no-restricted-imports': 'off' },
  },
])
