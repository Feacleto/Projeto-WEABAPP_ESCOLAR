/**
 * O REGISTRO DE AÇÕES DO DONO — a régua da suspensão por callable.
 *
 * O QUE ELE TRAVA
 *   1. o ALVO: só motorista; dono não suspende dono nem a si mesmo;
 *   2. os motivos são LISTA FECHADA, e `atraso` só existe com a cobrança ligada;
 *   3. o grau e a data: suspensão com data depois de hoje e até 365 dias,
 *      encerramento sem data, aviso sem trava;
 *   4. a mensagem é obrigatória (menos para reativar), tem teto, e não sai com
 *      o MARCADOR da cláusula ainda dentro;
 *   5. o aviso ao alvo leva a mensagem e o prazo, NUNCA o motivo da lista nem
 *      a evidência;
 *   6. o prazo de resposta é de 10 dias, contados no dia de Brasília;
 *   7. o ESPELHO: app e servidor respondem igual, caso a caso.
 *
 * COMO RODAR
 *   node scripts/testar-registro.mjs
 */

import { createRequire } from 'node:module';
import * as app from '../src/dominio/identidade/registroDoDono.js';

// O lado do servidor é CommonJS e régua pura: nenhum SDK no caminho.
const servidor = createRequire(import.meta.url)('../functions/lib/reguaDoRegistro.js');

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}

function bloco(t) {
  console.log('');
  console.log(t);
}

// 05/10/2026 às 23h30 de Brasília = 06/10 02:30 UTC: o dia ainda é 05/10.
const AGORA = new Date('2026-10-06T02:30:00Z');
const MOTORISTA = { role: 'admin', marcaNome: 'Tio Gil', name: 'Gilberto' };
const base = {
  acao: 'suspender',
  alvoUid: 'gil123',
  motivo: 'fraude',
  grau: 'suspensao',
  ate: '2026-10-15',
  mensagem: 'Sua conta foi suspensa até 15/10. Responda até 15/10 por contato@alobuzinou.com.',
  evidencia: 'Comprovante de 02/10 igual ao de outra turma.',
};
const v = (dados, extra = {}) =>
  app.validarPedido(dados, { agora: AGORA, alvo: MOTORISTA, donoUid: 'dono1', ...extra });

// ───────────────────────── 1. o alvo ───────────────────────────────────────
bloco('─── 1. o alvo ───');
checar('motorista pode ser suspenso', true, v(base).ok);
checar('dono não suspende outro dono', false, v(base, { alvo: { role: 'owner' } }).ok);
checar('dono não suspende a si mesmo', false, v({ ...base, alvoUid: 'dono1' }).ok);
checar('família ainda não (item 4)', false, v(base, { alvo: { role: 'parent' } }).ok);
checar('auxiliar ainda não (item 4)', false, v(base, { alvo: { role: 'auxiliar' } }).ok);
checar('id com barra é recusado (vira caminho)', false, v({ ...base, alvoUid: 'users/dono1' }).ok);
checar('ação fora da lista é recusada', false, v({ ...base, acao: 'apagar' }).ok);
checar('resposta registrada não vem pelo painel', false, v({ ...base, acao: 'resposta_registrada' }).ok);

// ───────────────────────── 2. os motivos ───────────────────────────────────
bloco('─── 2. motivos: lista fechada ───');
checar('motivo inventado é recusado', false, v({ ...base, motivo: 'nao_gostei' }).ok);
checar('atraso NÃO existe com a cobrança desligada', false, v({ ...base, motivo: 'atraso' }).ok);
checar('atraso existe com a cobrança ligada', true, v({ ...base, motivo: 'atraso' }, { cobrancaLigada: true }).ok);
checar('motivo de suspender não serve para reativar', false, v({ acao: 'reativar', alvoUid: 'gil123', motivo: 'fraude' }).ok);
checar('reativar com motivo próprio', true, v({ acao: 'reativar', alvoUid: 'gil123', motivo: 'resposta_aceita' }).ok);
checar('sete motivos de conduta + atraso', 8, app.MOTIVOS_DE_BLOQUEIO.length);
checar('a folha não oferece atraso com a cobrança desligada', false, app.motivosPara('suspender').some((m) => m.id === 'atraso'));

// ───────────────────────── 3. grau e data ──────────────────────────────────
bloco('─── 3. grau e data ───');
checar('suspensão sem data passa (o dono reativa à mão)', true, v({ ...base, ate: null }).ok);
checar('data de hoje é recusada', false, v({ ...base, ate: '2026-10-05' }).ok);
checar('amanhã de Brasília passa', true, v({ ...base, ate: '2026-10-06' }).ok);
checar('mais de 365 dias é recusado', false, v({ ...base, ate: '2027-10-07' }).ok);
checar('data torta é recusada', false, v({ ...base, ate: '15/10/2026' }).ok);
checar('encerramento ignora a data', null, v({ ...base, grau: 'encerramento' }).pedido.ate);
checar('suspender sem grau é recusado', false, v({ ...base, grau: 'aviso' }).ok);
checar('aviso sempre tem grau aviso', 'aviso', v({ ...base, acao: 'aviso', grau: 'suspensao' }).pedido.grau);
checar('aviso não tem data', null, v({ ...base, acao: 'aviso' }).pedido.ate);
checar('urgente só vale para suspender', false, v({ ...base, acao: 'aviso', urgente: true }).pedido.urgente);

// ───────────────────────── 4. a mensagem ───────────────────────────────────
bloco('─── 4. a mensagem ───');
checar('suspender sem mensagem é recusado', false, v({ ...base, mensagem: '   ' }).ok);
checar('reativar sem mensagem passa', true, v({ acao: 'reativar', alvoUid: 'gil123', motivo: 'engano' }).ok);
checar('mensagem acima de 1000 é recusada', false, v({ ...base, mensagem: 'a'.repeat(1001) }).ok);
checar('evidência acima de 500 é recusada', false, v({ ...base, evidencia: 'a'.repeat(501) }).ok);
checar(
  'o texto padrão com o MARCADOR não pode ser mandado',
  false,
  v({ ...base, mensagem: app.mensagemPadrao({ acao: 'suspender', grau: 'suspensao', ate: '2026-10-15', agora: AGORA }) }).ok
);
checar('o texto padrão cita o marcador', true, app.mensagemPadrao({ acao: 'aviso', agora: AGORA }).includes(app.MARCADOR_DA_CLAUSULA));
checar('o texto padrão traz o prazo de resposta', true, app.mensagemPadrao({ acao: 'suspender', agora: AGORA }).includes('15/10/2026'));

// ───────────────────────── 5. o aviso ao alvo ──────────────────────────────
bloco('─── 5. o aviso leva a mensagem, nunca o motivo ───');
const p = v(base).pedido;
const aviso = app.avisoAoAlvo(p);
checar('tipo do aviso', 'conta_suspensa', aviso.type);
checar('o corpo é a mensagem do dono', base.mensagem, aviso.body);
checar('o aviso NÃO tem o motivo', false, JSON.stringify(aviso).includes('fraude') || JSON.stringify(aviso).includes('Fraude'));
checar('o aviso NÃO tem a evidência', false, JSON.stringify(aviso).includes('outra turma'));
checar('o aviso leva o prazo de resposta', '2026-10-15', aviso.respostaAte);
checar('encerramento diz encerrada', 'Sua conta foi encerrada', app.avisoAoAlvo({ ...p, grau: 'encerramento' }).title);
checar('reativar vira conta_reativada', 'conta_reativada', app.avisoAoAlvo({ ...p, acao: 'reativar' }).type);
checar('aviso vira aviso_da_plataforma', 'aviso_da_plataforma', app.avisoAoAlvo({ ...p, acao: 'aviso' }).type);
checar('suspender trava a conta', { suspenso: true }, app.efeitoNaConta(p));
checar('reativar destrava', { suspenso: false }, app.efeitoNaConta({ ...p, acao: 'reativar' }));
checar('aviso não mexe na conta', null, app.efeitoNaConta({ ...p, acao: 'aviso' }));

const linha = app.linhaDoRegistro(p, { donoUid: 'dono1', donoNome: 'Fellipe', alvo: MOTORISTA });
checar('o registro guarda motivo e evidência', ['fraude', 'Fraude', base.evidencia], [linha.motivo, linha.motivoRotulo, linha.evidencia]);
checar('o registro guarda quem decidiu', ['dono1', 'Fellipe'], [linha.donoUid, linha.donoNome]);
checar('o nome do alvo é a marca do momento', 'Tio Gil', linha.alvoNome);

// ───────────────────────── 6. o prazo de resposta ──────────────────────────
bloco('─── 6. 10 dias, no dia de Brasília ───');
checar('23h30 de Brasília conta do dia de Brasília', '2026-10-15', p.respostaAte);
checar('reativar não tem prazo de resposta', null, v({ acao: 'reativar', alvoUid: 'gil123', motivo: 'engano' }).pedido.respostaAte);
checar('a janela é de 10 dias', 10, app.DIAS_PARA_RESPONDER);

// ───────────────────────── 7. o espelho ────────────────────────────────────
bloco('─── 7. app e servidor respondem igual ───');
{
  const acoes = ['suspender', 'reativar', 'aviso', 'apagar'];
  const motivos = ['fraude', 'atraso', 'resposta_aceita', 'x'];
  const graus = ['suspensao', 'encerramento', 'aviso', undefined];
  const ates = [null, '2026-10-05', '2026-10-06', '2027-10-07', 'torta'];
  const alvos = [MOTORISTA, { role: 'owner' }, { role: 'parent' }, null];
  const mensagens = ['', 'ok', `vai contra ${app.MARCADOR_DA_CLAUSULA}`];
  let casos = 0;
  const divergem = [];
  for (const acao of acoes)
    for (const motivo of motivos)
      for (const grau of graus)
        for (const ate of ates)
          for (const alvo of alvos)
            for (const mensagem of mensagens)
              for (const cobrancaLigada of [false, true]) {
                casos += 1;
                const dados = { acao, alvoUid: 'gil123', motivo, grau, ate, mensagem, urgente: true };
                const opc = { agora: AGORA, alvo, donoUid: 'dono1', cobrancaLigada };
                const a = app.validarPedido(dados, opc);
                const s = servidor.validarPedido(dados, opc);
                const fora = [a, s].map((r) => (r.ok ? [app.avisoAoAlvo(r.pedido), app.efeitoNaConta(r.pedido)] : null));
                const foraS = [s].map((r) => (r.ok ? [servidor.avisoAoAlvo(r.pedido), servidor.efeitoNaConta(r.pedido)] : null));
                if (JSON.stringify(a) !== JSON.stringify(s) || JSON.stringify(fora[1]) !== JSON.stringify(foraS[0])) {
                  divergem.push(dados);
                }
              }
  checar(`validação, aviso e efeito iguais nos ${casos} casos`, [], divergem.slice(0, 3));
  checar('as listas são as mesmas', [app.MOTIVOS_DE_BLOQUEIO, app.MOTIVOS_DE_REATIVAR, app.ACOES_DO_PAINEL], [
    servidor.MOTIVOS_DE_BLOQUEIO,
    servidor.MOTIVOS_DE_REATIVAR,
    servidor.ACOES_DO_PAINEL,
  ]);
  checar(
    'o texto padrão é o mesmo',
    ['suspender', 'reativar', 'aviso'].map((acao) => app.mensagemPadrao({ acao, agora: AGORA })),
    ['suspender', 'reativar', 'aviso'].map((acao) => servidor.mensagemPadrao({ acao, agora: AGORA }))
  );
}

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
