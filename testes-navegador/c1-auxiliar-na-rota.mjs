/**
 * C1 — A AUXILIAR NA ROTA: A CENTRAL SEM SENHA (04/10/2026).
 *
 * Fase 1 da "Rota e Central" (630efb3). O Seu Zé de `semear-financeiro.mjs`
 * inicia a rota e passa o celular: quem segura agora é a auxiliar. Mede, em
 * ordem:
 *   1. o rodapé é Início · Central, com a bolinha verde na Central;
 *   2. na porta do Lucas (em aberto), "Mensalidade de outubro em aberto" e o
 *      "Recebi" de CONTORNO; em dinheiro dá baixa (paid, cash);
 *   3. na porta do Davi (em aberto), "a família disse que mandou PIX" vira
 *      claimed, não baixa;
 *   4. "Mostrar PIX da perua" mostra e copia a chave;
 *   5. em nenhuma tela aparece "R$".
 * A rota fica ABERTA no fim: a C2 começa encerrando-a.
 *
 * Rodar: node testes-navegador/semear-financeiro.mjs
 *        node testes-navegador/c1-auxiliar-na-rota.mjs
 * ⚠️ Só emulador (`demo-alobuzinou`), como todo o kit.
 */
import { abrirCelular, passo, tocar, registrar, encerrar, esperar, achado, APP, garantirSessao, CONTAS } from './lib.mjs';

const FS = 'http://127.0.0.1:8085/v1/projects/demo-alobuzinou/databases/(default)/documents';
const ADM = { Authorization: 'Bearer owner' };
const agora = new Date();
const MES = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
const pagamento = async (cid) => (await (await fetch(`${FS}/payments/${cid}_${MES}`, { headers: ADM })).json()).fields || {};
const eventos = async (cid) =>
  ((await (await fetch(`${FS}/payments/${cid}_${MES}/events`, { headers: ADM })).json()).documents || []).map((d) => d.fields);

const { contexto, pagina, estado } = await abrirCelular('motorista', { jornada: 'C1-auxiliar-na-rota', perfil: CONTAS.zeFinanceiro().perfil });
// A jornada é a da IDA, de manhã. Rodada à noite, a tela abre na volta e
// volta para ela a cada marcação; por isso o relógio do navegador fica nas
// 6h35 de HOJE (a data continua a do servidor, para o dia bater).
const manha = new Date(); manha.setHours(6, 35, 0, 0);
await pagina.clock.setFixedTime(manha);
const m = (t) => passo(pagina, estado, t);
const visivel = (loc) => loc.first().isVisible().catch(() => false);
const r = {};

/** Nenhum "R$" na tela inteira — a regra da Central sem senha. */
async function semValor(onde) {
  const texto = await pagina.evaluate(() => document.body.innerText);
  const achou = texto.match(/R\$\s?[\d.,•]*/g);
  r[`semValor:${onde}`] = !achou;
  if (achou) achado(estado, { gravidade: 'bloqueia', lente: 'seguranca', tela: onde, oque: `Aparece valor na rota sem senha: ${achou.slice(0, 3).join(', ')}` });
}

async function entrar() {
  // Um login só, no kit: entra apenas se o app pedir (perfil próprio do
  // ze.financeiro, que a F1 reaproveita com a rota aberta).
  await garantirSessao(pagina, estado, CONTAS.zeFinanceiro());
}

try {
  await m('entra com a conta do Seu Zé');
  await entrar();

  // ── Iniciar a rota ─────────────────────────────────────────────────────
  await m('Minha rota → iniciar');
  await pagina.goto(APP + '/tio/rota');
  await esperar(3500);
  await registrar(pagina, estado, '01-minha-rota');
  const mesmoAssim = pagina.getByRole('button', { name: /Rodar mesmo assim/ });
  if (await visivel(mesmoAssim)) { await tocar(pagina, mesmoAssim.first(), 'Rodar mesmo assim'); await esperar(800); }
  await tocar(pagina, pagina.getByRole('button', { name: /Iniciar a rota|INICIAR ROTA/i }).last(), 'Iniciar a rota');
  await esperar(5000);
  if (!new URL(pagina.url()).pathname.startsWith('/tio/route/now')) await pagina.goto(APP + '/tio/route/now');
  await esperar(2500);
  // Fora da manhã a tela abre na última viagem do dia (a volta, já concluída
  // para quem está "em casa"). A jornada é a da IDA: o chip da hora de saída.
  const ida = pagina.getByRole('button', { name: /6h40/ });
  if (await visivel(ida)) { await tocar(pagina, ida.first(), 'a viagem das 6h40'); await esperar(1500); }

  // ── 1. O rodapé ────────────────────────────────────────────────────────
  await m('1 · rodapé: Início · Central, com a bolinha verde');
  const nav = pagina.locator('nav').last();
  r.rodape = (await nav.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  r.bolinha = await visivel(pagina.locator('[aria-label="Rota rodando"]'));
  if (!/Início/.test(r.rodape) || !/Central/.test(r.rodape) || /Financeiro|Rota\b/.test(r.rodape)) {
    achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'rodapé', oque: `O rodapé na rota diz "${r.rodape}", e não Início · Central.` });
  }
  if (!r.bolinha) achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'rodapé', oque: 'A bolinha verde da Central não aparece com a rota rodando.' });
  await registrar(pagina, estado, '02-rota-aberta', { paginaInteira: true });
  await semValor('rota aberta');

  // ── 2. Lucas: dinheiro na mão ──────────────────────────────────────────
  await m('2 · na porta do Lucas: "Mensalidade de outubro em aberto"');
  const caixa = pagina.getByText(/^Mensalidade de \S+ em aberto$/);
  r.caixaLucas = await visivel(caixa);
  if (!r.caixaLucas) {
    achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: 'rota', oque: 'Na porta do Lucas (mensalidade pending) não aparece "Mensalidade de … em aberto".' });
  } else {
    const recebi = pagina.getByRole('button', { name: /^Recebi$/ }).first();
    r.recebiDeContorno = await recebi.evaluate((el) => {
      const s = getComputedStyle(el);
      return s.backgroundColor === 'rgb(255, 255, 255)' && parseFloat(s.borderTopWidth) >= 2;
    }).catch(() => null);
    if (r.recebiDeContorno === false) achado(estado, { gravidade: 'atrapalha', lente: 'UX', tela: 'rota', oque: '"Recebi" não é de contorno: compete com o EMBARQUEI.' });
    r.linhasDaFrase = await caixa.first().evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
    if (r.linhasDaFrase > 2) achado(estado, { gravidade: 'atrapalha', lente: '40+', tela: 'rota', oque: `"Mensalidade de outubro em aberto" quebra em ${r.linhasDaFrase} linhas a 360 px: o "Recebi" ao lado aperta a frase.` });
    await registrar(pagina, estado, '03-lucas-em-aberto');
    await tocar(pagina, recebi, 'Recebi');
    await esperar(1000);
    await registrar(pagina, estado, '04-recebi-folha');
    await semValor('folha do Recebi');
    await tocar(pagina, pagina.getByText('Em dinheiro, na minha mão', { exact: true }).last(), 'Em dinheiro, na minha mão');
    await esperar(1500);
    r.toastLucas = await pagina.getByText(/^Baixa dada:/).first().innerText().catch(() => null);
    await registrar(pagina, estado, '05-baixa-dada');
    await semValor('confirmação da baixa');
    await esperar(1500);
    const p = await pagamento('finLucas');
    r.lucasNoBanco = { status: p.status?.stringValue, metodo: p.paymentMethod?.stringValue };
    r.lucasTrilha = (await eventos('finLucas')).map((e) => `${e.type?.stringValue}:${e.meta?.mapValue?.fields?.via?.stringValue}`);
    if (r.lucasNoBanco.status !== 'paid' || r.lucasNoBanco.metodo !== 'cash') {
      achado(estado, { gravidade: 'bloqueia', lente: 'dinheiro', tela: 'rota', oque: `Baixa em dinheiro gravou ${JSON.stringify(r.lucasNoBanco)}, e não paid/cash.` });
    }
    if (!r.lucasTrilha.some((x) => x === 'confirmed:sem_senha')) {
      achado(estado, { gravidade: 'atrapalha', lente: 'dinheiro', tela: 'trilha', oque: `A trilha do Lucas não tem "confirmed" com via sem_senha: ${r.lucasTrilha.join(', ')}` });
    }
    r.caixaSumiu = !(await visivel(caixa));
  }

  // ── 3. Davi: PIX vira aviso ────────────────────────────────────────────
  await m('3 · EMBARQUEI no Lucas; na porta do Davi, "mandou PIX"');
  await tocar(pagina, pagina.getByRole('button', { name: /^EMBARQUEI/ }).first(), 'EMBARQUEI');
  await esperar(3000);
  r.focoDepois = await pagina.evaluate(() => document.querySelector('.shadow-focus.border-primary')?.innerText.split('\n')[0] || null);
  if (await visivel(caixa)) {
    await registrar(pagina, estado, '06-davi-em-aberto');
    await tocar(pagina, pagina.getByRole('button', { name: /^Recebi$/ }).first(), 'Recebi');
    await esperar(1000);
    await tocar(pagina, pagina.getByText('A família disse que mandou PIX', { exact: true }).last(), 'A família disse que mandou PIX');
    await esperar(2500);
    await registrar(pagina, estado, '07-pix-anotado');
    const p = await pagamento('finDavi');
    r.daviNoBanco = { status: p.status?.stringValue, metodo: p.paymentMethod?.stringValue };
    if (r.daviNoBanco.status !== 'claimed') {
      achado(estado, { gravidade: 'bloqueia', lente: 'dinheiro', tela: 'rota', oque: `"Mandou PIX" gravou ${JSON.stringify(r.daviNoBanco)}, e não claimed.` });
    }
  } else {
    achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'rota', oque: `Depois do Lucas, a porta em foco (${r.focoDepois}) não mostrou a mensalidade do Davi.` });
  }

  // ── 4. PIX da perua ────────────────────────────────────────────────────
  await m('4 · Mostrar PIX da perua → Copiar');
  const pix = pagina.getByRole('button', { name: /Mostrar PIX da perua/ });
  if (await visivel(pix)) {
    await tocar(pagina, pix.first(), 'Mostrar PIX da perua');
    await esperar(1000);
    r.chaveNaTela = await visivel(pagina.getByText('11987654321'));
    await registrar(pagina, estado, '08-pix-da-perua');
    await tocar(pagina, pagina.getByText('Copiar', { exact: true }).last(), 'Copiar');
    await esperar(800);
    r.copiado = await pagina.evaluate(() => navigator.clipboard.readText()).catch(() => null);
    if (r.copiado !== '11987654321') achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'PIX da perua', oque: `Copiar não pôs a chave na área de transferência (veio "${r.copiado}").` });
    await semValor('PIX da perua');
    await pagina.keyboard.press('Escape');
    await esperar(800);
  } else {
    achado(estado, { gravidade: 'bloqueia', lente: 'fluxo', tela: 'rota', oque: '"Mostrar PIX da perua" não aparece na rota (o Seu Zé tem chave).' });
  }

  // ── 5. A Central durante a rota ────────────────────────────────────────
  await m('5 · tocar em Central durante a rota: continua a tela da rota');
  await tocar(pagina, pagina.getByRole('link', { name: /Central/ }).last(), 'Central');
  await esperar(2000);
  r.centralNaRota = new URL(pagina.url()).pathname;
  if (!r.centralNaRota.startsWith('/tio/route/now')) {
    achado(estado, { gravidade: 'bloqueia', lente: 'seguranca', tela: 'Central', oque: `Com a rota rodando, a Central levou a ${r.centralNaRota}, e não à tela da rota.` });
  }
  await registrar(pagina, estado, '09-central-na-rota', { paginaInteira: true });
  await semValor('Central na rota');
} catch (err) {
  console.error(err);
  achado(estado, { gravidade: 'bloqueia', lente: 'teste', tela: '—', oque: `A jornada parou: ${err.message}` });
  await registrar(pagina, estado, '99-onde-parou').catch(() => {});
}
estado.resultado = r;
console.log(JSON.stringify(r, null, 2));
await encerrar(contexto, pagina, estado);
