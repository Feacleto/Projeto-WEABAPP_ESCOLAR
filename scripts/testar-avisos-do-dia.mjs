/**
 * OS AVISOS DE TEMPO — os que nascem de uma data chegando.
 *
 * POR QUE ESTE TESTE
 * A varredura roda uma vez por dia e não tem quem a olhe. Um limiar errado
 * aqui não aparece como erro: aparece como uma família que não foi avisada, ou
 * como a mesma família avisada cinco dias seguidos. Nenhum dos dois chega até
 * nós — chega até ela.
 *
 * O caso que mais importa é o do CALENDÁRIO. "Vence em 3 dias" é uma frase
 * sobre o calendário dela, não sobre 72 horas corridas: um vencimento às 23h e
 * outro às 01h do mesmo dia são o mesmo dia. Contado em milissegundos, o aviso
 * de 3 dias cairia no de 2 pra metade da base — sem nenhum erro aparecer.
 *
 * COMO RODAR
 *   node scripts/testar-avisos-do-dia.mjs   (ou: npm run testar:avisos-do-dia)
 */

/* ⚠️ O FUSO É FIXADO ANTES DE QUALQUER `Date`, e é isso que torna a
   comparação do espelho honesta.

   `avisoDoMomento` roda no NAVEGADOR — no celular da mãe, no Brasil — e usa a
   hora LOCAL do aparelho, que é a certa lá. O espelho roda em function, que
   roda em UTC, e por isso converte pra São Paulo. As duas estão certas no
   ambiente de cada uma; comparar sem alinhar o fuso reprovaria as duas numa
   máquina de CI em UTC. */
process.env.TZ = 'America/Sao_Paulo';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../functions/lib/reguaDosAvisos.js');
import { avisoDoMomento } from '../src/dominio/rota/avisoDoMomento.js';
import { ESTADO as ESTADO_SELO } from '../src/dominio/identidade/verificacao.js';

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, cond, detalhe) {
  if (cond) {
    console.log(`  ok  ${nome}`);
    ok += 1;
  } else {
    console.log(` FALHA ${nome}${detalhe ? ' — ' + detalhe : ''}`);
    bad += 1;
    falhas.push(nome);
  }
}
const eq = (nome, esperado, obtido) =>
  checar(nome, esperado === obtido, `esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
const bloco = (t) => { console.log(''); console.log(t); };

/** 12h de Brasília do dia informado — meio do dia, longe de qualquer borda. */
const meioDia = (iso) => new Date(`${iso}T15:00:00Z`);

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ A CONTA É DE CALENDÁRIO, NÃO DE 24H CORRIDAS ═══');

eq('mesmo dia = 0', 0, R.diasAte(meioDia('2026-09-10'), meioDia('2026-09-10')));
eq('amanhã = 1', 1, R.diasAte(meioDia('2026-09-11'), meioDia('2026-09-10')));
eq('ontem = -1', -1, R.diasAte(meioDia('2026-09-09'), meioDia('2026-09-10')));

checar(
  'vencimento às 23h de hoje ainda é HOJE (0), não ontem',
  R.diasAte(new Date('2026-09-11T02:00:00Z'), new Date('2026-09-10T12:00:00Z')) === 0,
  'veio ' + R.diasAte(new Date('2026-09-11T02:00:00Z'), new Date('2026-09-10T12:00:00Z'))
);
/* 02:00Z do dia 11 é 23:00 do dia 10 em Brasília. Em milissegundos daria 1. */

checar(
  'às 22h de Brasília a chave ainda é o dia de hoje',
  R.chaveDoDia(new Date('2026-09-11T01:00:00Z')) === '2026-09-10',
  'veio ' + R.chaveDoDia(new Date('2026-09-11T01:00:00Z'))
);

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ MENSALIDADE — cinco degraus, e só nos dias exatos ═══');

const pag = (venc, extra = {}) => ({
  status: 'pending',
  dueDate: meioDia(venc),
  amount: 480,
  month: '09/2026',
  childName: 'João Pedro',
  ...extra,
});
const HOJE = meioDia('2026-09-10');
const mens = (venc, extra) => R.avisoDaMensalidade({ pagamento: pag(venc, extra), agora: HOJE });

eq('5 dias antes', R.TIPO.VENCE_5, mens('2026-09-15').tipo);
eq('no dia', R.TIPO.VENCE_HOJE, mens('2026-09-10').tipo);
eq('7 dias de atraso', R.TIPO.ATRASO_7, mens('2026-09-03').tipo);

// ⚠️ 3 DIAS ANTES E 3 DE ATRASO SÃO DO E-MAIL, E O PUSH CALA NELES.
//
// Os dois canais mandavam nesses dois marcos ao mesmo tempo, sobre a mesma
// mensalidade: este push e o `reminder_3d`/`overdue_3d` do
// `sendPaymentReminders`. Cada régua estava certa sozinha, e ninguém tinha o
// mapa das duas juntas — é o defeito clássico de dois módulos corretos.
//
// Quem decide agora é `canalDaCobranca.js`, e o teste dele prova a parte que
// é regra (um marco, um canal). Estes dois casos travam a metade que este
// arquivo pode ver: o push obedecendo.
checar('3 dias antes é do e-mail, o push cala', mens('2026-09-13') === null);
checar('3 dias de atraso também', mens('2026-09-07') === null);

checar('4 dias antes não avisa', mens('2026-09-14') === null);
checar('1 dia antes não avisa', mens('2026-09-11') === null);
checar('2 dias de atraso não avisa', mens('2026-09-08') === null);
checar('30 dias de atraso não avisa mais', mens('2026-08-11') === null);
checar('pago não avisa nunca', mens('2026-09-10', { status: 'paid' }) === null);
checar('sem vencimento não avisa', R.avisoDaMensalidade({ pagamento: { status: 'pending' }, agora: HOJE }) === null);
checar('sem argumento não explode', R.avisoDaMensalidade() === null);

// As três invariantes do corpo mudaram de DIA, não de conteúdo: o 13 passou
// a ser do e-mail, e o dia do vencimento continua sendo do push.
checar(
  'o nome da criança vai na frente — ela pode ter dois filhos',
  mens('2026-09-10').corpo.startsWith('João: '),
  mens('2026-09-10').corpo
);
checar('o valor sai em reais', mens('2026-09-10').corpo.includes('R$'), mens('2026-09-10').corpo);
eq('o toque leva ao financeiro dela', '/pai/finance', mens('2026-09-10').destino);

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ CONVITE PARADO — e ele vai pro MOTORISTA ═══');
/* A família não tem conta ainda: não há caixa onde entregar. Quem pode agir é
   ele, que tem o telefone dela. */

const conv = (dias, extra = {}) =>
  R.avisoDoConvite({
    crianca: {
      name: 'Ana Clara',
      inviteStatus: 'pending',
      createdAt: meioDia('2026-09-10'),
      ...extra,
    },
    agora: meioDia(`2026-09-${String(10 + dias).padStart(2, '0')}`),
  });

eq('no 4º dia avisa', R.TIPO.CONVITE_PARADO, conv(4).tipo);
checar('no 3º ainda não', conv(3) === null);
checar('no 5º não avisa de novo — uma vez só', conv(5) === null);
checar('convite já resgatado não avisa', conv(4, { inviteStatus: 'used' }) === null);
checar('com responsável vinculado não avisa', conv(4, { parentUid: 'uid' }) === null);
checar('criança desativada não avisa', conv(4, { active: false }) === null);
eq('o toque leva à turma dele', '/tio/children', conv(4).destino);

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ FATURA DA PLATAFORMA — 3 dias antes ═══');

const fat = (venc, extra = {}) =>
  R.avisoDaFatura({ fatura: { status: 'aberta', vencimento: meioDia(venc), total: 149, ...extra }, agora: HOJE });

eq('3 dias antes', R.TIPO.FATURA_VENCE, fat('2026-09-13').tipo);
checar('4 dias antes não', fat('2026-09-14') === null);
checar('no dia não (já é outra conversa)', fat('2026-09-10') === null);
checar('fatura quitada não avisa', fat('2026-09-13', { status: 'quitada' }) === null);
checar('o valor aparece', fat('2026-09-13').corpo.includes('R$'), fat('2026-09-13').corpo);
eq('o toque leva à tela de pagar', '/tio/taxa', fat('2026-09-13').destino);

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ ALVARÁ — 30 dias, a mesma antecedência da fila do dono ═══');

const alv = (venc, extra = {}) =>
  R.avisoDoAlvara({
    motorista: { verificacao: ESTADO_SELO.VERIFICADA, alvaraValidade: meioDia(venc), ...extra },
    agora: HOJE,
  });

eq('30 dias antes', R.TIPO.ALVARA_VENCE, alv('2026-10-10').tipo);
checar('31 dias antes não', alv('2026-10-11') === null);
checar('29 dias antes não', alv('2026-10-09') === null);
checar('quem não tem selo aprovado não é avisado', alv('2026-10-10', { verificacao: 'enviada' }) === null);
checar('sem validade não avisa', R.avisoDoAlvara({ motorista: { verificacao: ESTADO_SELO.VERIFICADA }, agora: HOJE }) === null);

// ⚠️ O ESTADO ERA UM LITERAL DOS DOIS LADOS, E OS DOIS ESTAVAM ERRADOS.
//
// A régua procurava `'aprovada'` e este teste semeava `'aprovada'` — então
// a bateria confirmava o erro em verde, enquanto a consulta real
// (`where('verificacao','==','aprovada')`) voltava ZERO documentos todo dia.
// O aviso de alvará nunca disparou para ninguém, e ele existe porque o selo
// cai sozinho na data: o motorista perdia o selo sem ninguém ter pedido o
// papel novo.
//
// Agora o literal do servidor é comparado com o enum do domínio. Renomear o
// estado num lado passa a falhar aqui, em vez de emudecer um aviso.
checar('o estado que vale o selo é o mesmo dos dois lados',
  ESTADO_SELO.VERIFICADA === R.SELO_VALE_EM,
  `dominio=${ESTADO_SELO.VERIFICADA} servidor=${R.SELO_VALE_EM}`);
// Sonda: um estado que existe mas não vale o selo não pode disparar aviso.
checar('quem só ENVIOU o alvará não recebe aviso de vencimento',
  R.avisoDoAlvara({
    motorista: { verificacao: ESTADO_SELO.ENVIADA, alvaraValidade: meioDia('2026-10-10') },
    agora: HOJE,
  }) === null);
eq('o toque leva ao selo', '/tio/selo', alv('2026-10-10').destino);

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ A MARCA DE JÁ TER FALADO ═══');
/* A varredura roda todo dia. Sem esta marca, quem está a 3 dias do vencimento
   hoje continua a 3 dias amanhã? Não — mas quem está atrasado há 7 dias
   continua atrasado há 8, 9, 10. Sem a marca, o de atraso viraria diário. */

checar('sem marca, não avisou', R.jaAvisado({}, R.TIPO.VENCE_3) === false);
checar('com marca, avisou', R.jaAvisado({ avisos: { payment_due_3d: true } }, R.TIPO.VENCE_3) === true);
checar('marca de outro tipo não conta', R.jaAvisado({ avisos: { payment_due_5d: true } }, R.TIPO.VENCE_3) === false);
checar('documento nulo não explode', R.jaAvisado(null, R.TIPO.VENCE_3) === false);

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ OS TIPOS DE MENSALIDADE SÃO OS QUE O SINO JÁ DESENHA ═══');
/* `NotificationsBody` tem ícone e cor pra cada um desses nomes. Trocar o nome
   apagaria o desenho sem ninguém notar. */

eq('5 dias', 'payment_due_5d', R.TIPO.VENCE_5);
eq('3 dias', 'payment_due_3d', R.TIPO.VENCE_3);
eq('hoje', 'payment_due_0d', R.TIPO.VENCE_HOJE);
eq('atraso 3', 'payment_overdue_3d', R.TIPO.ATRASO_3);
eq('atraso 7', 'payment_overdue_7d', R.TIPO.ATRASO_7);

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ A ROTA ATRASOU — e o ESPELHO tem que bater com o original ═══');
/* `avisoDoMomento` (src, roda no celular da mãe) e `avisoDeAtraso` (functions,
   roda no servidor) decidem a MESMA coisa. Espelho é dívida, e a regra da casa
   é que ele só existe com teste comparando as duas caso a caso — como
   `testar:gateway` faz com a régua de preço. Estes casos batem os limiares nos
   DOIS lados de cada um, que é onde um espelho desanda primeiro. */

const CRIANCA = { name: 'João Pedro', parentUid: 'p1', horaPega: '06:30', horaEntrega: '12:35' };

/** Um `Date` de hoje, na hora local (que o TZ acima fixou em São Paulo). */
function hojeAs(hh, mm) {
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d;
}

//
// ⚠️ O NÍVEL ESPERADO É PARÂMETRO, E NÃO SÓ A COMPARAÇÃO ENTRE OS DOIS LADOS.
//
// A asserção era `a === b`, e os nomes prometiam mais do que ela media:
// "os dois dizem GRAVE" passava com `null === null`. Se um limiar
// compartilhado mudasse — ou se as duas réguas passassem a calar — os nove
// casos ficariam verdes anunciando um nível que ninguém produziu. É o
// espelho protegendo a igualdade e perdendo o valor.
function comparar(nome, { status, rotaAtiva, agora, falta = null, nivel = null }) {
  const original = avisoDoMomento({
    child: CRIANCA,
    status,
    presence: rotaAtiva ? { kind: 'live' } : { kind: 'no-route' },
    ride: null,
    absence: falta,
    agora,
  });
  const espelho = R.avisoDeAtraso({
    crianca: { ...CRIANCA, status },
    rotaAtiva,
    temFalta: !!falta,
    agora,
  });

  const a = original ? original.nivel : null;
  const b = espelho ? espelho.nivel : null;
  checar(nome, `${nivel}|${nivel}`, `${a}|${b}`);
}

comparar('sem atraso, rota rodando: nenhum dos dois avisa',
  { status: 'onboard', rotaAtiva: true, agora: hojeAs(12, 40)  });

comparar('20 min depois da entrega — no limiar, nenhum avisa',
  { status: 'onboard', rotaAtiva: true, agora: hojeAs(12, 55)  });

comparar('21 min depois da entrega — os dois dizem GRAVE',
  { status: 'onboard', rotaAtiva: true, agora: hojeAs(12, 56) , nivel: 'grave' });

comparar('10 min depois de pegar, sem rota — no limiar, nenhum avisa',
  { status: 'home', rotaAtiva: false, agora: hojeAs(6, 40)  });

comparar('11 min depois de pegar, sem rota — os dois dizem ATENÇÃO',
  { status: 'home', rotaAtiva: false, agora: hojeAs(6, 41) , nivel: 'atencao' });

comparar('rota rodando e ainda em casa: nenhum avisa',
  { status: 'home', rotaAtiva: true, agora: hojeAs(6, 41)  });

comparar('falta declarada cala os dois',
  { status: 'home', rotaAtiva: false, agora: hojeAs(6, 41), falta: { type: 'falta' }  });

comparar('os dois gatilhos valendo: o GRAVE ganha nos dois',
  { status: 'onboard', rotaAtiva: false, agora: hojeAs(13, 30) , nivel: 'grave' });

checar('horário presumido não vira atraso — é chute do app',
  R.avisoDeAtraso({
    crianca: { name: 'Ana', parentUid: 'p1' },
    rotaAtiva: false,
    agora: hojeAs(18, 0),
  }) === null);

checar('criança sem responsável não é avisada',
  R.avisoDeAtraso({
    crianca: { ...CRIANCA, parentUid: null, status: 'home' },
    rotaAtiva: false,
    agora: hojeAs(6, 41),
  }) === null);

eq('os dois casos usam o mesmo tipo', 'rota_atrasada',
  R.avisoDeAtraso({ crianca: { ...CRIANCA, status: 'home' }, rotaAtiva: false, agora: hojeAs(6, 41) }).tipo);

bloco('═══ A MARCA COM DATA — atraso repete, booleano não serve ═══');
checar('marca de hoje cala', R.jaAvisadoHoje({ avisos: { rota_atrasada: '2026-09-10' } }, 'rota_atrasada', '2026-09-10'));
checar('marca de ontem NÃO cala', !R.jaAvisadoHoje({ avisos: { rota_atrasada: '2026-09-09' } }, 'rota_atrasada', '2026-09-10'));
checar('sem marca não cala', !R.jaAvisadoHoje({}, 'rota_atrasada', '2026-09-10'));

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ O PUSH DE 40 MINUTOS — o segundo toque da oferta ═══');
/* A folha aparece no meio-fio, com o carro ligado, e muita gente fecha sem
   ler. Quarenta minutos depois ele está parado. Estes casos travam as quatro
   portas que impedem esse push de virar perseguição. */

const AGORA = new Date('2026-09-10T18:00:00Z');
const ha = (min) => new Date(AGORA.getTime() - min * 60000);
const base = {
  ofertaEstado: 'pendente',
  ofertaEm: ha(45),
  trialInicio: new Date(AGORA.getTime() - 5 * 24 * 3600 * 1000),
  criancasAtivas: 20,
};
const oferta = (extra) => R.avisoDaOferta({ motorista: { ...base, ...extra }, agora: AGORA });

checar('45 minutos depois, o push sai', !!oferta());
checar('20 minutos ainda é cedo', oferta({ ofertaEm: ha(20) }) === null);
eq('exatamente 40 já vale', 'oferta_primeira_rota', oferta({ ofertaEm: ha(40) }).tipo);
checar('39 não', oferta({ ofertaEm: ha(39) }) === null);

/* ⚠️ EXPIRA. Passadas 12 horas o momento passou: o push chegaria no dia
   seguinte, sobre uma rota que ele não lembra — e a folha na próxima abertura
   faz esse trabalho melhor. */
checar('13 horas depois não sai mais', oferta({ ofertaEm: ha(13 * 60) }) === null);

/* As três portas do estado. `pendente` é "mostrei e ele não disse nada" —
   fechar a folha não é responder, e é por isso que este toque existe. */
checar('quem recusou nunca recebe', oferta({ ofertaEstado: 'recusada' }) === null);
checar('quem foi ver o plano também não', oferta({ ofertaEstado: 'aceita' }) === null);
checar('quem já contratou não', oferta({ plano: 'mensal' }) === null);

/* ⚠️ UMA VEZ SÓ, e o marcador é separado do estado: o `pendente` continua de
   pé depois do push porque é ele que faz a folha reaparecer na abertura
   seguinte. Sem `ofertaPushEm`, a varredura de 10 em 10 min mandaria o mesmo
   push seis vezes por hora. */
checar('já empurrado não repete', oferta({ ofertaPushEm: ha(5) }) === null);

checar('sem relógio do teste não sai', oferta({ trialInicio: null }) === null);
checar('sem argumento não explode', R.avisoDaOferta() === null);

/* ⚠️ O NÚMERO SAI DA RÉGUA, e o degrau manda. Um push dizendo 30% para quem
   está no degrau de 20% seria a plataforma contradizendo a própria fatura. */
const noDegrau2 = oferta({ trialInicio: new Date(AGORA.getTime() - 40 * 24 * 3600 * 1000) });
checar('no degrau 2 o push diz 20%', noDegrau2.titulo.includes('20%'), noDegrau2.titulo);
checar('e o corpo traz os dois valores', /R\$.*R\$/.test(oferta().corpo), oferta().corpo);
eq('o toque leva ao plano dele', '/tio/planos', oferta().destino);

// ══════════════════════════════════════════════════════════════════════════
console.log('');
console.log('════════════════════════════════════════════════════════════════');
console.log(`  ${ok} passaram, ${bad} falharam`);
if (bad) {
  console.log('');
  falhas.forEach((f) => console.log(`  ✗ ${f}`));
}
console.log('════════════════════════════════════════════════════════════════');
process.exit(bad ? 1 : 0);
