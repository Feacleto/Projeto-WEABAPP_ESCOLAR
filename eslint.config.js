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
])
