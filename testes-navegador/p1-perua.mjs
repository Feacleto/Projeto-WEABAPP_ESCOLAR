/**
 * P1 — "SUA PERUA" NO FINANCEIRO, COMO O MOTORISTA USA (03/10/2026).
 *
 * Duas pessoas, dois celulares, um depois do outro:
 *
 *   O NOVATO (sem turma, sem despesa) abre Abastecer pela primeira vez:
 *   escolhe o combustível, escreve o posto, cota em reais e em litros, guarda
 *   só o preço, volta e confere que posto e preço ficaram. Depois maltrata os
 *   campos (vírgula, ponto, milhar, vazio, zero), lança um abastecimento e
 *   abre o "Preciso aumentar?" sem dado nenhum.
 *
 *   O SEU BETO (12 meses de despesas, contratos vencendo em ~45 dias) cria a
 *   senha, vê o bloco "Sua perua" no caixa (com o olho aberto e fechado), faz
 *   o plano da troca e anota o guardado, lê o "Preciso aumentar?", usa os
 *   atalhos e o "Encher", lança hoje / ontem / outro dia, vê o aviso de preço
 *   impossível, confere a despesa no caixa e entra em Abastecer pela tela
 *   TRANCADA — e ao voltar, o Financeiro tem de continuar trancado.
 *
 * Em toda tela: nenhum NaN / Infinity / undefined, nada estoura os 360 px e
 * nada fica escondido atrás do menu de baixo.
 *
 * Rodar (emuladores + vite SEM StrictMode, ver CLAUDE.md "ca9"):
 *   node testes-navegador/semear-perua.mjs && node testes-navegador/p1-perua.mjs
 * `APP_URL=http://127.0.0.1:5174` se o vite estiver noutra porta.
 *
 * ⚠️ Só emulador (`demo-alobuzinou`), como todo o kit.
 */
import { abrirCelular, passo, tocar, digitar, registrar, encerrar, esperar, achado, responderCookies, APP as APP_DA_LIB, garantirSessao, CONTAS } from './lib.mjs';

const APP = process.env.APP_URL || APP_DA_LIB;
const SENHA_DA_CONTA = 'senha-de-teste-123';
const SENHA_FIN = '2580';
const PALAVRAS_DE_BANCO = /\b(saldo|deposit\w*|sac(ar|ou|ando|ado)|saque|transfer\w*|rendiment\w*|render)\b/i;
const NUMERO_QUEBRADO = /NaN|Infinity|undefined|null\b/;
const SUGERE_REAJUSTE = /(sugerimos|sugest|recomend|reajuste de|aument(e|ar) (para|em)\s*R?\$?\s*\d|cobre\s+R\$|\b\d+([.,]\d+)?\s?%)/i;

const placar = {};
const marcar = (cenario, ok, nota = '') => {
  placar[cenario] = { ok, nota };
  console.log(`  ${ok ? '✔' : '✘'} ${cenario}${nota ? ' — ' + nota : ''}`);
};

// ── ajudantes que valem para os dois celulares ─────────────────────────
function kit(pagina, estado) {
  const m = (t) => passo(pagina, estado, t);
  const visivel = (loc) => loc.isVisible().catch(() => false);
  const texto = () => pagina.evaluate(() => document.body.innerText);
  const caminho = () => new URL(pagina.url()).pathname;

  /** Registra a tela e confere número quebrado, largura e o menu de baixo. */
  async function foto(nome, { cheia = false, conferirMenu = true } = {}) {
    const tela = await registrar(pagina, estado, nome, { paginaInteira: cheia });
    const t = await texto();
    const quebrado = t.match(NUMERO_QUEBRADO);
    if (quebrado) {
      achado(estado, { gravidade: 'alta', lente: 'número', tela: tela.id, oque: `A tela mostra "${quebrado[0]}" (…${t.slice(Math.max(0, quebrado.index - 40), quebrado.index + 30).replace(/\s+/g, ' ')}…)` });
    }
    if (tela.rolagemLateral) {
      achado(estado, { gravidade: 'alta', lente: '360px', tela: tela.id, oque: 'A página rola para o lado em 360 px de largura.' });
    }
    if (conferirMenu) {
      const sobra = await pagina.evaluate(() => {
        // Folha aberta cobre o menu: não é o caso medido aqui.
        if (document.querySelector('[role=dialog]')) return null;
        window.scrollTo(0, document.documentElement.scrollHeight);
        const fixos = [...document.querySelectorAll('nav, footer, div')].filter((el) => {
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return s.position === 'fixed' && r.height > 30 && r.height < 160 && r.bottom >= innerHeight - 2 && r.width > innerWidth * 0.8;
        });
        if (!fixos.length) return null;
        const topo = Math.min(...fixos.map((f) => f.getBoundingClientRect().top));
        let pior = null;
        for (const el of document.querySelectorAll('main button, main a, main input, main p, main h2, button, input, p, h2')) {
          if (fixos.some((f) => f.contains(el)) || el.closest('#tn-legenda,[data-sonner-toaster],[class*=toast]')) continue;
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          if (!r.width || !r.height || s.visibility === 'hidden' || s.position === 'fixed') continue;
          if (r.bottom > topo + 1 && r.top < innerHeight && (!pior || r.bottom > pior.bottom)) {
            pior = { bottom: Math.round(r.bottom), topo: Math.round(topo), texto: (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 50) };
          }
        }
        window.scrollTo(0, 0);
        return pior;
      });
      if (sobra) {
        achado(estado, { gravidade: 'atrapalha', lente: '360px', tela: tela.id, oque: `"${sobra.texto}" fica por baixo do menu fixo (termina em ${sobra.bottom}px, menu começa em ${sobra.topo}px) mesmo rolando até o fim.` });
      }
    }
    return tela;
  }

  async function entrar(email) {
    // O novato abre o Chrome LIMPO (celular novo, de propósito); o Beto
    // reaproveita o dele. Os dois entram pelo login único do kit.
    const conta = email === CONTAS.beto().email ? CONTAS.beto() : CONTAS.novato();
    await garantirSessao(pagina, estado, { ...conta, painel: '/tio' });
  }

  async function digitarComum(senha) {
    for (const d of senha) await tocar(pagina, pagina.getByRole('button', { name: d, exact: true }), d);
  }
  async function digitarNoBanco(senha) {
    for (const d of senha) {
      await tocar(pagina, pagina.getByRole('button', { name: new RegExp(`(^${d} ou \\d$)|(^\\d ou ${d}$)`) }), `o botão com ${d}`);
    }
  }
  /** Primeira vez no Financeiro: cria a senha e recusa a digital (como a F1). */
  async function criarSenha() {
    await tocar(pagina, pagina.getByRole('button', { name: 'Criar senha' }), 'Criar senha');
    await esperar(800);
    await digitarComum(SENHA_FIN);
    await esperar(1000);
    await digitarNoBanco(SENHA_FIN);
    await esperar(3500);
    const agoraNao = pagina.getByRole('button', { name: /Agora não/ });
    if (await visivel(agoraNao)) await tocar(pagina, agoraNao, 'Agora não');
    await esperar(2500);
  }
  async function voltar() {
    await tocar(pagina, pagina.getByRole('button', { name: /^Voltar/ }).first(), 'Voltar');
    await esperar(1800);
  }
  async function irPeloRodape(nome) {
    await tocar(pagina, pagina.getByRole('link', { name: nome }).last(), nome);
    await esperar(1800);
  }
  /**
   * Toque dentro de uma folha. Antes, confere se o botão está COBERTO (o
   * ponto do toque cai noutro elemento — o menu de baixo, por exemplo). Se
   * estiver, anota o achado e toca por evento, para a jornada seguir.
   */
  const jaAnotados = new Set();
  async function tocarNaFolha(alvo, rotulo, tela) {
    await alvo.waitFor({ state: 'visible', timeout: 15000 });
    await alvo.scrollIntoViewIfNeeded().catch(() => {});
    await esperar(300);
    const cobre = await alvo.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (y > innerHeight || y < 0) return `fora da tela (y=${Math.round(y)}, altura ${innerHeight})`;
      const em = document.elementFromPoint(x, y);
      if (!em || el.contains(em) || em.contains(el)) return null;
      const dono = em.closest('nav,footer,[role=dialog],header') || em;
      return `${dono.tagName.toLowerCase()}${dono.innerText ? ' "' + dono.innerText.replace(/\s+/g, ' ').slice(0, 40) + '"' : ''}`;
    });
    if (cobre) {
      if (!jaAnotados.has(rotulo)) {
        jaAnotados.add(rotulo);
        const f = await foto(`coberto-${rotulo.replace(/\W+/g, '-').toLowerCase()}`, { conferirMenu: false });
        achado(estado, { gravidade: 'bloqueia', lente: '360px', tela: f.id, oque: `Na folha "${tela}", o botão "${rotulo}" fica coberto por ${cobre} — o dedo toca no menu, não no botão.` });
      }
      await alvo.dispatchEvent('click');
      await esperar(600);
    } else {
      await tocar(pagina, alvo, rotulo);
    }
  }
  const resultado = () => pagina.locator('[aria-live=polite]').filter({ hasText: /^(Dá|Vai dar)/ }).first().innerText().catch(() => '');
  const campoPreco = () => pagina.locator('#abastecer-preco');
  const campoQtd = () => pagina.locator('#abastecer-qtd');
  const botao = (nome, exato = true) => pagina.getByRole('button', { name: nome, exact: exato });

  return { m, visivel, texto, caminho, foto, tocarNaFolha, entrar, criarSenha, digitarNoBanco, voltar, irPeloRodape, resultado, campoPreco, campoQtd, botao };
}

// ═════════════════════════════════════════════════════════════════════════
// O NOVATO
// ═════════════════════════════════════════════════════════════════════════
{
  const { contexto, pagina, estado } = await abrirCelular('responsavel', { jornada: 'P1-perua-novato', perfil: CONTAS.novato().perfil, limpar: true });
  estado.persona = 'Motorista novato';
  const k = kit(pagina, estado);
  const { m, visivel, texto, caminho, foto, resultado, campoPreco, campoQtd, botao } = k;

  try {
    await k.entrar('perua.novato@teste.local');

    // ── 1. Primeira vez em Abastecer ──────────────────────────────────
    try {
      await pagina.goto(APP + '/tio/abastecer');
      await esperar(3000);
      await m('1 · primeira vez: a pergunta do combustível');
      await foto('01-pergunta-combustivel');
      const pergunta = await visivel(pagina.getByText('Qual combustível sua perua usa?'));
      await tocar(pagina, botao('Diesel S10'), 'Diesel S10');
      await esperar(1500);

      await m('1 · sem posto: escreve o nome');
      const nomePosto = pagina.getByLabel('Nome do posto');
      const semPosto = await visivel(nomePosto);
      await digitar(pagina, nomePosto, 'Posto do Bairro', 'nome do posto');
      await m('1 · preço 6,33 e R$ 300');
      await digitar(pagina, campoPreco(), '6,33', 'preço');
      await digitar(pagina, campoQtd(), '300', 'reais');
      await esperar(500);
      const emReais = await resultado();
      await foto('02-cotacao-em-reais');
      await m('1 · troca para litros');
      await tocar(pagina, botao('Litros'), 'Litros');
      await esperar(600);
      const qtdEmLitros = await campoQtd().inputValue();
      const emLitros = await resultado();
      await foto('03-cotacao-em-litros');
      if (qtdEmLitros !== '47,4') {
        achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: '03', oque: `Ao trocar para litros o campo ficou "${qtdEmLitros}" (esperado 47,4 — os 300 reais).` });
      }

      // ── 2 (novato). Atalhos sem "Encher" ──
      await m('2 · novato: atalhos em litros e em reais, sem "Encher"');
      const atalhosLitros = await Promise.all(['20 l', '40 l', '50 l'].map((t) => visivel(botao(t))));
      await tocar(pagina, botao('Reais'), 'Reais');
      await esperar(500);
      const atalhosReais = await Promise.all(['R$ 100', 'R$ 200', 'R$ 300'].map((t) => visivel(botao(t))));
      const encherNovato = await visivel(botao('Encher'));
      if (encherNovato) achado(estado, { gravidade: 'alta', lente: 'número', tela: 'abastecer', oque: '"Encher" aparece para o novato, sem nenhum tanque cheio lançado.' });
      marcar('2a · atalhos do novato (sem Encher)', atalhosLitros.every(Boolean) && atalhosReais.every(Boolean) && !encherNovato);

      await m('1 · Guardar só o preço');
      await tocar(pagina, botao('Guardar só o preço'), 'Guardar só o preço');
      await esperar(1500);
      const toastGuardado = await visivel(pagina.getByText('Preço guardado'));
      await foto('04-preco-guardado');

      await m('1 · volta e reabre: posto e preço ficaram?');
      await k.voltar();
      await foto('05-depois-de-voltar');
      await pagina.goto(APP + '/tio/abastecer');
      await esperar(3000);
      const postoFicou = await visivel(pagina.getByText('Posto do Bairro', { exact: true }));
      const precoFicou = await campoPreco().inputValue().catch(() => '');
      await foto('06-reaberto');
      if (!postoFicou) achado(estado, { gravidade: 'alta', lente: 'fluxo', tela: '06', oque: 'Depois de "Guardar só o preço" e voltar, o posto não aparece em Abastecer.' });
      if (precoFicou !== '6,33') achado(estado, { gravidade: 'alta', lente: 'fluxo', tela: '06', oque: `Depois de guardar, o preço reaberto é "${precoFicou}" (esperado 6,33).` });
      marcar('1 · primeira vez em Abastecer',
        pergunta && semPosto && /47,4 litros/.test(emReais) && /R\$\s?300,04/.test(emLitros) && toastGuardado && postoFicou && precoFicou === '6,33',
        `reais: "${emReais.replace(/\s+/g, ' ')}" · litros: "${emLitros.replace(/\s+/g, ' ')}"`);
    } catch (err) {
      marcar('1 · primeira vez em Abastecer', false, err.message.slice(0, 120));
      achado(estado, { gravidade: 'bloqueia', lente: 'teste', tela: 'abastecer', oque: `Cenário 1 parou: ${err.message.slice(0, 200)}` });
      await foto('99-cenario1-parou', { conferirMenu: false }).catch(() => {});
    }

    // ── Ordem invertida: preço antes do nome do posto (só sem posto) ──
    // (o preço digitado é guardado "por posto"; cobre o motorista que pula
    // o nome e volta nele) — feito por um posto novo pela folha "Trocar".
    try {
      await m('1b · trocar de posto pela folha: cadastrar outro');
      await tocar(pagina, botao('Trocar'), 'Trocar');
      await esperar(1000);
      await foto('07-folha-trocar-posto', { conferirMenu: false });
      await k.tocarNaFolha(pagina.getByRole('button', { name: /Cadastrar posto/ }), 'Cadastrar posto', 'Trocar de posto');
      await digitar(pagina, pagina.getByRole('dialog').getByLabel('Nome do posto'), 'Auto Posto Avenida', 'nome');
      await k.tocarNaFolha(pagina.getByRole('button', { name: 'Usar este posto' }), 'Usar este posto', 'Trocar de posto');
      await esperar(1000);
      const precoNovo = await campoPreco().inputValue();
      await foto('08-posto-novo');
      if (precoNovo) achado(estado, { gravidade: 'melhoria', lente: 'número', tela: '08', oque: `Posto novo, nunca visto, já vem com preço "${precoNovo}".` });
    } catch (err) {
      achado(estado, { gravidade: 'atrapalha', lente: 'teste', tela: 'trocar posto', oque: `Folha "Trocar de posto" não funcionou: ${err.message.slice(0, 160)}` });
      await pagina.keyboard.press('Escape').catch(() => {});
    }

    // ── 3. Vírgula, ponto, milhar, vazio e zero ───────────────────────
    try {
      await m('3 · entradas: vírgula, ponto, milhar, vazio, zero');
      const casos = [];
      const caso = async (rotulo, preco, qtd) => {
        await campoPreco().fill(preco);
        await campoQtd().fill(qtd);
        await esperar(400);
        const r = (await resultado()).replace(/\s+/g, ' ');
        casos.push(`${rotulo}: preço "${preco}" qtd "${qtd}" → ${r}`);
        if (NUMERO_QUEBRADO.test(r)) achado(estado, { gravidade: 'alta', lente: 'número', tela: 'abastecer', oque: `${rotulo}: o resultado mostra "${r}".` });
        return r;
      };
      const virgula = await caso('vírgula', '6,33', '300');
      const ponto = await caso('ponto', '6.33', '300');
      const milhar = await caso('milhar', '6,33', '1.234,50');
      await foto('09-entrada-milhar');
      const vazio = await caso('preço vazio', '', '300');
      const zeroPreco = await caso('preço zero', '0', '300');
      const zeroQtd = await caso('quantidade zero', '6,33', '0');
      const qtdVazia = await caso('quantidade vazia', '6,33', '');
      await foto('10-entrada-zero');
      const milharSemVirgula = await caso('"1.234" sem vírgula', '6,33', '1.234');
      await tocar(pagina, botao('Litros'), 'Litros');
      const litrosVirgula = await caso('litros com vírgula', '6,33', '40,5');
      const litrosZero = await caso('litros zero', '0,00', '40');
      await foto('11-entrada-litros');
      await tocar(pagina, botao('Reais'), 'Reais');
      console.log('    ' + casos.join('\n    '));
      estado.casosDeEntrada = casos;
      if (/R\$\s?7\b|0,2 litros/.test(milharSemVirgula)) {
        achado(estado, { gravidade: 'melhoria', lente: 'número', tela: 'abastecer', oque: `"1.234" em reais (sem vírgula) é lido como R$ 1,23 — ${milharSemVirgula}. Quem digita milhar com ponto e sem centavos recebe um número 1000× menor, calado.` });
      }
      const ok =
        virgula === ponto && /195,0 litros/.test(milhar) && [vazio, zeroPreco, zeroQtd, qtdVazia, litrosZero].every((r) => /^(Dá|Vai dar) —/.test(r)) && /256,37/.test(litrosVirgula);
      marcar('3 · vírgula, ponto, milhar, vazio e zero', ok && !casos.some((c) => NUMERO_QUEBRADO.test(c)));
    } catch (err) {
      marcar('3 · vírgula, ponto, milhar, vazio e zero', false, err.message.slice(0, 120));
    }

    // ── 4 (novato). Um abastecimento, para ter um mês de dado ──
    try {
      await m('4 · novato lança um abastecimento');
      await campoPreco().fill('6,33');
      await campoQtd().fill('200');
      await tocar(pagina, botao('Abasteci'), 'Abasteci');
      await esperar(1000);
      await foto('12-folha-abasteci-novato', { conferirMenu: false });
      await k.tocarNaFolha(pagina.getByRole('dialog').getByRole('button', { name: 'Lançar' }), 'Lançar', 'Abasteci');
      await esperar(2000);
      const lancou = await visivel(pagina.getByText(/^Lançado:/));
      await foto('13-historico-novato');
      if (!lancou) achado(estado, { gravidade: 'alta', lente: 'fluxo', tela: '13', oque: 'O novato tocou em Lançar e não apareceu "Lançado".' });
    } catch (err) {
      achado(estado, { gravidade: 'alta', lente: 'teste', tela: 'abasteci', oque: `Lançar do novato parou: ${err.message.slice(0, 160)}` });
    }

    // ── 9 (novato). Preciso aumentar? sem histórico ──
    try {
      await m('9 · novato: Preciso aumentar? (cria a senha antes)');
      await pagina.goto(APP + '/tio/finance');
      await esperar(3000);
      if (await visivel(botao('Criar senha'))) await k.criarSenha();
      await pagina.goto(APP + '/tio/finance/aumentar');
      await esperar(3500);
      // Recarregar tranca: ou aparece a porta, ou direto o teclado de banco.
      if (await visivel(pagina.getByText('Abrir caixa'))) {
        await tocar(pagina, pagina.getByText('Abrir caixa'), 'Acessar');
        await esperar(1200);
      }
      if (await visivel(pagina.getByRole('button', { name: /^\d ou \d$/ }).first())) {
        await k.digitarNoBanco(SENHA_FIN);
        await esperar(3500);
      }
      if (caminho() !== '/tio/finance/aumentar' || (await visivel(pagina.getByText('Digite sua senha')))) {
        await tocar(pagina, pagina.getByRole('button', { name: /^Preciso aumentar\?/ }).first(), 'Preciso aumentar?');
        await esperar(3000);
      }
      await foto('14-aumentar-novato', { cheia: true });
      const t = await texto();
      const reajuste = t.match(SUGERE_REAJUSTE);
      if (reajuste) achado(estado, { gravidade: 'alta', lente: 'informar-não-induzir', tela: '14', oque: `Frase que sugere reajuste: "${reajuste[0]}"` });
      const faltam = /Faltam \d+ m(e|ê)s(es)? para mostrar/.test(t);
      if (!faltam) {
        achado(estado, { gravidade: 'melhoria', lente: 'fluxo', tela: '14', oque: `Novato sem turma: em vez de "quantos meses faltam", a alta diz "${(t.match(/Aparece quando[^\n]*/) || ['?'])[0]}". O texto dos meses só aparece com criança cadastrada — e o dado que falta é despesa, não turma.` });
      }
      marcar('9b · Preciso aumentar? (novato)', caminho() === '/tio/finance/aumentar' && /Preciso aumentar\?/.test(t) && !/Digite sua senha/.test(t) && !reajuste && !NUMERO_QUEBRADO.test(t), faltam ? 'mostra meses que faltam' : 'sem turma: não mostra meses que faltam');
    } catch (err) {
      marcar('9b · Preciso aumentar? (novato)', false, err.message.slice(0, 120));
    }
  } catch (err) {
    console.error(err);
    achado(estado, { gravidade: 'bloqueia', lente: 'teste', tela: '?', oque: `A jornada do novato parou: ${err.message}` });
    await registrar(pagina, estado, '99-onde-parou').catch(() => {});
  }
  estado.placar = placar;
  await encerrar(contexto, pagina, estado, { manterAberto: 1500 });
}

// ═════════════════════════════════════════════════════════════════════════
// O SEU BETO
// ═════════════════════════════════════════════════════════════════════════
{
  const { contexto, pagina, estado } = await abrirCelular('motorista', { jornada: 'P1-perua', perfil: CONTAS.beto().perfil });
  const k = kit(pagina, estado);
  const { m, visivel, texto, caminho, foto, resultado, campoPreco, campoQtd, botao } = k;
  const trancado = () => visivel(pagina.getByText('Abrir caixa'));

  try {
    await k.entrar('perua.beto@teste.local');
    await k.irPeloRodape('Financeiro');
    await m('cria a senha do Financeiro');
    await k.criarSenha();

    // ── 7. O bloco "Sua perua" no caixa ───────────────────────────────
    try {
      await m('7 · caixa: o bloco "Sua perua"');
      const bloco = pagina.getByText('Sua perua', { exact: true });
      await bloco.scrollIntoViewIfNeeded();
      await foto('01-caixa-sua-perua');
      const linhaComb = await pagina.getByRole('button', { name: /^Combustível/ }).first().innerText().catch(() => '');
      const temUltimo = /\d{2}\/\d{2} · [\d,]+ litros · R\$\s?\d+,\d{2} o litro/.test(linhaComb);
      await m('7 · fecha o olho');
      const esconder = pagina.getByRole('button', { name: /Esconder/ }).first();
      await tocar(pagina, esconder, 'Esconder');
      await esperar(800);
      await bloco.scrollIntoViewIfNeeded();
      const linhaEscondida = await pagina.getByRole('button', { name: /^Combustível/ }).first().innerText().catch(() => '');
      const reservaEscondida = await pagina.getByRole('button', { name: /^Reserva da perua/ }).first().innerText().catch(() => '');
      await foto('02-caixa-olho-fechado');
      const vazou = /R\$\s?\d/.test(linhaEscondida + reservaEscondida);
      if (vazou) achado(estado, { gravidade: 'alta', lente: 'privacidade', tela: '02', oque: `Com o olho fechado, "Sua perua" ainda mostra valor: ${linhaEscondida.replace(/\s+/g, ' ')}` });
      await tocar(pagina, pagina.getByRole('button', { name: /Mostrar/ }).first(), 'Mostrar');
      marcar('7 · "Sua perua" no caixa + olho', temUltimo && !vazou, linhaComb.replace(/\s+/g, ' '));
    } catch (err) {
      marcar('7 · "Sua perua" no caixa + olho', false, err.message.slice(0, 120));
    }

    // ── 8. Reserva: plano em três passos e o guardado ─────────────────
    try {
      await m('8 · Reserva da perua, sem plano');
      await tocar(pagina, pagina.getByRole('button', { name: /^Reserva da perua/ }).first(), 'Reserva da perua');
      await esperar(2000);
      await foto('03-reserva-sem-plano', { cheia: true });
      await tocar(pagina, botao('Fazer o plano da troca'), 'Fazer o plano da troca');
      await esperar(1000);
      const dialogo = pagina.getByRole('dialog');
      await m('8 · passo 1: vale hoje R$ 250.000');
      await digitar(pagina, dialogo.getByLabel('Quanto vale a sua perua hoje?'), '25000000', 'vale hoje');
      await foto('04-plano-passo1', { conferirMenu: false });
      await k.tocarNaFolha(dialogo.getByRole('button', { name: 'Próximo' }), 'Próximo', 'Plano da troca');
      await m('8 · passo 2: 6 anos');
      await k.tocarNaFolha(dialogo.getByRole('button', { name: 'Um ano a mais' }), '+1 ano', 'Plano da troca');
      await foto('05-plano-passo2', { conferirMenu: false });
      await k.tocarNaFolha(dialogo.getByRole('button', { name: 'Próximo' }), 'Próximo', 'Plano da troca');
      await m('8 · passo 3, "Voltar um passo" e de novo');
      await k.tocarNaFolha(dialogo.getByRole('button', { name: 'Voltar um passo' }), 'Voltar um passo', 'Plano da troca');
      const anosMantidos = await visivel(dialogo.getByText('6 anos', { exact: true }));
      if (!anosMantidos) achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: 'plano', oque: '"Voltar um passo" perdeu os 6 anos escolhidos.' });
      await k.tocarNaFolha(dialogo.getByRole('button', { name: 'Próximo' }), 'Próximo', 'Plano da troca');
      await m('8 · vai valer R$ 300.000 (maior que hoje) → recusa');
      const campoFinal = dialogo.getByLabel('Quanto acha que ela vai valer quando trocar?');
      await digitar(pagina, campoFinal, '30000000', 'vai valer');
      await k.tocarNaFolha(dialogo.getByRole('button', { name: 'Salvar o plano' }), 'Salvar o plano', 'Plano da troca');
      await esperar(800);
      const recusou = await visivel(dialogo.getByText(/precisa ser menor/));
      const conta300 = (await dialogo.innerText()).replace(/\s+/g, ' ');
      await foto('06-plano-maior-que-hoje', { conferirMenu: false });
      if (!recusou) achado(estado, { gravidade: 'alta', lente: 'número', tela: '06', oque: 'Valor final maior que o de hoje NÃO foi recusado.' });
      if (/separe\s+(-|−)/.test(conta300)) achado(estado, { gravidade: 'atrapalha', lente: 'número', tela: '06', oque: `Com valor final maior que o de hoje, a folha mostra um "separe" negativo antes de recusar: ${conta300.match(/separe[^)]*\)/)?.[0]}` });
      await m('8 · vai valer R$ 130.000');
      await digitar(pagina, campoFinal, '13000000', 'vai valer');
      await esperar(500);
      const conta = (await dialogo.innerText()).replace(/\s+/g, ' ');
      await foto('07-plano-conta', { conferirMenu: false });
      await k.tocarNaFolha(dialogo.getByRole('button', { name: 'Salvar o plano' }), 'Salvar o plano', 'Plano da troca');
      await esperar(2000);
      const porMesOk = /separe R\$\s?1\.667 por mês/.test(conta);

      await m('8 · anota o guardado da troca: R$ 15.000');
      await tocar(pagina, botao('Atualizar o que tenho guardado').first(), 'Atualizar (troca)');
      await esperar(800);
      await digitar(pagina, pagina.getByRole('dialog').getByLabel('Valor na sua reserva do banco'), '1500000', 'guardado');
      await foto('08-anotar-troca', { conferirMenu: false });
      await k.tocarNaFolha(pagina.getByRole('dialog').getByRole('button', { name: 'Salvar anotação' }), 'Salvar anotação', 'Quanto tem guardado');
      await esperar(2000);

      await m('8 · manutenção: zero, depois R$ 2.500');
      await tocar(pagina, botao('Atualizar o que tenho guardado').last(), 'Atualizar (manutenção)');
      await esperar(800);
      const campoGuardado = pagina.getByRole('dialog').getByLabel('Valor na sua reserva do banco');
      await digitar(pagina, campoGuardado, '0', 'zero');
      const valorComZero = await campoGuardado.inputValue();
      await k.tocarNaFolha(pagina.getByRole('dialog').getByRole('button', { name: 'Salvar anotação' }), 'Salvar anotação', 'Quanto tem guardado');
      await esperar(1500);
      const zeroAberta = await visivel(pagina.getByRole('dialog'));
      await foto('09-anotar-zero', { conferirMenu: false });
      if (zeroAberta) {
        achado(estado, { gravidade: 'atrapalha', lente: 'fluxo', tela: '09', oque: `"Quanto tem guardado": a folha pede "Se não tem nada guardado, digite zero", mas digitar 0 deixa o campo "${valorComZero}" e o Salvar recusa — não dá para anotar zero.` });
        await digitar(pagina, campoGuardado, '250000', 'guardado');
        await k.tocarNaFolha(pagina.getByRole('dialog').getByRole('button', { name: 'Salvar anotação' }), 'Salvar anotação', 'Quanto tem guardado');
        await esperar(2000);
      }
      const t = await texto();
      await foto('10-reserva-com-plano', { cheia: true });
      const hoje = new Date();
      const dia = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}`;
      const progresso = await pagina.getByRole('progressbar').first().getAttribute('aria-valuenow').catch(() => null);
      const checagens = {
        guardado: /R\$\s?15\.000/.test(t),
        data: t.includes(`Anotado por você em ${dia}`),
        falta: /Faltam para a meta de R\$\s?120\.000\s*R\$\s?105\.000/.test(t),
        progresso: progresso === '13',
        prazo: /Em 6 anos · \w+ de \d{4}/.test(t),
        porMes: porMesOk,
      };
      const banco = t.match(PALAVRAS_DE_BANCO);
      if (banco) achado(estado, { gravidade: 'alta', lente: 'palavras', tela: '10', oque: `A reserva usa a palavra "${banco[0]}" — o app não guarda dinheiro.` });
      for (const [nome, ok] of Object.entries(checagens)) {
        if (!ok) achado(estado, { gravidade: 'atrapalha', lente: 'número', tela: '10', oque: `Reserva: a conferência "${nome}" falhou (progresso=${progresso}).` });
      }
      marcar('8 · Reserva: plano, recusa, guardado', recusou && anosMantidos && Object.values(checagens).every(Boolean) && !banco, JSON.stringify(checagens));
      await k.voltar();
    } catch (err) {
      marcar('8 · Reserva: plano, recusa, guardado', false, err.message.slice(0, 120));
      await pagina.keyboard.press('Escape').catch(() => {});
      await pagina.goto(APP + '/tio/finance').catch(() => {});
      await esperar(2500);
    }

    // ── 9. Preciso aumentar? com 12 meses ─────────────────────────────
    try {
      await m('9 · Preciso aumentar? com 12 meses');
      if (await trancado()) {
        await tocar(pagina, pagina.getByText('Abrir caixa'), 'Acessar');
        await k.digitarNoBanco(SENHA_FIN);
        await esperar(3500);
      }
      await tocar(pagina, pagina.getByRole('button', { name: /^Preciso aumentar\?/ }).first(), 'Preciso aumentar?');
      await esperar(2500);
      await foto('11-aumentar-12-meses', { cheia: true });
      await tocar(pagina, pagina.getByRole('button', { name: /A economia do Brasil/ }), 'A economia do Brasil');
      await esperar(1200);
      await foto('12-aumentar-ipca-aberto', { cheia: true });
      const t = await texto();
      const renova = pagina.getByText(/^Seus contratos renovam em/).first();
      const destaque = /warning/.test((await renova.getAttribute('class').catch(() => '')) || '');
      const c = {
        custoPorCrianca: /Cada criança te custa R\$\s?[\d.]+ por mês/.test(t),
        cobra: /Você cobra R\$\s?478/.test(t),
        altaPorPartes: /Em 12 meses, cada criança passou a custar/.test(t) && /Auxiliar|Monitor/i.test(t) && /Manuten/.test(t) && /Diesel S10/.test(t),
        renovacaoEmDestaque: destaque,
        semCombustivelAmbar: /não há abastecimento lançado/.test(t),
        ipcaSemDado: /ainda não chegou/.test(t),
      };
      const reajuste = t.match(SUGERE_REAJUSTE);
      if (reajuste) achado(estado, { gravidade: 'alta', lente: 'informar-não-induzir', tela: '11', oque: `Frase que sugere reajuste: "${reajuste[0]}"` });
      for (const [nome, ok] of Object.entries(c)) {
        if (!ok) achado(estado, { gravidade: 'atrapalha', lente: 'conteúdo', tela: '11', oque: `Preciso aumentar?: "${nome}" não apareceu como esperado.` });
      }
      estado.textoAumentar = t;
      // A alta do auxiliar: a semente sobe o salário todo mês; se a tela disser que caiu, o mês corrente (incompleto) entrou na média.
      if (/Monitor \/ auxiliar\s*−/.test(t)) achado(estado, { gravidade: 'alta', lente: 'número', tela: '11', oque: `O salário do auxiliar SOBE todo mês na semente (R$ 900 → R$ 1.000), e a tela diz que ele caiu: "${t.match(/Monitor \/ auxiliar\s*−R\$\s?\d+/)[0].replace(/\s+/g, ' ')}". O mês corrente (3 dias, sem salário lançado) entra como mês inteiro na média dos 3 mais recentes — e o título vira "passou a custar menos".` });
      marcar('9a · Preciso aumentar? (12 meses)', Object.values(c).every(Boolean) && !reajuste && !NUMERO_QUEBRADO.test(t), JSON.stringify(c));
      await k.voltar();
    } catch (err) {
      marcar('9a · Preciso aumentar? (12 meses)', false, err.message.slice(0, 120));
    }

    // ── 2, 4, 5. Abastecer de quem tem histórico ─────────────────────
    try {
      await m('2 · Abastecer pelo caixa: atalhos e "Encher"');
      await tocar(pagina, pagina.getByRole('button', { name: /^Combustível/ }).first(), 'Combustível');
      await esperar(2500);
      await foto('13-abastecer-beto', { cheia: true });
      const precoPreenchido = await campoPreco().inputValue();
      const r = {};
      for (const v of [100, 200, 300]) {
        await tocar(pagina, botao(`R$ ${v}`), `R$ ${v}`);
        r[v] = (await resultado()).replace(/\s+/g, ' ');
      }
      const encher = botao('Encher');
      const temEncher = await visivel(encher);
      if (temEncher) {
        await tocar(pagina, encher, 'Encher');
        r.encher = (await resultado()).replace(/\s+/g, ' ');
      } else {
        achado(estado, { gravidade: 'alta', lente: 'fluxo', tela: '13', oque: '"Encher" não aparece para quem tem 11 tanques cheios lançados.' });
      }
      await foto('14-encher');
      const okAtalhos = [100, 200, 300].every((v) => new RegExp(`R\\$\\s?${v},00 a`).test(r[v]));
      marcar('2b · atalhos e Encher (com histórico)', okAtalhos && temEncher && /encher é cerca de \d+ litros/.test(r.encher || ''), `preço ${precoPreenchido} · ${JSON.stringify(r)}`);

      // ── 4. Abasteci: hoje, ontem, outro dia ──
      const hoje = new Date();
      const dd = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
      const outro = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 10);
      const isoDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const lancar = async (quando, litros, pagou, nome) => {
        await campoPreco().fill('6,40');
        await campoQtd().fill('300');
        await tocar(pagina, botao('Abasteci'), 'Abasteci');
        await esperar(900);
        const d = pagina.getByRole('dialog');
        await d.getByLabel('Litros').fill(litros);
        await d.getByLabel('Pagou (R$)').fill(pagou);
        await k.tocarNaFolha(d.getByRole('button', { name: quando }), quando, 'Abasteci');
        if (quando === 'Outro dia') await d.getByLabel('Dia').fill(isoDe(outro));
        await k.tocarNaFolha(d.getByRole('checkbox', { name: /Enchi o tanque/ }), 'Enchi o tanque', 'Abasteci');
        await foto(nome, { conferirMenu: false });
        await k.tocarNaFolha(d.getByRole('button', { name: 'Lançar' }), 'Lançar', 'Abasteci');
        await esperar(2200);
        return !(await visivel(pagina.getByRole('dialog')));
      };
      await m('4 · Abasteci hoje, tanque cheio');
      const l1 = await lancar('Hoje', '50', '320,00', '15-abasteci-hoje');
      await m('4 · Abasteci ontem');
      const l2 = await lancar('Ontem', '40,5', '259,20', '16-abasteci-ontem');
      await m('4 · Abasteci outro dia (10 dias atrás)');
      const l3 = await lancar('Outro dia', '45', '286,65', '17-abasteci-outro-dia');
      await esperar(1500);
      const hist = (await pagina.getByText('Seus abastecimentos').locator('..').innerText()).replace(/\s+/g, ' ');
      await foto('18-historico-depois', { cheia: true });
      const h = {
        hoje: hist.includes(`${dd(hoje)} · 50 litros`) && /R\$\s?6,40 o litro/.test(hist),
        ontem: hist.includes(`${dd(ontem)} · 40,5 litros`),
        outroDia: hist.includes(`${dd(outro)} · 45 litros`) && /R\$\s?6,37 o litro/.test(hist),
      };
      if (!h.outroDia && hist.includes(`${dd(outro)}`) === false) {
        achado(estado, { gravidade: 'melhoria', lente: 'fluxo', tela: '18', oque: `O lançamento de "outro dia" (${dd(outro)}) não aparece nas 5 linhas do histórico — a lista mostra só os 5 mais recentes.` });
      }
      for (const [n2, ok] of Object.entries(h)) if (!ok) achado(estado, { gravidade: 'atrapalha', lente: 'conteúdo', tela: '18', oque: `Histórico: a linha de "${n2}" não bateu. Lido: ${hist.slice(0, 300)}` });
      estado.historico = hist;
      marcar('4a · Abasteci hoje/ontem/outro dia + histórico', l1 && l2 && l3 && h.hoje && h.ontem, JSON.stringify(h));

      // ── 5. Preço implausível ──
      await m('5 · preço implausível: 5 litros por R$ 300');
      await campoQtd().fill('300');
      await tocar(pagina, botao('Abasteci'), 'Abasteci');
      await esperar(900);
      const d = pagina.getByRole('dialog');
      await d.getByLabel('Litros').fill('5');
      await d.getByLabel('Pagou (R$)').fill('300');
      await esperar(500);
      const aviso = await visivel(d.getByText(/parece fora do normal/));
      await foto('19-preco-implausivel', { conferirMenu: false });
      marcar('5 · aviso de preço implausível', aviso);
      if (!aviso) achado(estado, { gravidade: 'alta', lente: 'número', tela: '19', oque: 'R$ 60 o litro não mostrou o aviso de preço fora do normal.' });
      const fechar = d.getByRole('button', { name: /Fechar|Voltar/ }).first();
      if (await visivel(fechar)) await tocar(pagina, fechar, 'Fechar');
      else await pagina.keyboard.press('Escape');
      await esperar(1000);
      if (await visivel(pagina.getByRole('dialog'))) {
        await pagina.goBack();
        await esperar(1000);
      }
    } catch (err) {
      marcar('2b/4/5 · Abastecer com histórico', false, err.message.slice(0, 160));
      await foto('99-abastecer-parou', { conferirMenu: false }).catch(() => {});
    }

    // ── 4b. A despesa no caixa ────────────────────────────────────────
    try {
      await m('4b · volta ao Financeiro e confere a despesa');
      await pagina.goto(APP + '/tio/abastecer');
      await esperar(2000);
      await k.voltar();
      const estavaTrancado = await trancado();
      await foto('20-financeiro-depois-de-abastecer');
      if (estavaTrancado) {
        await tocar(pagina, pagina.getByText('Abrir caixa'), 'Acessar');
        await k.digitarNoBanco(SENHA_FIN);
        await esperar(3500);
      }
      const extrato = await texto();
      await foto('21-extrato', { cheia: true });
      const noExtrato = /R\$\s?320,00/.test(extrato);
      await tocar(pagina, pagina.getByRole('button', { name: /Despesas do mês/ }).or(pagina.getByRole('link', { name: /Despesas do mês/ })).first(), 'Despesas do mês');
      await esperar(2200);
      const desp = await texto();
      await foto('22-despesas-do-mes', { cheia: true });
      const nasDespesas = /320,00/.test(desp) && /259,20/.test(desp);
      if (!noExtrato) achado(estado, { gravidade: 'atrapalha', lente: 'conteúdo', tela: '21', oque: 'O abastecimento de hoje (R$ 320,00) não aparece no Extrato do caixa.' });
      if (!nasDespesas) achado(estado, { gravidade: 'atrapalha', lente: 'conteúdo', tela: '22', oque: 'Os abastecimentos de hoje e ontem (R$ 320,00 e R$ 259,20) não aparecem em Despesas do mês.' });
      marcar('4b · despesa no Extrato e em Despesas do mês', noExtrato && nasDespesas, estavaTrancado ? 'voltar de Abastecer cai na tela trancada' : 'voltar de Abastecer cai no caixa aberto');
      await k.voltar();
    } catch (err) {
      marcar('4b · despesa no Extrato e em Despesas do mês', false, err.message.slice(0, 120));
    }

    // ── 6. Pela tela trancada ────────────────────────────────────────
    try {
      await m('6 · sai para o Início, volta: trancado; Abastecer sem senha');
      await k.irPeloRodape('Início');
      await k.irPeloRodape('Financeiro');
      const t1 = await trancado();
      await foto('23-trancado', { cheia: true });
      await tocar(pagina, pagina.getByRole('button', { name: /^Abastecer/ }), 'Abastecer');
      await esperar(2200);
      const semSenha = caminho() === '/tio/abastecer' && !(await visivel(pagina.getByRole('button', { name: /^\d ou \d$/ }).first()));
      await foto('24-abastecer-pela-tranca');
      await k.voltar();
      const t2 = await trancado();
      await foto('25-depois-de-voltar');
      if (!semSenha) achado(estado, { gravidade: 'alta', lente: 'fluxo', tela: '24', oque: `O cartão Abastecer da tela trancada não abriu Abastecer sem senha (caminho ${caminho()}).` });
      if (!t2) achado(estado, { gravidade: 'critica', lente: 'segurança', tela: '25', oque: 'Voltar de Abastecer (entrando pela tela trancada) abriu o caixa SEM senha.' });
      marcar('6 · tela trancada → Abastecer → volta trancado', t1 && semSenha && t2);
    } catch (err) {
      marcar('6 · tela trancada → Abastecer → volta trancado', false, err.message.slice(0, 120));
    }
  } catch (err) {
    console.error(err);
    achado(estado, { gravidade: 'bloqueia', lente: 'teste', tela: '?', oque: `A jornada do Beto parou: ${err.message}` });
    await registrar(pagina, estado, '99-onde-parou').catch(() => {});
  }

  // ── 10. 360 px: o que as fotos mediram ──
  const telas = estado.telas.filter((t) => t.rolagemLateral);
  marcar('10 · 360 px sem rolagem lateral (Beto)', telas.length === 0, telas.map((t) => t.id).join(', '));
  estado.placar = placar;
  await encerrar(contexto, pagina, estado, { manterAberto: 1500 });
}

console.log('\n══ PLACAR ══');
for (const [c, { ok, nota }] of Object.entries(placar)) console.log(`${ok ? 'OK ' : 'FALHOU'}  ${c}${nota ? '  · ' + nota.slice(0, 200) : ''}`);
