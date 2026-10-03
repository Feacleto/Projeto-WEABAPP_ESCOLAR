/**
 * M1 + M2 — O MOTORISTA CHEGA PELO SITE, CRIA A CONTA E FAZ O PRIMEIRO ACESSO.
 *
 * Seu Zé, 52 anos, Android simples, letra aumentada. Ele viu o site, quer
 * experimentar. O caminho que um motorista curioso faz: site → "Entrar no app"
 * → a porta (com a apresentação de primeira visita) → "Criar conta grátis" →
 * cadastro → primeiro acesso → tutorial → Início.
 */
import { abrirCelular, passo, tocar, digitar, registrar, achado, encerrar, esperar, SITE, responderCookies } from './lib.mjs';

const EMAIL = `ze.motorista.${Date.now() % 100000}@teste.local`;

const { contexto, pagina, estado } = await abrirCelular('motorista', { jornada: 'M1-cadastro', limpar: true });
const m = (t) => passo(pagina, estado, t);

try {
  // ── O site ────────────────────────────────────────────────────────────
  await m('abre o site');
  await pagina.goto(SITE + '/');
  await registrar(pagina, estado, 'site-topo');
  await registrar(pagina, estado, 'site-inteiro', { paginaInteira: true });

  await m('toca em "Entrar no app"');
  await tocar(pagina, pagina.getByRole('link', { name: 'Entrar no app' }).first(), 'Entrar no app');

  // ── A porta: a apresentação de primeira visita ─────────────────────────
  await m('a apresentação do login (primeira visita)');
  await pagina.waitForURL(/\/login/, { timeout: 15000 });
  await esperar(2200);
  await registrar(pagina, estado, 'login-apresentacao-2s');
  // Toque no meio da apresentação: ela deve ignorar (decisão do dono).
  await pagina.mouse.click(180, 400).catch(() => {});
  await esperar(4000);
  await registrar(pagina, estado, 'login-apresentacao-previa');
  await esperar(5000);
  await registrar(pagina, estado, 'login-foco-final');

  if (await pagina.getByText('Configurar primeiro administrador').isVisible().catch(() => false)) {
    console.log('  (nota: "Configurar primeiro administrador" aparece só porque o banco de teste não tem dono — não conta como achado)');
  }

  await m('toca em "Criar conta grátis"');
  await tocar(pagina, pagina.getByRole('button', { name: /Criar conta grátis/ }), 'Criar conta grátis');

  // ── O cadastro ────────────────────────────────────────────────────────
  await pagina.waitForURL(/quero-fazer-parte/, { timeout: 15000 });
  await m('o cadastro: e-mail, WhatsApp e senha');
  await registrar(pagina, estado, 'cadastro-vazio');
  if (await pagina.getByRole('button', { name: 'Apenas essenciais' }).isVisible().catch(() => false)) {
    await responderCookies(pagina);
  }

  // Erro de propósito: tentar entrar sem preencher. A mensagem diz o que fazer?
  await tocar(pagina, pagina.getByRole('button', { name: /Criar minha conta e entrar/ }), 'Criar (vazio)');
  await registrar(pagina, estado, 'cadastro-erros');

  await digitar(pagina, pagina.getByLabel('Email'), EMAIL, 'e-mail');
  await digitar(pagina, pagina.getByLabel('WhatsApp'), '11987654321', 'WhatsApp');
  await digitar(pagina, pagina.getByLabel('Senha', { exact: false }).first(), 'perua123', 'senha');
  await registrar(pagina, estado, 'cadastro-preenchido');
  await tocar(pagina, pagina.getByRole('button', { name: /Criar minha conta e entrar/ }), 'Criar minha conta e entrar');

  // ── O primeiro acesso (card por cima do /tio) ──────────────────────────
  await pagina.waitForURL(/\/tio/, { timeout: 30000 });
  await esperar(1500);
  if (await pagina.getByText(/Atualização dos termos|Antes de começar/).first().isVisible().catch(() => false)) {
    await m('aceite dos termos (conta nova)');
    await registrar(pagina, estado, 'termos-conta-nova');
    const caixas = pagina.getByRole('checkbox');
    const n = await caixas.count();
    for (let i = 0; i < n; i++) await tocar(pagina, caixas.nth(i), 'aceito');
    if (n === 0) {
      await tocar(pagina, pagina.getByText('Li e aceito os').first(), 'aceito os termos');
      await tocar(pagina, pagina.getByText('Li e aceito a').first(), 'aceito a política');
    }
    await registrar(pagina, estado, 'termos-marcados');
    await tocar(pagina, pagina.getByRole('button', { name: 'Aceitar e continuar' }), 'Aceitar e continuar');
    await esperar(2000);
  }

  await m('primeiro acesso: seus dados');
  await registrar(pagina, estado, 'primeiro-acesso-1');

  const nome = pagina.getByLabel('Seu nome completo');
  if (await nome.isVisible().catch(() => false)) {
    await digitar(pagina, nome, 'José Aparecido da Silva', 'nome');
    await tocar(pagina, pagina.getByRole('button', { name: 'Continuar' }), 'Continuar');
  }

  await m('primeiro acesso: a marca');
  await registrar(pagina, estado, 'primeiro-acesso-marca');
  const marca = pagina.getByLabel('Como as famílias te chamam');
  if (await marca.isVisible().catch(() => false)) {
    await digitar(pagina, marca, 'Tio Zé', 'como as famílias te chamam');
    await tocar(pagina, pagina.getByRole('button', { name: 'Continuar' }), 'Continuar');
  }

  await m('primeiro acesso: localização');
  await registrar(pagina, estado, 'primeiro-acesso-local');
  const permitir = pagina.getByRole('button', { name: 'Permitir localização' });
  if (await permitir.isVisible().catch(() => false)) {
    await tocar(pagina, permitir, 'Permitir localização');
    await esperar(4000);
    await registrar(pagina, estado, 'primeiro-acesso-local-depois');
  }
  const entrar = pagina.getByRole('button', { name: 'Entrar no app' });
  if (await entrar.isVisible().catch(() => false)) {
    await tocar(pagina, entrar, 'Entrar no app');
  }

  // ── O tutorial (quatro paradas) ────────────────────────────────────────
  await m('o tutorial');
  await esperar(2500);
  for (let i = 1; i <= 6; i++) {
    const proximo = pagina.getByRole('button', { name: /Próximo|Concluir|Começar|Entendi/ }).last();
    if (!(await proximo.isVisible().catch(() => false))) break;
    await registrar(pagina, estado, `tutorial-${i}`);
    await tocar(pagina, proximo, 'Próximo');
    await esperar(1200);
  }

  // ── O Início ──────────────────────────────────────────────────────────
  await m('o Início, pronto para usar');
  await esperar(1500);
  await registrar(pagina, estado, 'inicio');
  await registrar(pagina, estado, 'inicio-inteiro', { paginaInteira: true });
  console.log('\n  e-mail do motorista:', EMAIL);
} catch (err) {
  console.error('\n  ✗ a jornada parou:', err.message.split('\n')[0]);
  await registrar(pagina, estado, 'onde-parou').catch(() => {});
  estado.parou = err.message.split('\n')[0];
} finally {
  estado.email = EMAIL;
  await encerrar(contexto, pagina, estado);
}
