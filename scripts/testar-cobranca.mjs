/**
 * O QUE CADA EVENTO DO GATEWAY FAZ COM A FATURA.
 *
 * POR QUE ESTE TESTE
 * A função que ele exercita roda num endpoint PÚBLICO, disparada por um
 * sistema de fora, sobre eventos que chegam repetidos e fora de ordem. É o
 * pedaço mais difícil de observar em produção: quando ele erra, o sintoma é
 * um motorista bloqueado que já pagou — ou, pior e mais silencioso, um
 * motorista operando de graça porque um estorno não reabriu a fatura.
 *
 * COMO RODAR
 *   node scripts/testar-cobranca.mjs      (ou: npm run testar:cobranca)
 */

import { readFileSync } from 'node:fs';
import {
  EVENTO,
  montarTrilha,
  rotuloDoEvento,
} from '../src/dominio/cobranca/trilhaDoPagamento.js';
import {
  MESES_DE_RETENCAO,
  MESES_NAVEGAVEIS_ATRAS,
} from '../src/dominio/cobranca/retencao.js';
import {
  QUITADA,
  ABERTA,
  EVENTOS_ASSINADOS,
  efeitoDoEvento,
  eventoAssinado,
} from '../functions/lib/eventoDeCobranca.js';

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

const status = (evento, atual) => efeitoDoEvento(evento, atual).status;

// ────────────────────────────── dar baixa ──────────────────────────────────

bloco('1. O que dá baixa');

// A decisão central: libera no CONFIRMED, que é "pagou, saldo ainda não
// disponível". Esperar o RECEIVED deixaria quem pagou bloqueado por dias.
checar('CONFIRMED dá baixa mesmo sem o saldo liberado', QUITADA, status('PAYMENT_CONFIRMED', ABERTA));
checar('RECEIVED também', QUITADA, status('PAYMENT_RECEIVED', ABERTA));
checar(
  'e o motivo fica registrado',
  'pagamento confirmado',
  efeitoDoEvento('PAYMENT_CONFIRMED', ABERTA).motivo
);

bloco('2. O que faz voltar a dever');

checar('estorno reabre', ABERTA, status('PAYMENT_REFUNDED', QUITADA));
// Estorno parcial também: "quitada pela metade" não é um estado que a cobrança
// deste projeto tenha.
checar('estorno PARCIAL também reabre', ABERTA, status('PAYMENT_PARTIALLY_REFUNDED', QUITADA));
checar('chargeback reabre', ABERTA, status('PAYMENT_CHARGEBACK_REQUESTED', QUITADA));
checar('recebimento em dinheiro desfeito reabre', ABERTA, status('PAYMENT_RECEIVED_IN_CASH_UNDONE', QUITADA));
checar('cobrança removida no gateway reabre', ABERTA, status('PAYMENT_DELETED', QUITADA));

// ⚠️ MAS NÃO REABRE O QUE FOI PAGO POR FORA — e este era o caminho NATURAL.
//
// A sequência: o motorista paga o PIX direto da plataforma, o dono dá baixa à
// mão na aba Mês, e depois abre o painel do Asaas e apaga a cobrança
// redundante — a limpeza que qualquer pessoa faria. Chega `PAYMENT_DELETED`,
// a fatura voltava para `aberta`, e dez dias depois o motorista que PAGOU era
// bloqueado com o comprovante na mão.
//
// `quitadaPor` é o sinal: ele só existe na baixa manual (`marcarFaturaPaga` o
// grava; o webhook não). Estorno e chargeback continuam reabrindo mesmo assim,
// porque neles o dinheiro VOLTOU — aqui não voltou nada, só o registro no
// gateway deixou de existir.
checar(
  'mas NÃO reabre fatura que o dono baixou à mão',
  null,
  efeitoDoEvento('PAYMENT_DELETED', QUITADA, true).status
);
checar(
  'e o motivo diz por quê',
  true,
  /baixada à mão/.test(efeitoDoEvento('PAYMENT_DELETED', QUITADA, true).motivo)
);
// A guarda é ESTREITA de propósito: vale só para este evento e só sobre
// fatura quitada. Estorno sobre baixa manual continua reabrindo — o dinheiro
// voltou de verdade.
checar(
  'estorno sobre baixa manual AINDA reabre',
  ABERTA,
  efeitoDoEvento('PAYMENT_REFUNDED', QUITADA, true).status
);
checar(
  'e chargeback também',
  ABERTA,
  efeitoDoEvento('PAYMENT_CHARGEBACK_REQUESTED', QUITADA, true).status
);
// Sem o sinal, o comportamento é o de sempre — o padrão do parâmetro não
// pode mudar o que já funcionava.
checar(
  'sem o sinal, PAYMENT_DELETED reabre como antes',
  ABERTA,
  efeitoDoEvento('PAYMENT_DELETED', QUITADA, false).status
);

bloco('3. A guarda que impede o pior caso');

// Eventos chegam FORA DE ORDEM: um OVERDUE gerado às 00:00 pode ser entregue
// depois do CONFIRMED das 08:00 se a fila do gateway atrasar. Sem esta linha,
// o motorista paga e é bloqueado em seguida por um evento velho.
checar(
  'vencimento NÃO desfaz pagamento',
  null,
  status('PAYMENT_OVERDUE', QUITADA)
);
checar(
  'e o motivo diz por que foi ignorado',
  'vencimento não desfaz pagamento',
  efeitoDoEvento('PAYMENT_OVERDUE', QUITADA).motivo
);
checar('mas vencimento sobre fatura aberta marca atraso', ABERTA, status('PAYMENT_OVERDUE', ABERTA));

bloco('4. Repetição não muda nada');

// O gateway repete o webhook quando não recebe confirmação, então o mesmo
// evento chega duas ou três vezes. A resposta é um ESTADO ABSOLUTO, nunca um
// passo relativo — aplicar de novo dá no mesmo.
checar('CONFIRMED sobre fatura já quitada não muda', null, status('PAYMENT_CONFIRMED', QUITADA));
checar('estorno sobre fatura já aberta não muda', null, status('PAYMENT_REFUNDED', ABERTA));
checar(
  'e diz que não mudou porque já estava assim',
  'já estava quitada',
  efeitoDoEvento('PAYMENT_RECEIVED', QUITADA).motivo
);

bloco('5. O que o app ignora de propósito');

// Ruído do gateway: nada disso muda quem deve o quê. Se algum dia um destes
// passar a mexer no estado, foi por engano.
[
  'PAYMENT_CREATED',
  'PAYMENT_UPDATED',
  'PAYMENT_BANK_SLIP_VIEWED',
  'PAYMENT_CHECKOUT_VIEWED',
  'PAYMENT_ANTICIPATED',
  'PAYMENT_AWAITING_RISK_ANALYSIS',
  'PAYMENT_SPLIT_DONE',
  'PAYMENT_DUNNING_REQUESTED',
].forEach((e) => checar(`${e} não mexe`, null, status(e, ABERTA)));

// O gateway acrescenta eventos com o tempo. Evento novo que este arquivo não
// conhece precisa não fazer NADA — fatura é dinheiro, e na dúvida não mexe.
checar('evento que ainda não existe não mexe', null, status('PAYMENT_ALGO_NOVO_DE_2027', ABERTA));
checar('nem lixo', null, status('', ABERTA));
checar('nem nulo', null, status(null, ABERTA));

bloco('6. A lista que vai marcada no painel do gateway');

checar('são oito eventos', 8, EVENTOS_ASSINADOS.length);
checar('e todos têm efeito', true, EVENTOS_ASSINADOS.every((e) => status(e, ABERTA) !== null || status(e, QUITADA) !== null));
checar('CONFIRMED está assinado', true, eventoAssinado('PAYMENT_CONFIRMED'));
checar('o ruído não está', false, eventoAssinado('PAYMENT_CREATED'));
// Nome em caixa trocada é erro de digitação de quem configura o painel, não
// motivo para perder um pagamento.
checar('caixa não importa', QUITADA, status('payment_confirmed', ABERTA));

// ═══════════ A RETENÇÃO — UM NÚMERO, TRÊS LUGARES QUE O USAM ════════════
//
// ⚠️ O NÚMERO VEM DA POLÍTICA DE PRIVACIDADE. A seção 8 promete cinco anos
// de registro fiscal; o servidor foi para 60 meses e as TELAS não foram
// junto. `MonthSwitcher` travava a navegação em doze, com a justificativa
// escrita de que era "para casar com a retenção" — 48 meses de mensalidade
// existiam no banco e a tela não deixava chegar neles.
//
// A cópia do servidor mora em `functions/lib/billing.js`, que requer o SDK e
// não pode ser importado por script da bateria (ver `testar:imports`). Então
// ela é conferida por LEITURA DE ARQUIVO — o mesmo recurso de `testar:selo`
// com o texto do selo e de `testar:busca` com a landing.

bloco('A retenção de pagamentos, dos dois lados');

checar('a retenção é de 60 meses', 60, MESES_DE_RETENCAO);
// O mês corrente conta: 60 de retenção são o atual mais 59 atrás. Oferecer um
// mês a mais mostraria uma lista vazia que o servidor já apagou.
checar('e a navegação vai 59 meses para trás', 59, MESES_NAVEGAVEIS_ATRAS);

const fonteDoBilling = readFileSync(
  new URL('../functions/lib/billing.js', import.meta.url),
  'utf8'
);
const noServidor = fonteDoBilling.match(/RETENTION_MONTHS\s*=\s*(\d+)/);
checar('o servidor declara o mesmo número', String(MESES_DE_RETENCAO),
  noServidor ? noServidor[1] : 'não achei RETENTION_MONTHS');
// Sonda: sem ela, um arquivo vazio ou um `match` que falhasse passariam se o
// esperado também fosse nulo.
checar('e a varredura realmente leu o arquivo', true, fonteDoBilling.length > 500);

// ⚠️ E O SELETOR DE MÊS PRECISA LER A CONSTANTE, não repetir o número. Era
// `addMonths(current, -11)` escrito à mão, e foi assim que ele ficou para
// trás quando a retenção mudou.
const fonteDoSeletor = readFileSync(
  new URL('../src/components/payments/MonthSwitcher.jsx', import.meta.url),
  'utf8'
);
checar('o seletor de mês deriva o limite da régua', true,
  fonteDoSeletor.includes('MESES_NAVEGAVEIS_ATRAS'));
checar('e não tem mais um número escrito à mão', false,
  /addMonths\(current,\s*-\d/.test(fonteDoSeletor));

bloco('A trilha do pagamento — escrita inteira, e lida por alguém');

// ⚠️ POR QUE ESTE BLOCO EXISTE
// A trilha era metade de um mecanismo: TRÊS dos sete tipos nunca foram
// escritos (`unclaimed`, `reverted`, `receipt_replaced`) e NENHUM era lido —
// `listPaymentEvents` e `eventLabel` não tinham um único chamador. O tipo
// que faltava com mais ironia era `unclaimed`: desfazer o aviso apaga
// `claimedAt`, `paymentMethod` e `receiptURL` no mesmo write, e é o caso
// descrito no cabeçalho do arquivo como o motivo de ele existir.

const AGORA = new Date('2026-09-10T14:00:00');
const ONTEM = new Date('2026-09-09T14:00:00');

// (a) A LINHA ZERO É SINTETIZADA de `createdAt` — `created` nunca é gravado,
// e uma escrita por mensalidade por mês só para repetir o que o documento já
// diz seria custo sem informação.
const comNascimento = montarTrilha({
  payment: { createdAt: ONTEM },
  eventos: [{ type: 'claimed', at: AGORA, actorRole: 'parent' }],
});
checar('a trilha começa pela criação', 'created', comNascimento[0].tipo);
checar('e ela é sintetizada, não gravada', true, comNascimento[0].sintetizado);
checar('o evento real vem depois', 'claimed', comNascimento[1].tipo);

// Se o evento REAL existir um dia, ele vence — nada de duas criações.
const comCriacaoReal = montarTrilha({
  payment: { createdAt: ONTEM },
  eventos: [{ type: 'created', at: ONTEM }],
});
checar('evento real de criação não duplica', 1,
  comCriacaoReal.filter((l) => l.tipo === 'created').length);
checar('e ele não é marcado como sintetizado', false, comCriacaoReal[0].sintetizado);

// Sem `createdAt` (pagamento antigo) não inventa linha nenhuma.
checar('sem createdAt não há linha zero', 0, montarTrilha({ payment: {} }).length);

// (b) ORDEM CRONOLÓGICA, e o evento SEM data vai pro fim.
//
// `at` é `serverTimestamp()`: entre a escrita local e o eco do servidor ele
// chega nulo. Descartar faria a linha recém-criada sumir e reaparecer.
const fora = montarTrilha({
  payment: null,
  eventos: [
    { type: 'confirmed', at: AGORA },
    { type: 'claimed', at: ONTEM },
    { type: 'reverted', at: null },
  ],
});
checar('a ordem é cronológica', 'claimed,confirmed,reverted',
  fora.map((l) => l.tipo).join(','));
checar('o evento sem data não some', 3, fora.length);

// (c) TODO TIPO TEM FRASE, E ELA DIZ QUEM AGIU.
//
// "Comprovante substituído" sozinho não conta que alguém trocou a prova de
// outra pessoa — e é exatamente aí que a trilha é lida.
for (const tipo of Object.values(EVENTO)) {
  const r = rotuloDoEvento(tipo);
  checar(`o tipo ${tipo} tem frase própria`, true, r !== tipo && r.length > 0);
}
checar('tipo desconhecido não vira frase inventada', 'coisa_nova',
  rotuloDoEvento('coisa_nova'));

// (d) ⚠️ A INVARIANTE QUE PAGA O BLOCO: TIPO DECLARADO É TIPO ESCRITO.
//
// Tipo no vocabulário que nenhuma tela grava é uma promessa que a trilha não
// cumpre — o histórico fica com um buraco e ninguém recebe erro. `created` é
// a exceção declarada: ele é sintetizado na leitura (ver (a)).
const telas = ['../src/pages/pai/PaiFinance.jsx', '../src/pages/tio/TioFinance.jsx']
  .map((rel) => readFileSync(new URL(rel, import.meta.url), 'utf8'))
  .join('\n');
for (const [chave, tipo] of Object.entries(EVENTO)) {
  if (tipo === EVENTO.CREATED) continue;
  checar(`alguém escreve o evento ${tipo}`, true,
    telas.includes(`PAYMENT_EVENTS.${chave}`));
}

// Sonda positiva do (d): o detector precisa acusar um tipo que ninguém grava.
checar('o detector acusa tipo sem gravador (sonda positiva)', false,
  telas.includes('PAYMENT_EVENTS.NUNCA_ESCRITO'));

// (e) E ALGUÉM LÊ. Sem esta metade, os eventos continuam sendo escritos para
// um leitor que não existe — que foi o estado dos sete por meses.
const fonteRow = readFileSync(
  new URL('../src/components/payments/PaymentRow.jsx', import.meta.url), 'utf8');
const fonteTrilha = readFileSync(
  new URL('../src/components/payments/TrilhaDoPagamento.jsx', import.meta.url), 'utf8');
checar('o cartão de pagamento mostra a trilha', true,
  fonteRow.includes('<TrilhaDoPagamento payment={payment} />'));
checar('e o cartão é o mesmo dos dois lados', true,
  readFileSync(new URL('../src/pages/pai/PaiFinance.jsx', import.meta.url), 'utf8')
    .includes('<PaymentRow')
  && readFileSync(new URL('../src/pages/tio/TioFinance.jsx', import.meta.url), 'utf8')
    .includes('<PaymentRow'));
checar('a tela lê os eventos de verdade', true,
  fonteTrilha.includes('listPaymentEvents'));
// Leitura, nunca edição: a subcoleção é append-only nas rules, e um histórico
// que se edita vale como versão, não como prova.
for (const escrita of ['updateDoc', 'deleteDoc', 'setDoc']) {
  checar(`a tela da trilha não ${escrita}`, false, fonteTrilha.includes(escrita));
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
