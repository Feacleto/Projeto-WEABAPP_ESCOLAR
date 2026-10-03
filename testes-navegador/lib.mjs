/**
 * O KIT DO TESTE NO NAVEGADOR — Chrome visível, como um celular, em câmera lenta.
 *
 * O que cada jornada usa daqui:
 *   abrirCelular(persona)   o Chrome na tela, 360×740, toque, pt-BR, GPS em SP
 *   passo(texto)            a legenda no topo ("Motorista · M3 · …")
 *   tocar(alvo, rotulo)     contorno amarelo, pausa, toque
 *   digitar(alvo, texto)    contorno amarelo e digitação letra a letra
 *   registrar(nome)         print (normal e com fonte 130%), axe, medidas
 *   achado({...})           anota um problema encontrado, com gravidade e lente
 *
 * ⚠️ NADA AQUI TOCA PRODUÇÃO. O app roda com o `.env.local` apontando para os
 * emuladores do projeto `demo-alobuzinou`. O WhatsApp e o "compartilhar" do
 * sistema são INTERCEPTADOS: o teste guarda a mensagem que iria, e nada sai.
 *
 * Rodar uma jornada:  node testes-navegador/m1-cadastro.mjs
 * (com `firebase emulators:start --project demo-alobuzinou` e `vite` de pé)
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const APP = 'http://127.0.0.1:5173';
export const SITE = 'http://127.0.0.1:4321';
const AXE = path.resolve(AQUI, '../node_modules/axe-core/axe.min.js');

/** Pausa antes de cada toque — é o tempo de quem assiste ver o que vai acontecer. */
const PAUSA = Number(process.env.PAUSA || 900);
export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const PERSONAS = {
  motorista: { nome: 'Motorista', x: 0 },
  responsavel: { nome: 'Responsável', x: 470 },
};

/**
 * Abre o Chrome como o celular da persona. O perfil é PERSISTENTE por persona
 * (`perfis/<persona>`): a sessão do motorista sobrevive de uma jornada para a
 * outra, como no aparelho dele.
 */
export async function abrirCelular(persona, { jornada, limpar = false } = {}) {
  const p = PERSONAS[persona];
  const dirPerfil = path.join(AQUI, 'perfis', persona);
  if (limpar && existsSync(dirPerfil)) {
    const { rmSync } = await import('node:fs');
    rmSync(dirPerfil, { recursive: true, force: true });
  }
  const contexto = await chromium.launchPersistentContext(dirPerfil, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    geolocation: { latitude: -23.5869, longitude: -46.6825 }, // Vila Olímpia, SP
    permissions: ['geolocation', 'clipboard-read', 'clipboard-write'],
    userAgent:
      'Mozilla/5.0 (Linux; Android 12; SM-A135M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    args: [
      `--window-position=${p.x},0`,
      '--window-size=430,900',
      '--deny-permission-prompts', // notificação: nega sem abrir pergunta
    ],
  });

  const pasta = path.join(AQUI, 'resultados', jornada);
  // Cada rodada começa com a pasta limpa: print velho misturado com novo é
  // achado de uma versão do app atribuído a outra.
  if (jornada !== 'olhadas') {
    const { rmSync } = await import('node:fs');
    rmSync(pasta, { recursive: true, force: true });
  }
  mkdirSync(pasta, { recursive: true });
  const estado = {
    persona: p.nome,
    jornada,
    pasta,
    n: 0,
    telas: [],
    achados: [],
    errosConsole: [],
    mensagensEnviadas: [],
  };

  // A legenda, o compartilhar e o WhatsApp — em toda página, antes do app.
  await contexto.addInitScript(() => {
    window.__compartilhados = [];
    try {
      navigator.share = async (dados) => {
        window.__compartilhados.push({ ...dados, files: (dados.files || []).length });
      };
      navigator.canShare = () => true;
    } catch {
      /* algumas versões não deixam sobrescrever */
    }
    const desenhar = () => {
      if (!document.body || document.getElementById('tn-legenda')) return;
      const el = document.createElement('div');
      el.id = 'tn-legenda';
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText =
        'position:fixed;left:50%;top:4px;transform:translateX(-50%);z-index:2147483647;' +
        'max-width:94vw;background:rgba(11,18,16,.86);color:#ffd84d;font:600 11px/1.3 system-ui;' +
        'padding:4px 9px;border-radius:8px;pointer-events:none;text-align:center';
      el.textContent = sessionStorage.getItem('tn-passo') || '';
      document.body.appendChild(el);
    };
    document.addEventListener('DOMContentLoaded', desenhar);
    setInterval(desenhar, 500);
  });

  // Os domínios de produção viram os locais: o app (.com) e o site (.com.br).
  await contexto.route(/^https:\/\/(www\.)?alobuzinou\.com(\.br)?(\/.*)?$/, async (rota) => {
    const u = new URL(rota.request().url());
    const destino = u.hostname.endsWith('.com.br') ? SITE : APP;
    const caminho = u.hostname.endsWith('.com.br') && u.pathname === '/saiba-mais' ? '/saiba-mais.html' : u.pathname;
    await rota.fulfill({ status: 302, headers: { location: destino + caminho + u.search + u.hash } });
  });

  await contexto.route(/https:\/\/(wa\.me|api\.whatsapp\.com)\/.*/, async (rota) => {
    estado.mensagensEnviadas.push(decodeURIComponent(rota.request().url()));
    await rota.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<meta name="viewport" content="width=device-width"><body style="font:16px system-ui;padding:24px;background:#e7ffdb"><b>WhatsApp (simulado pelo teste)</b><p>A mensagem foi registrada. Nada foi enviado.</p></body>',
    });
  });

  const pagina = contexto.pages()[0] || (await contexto.newPage());
  pagina.on('console', (m) => {
    if (m.type() === 'error') estado.errosConsole.push(m.text().slice(0, 300));
  });
  pagina.on('pageerror', (e) => estado.errosConsole.push('[pageerror] ' + String(e).slice(0, 300)));
  contexto.on('page', (nova) => {
    // Janela nova (wa.me via window.open): registra e fecha.
    nova.on('load', () => estado.mensagensEnviadas.push('[janela] ' + decodeURIComponent(nova.url())));
    setTimeout(() => nova.close().catch(() => {}), 2500);
  });

  return { contexto, pagina, estado };
}

/** A legenda do topo. Fica guardada na sessão para sobreviver à troca de tela. */
export async function passo(pagina, estado, texto) {
  const linha = `${estado.persona} · ${estado.jornada} · ${texto}`;
  console.log('  →', texto);
  await pagina
    .evaluate((t) => {
      sessionStorage.setItem('tn-passo', t);
      const el = document.getElementById('tn-legenda');
      if (el) el.textContent = t;
    }, linha)
    .catch(() => {});
}

async function destacar(alvo, rotulo) {
  await alvo.scrollIntoViewIfNeeded().catch(() => {});
  await alvo
    .evaluate((el, r) => {
      el.dataset.tnAntes = el.style.outline || '';
      el.style.outline = '3px solid #ffd84d';
      el.style.outlineOffset = '2px';
      const box = el.getBoundingClientRect();
      const tag = document.createElement('div');
      tag.className = 'tn-rotulo';
      tag.textContent = r;
      tag.style.cssText =
        `position:fixed;left:${Math.max(4, box.left)}px;top:${Math.max(24, box.top - 22)}px;` +
        'z-index:2147483647;background:#ffd84d;color:#111;font:700 11px system-ui;' +
        'padding:2px 6px;border-radius:5px;pointer-events:none';
      document.body.appendChild(tag);
    }, rotulo)
    .catch(() => {});
  await esperar(PAUSA);
}

async function apagarDestaque(pagina, alvo) {
  await alvo
    .evaluate((el) => {
      el.style.outline = el.dataset.tnAntes || '';
    })
    .catch(() => {});
  await pagina.evaluate(() => document.querySelectorAll('.tn-rotulo').forEach((e) => e.remove())).catch(() => {});
}

/** Toque com o contorno amarelo antes — quem assiste vê onde o dedo vai. */
export async function tocar(pagina, alvo, rotulo = 'tocando') {
  await alvo.waitFor({ state: 'visible', timeout: 15000 });
  await destacar(alvo, rotulo);
  await apagarDestaque(pagina, alvo);
  await alvo.tap({ timeout: 10000 }).catch(async () => alvo.click({ timeout: 10000 }));
  await esperar(500);
}

/** Digitação letra a letra, como uma pessoa. */
export async function digitar(pagina, alvo, texto, rotulo = 'digitando') {
  await alvo.waitFor({ state: 'visible', timeout: 15000 });
  await destacar(alvo, rotulo);
  await alvo.tap().catch(() => alvo.click());
  await alvo.fill('');
  await alvo.pressSequentially(texto, { delay: 55 });
  await apagarDestaque(pagina, alvo);
  await esperar(300);
}

/** As medidas da tela, rodando dentro da página. */
function medirNaPagina() {
  const visivel = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  const textoDe = (el) => (el.innerText || el.getAttribute('aria-label') || el.value || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 50);

  const tocaveis = [...document.querySelectorAll('a[href],button,[role=button],[role=switch],[role=tab],input:not([type=hidden]),select,textarea')]
    .filter((el) => visivel(el) && !el.closest('#tn-legenda'));
  const alvosPequenos = tocaveis
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => Math.min(r.width, r.height) < 44)
    .map(({ el, r }) => ({ texto: textoDe(el) || `<${el.tagName.toLowerCase()}>`, w: Math.round(r.width), h: Math.round(r.height) }));

  const tamanhos = {};
  const miudos = [];
  const caminhar = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let no;
  while ((no = caminhar.nextNode())) {
    const t = no.textContent.trim();
    if (t.length < 2) continue;
    const el = no.parentElement;
    if (!el || el.closest('#tn-legenda,.tn-rotulo') || !visivel(el)) continue;
    const px = parseFloat(getComputedStyle(el).fontSize);
    const k = Math.round(px);
    tamanhos[k] = (tamanhos[k] || 0) + 1;
    if (px < 12) miudos.push({ px, texto: t.slice(0, 50) });
  }
  return {
    url: location.pathname + location.search,
    titulo: document.title,
    rolagemLateral: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    alturaDaPagina: document.documentElement.scrollHeight,
    tocaveis: tocaveis.length,
    alvosPequenos,
    tamanhosDeTexto: tamanhos,
    textosMenoresQue12: miudos.slice(0, 25),
  };
}

/**
 * Registra a tela: print normal, print com fonte 130%, axe e medidas.
 * A legenda some durante os prints — ela é para quem assiste, não para a tela.
 */
export async function registrar(pagina, estado, nome, { paginaInteira = false } = {}) {
  estado.n += 1;
  const id = String(estado.n).padStart(2, '0') + '-' + nome;
  await esperar(700);
  await pagina.evaluate(() => {
    const el = document.getElementById('tn-legenda');
    if (el) el.style.display = 'none';
  });
  await pagina.screenshot({ path: path.join(estado.pasta, `${id}.png`), fullPage: paginaInteira });

  // Fonte 130%: aproximação de quem aumenta a letra do celular.
  await pagina.evaluate(() => (document.documentElement.style.fontSize = '130%'));
  await esperar(300);
  const quebraCom130 = await pagina.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  await pagina.screenshot({ path: path.join(estado.pasta, `${id}-fonte130.png`) });
  await pagina.evaluate(() => (document.documentElement.style.fontSize = ''));

  const medidas = await pagina.evaluate(medirNaPagina);
  let axe = { violacoes: [] };
  try {
    const ja = await pagina.evaluate(() => !!window.axe);
    if (!ja) await pagina.addScriptTag({ content: readFileSync(AXE, 'utf8') });
    axe = await pagina.evaluate(async () => {
      const r = await window.axe.run(document, {
        exclude: [['#tn-legenda']],
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      return {
        violacoes: r.violations.map((v) => ({
          regra: v.id,
          impacto: v.impact,
          ajuda: v.help,
          quantos: v.nodes.length,
          exemplos: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' — ' + (n.failureSummary || '').split('\n')[1]?.trim()),
        })),
      };
    });
  } catch (err) {
    axe = { erro: String(err).slice(0, 200), violacoes: [] };
  }
  await pagina.evaluate(() => {
    const el = document.getElementById('tn-legenda');
    if (el) el.style.display = '';
  });

  const tela = { id, nome, ...medidas, quebraCom130, axe };
  estado.telas.push(tela);
  writeFileSync(path.join(estado.pasta, `${id}.json`), JSON.stringify(tela, null, 2));
  const pequenos = medidas.alvosPequenos.length;
  const viol = axe.violacoes.length;
  console.log(
    `  ▣ ${id}  ${medidas.url}  · alvos<44px: ${pequenos} · texto<12px: ${medidas.textosMenoresQue12.length}` +
      ` · axe: ${viol}${quebraCom130 ? ' · QUEBRA com 130%' : ''}${medidas.rolagemLateral ? ' · ROLAGEM LATERAL' : ''}`
  );
  return tela;
}

/** Um problema encontrado. gravidade: bloqueia | atrapalha | melhoria. */
export function achado(estado, a) {
  estado.achados.push({ jornada: estado.jornada, ...a });
  console.log(`  ✱ [${a.gravidade}] ${a.tela}: ${a.oque}`);
}

/** Fecha a jornada: grava o resumo e deixa o Chrome aberto alguns segundos. */
export async function encerrar(contexto, pagina, estado, { manterAberto = 4000 } = {}) {
  try {
    estado.compartilhados = await pagina.evaluate(() => window.__compartilhados || []);
  } catch {
    estado.compartilhados = [];
  }
  writeFileSync(path.join(estado.pasta, 'resumo.json'), JSON.stringify(estado, null, 2));
  console.log(`\n  ${estado.telas.length} telas registradas · ${estado.achados.length} achados anotados`);
  console.log(`  erros no console: ${estado.errosConsole.length} · mensagens interceptadas: ${estado.mensagensEnviadas.length}`);
  await esperar(manterAberto);
  await contexto.close();
}

/**
 * O aviso de cookies, respondido como uma pessoa responderia: "Apenas
 * essenciais". Devolve se ele estava na tela — o que já é dado da jornada.
 */
export async function responderCookies(pagina) {
  const botao = pagina.getByRole('button', { name: 'Apenas essenciais' });
  if (!(await botao.isVisible().catch(() => false))) return false;
  await tocar(pagina, botao, 'Apenas essenciais');
  return true;
}
