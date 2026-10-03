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
import { readFileSync } from 'node:fs';
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
  // UMA QUINTA-FEIRA FIXA (03/10/2026): os avisos de rota não valem no fim de
  // semana, e com `new Date()` esta bateria falharia rodada num sábado.
  const d = new Date(2026, 8, 10);
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

// ⚠️ OS FALSOS ALARMES DA TARDE (03/10/2026). Sem teto e sem olhar o status,
// às 16h — entre uma viagem e outra, GPS desligado — os dois diziam "a rota
// não começou às 06:30" para a criança já entregue de manhã.
comparar('16h, criança da manhã JÁ ENTREGUE, sem rota: nenhum avisa',
  { status: 'delivered', rotaAtiva: false, agora: hojeAs(16, 0) });
comparar('7h, criança já EMBARCADA, rota encerrada: nenhum avisa a partida',
  { status: 'atSchool', rotaAtiva: false, agora: hojeAs(7, 10) });
comparar('90 min depois de pegar, ainda em casa: ainda é ATENÇÃO',
  { status: 'home', rotaAtiva: false, agora: hojeAs(8, 0), nivel: 'atencao' });
comparar('91 min depois de pegar: o aviso já não serve, nenhum avisa',
  { status: 'home', rotaAtiva: false, agora: hojeAs(8, 1) });

const ontem = new Date(hojeAs(12, 0).getTime() - 86400000);
checar('servidor: "na perua" gravado ONTEM não vira "passou da hora" hoje',
  R.avisoDeAtraso({
    crianca: { ...CRIANCA, status: 'onboard', statusUpdatedAt: ontem },
    rotaAtiva: false,
    agora: hojeAs(13, 30),
  }) === null);
checar('servidor: "na perua" gravado HOJE continua GRAVE',
  R.avisoDeAtraso({
    crianca: { ...CRIANCA, status: 'onboard', statusUpdatedAt: hojeAs(6, 35) },
    rotaAtiva: false,
    agora: hojeAs(13, 30),
  })?.nivel === 'grave');

comparar('SÁBADO, sem rota: nenhum dos dois avisa', {
  status: 'home', rotaAtiva: false,
  agora: (() => { const d = new Date(2026, 8, 12); d.setHours(6, 50, 0, 0); return d; })(),
});

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
bloco('═══ A VARREDURA DE ATRASOS COMEÇA PELOS MOTORISTAS (03/10/2026) ═══');

/* Era `children.limit(500)` sem ordem: com 3.000 crianças, ~2.500 famílias
   nunca eram olhadas. A escolha de quem ler agora é pura e está aqui. */
const V = require('../functions/lib/reguaDasVarreduras.js');

{
  const r = V.motoristasDaVarredura({
    motoristas: ['a', 'b', 'c', 'a', null],
    rotas: [
      { id: 'b', routeActive: true },
      { id: 'c', routeActive: false },
      { id: 'z', routeActive: true }, // liveLocation de quem não é motorista
    ],
  });
  eq('rota parada: a turma inteira (a e c, sem repetir a)', JSON.stringify(['a', 'c']), JSON.stringify(r.semRota));
  checar('rota rodando: b vai para a consulta "na perua"', r.comRota.has('b') && r.comRota.size === 1);
  checar('liveLocation sem motorista não vira motorista', !r.comRota.has('z') && !r.semRota.includes('z'));

  /* ⚠️ NA DÚVIDA, A ROTA ESTÁ ATIVA. Sem isso, um soluço ao ler liveLocation
     mandaria "a rota não começou" para a base inteira. */
  const duvida = V.motoristasDaVarredura({ motoristas: ['a', 'b'], rotas: [], rotasIlegiveis: true });
  eq('liveLocation ilegível: ninguém em "rota parada"', 0, duvida.semRota.length);
  eq('liveLocation ilegível: todos só pela perua', 2, duvida.comRota.size);

  /* Motorista sem documento em liveLocation nunca ligou a rota: rota parada. */
  eq('sem liveLocation = rota parada', 'x', V.motoristasDaVarredura({ motoristas: ['x'] }).semRota[0]);
  eq('sem argumento não explode', 0, V.motoristasDaVarredura().semRota.length);

  /* A criança "na perua" vem da plataforma inteira: só entra a de quem está
     com rota rodando — a dos outros já veio pela turma, e avaliar duas vezes
     avisaria duas vezes. */
  checar('na perua de quem roda: avalia', V.avaliarDaPerua({ adminUid: 'b' }, r.comRota));
  checar('na perua de quem está parado: já veio pela turma', !V.avaliarDaPerua({ adminUid: 'a' }, r.comRota));
  checar('sem motorista: não avalia', !V.avaliarDaPerua({}, r.comRota));
}

/* ⚠️ O CASO GRAVE NÃO DEPENDE DA ROTA — e é por isso que motorista com rota
   rodando não é DESCARTADO, só muda de consulta. Se alguém "simplificar" para
   ler só quem está parado, esta é a frase que deixa de sair. */
{
  const naPerua = {
    name: 'Lucas', parentUid: 'mae', horaPega: '06:40', horaEntrega: '07:20',
    status: 'onboard', statusUpdatedAt: new Date('2026-09-10T10:30:00Z'),
  };
  const grave = R.avisoDeAtraso({
    crianca: naPerua, rotaAtiva: true, temFalta: false, agora: new Date('2026-09-10T10:50:00Z'),
  });
  checar('com a rota ATIVA, "passou da hora de chegar" ainda sai', grave && grave.nivel === 'grave',
    JSON.stringify(grave));
}

/* A ordem das consultas mora no arquivo que escreve — conferida pelo texto. */
{
  const fonte = readFileSync(new URL('../functions/lib/enviarAvisosDoDia.js', import.meta.url), 'utf8');
  const atrasos = fonte.slice(fonte.indexOf('async function varrerAtrasos'), fonte.indexOf('function makeVarrerAtrasos'));
  checar('não lê mais children.limit(TETO) solto', !/collection\('children'\)\.limit\(/.test(atrasos));
  checar('a turma é lida por adminUid', /where\('adminUid', '==', adminUid\)/.test(atrasos));
  checar('a turma NÃO filtra active na consulta (ausente vale ativa)', !/where\('active'/.test(atrasos));
  checar('quem roda: consulta "na perua"', /where\('status', '==', 'onboard'\)/.test(atrasos));
  checar('as faltas do dia são paginadas, sem limit(1000)', !/TETO \* 2/.test(atrasos) && /absenceDeclarations[\s\S]*?startAfter/.test(atrasos));
  const convites = fonte.slice(fonte.indexOf('async function varrerConvites'), fonte.indexOf('async function varrerFaturas'));
  checar('os convites pendentes são paginados', /startAfter/.test(convites) && !/limit\(TETO\)/.test(convites));
  checar('e completam parentPhoneChave só quando difere', /c\.parentPhoneChave !== chave/.test(convites));
}

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ PAGINAR E APAGAR EM PÁGINAS (a régua das varreduras) ═══');

/** Uma "coleção" de mentira com a forma mínima que a régua usa. */
function colecao(n) {
  const docs = Array.from({ length: n }, (_, i) => ({ id: `d${String(i).padStart(4, '0')}` }));
  let consultas = 0;
  return {
    get consultas() { return consultas; },
    docs,
    montar: (tamanho) => (ultimo) => ({
      get: async () => {
        consultas += 1;
        const desde = ultimo ? docs.findIndex((d) => d.id === ultimo.id) + 1 : 0;
        return { docs: docs.slice(desde, desde + tamanho) };
      },
    }),
  };
}

{
  const c = colecao(10);
  const vistos = [];
  for await (const d of V.paginar(c.montar(4), 4)) vistos.push(d.id);
  eq('paginar devolve todos, sem repetir', 10, new Set(vistos).size);
  eq('10 em páginas de 4: três consultas (a última incompleta encerra)', 3, c.consultas);

  const exata = colecao(8);
  const n = [];
  for await (const d of V.paginar(exata.montar(4), 4)) n.push(d);
  eq('8 em páginas de 4: a terceira consulta volta vazia e encerra', 3, exata.consultas);
  eq('e devolve os 8', 8, n.length);

  const vazia = colecao(0);
  const nada = [];
  for await (const d of V.paginar(vazia.montar(4), 4)) nada.push(d);
  eq('coleção vazia: uma consulta, nada devolvido', 0, nada.length);
}

{
  /* A retenção apaga SEM cursor: quem foi apagado sai da consulta. */
  let restantes = Array.from({ length: 1001 }, (_, i) => i);
  const lotes = [];
  const r = await V.apagarEmPaginas({
    tamanho: 400,
    buscar: async (t) => restantes.slice(0, t),
    apagar: async (docs) => { lotes.push(docs.length); restantes = restantes.slice(docs.length); },
  });
  eq('1001 viagens: apaga todas', 1001, r.apagados);
  eq('em três lotes (400, 400, 201)', JSON.stringify([400, 400, 201]), JSON.stringify(lotes));
  checar('nenhum lote passa de 400 (o Firestore recusa acima de 500)', lotes.every((x) => x <= 400));
  checar('terminou sem bater no teto', r.interrompido === false);

  /* ⚠️ O TETO DE PÁGINAS: se o lote "apaga" e a consulta devolve o mesmo, o
     laço sem teto rodaria até o timeout gastando leitura. */
  const teimosa = await V.apagarEmPaginas({
    tamanho: 400, maxPaginas: 5,
    buscar: async (t) => Array.from({ length: t }, (_, i) => i),
    apagar: async () => {},
  });
  checar('consulta que nunca esvazia para no teto e diz que parou', teimosa.interrompido === true && teimosa.paginas === 5);

  const nadaAApagar = await V.apagarEmPaginas({ buscar: async () => [], apagar: async () => { throw new Error('não devia'); } });
  eq('nada a apagar: nenhum lote', 0, nadaAApagar.apagados);
}

{
  const fonte = readFileSync(new URL('../functions/lib/retencaoDasViagens.js', import.meta.url), 'utf8');
  checar('a retenção usa apagarEmPaginas', /apagarEmPaginas\(/.test(fonte));
  checar('e a consulta da retenção tem limit', /where\('dateKey', '<', corte\)\s*\.limit\(/.test(fonte));
  checar('e declara o tempo e a memória das agendadas pesadas',
    /timeoutSeconds: LIMITES\.TEMPO_AGENDADO/.test(fonte) && /memory: LIMITES\.MEMORIA_AGENDADO/.test(fonte));
}

// ══════════════════════════════════════════════════════════════════════════
bloco('═══ TODA AGENDADA RODA UMA DE CADA VEZ ═══');

/* ⚠️ `maxInstances: 1` sozinho NÃO serializa: uma instância de Functions v2
   atende 80 requisições ao mesmo tempo. Quem serializa é o par com
   `concurrency: 1`. Varre todo `onSchedule(` de functions/. */
{
  const { readdirSync } = await import('node:fs');
  const LIMITES = require('../functions/lib/limites.js');
  eq('CONCORRENCIA_AGENDADO é 1', 1, LIMITES.CONCORRENCIA_AGENDADO);
  eq('AGENDADO é 1', 1, LIMITES.AGENDADO);

  const pasta = new URL('../functions/lib/', import.meta.url);
  const arquivos = readdirSync(pasta).filter((f) => f.endsWith('.js')).map((f) => new URL(f, pasta));
  arquivos.push(new URL('../functions/index.js', import.meta.url));

  let agendadas = 0;
  for (const arq of arquivos) {
    const fonte = readFileSync(arq, 'utf8');
    const re = /onSchedule\(\s*\{([\s\S]*?)\n\s*\},/g;
    let m;
    while ((m = re.exec(fonte))) {
      agendadas += 1;
      const opcoes = m[1];
      const nome = `${arq.pathname.split('/').pop()} (${(opcoes.match(/schedule: '([^']+)'/) || [])[1] || '?'})`;
      checar(`${nome}: concurrency 1`, /concurrency: (1|LIMITES\.CONCORRENCIA_AGENDADO)\b/.test(opcoes));
      checar(`${nome}: maxInstances 1`, /maxInstances: (1|LIMITES\.AGENDADO)\b/.test(opcoes));
    }
  }
  checar('achou as agendadas (sonda: a varredura não está cega)', agendadas >= 9, `achou ${agendadas}`);

  /* Sonda positiva: o detector reprovaria uma agendada sem concurrency. */
  const sonda = "onSchedule(\n    {\n      schedule: 'x',\n      maxInstances: LIMITES.AGENDADO,\n    },";
  const ms = /onSchedule\(\s*\{([\s\S]*?)\n\s*\},/.exec(sonda);
  checar('sonda: sem concurrency o detector reprova', ms && !/concurrency:/.test(ms[1]));

  const fech = readFileSync(new URL('../functions/lib/fechamento.js', import.meta.url), 'utf8');
  checar('fecharMesDosParceiros retenta (é idempotente por jaTem.exists)',
    /schedule: '0 5 1 \* \*'[\s\S]*?retryCount: 2/.test(fech) && /jaTem\.exists/.test(fech));
}

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
