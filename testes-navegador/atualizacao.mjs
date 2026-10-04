// A TROCA DE VERSÃO DO PWA, testada num navegador de verdade (04/10/2026).
//
// Serve a versão A, troca o servidor para a B e toca no "Atualizar" do aviso,
// como o motorista faria. Com DOIS_DEPLOYS=1, sai uma terceira publicação (C)
// com o aviso aberto e o download dela demora ATRASO ms — era assim que o
// toque abria a versão do meio e o aviso voltava (achado do dono, 1.1 → 1.2).
//
// Uso (precisa do build em dist/ e do Edge instalado; CANAL=chrome troca):
//   npm run build
//   node testes-navegador/atualizacao.mjs
//   DOIS_DEPLOYS=1 ATRASO=15000 ESPERA=25000 node testes-navegador/atualizacao.mjs
// Esperado: "versão B" (ou "versão C" com DOIS_DEPLOYS) e "aviso de novo? false".
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import os from 'node:os';
const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const require = createRequire(RAIZ + '/package.json');
const { chromium } = require('playwright');

const AQUI = fs.mkdtempSync(path.join(os.tmpdir(), 'troca-de-versao-'));
const A = path.join(AQUI, 'verA');
const B = path.join(AQUI, 'verB');
const C = path.join(AQUI, 'verC');

function copiar(de, para) {
  fs.rmSync(para, { recursive: true, force: true });
  fs.cpSync(de, para, { recursive: true });
}
const DIST = process.env.DIST || (RAIZ + '/dist');
copiar(DIST, A);
copiar(DIST, B);
copiar(DIST, C);
// A versão B: o index.html ganha uma marca, e o sw.js muda a revisão do index
// (é assim que um deploy de verdade chega: worker novo, index novo).
for (const [dir, marca] of [[A, 'A'], [B, 'B'], [C, 'C']]) {
  const idx = path.join(dir, 'index.html');
  fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8').replace('<head>', `<head><meta name="versao-teste" content="${marca}">`));
}
const swB = path.join(B, 'sw.js');
fs.writeFileSync(swB, fs.readFileSync(swB, 'utf8').replace(/\{url:"index\.html",revision:"[^"]+"\}/, '{url:"index.html",revision:"versao-b-teste"}') + '\n// b');
const swC = path.join(C, 'sw.js');
fs.writeFileSync(swC, fs.readFileSync(swC, 'utf8').replace(/\{url:"index\.html",revision:"[^"]+"\}/, '{url:"index.html",revision:"versao-c-teste"}') + '\n// b');

let raiz = A;
let atrasoMs = Number(process.env.ATRASO || 0);
const tipos = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webp': 'image/webp' };
const servidor = http.createServer(async (req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  let arq = path.join(raiz, url);
  if (!fs.existsSync(arq) || fs.statSync(arq).isDirectory()) arq = path.join(raiz, 'index.html');
  if (atrasoMs && raiz === C && arq.endsWith('index.html')) await new Promise((r) => setTimeout(r, atrasoMs));
  res.setHeader('Cache-Control', 'no-cache, max-age=0');
  res.setHeader('Content-Type', tipos[path.extname(arq)] || 'application/octet-stream');
  fs.createReadStream(arq).pipe(res);
});
await new Promise((r) => servidor.listen(4499, r));

const navegador = await chromium.launch({ channel: process.env.CANAL || 'msedge' });
const pagina = await navegador.newPage();
const log = [];
pagina.on('console', (m) => { if (m.type() === 'error') log.push(m.text()); });
const marca = () => pagina.evaluate(() => document.querySelector('meta[name="versao-teste"]')?.content);
const estadoSW = () => pagina.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration('/');
  return { controlando: !!navigator.serviceWorker.controller, esperando: !!r?.waiting, instalando: !!r?.installing };
});

await pagina.goto('http://localhost:4499/login');
await pagina.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30000 });
console.log('1. carregou a versão', await marca(), await estadoSW());

raiz = B;
console.log('2. servidor agora entrega a versão B');
await pagina.evaluate(async () => (await navigator.serviceWorker.getRegistration('/')).update());
const aviso = pagina.getByText('Tem uma versão nova');
await aviso.waitFor({ timeout: 30000 });
console.log('3. o aviso apareceu', await estadoSW());

if (process.env.DOIS_DEPLOYS) {
  raiz = C;
  console.log('3b. sai OUTRA publicação (C) com o aviso ainda aberto; o download dela demora', atrasoMs, 'ms');
}
const t0 = Date.now();
await Promise.all([
  pagina.waitForEvent('load', { timeout: 40000 }),
  pagina.getByRole('button', { name: /Atualizar/ }).click(),
]);
await pagina.waitForTimeout(Number(process.env.ESPERA || 3000));
const avisoDeNovo = await pagina.getByText('Tem uma versão nova').count();
console.log(`4. depois do toque (${Date.now() - t0} ms): versão`, await marca(), await estadoSW(), 'aviso de novo?', avisoDeNovo > 0);
if (log.length) console.log('erros no console:', log.slice(0, 5));
await navegador.close();
servidor.close();
