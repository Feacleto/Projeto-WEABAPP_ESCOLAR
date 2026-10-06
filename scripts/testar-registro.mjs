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
const { deveSairDoRegistro } = createRequire(import.meta.url)('../functions/lib/reguaDosContatos.js');

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
checar('e a frase diz por quê', 'Com a cobrança desligada, não existe atraso.', v({ ...base, motivo: 'atraso' }).erro);
checar('o servidor diz a mesma frase', 'Com a cobrança desligada, não existe atraso.',
  servidor.validarPedido({ ...base, motivo: 'atraso' }, { agora: AGORA, alvo: MOTORISTA, donoUid: 'dono1' }).erro);
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
  'o texto padrão pode ser mandado como está',
  true,
  v({ ...base, mensagem: app.mensagemPadrao({ acao: 'suspender', grau: 'suspensao', ate: '2026-10-15', agora: AGORA }) }).ok
);
checar('o texto padrão cita a cláusula 11b dos Termos', true, app.mensagemPadrao({ acao: 'aviso', agora: AGORA }).includes('cláusula 11b dos Termos de Uso'));
checar('o texto padrão não tem colchete de marcador', false, /\[/.test(app.mensagemPadrao({ acao: 'suspender', agora: AGORA })));
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
  const mensagens = ['', 'ok', `vai contra a ${app.CLAUSULA_DOS_TERMOS}`];
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

// ───────────────────────── 8. a família (05/10/2026) ───────────────────────
bloco('─── 8. a família suspensa: lista própria, sem atraso, um aviso por tio ───');
{
  const FAMILIA = { role: 'parent', name: 'Carla Mendes' };
  const fam = {
    acao: 'suspender',
    alvoUid: 'carla1',
    alvoPapel: 'familia',
    motivo: 'ameaca_ofensa',
    grau: 'suspensao',
    ate: '2026-10-15',
    mensagem: 'Sua conta foi suspensa até 15/10. Responda até 15/10 por contato@alobuzinou.com.',
  };
  const vf = (dados, extra = {}) =>
    app.validarPedido(dados, { agora: AGORA, alvo: FAMILIA, donoUid: 'dono1', ...extra });

  checar('família com motivo da lista dela passa', true, vf(fam).ok);
  checar('família com motivo de motorista é recusada', false, vf({ ...fam, motivo: 'fraude' }).ok);
  checar('motorista com motivo de família é recusado', false, v({ ...base, motivo: 'ameaca_ofensa' }).ok);
  checar('papel família contra conta de motorista é recusado', false, vf(fam, { alvo: MOTORISTA }).ok);
  checar('papel motorista contra conta de família é recusado', false, vf({ ...fam, alvoPapel: 'motorista', motivo: 'fraude' }).ok);
  checar('atraso NUNCA vale para família, nem com a cobrança ligada', false, vf({ ...fam, motivo: 'atraso' }, { cobrancaLigada: true }).ok);
  checar(
    'a lista da família não fala de atraso, mensalidade nem pagamento',
    false,
    /atraso|mensalidade|pagamento|pagar/i.test(JSON.stringify(app.MOTIVOS_DA_FAMILIA))
  );
  checar('cinco motivos na lista da família', 5, app.MOTIVOS_DA_FAMILIA.length);
  checar('a folha oferece a lista da família', app.MOTIVOS_DA_FAMILIA, app.motivosPara('suspender', { papel: 'familia', cobrancaLigada: true }));

  const pf = vf(fam).pedido;
  checar('o pedido guarda o papel', 'familia', pf.alvoPapel);
  checar('suspender a família grava bloqueio, não suspenso', { bloqueio: { grau: 'suspensao', ate: '2026-10-15' } }, app.efeitoNaConta(pf));
  checar('encerrar a família grava encerramento sem data', { bloqueio: { grau: 'encerramento', ate: null } }, app.efeitoNaConta(vf({ ...fam, grau: 'encerramento' }).pedido));
  checar('reativar a família limpa o bloqueio', { bloqueio: null }, app.efeitoNaConta({ ...pf, acao: 'reativar' }));
  checar('aviso à família não trava nada', null, app.efeitoNaConta({ ...pf, acao: 'aviso' }));
  checar('o bloqueio NÃO tem o motivo', false, JSON.stringify(app.efeitoNaConta(pf)).includes('ameaca'));
  checar('o registro diz que o alvo é família', 'familia', app.linhaDoRegistro(pf, { donoUid: 'dono1', alvo: FAMILIA }).alvoPapel);
  checar('o texto padrão da família diz que o transporte continua', true, app.mensagemPadrao({ acao: 'suspender', papel: 'familia', agora: AGORA }).includes('transporte do seu filho continua'));

  // O dia de Brasília em AGORA é 05/10/2026.
  checar('encerramento vale sempre', true, app.bloqueioVigente({ grau: 'encerramento' }, AGORA));
  checar('suspensão sem data vale', true, app.bloqueioVigente({ grau: 'suspensao', ate: null }, AGORA));
  checar('suspensão até hoje ainda vale', true, app.bloqueioVigente({ grau: 'suspensao', ate: '2026-10-05' }, AGORA));
  checar('suspensão até ontem já não vale', false, app.bloqueioVigente({ grau: 'suspensao', ate: '2026-10-04' }, AGORA));
  checar('sem bloqueio não vale', false, app.bloqueioVigente(null, AGORA));
  checar('ENCERRAMENTO nunca se reativa sozinho', false, app.bloqueioVencido({ grau: 'encerramento', ate: '2020-01-01' }, AGORA));
  checar('suspensão sem data não se reativa sozinha', false, app.bloqueioVencido({ grau: 'suspensao', ate: null }, AGORA));
  checar('suspensão vencida ontem se reativa', true, app.bloqueioVencido({ grau: 'suspensao', ate: '2026-10-04' }, AGORA));
  checar('suspensão até hoje ainda não se reativa', false, app.bloqueioVencido({ grau: 'suspensao', ate: '2026-10-05' }, AGORA));

  const tios = app.tiosParaAvisar([
    { adminUid: 'tioA', name: 'Ana Lima' },
    { adminUid: 'tioA', name: 'Bia Lima' },
    { adminUid: 'tioB', name: 'Caio' },
    { adminUid: 'tioC', name: 'Duda', active: false },
    { name: 'Sem tio' },
  ]);
  checar('dois irmãos no mesmo tio = UM aviso, com os dois nomes', { tioUid: 'tioA', nomes: ['Ana', 'Bia'] }, tios[0]);
  checar('um aviso por tio, e só de criança ativa com tio', ['tioA', 'tioB'], tios.map((t) => t.tioUid));
  const avTio = app.avisoAoTio({ acao: 'suspender', nomes: ['Ana', 'Bia'] });
  checar('o aviso ao tio', ['familia_sem_avisos', 'A família de Ana e Bia está sem os avisos do app', 'Combine por telefone o que for preciso.'], [avTio.type, avTio.title, avTio.body]);
  checar('o aviso ao tio não tem o motivo', false, JSON.stringify(avTio).includes('ameaça'));
  checar('reativar avisa o tio que voltou', 'familia_com_avisos', app.avisoAoTio({ acao: 'reativar', nomes: ['Ana'] }).type);

  // O espelho também nas peças da família.
  const iguais = [
    [app.MOTIVOS_DA_FAMILIA, servidor.MOTIVOS_DA_FAMILIA],
    [app.efeitoNaConta(pf), servidor.efeitoNaConta(servidor.validarPedido(fam, { agora: AGORA, alvo: FAMILIA, donoUid: 'dono1' }).pedido)],
    [app.tiosParaAvisar([{ adminUid: 'x', name: 'Ana' }]), servidor.tiosParaAvisar([{ adminUid: 'x', name: 'Ana' }])],
    [app.bloqueioVencido({ grau: 'suspensao', ate: '2026-10-04' }, AGORA), servidor.bloqueioVencido({ grau: 'suspensao', ate: '2026-10-04' }, AGORA)],
  ];
  checar('o espelho responde igual nas peças da família', true, iguais.every(([a, b]) => JSON.stringify(a) === JSON.stringify(b)));
}

// ───────────────────────── 9. o prazo do registro ──────────────────────────
bloco('─── 9. o registro sai 5 anos depois de a conta encerrar ───');
{
  const HOJE9 = new Date('2026-10-05T12:00:00Z');
  const ha = (anos) => new Date(Date.UTC(2026 - anos, 9, 1));
  checar('conta apagada: sai 5 anos depois da linha', true, deveSairDoRegistro({ linha: { em: ha(6) }, conta: null, agora: HOJE9 }));
  checar('conta apagada: linha recente fica', false, deveSairDoRegistro({ linha: { em: ha(2) }, conta: null, agora: HOJE9 }));
  checar('família ativa: fica', false, deveSairDoRegistro({ linha: { em: ha(9) }, conta: { role: 'parent' }, agora: HOJE9 }));
  checar('família só suspensa: fica', false, deveSairDoRegistro({ linha: { em: ha(9) }, conta: { role: 'parent', bloqueio: { grau: 'suspensao', desde: ha(9) } }, agora: HOJE9 }));
  checar('família encerrada há 6 anos: sai', true, deveSairDoRegistro({ linha: { em: ha(7) }, conta: { role: 'parent', bloqueio: { grau: 'encerramento', desde: ha(6) } }, agora: HOJE9 }));
  checar('família encerrada há 2 anos: fica', false, deveSairDoRegistro({ linha: { em: ha(7) }, conta: { role: 'parent', bloqueio: { grau: 'encerramento', desde: ha(2) } }, agora: HOJE9 }));
  checar('motorista com renovação ligada: fica', false, deveSairDoRegistro({ linha: { em: ha(9) }, conta: { role: 'admin' }, agora: HOJE9 }));
  checar('motorista encerrado há 6 anos: sai', true, deveSairDoRegistro({ linha: { em: ha(9) }, conta: { role: 'admin', renovacaoAutomatica: false, assinaturaAte: ha(6) }, agora: HOJE9 }));
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
