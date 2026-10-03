/**
 * Escreve as duas cópias do design system em CSS — ver scripts/tokens-css.mjs.
 * Rodar: npm run tokens (depois de mudar qualquer valor no tailwind.config.js)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cfg from '../tailwind.config.js';
import { montarTokensCss } from './tokens-css.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = montarTokensCss(cfg);

for (const destino of ['src/design/tokens.css', 'landing/tokens.css']) {
  const caminho = resolve(raiz, destino);
  mkdirSync(dirname(caminho), { recursive: true });
  writeFileSync(caminho, css);
  console.log(`escrito: ${destino}`);
}
