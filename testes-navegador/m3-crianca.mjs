/**
 * M3 + M4 — O MOTORISTA CADASTRA A PRIMEIRA CRIANÇA E MANDA O CONVITE.
 *
 * Seu Zé (já logado, da M1) cadastra o Pedro: quem é, onde mora, escola (que
 * nasce no caminho, num popup) e horários, responsável e mensalidade. Depois
 * de salvar com mensalidade e sem chave PIX, o app pergunta pela chave — e a
 * pergunta "seu celular é sua chave?" é parte do teste. No fim ele manda o
 * convite; o link vai para `resultados/convite.txt`, de onde a mãe (R1) parte.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirCelular, passo, tocar, digitar, registrar, encerrar, esperar, APP } from './lib.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const { contexto, pagina, estado } = await abrirCelular('motorista', { jornada: 'M3-crianca' });
const m = (t) => passo(pagina, estado, t);
const avancar = () => tocar(pagina, pagina.getByRole('button', { name: /^(Avançar|Cadastrar criança)$/ }), 'Avançar');
const visivel = (loc) => loc.isVisible().catch(() => false);

/** Busca a rua pelo nome e escolhe a primeira sugestão — como ele faria. */
async function buscarRua(escopo, rua, rotulo) {
  const campo = escopo.getByLabel('Nome da rua');
  await digitar(pagina, campo, rua, rotulo);
  await esperar(2500);
  const sugestao = escopo.getByRole('button', { name: new RegExp(rua.split(' ').slice(-1)[0], 'i') }).first();
  if (await visivel(sugestao)) await tocar(pagina, sugestao, 'esta rua');
  await esperar(1200);
}

try {
  await pagina.goto(APP + '/tio');
  await esperar(3000);
  await m('Início: "Cadastrar a primeira criança"');
  await registrar(pagina, estado, 'inicio-antes');
  await tocar(pagina, pagina.getByRole('button', { name: /Cadastrar a primeira criança/ }).first(), 'Cadastrar a primeira criança');

  // ── Passo 1: quem é a criança ──────────────────────────────────────────
  await pagina.waitForURL(/children\/new/, { timeout: 15000 });
  await m('passo 1: quem é a criança');
  await esperar(1000);
  await registrar(pagina, estado, 'p1-vazio');
  await avancar(); // sem preencher: a tela diz o que falta?
  await registrar(pagina, estado, 'p1-erros');
  await digitar(pagina, pagina.getByLabel('Nome completo'), 'Pedro Henrique Souza', 'nome');
  await tocar(pagina, pagina.getByRole('button', { name: 'Menino' }), 'Menino');
  const autorizacao = pagina.getByRole('checkbox').first();
  await tocar(pagina, autorizacao, 'tenho autorização');
  await registrar(pagina, estado, 'p1-preenchido');
  await avancar();

  // ── Passo 2: onde mora ────────────────────────────────────────────────
  await m('passo 2: onde mora (busca da rua pelo nome)');
  await esperar(1000);
  await registrar(pagina, estado, 'p2-vazio');
  await buscarRua(pagina, 'Rua Gomes de Carvalho', 'rua de casa');
  const numero = pagina.getByLabel('Número', { exact: true });
  if (await visivel(numero)) await digitar(pagina, numero, '1510', 'número');
  await esperar(1500);
  await registrar(pagina, estado, 'p2-preenchido');
  await avancar();
  await esperar(3500); // o ponto no mapa (Nominatim) é procurado ao sair do passo
  await registrar(pagina, estado, 'p2-depois-de-avancar');
  // Se o app pedir para confirmar o ponto no mapa, confirma.
  const confirmar = pagina.getByRole('button', { name: /Confirmar|Usar este|Está certo|Avançar/ }).first();
  if (/children\/new/.test(pagina.url()) && (await pagina.getByText('Escola e horários').count()) === 0 && (await visivel(confirmar))) {
    await tocar(pagina, confirmar, 'confirmar o ponto');
    await esperar(1500);
  }

  // ── Passo 3: escola (nasce num popup) e horários ───────────────────────
  await m('passo 3: escola e horários');
  await pagina.getByText('Escola e horários').first().waitFor({ timeout: 15000 });
  await registrar(pagina, estado, 'p3-vazio');
  await tocar(pagina, pagina.getByRole('button', { name: /^Cadastrar escola$/ }), 'Cadastrar escola');
  await esperar(1000);
  await m('popup: nova escola');
  await registrar(pagina, estado, 'p3-popup-escola');
  const popup = pagina.getByRole('dialog').last();
  await digitar(pagina, popup.getByLabel('Nome da escola'), 'Colégio Santa Maria', 'nome da escola');
  await buscarRua(popup, 'Rua Funchal', 'rua da escola');
  await registrar(pagina, estado, 'p3-popup-preenchido');
  await tocar(pagina, popup.getByRole('button', { name: /Salvar e usar/ }), 'Salvar e usar');
  await esperar(2500);
  await registrar(pagina, estado, 'p3-escola-escolhida');
  await digitar(pagina, pagina.getByLabel('Que horas você pega em casa?'), '0640', 'hora de pegar');
  await digitar(pagina, pagina.getByLabel('Que horas você entrega em casa?'), '1250', 'hora de entregar');
  await registrar(pagina, estado, 'p3-preenchido');
  await avancar();

  // ── Passo 4: responsável e mensalidade ─────────────────────────────────
  await m('passo 4: responsável e mensalidade');
  await esperar(1000);
  await registrar(pagina, estado, 'p4-vazio');
  await digitar(pagina, pagina.getByLabel('Nome', { exact: true }), 'Mariana Souza', 'nome da mãe');
  await digitar(pagina, pagina.getByLabel('Telefone', { exact: true }), '11976543210', 'WhatsApp da mãe');
  await digitar(pagina, pagina.getByLabel('Valor (R$)'), '450', 'mensalidade');
  await digitar(pagina, pagina.getByLabel('Dia do vencimento'), '10', 'vencimento');
  await registrar(pagina, estado, 'p4-preenchido');
  await registrar(pagina, estado, 'p4-inteiro', { paginaInteira: true });
  await avancar();

  // ── A pergunta da chave PIX (mensalidade combinada, sem chave) ─────────
  await esperar(2500);
  await m('a pergunta da chave PIX');
  await registrar(pagina, estado, 'pix-pergunta');
  const sim = pagina.getByRole('button', { name: 'Sim, cadastrar agora' });
  if (await visivel(sim)) {
    await tocar(pagina, sim, 'Sim, cadastrar agora');
    await esperar(1000);
    await registrar(pagina, estado, 'pix-celular-e-chave');
    const usar = pagina.getByRole('button', { name: 'Sim, usar este número' });
    if (await visivel(usar)) {
      await tocar(pagina, usar, 'Sim, usar este número');
      await esperar(1500);
      await registrar(pagina, estado, 'pix-salva');
      const continuar = pagina.getByRole('button', { name: 'Continuar' });
      if (await visivel(continuar)) await tocar(pagina, continuar, 'Continuar');
    }
  }

  // ── O convite ─────────────────────────────────────────────────────────
  await esperar(1500);
  await m('a criança cadastrada e o convite');
  await registrar(pagina, estado, 'sucesso');
  await registrar(pagina, estado, 'sucesso-inteiro', { paginaInteira: true });
  // Os dados do contrato viraram obrigatórios para o convite: aparecem no
  // lugar do botão. O nome e a cidade já vêm do primeiro acesso.
  if (await visivel(pagina.getByText('Antes do convite: seus dados para o contrato'))) {
    await m('antes do convite: os dados do contrato');
    await registrar(pagina, estado, 'contrato-antes-do-convite');
    await digitar(pagina, pagina.getByLabel('CPF ou CNPJ'), '12345678900', 'CPF errado de propósito');
    await tocar(pagina, pagina.getByRole('button', { name: 'Salvar e liberar o convite' }), 'Salvar');
    await registrar(pagina, estado, 'contrato-cpf-invalido');
    await digitar(pagina, pagina.getByLabel('CPF ou CNPJ'), '12345678909', 'CPF certo');
    const end = pagina.getByLabel('Seu endereço');
    await digitar(pagina, end, 'Rua das Palmeiras, 200, Vila Olímpia, São Paulo/SP', 'endereço');
    await registrar(pagina, estado, 'contrato-preenchido');
    await tocar(pagina, pagina.getByRole('button', { name: 'Salvar e liberar o convite' }), 'Salvar e liberar o convite');
    await esperar(2000);
    await registrar(pagina, estado, 'convite-liberado');
  }
  const mandar = pagina.getByRole('link', { name: /Mandar convite/ }).first();
  if (await visivel(mandar)) {
    await tocar(pagina, mandar, 'Mandar convite');
    await esperar(2500);
    await registrar(pagina, estado, 'depois-do-convite');
  }
} catch (err) {
  console.error('\n  ✗ a jornada parou:', err.message.split('\n')[0]);
  await registrar(pagina, estado, 'onde-parou').catch(() => {});
  estado.parou = err.message.split('\n')[0];
} finally {
  const compartilhados = await pagina.evaluate(() => window.__compartilhados || []).catch(() => []);
  const textos = [...compartilhados.map((c) => `${c.text || ''} ${c.url || ''}`), ...estado.mensagensEnviadas];
  const link = textos.join(' ').match(/https?:\/\/[^\s"]+\/convite\/[A-Z0-9]+/i)?.[0];
  console.log('\n  mensagem do convite:', textos.join(' | ').slice(0, 400));
  if (link) {
    writeFileSync(path.join(AQUI, 'resultados', 'convite.txt'), link);
    console.log('  link do convite guardado:', link);
  }
  await encerrar(contexto, pagina, estado);
}
