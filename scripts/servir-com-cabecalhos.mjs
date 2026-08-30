/**
 * SERVE `dist/` APLICANDO OS CABEÇALHOS DO `firebase.json`.
 *
 * POR QUE ISTO PRECISOU EXISTIR
 * O emulador de hosting do Firebase **não aplica o bloco `headers`**. Não é
 * configuração errada: nem o `Cache-Control: immutable` de `/assets/**`, que
 * está no arquivo há semanas, sai na resposta dele. Conferido com `curl -I`.
 *
 * Isso quebra a única forma honesta de subir uma CSP: publicar primeiro como
 * `Report-Only`, percorrer as telas e ler as violações no console do
 * navegador. Sem servidor que ENVIE o cabeçalho, não há violação pra coletar —
 * e a alternativa seria descobrir o que faltou em produção, com o app
 * quebrado na mão de quem está usando.
 *
 * Então este script faz o mínimo: lê o mesmo `firebase.json` que vai pro ar,
 * casa os globs na mesma ordem (o último a casar vence, como no Hosting), e
 * serve os arquivos com SPA rewrite. Ele NÃO é um servidor de produção e não
 * tenta ser — é um instrumento de medição.
 *
 * COMO USAR
 *   npm run build
 *   node scripts/servir-com-cabecalhos.mjs      (ou: npm run servir)
 *   abre http://127.0.0.1:5050 e percorre as telas com o console aberto
 *
 * Node puro, sem dependência — o padrão dos outros scripts desta pasta.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const PORTA = Number(process.env.PORTA || 5050);
const RAIZ = 'dist';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Glob do Hosting → regex. Cobre só o que o `firebase.json` deste projeto usa
 * (`**` e `/pasta/**`), e é de propósito: um conversor genérico de glob teria
 * mais casos de borda que o arquivo tem linhas.
 */
function paraRegex(glob) {
  const escapado = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + escapado.replace(/\*\*/g, '.*').replace(/(?<!\.)\*/g, '[^/]*') + '$');
}

const config = JSON.parse(await readFile('firebase.json', 'utf8'));
const regras = (config.hosting.headers || []).map((h) => ({
  origem: h.source,
  // `source` sem barra inicial (`**`) casa o caminho inteiro; com barra, casa
  // a partir da raiz. Normalizar aqui evita depender do formato do glob.
  re: paraRegex(h.source.startsWith('/') ? h.source : '/' + h.source),
  headers: h.headers,
}));

function cabecalhosPara(caminho) {
  const saida = new Map();
  // Ordem do arquivo: o ÚLTIMO que casar vence, como no Hosting. É o que faz
  // `/assets/**` sobrescrever só o Cache-Control e herdar o resto do `**`.
  for (const r of regras) {
    if (!r.re.test(caminho)) continue;
    for (const h of r.headers) saida.set(h.key, h.value);
  }
  return saida;
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let caminho = decodeURIComponent(url.pathname);

  // Impede subir de diretório com `..`.
  const alvo = normalize(join(RAIZ, caminho));
  let arquivo = alvo.startsWith(normalize(RAIZ)) ? alvo : join(RAIZ, 'index.html');

  if (!existsSync(arquivo) || statSync(arquivo).isDirectory()) {
    // SPA rewrite — o mesmo `"destination": "/index.html"` do firebase.json.
    arquivo = join(RAIZ, 'index.html');
    caminho = '/index.html';
  }

  try {
    const corpo = await readFile(arquivo);
    for (const [k, v] of cabecalhosPara(caminho)) res.setHeader(k, v);
    res.setHeader('Content-Type', TIPOS[extname(arquivo)] || 'application/octet-stream');
    res.writeHead(200);
    res.end(corpo);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});

servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`\n  dist/ em http://127.0.0.1:${PORTA} — com os cabeçalhos do firebase.json`);
  const amostra = cabecalhosPara('/index.html');
  for (const k of amostra.keys()) console.log('   ·', k);
  console.log('\n  Percorra com o console aberto. Ctrl+C encerra.\n');
});
