/**
 * A CONTA ESTÁ ATIVA? — a regra que decide quando o app para.
 *
 * POR QUE ESTE TESTE
 * Errar para menos bloqueia quem ainda tinha prazo, com vinte famílias
 * esperando a perua na calçada. Errar para mais dá meses de uso sem contrato e
 * sem ninguém perceber. E a fronteira entre os dois é uma conta de datas, que
 * é justamente o tipo de código que passa em setembro e falha em março quando
 * lê o relógio da máquina — por isso o "agora" entra por parâmetro.
 *
 * COMO RODAR
 *   node scripts/testar-conta.mjs      (ou: npm run testar:conta)
 */

import {
  TOLERANCIA_DE_ATRASO,
  assinaturaAteDoMes,
  assinaturaValida,
  diasDeAtraso,
  estadoDaConta,
  lembreteDeAtraso,
  faturaZeradaEstendeAssinatura,
} from '../src/dominio/associacao/contaAtiva.js';

/** Quem pagou a fatura de abril está coberto até o fim de maio. */
const ASSINADO = assinaturaAteDoMes('2026-04');

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

/** Meio-dia: em 00:00 qualquer fuso de uma hora rouba um dia. */
const dia = (iso) => new Date(`${iso}T12:00:00`);

const VENCE = dia('2026-05-10');
const emAberto = { status: 'aberta', vencimento: VENCE, total: 149 };
const quitada = { status: 'quitada', vencimento: VENCE, total: 149 };

// Trial de 90 dias começando em 1º de março → acaba em 30 de maio.
const TRIAL = dia('2026-03-01');

// ───────────────────────────── dias de atraso ──────────────────────────────

bloco('1. Há quantos dias a fatura venceu');

checar('antes de vencer, negativo', -3, diasDeAtraso(emAberto, dia('2026-05-07')));
checar('no dia do vencimento, zero', 0, diasDeAtraso(emAberto, VENCE));
checar('cinco dias depois', 5, diasDeAtraso(emAberto, dia('2026-05-15')));

// Fatura paga não tem atraso, e isso precisa vir antes de qualquer conta de
// data: quitada em cima do vencimento continua quitada.
checar('fatura quitada não tem atraso', null, diasDeAtraso(quitada, dia('2026-06-30')));
checar('sem fatura também não', null, diasDeAtraso(null, VENCE));

// ───────────────────────────── o estado da conta ───────────────────────────

bloco('2. Quando a conta continua ativa');

checar(
  'dentro do trial, sem fatura',
  { ativa: true, motivo: null, dias: null },
  estadoDaConta({ trialInicio: TRIAL, agora: dia('2026-04-01') })
);
checar(
  'cadastrou e não rodou rota: o relógio nem começou',
  { ativa: true, motivo: null, dias: null },
  estadoDaConta({ trialInicio: null, agora: dia('2026-12-01') })
);
checar(
  'assinatura em dia faz o trial deixar de significar qualquer coisa',
  { ativa: true, motivo: null, dias: null },
  estadoDaConta({ trialInicio: TRIAL, assinaturaAte: assinaturaAteDoMes('2026-08'), agora: dia('2026-09-01') })
);
checar(
  'fatura em aberto dentro da tolerância',
  { ativa: true, motivo: null, dias: 9 },
  estadoDaConta({ assinaturaAte: ASSINADO, fatura: emAberto, agora: dia('2026-05-19') })
);

bloco('3. Quando ela para');

// A fronteira: 10 tolera, 11 bloqueia. Esta é a linha que separa esquecer de
// decidir, e mover um dia para cá bloqueia quem viajou no fim de semana.
checar(
  'no décimo dia ainda opera',
  true,
  estadoDaConta({ assinaturaAte: ASSINADO, fatura: emAberto, agora: dia('2026-05-20') }).ativa
);
checar(
  'no décimo primeiro, para',
  { ativa: false, motivo: 'atraso', dias: 11 },
  estadoDaConta({ assinaturaAte: ASSINADO, fatura: emAberto, agora: dia('2026-05-21') })
);
checar(
  'trial vencido sem contrato',
  { ativa: false, motivo: 'trial', dias: null },
  estadoDaConta({ trialInicio: TRIAL, agora: dia('2026-06-01') })
);

bloco('4. A ordem da checagem é parte da regra');

// Suspensão é decisão de uma pessoa. Um pagamento não a desfaz — quem desfaz
// é quem suspendeu, e por outro caminho.
checar(
  'suspenso vence tudo, mesmo em dia',
  { ativa: false, motivo: 'suspenso', dias: null },
  estadoDaConta({ suspenso: true, assinaturaAte: ASSINADO, fatura: quitada, agora: VENCE })
);
checar(
  'suspenso vence até o trial correndo',
  'suspenso',
  estadoDaConta({ suspenso: true, trialInicio: TRIAL, agora: dia('2026-04-01') }).motivo
);
// Quem já foi cliente e atrasou recebe a frase do atraso, não a do teste — a
// segunda seria mentira, e ele saberia disso.
checar(
  'atraso vence o trial vencido',
  'atraso',
  estadoDaConta({
    trialInicio: TRIAL,
    fatura: emAberto,
    agora: dia('2026-06-01'),
  }).motivo
);

// ───────────────────────────── os lembretes ────────────────────────────────

bloco('4b. A assinatura — o campo que diz até quando a conta está paga');

checar('pagar a fatura de maio cobre até o fim de junho', '2026-06-30', assinaturaAteDoMes('2026-05').toISOString().slice(0, 10));
// Dezembro precisa virar o ano, e é o caso que um cálculo ingênuo erra.
checar('dezembro vira janeiro do ano seguinte', '2027-01-31', assinaturaAteDoMes('2026-12').toISOString().slice(0, 10));
checar('mês em formato errado não inventa data', null, assinaturaAteDoMes('maio'));

checar('dentro da cobertura, vale', true, assinaturaValida(ASSINADO, dia('2026-05-10')));
checar('depois dela, não vale', false, assinaturaValida(ASSINADO, dia('2026-07-01')));
checar('sem assinatura nenhuma, não vale', false, assinaturaValida(null, dia('2026-05-10')));

// A LINHA QUE PROTEGE A CONFIANÇA: dizer "seu teste acabou" a quem pagou meses
// é uma mentira que ele reconhece na hora — e quem desconfia da cobrança para
// de pagar.
//
// ⚠️ MAS TAMBÉM NÃO É `atraso`, E ESTE CASO JÁ AFIRMOU QUE ERA.
//
// `atraso` é a frase que diz "está em aberto há mais de dez dias", e ela vem
// da FATURA vencida — no ramo de cima, onde o número é real. Este ramo aqui
// dispara no DIA SEGUINTE ao fim da cobertura, sem fatura em mão e com `dias`
// vindo `null`: um pagante em dia com o mês, que só não renovou, era acusado
// de dez dias de inadimplência.
//
// São três estados, não dois. O que este caso protege continua protegido: o
// motivo não é `trial`.
checar(
  'quem já foi cliente NÃO recebe a frase do teste',
  'renovar',
  estadoDaConta({ trialInicio: TRIAL, assinaturaAte: ASSINADO, agora: dia('2026-08-01') }).motivo
);
// E a distinção que faltava: sem fatura em mão, não se afirma prazo.
checar(
  'e `renovar` não é `atraso` — a frase dos dez dias exige fatura',
  true,
  estadoDaConta({ trialInicio: TRIAL, assinaturaAte: ASSINADO, agora: dia('2026-08-01') }).motivo !== 'atraso'
);
checar(
  'com fatura vencida em mão, aí sim é atraso',
  'atraso',
  estadoDaConta({
    trialInicio: TRIAL,
    assinaturaAte: ASSINADO,
    fatura: { status: 'aberta', vencimento: dia('2026-06-20') },
    agora: dia('2026-08-01'),
  }).motivo
);
checar(
  'e quem nunca pagou recebe a do teste',
  'trial',
  estadoDaConta({ trialInicio: TRIAL, assinaturaAte: null, agora: dia('2026-08-01') }).motivo
);

bloco('5. O lembrete de PIX — e o silêncio, que é a resposta comum');

checar('antes de vencer, silêncio', null, lembreteDeAtraso({ fatura: emAberto, agora: dia('2026-05-08') }));
checar(
  'no dia do vencimento, o primeiro',
  { nivel: 'vence-hoje', dias: 0, faltam: 11 },
  lembreteDeAtraso({ fatura: emAberto, agora: VENCE })
);
checar(
  'no terceiro dia, ainda o primeiro — não é contagem diária',
  'vence-hoje',
  lembreteDeAtraso({ fatura: emAberto, agora: dia('2026-05-13') }).nivel
);
checar(
  'no quinto, o segundo e último',
  { nivel: 'atrasada', dias: 5, faltam: 6 },
  lembreteDeAtraso({ fatura: emAberto, agora: dia('2026-05-15') })
);
checar(
  'no décimo, ainda lembra — e diz que falta 1',
  { nivel: 'atrasada', dias: 10, faltam: 1 },
  lembreteDeAtraso({ fatura: emAberto, agora: dia('2026-05-20') })
);

// Depois do bloqueio o lembrete some: quem está na tela de conta inativa não
// precisa de um cartão dizendo que está atrasado. Dois avisos sobre a mesma
// coisa é o app falando duas vezes.
checar(
  'passou da tolerância, o lembrete cala',
  null,
  lembreteDeAtraso({ fatura: emAberto, agora: dia('2026-05-25') })
);
checar('fatura quitada não lembra nada', null, lembreteDeAtraso({ fatura: quitada, agora: dia('2026-06-01') }));
checar('sem fatura, idem', null, lembreteDeAtraso({ fatura: null, agora: VENCE }));

bloco('6. A régua está onde foi combinada');

checar('dez dias de tolerância', 10, TOLERANCIA_DE_ATRASO);

// ═══════ A FATURA ZERADA QUE COMPRA TEMPO — E A QUE NAO COMPRA ═════════════

bloco('Fatura de R$ 0: quando ela estende a assinatura');

/**
 * ⚠️ ESTE BLOCO NASCEU DE UM BUG DE AUDITORIA, e ele custava o paywall inteiro.
 *
 * A fatura isenta do TESTE passou a existir em 07/09/2026 (uma por mes, com o
 * preco cheio visivel). Ela nasce com `total: 0`, e `fecharFatura` escrevia
 * `assinaturaAte` para toda fatura zerada — regra que existia para o fundador
 * vitalicio, que sem ela era bloqueado no dia 90 com a fatura quitada.
 *
 * So que `estadoDaConta` devolve `ativa` no instante em que ve `assinaturaAte`
 * no futuro, ANTES de olhar o trial. Entao a fatura de teste comprava tempo de
 * assinatura e o teste deixava de acabar: conta destravada depois do dia 90
 * (nas rules tambem), `avisoDoTrial` mudo, e no fim a frase do ATRASO para quem
 * nunca teve fatura.
 *
 * A distincao e de ESPECIE: isencao CONCEDIDA e um acordo, mes de teste e o
 * relogio correndo. So o primeiro compra tempo.
 */
checar('fatura zerada por isencao concedida estende', true,
  faturaZeradaEstendeAssinatura({ total: 0, isencaoDeTeste: false }));
checar('fatura zerada do fundador vitalicio estende', true,
  faturaZeradaEstendeAssinatura({ total: 0 }));
// ⚠️ A LINHA QUE O BUG ATRAVESSAVA.
checar('mas a isencao do TESTE nao estende', false,
  faturaZeradaEstendeAssinatura({ total: 0, isencaoDeTeste: true }));
checar('fatura com valor nao estende (quem estende e a baixa)', false,
  faturaZeradaEstendeAssinatura({ total: 149, isencaoDeTeste: false }));
checar('nem a de teste com valor, que nao deveria existir', false,
  faturaZeradaEstendeAssinatura({ total: 149, isencaoDeTeste: true }));
checar('entrada vazia nao estende nada', false, faturaZeradaEstendeAssinatura());

bloco('E o efeito disso em estadoDaConta — o porque da regra acima');

// A PROVA DE QUE A ORDEM IMPORTA: com `assinaturaAte` no futuro, o trial
// vencido nem e consultado. E por isso que escrever esse campo por causa de uma
// fatura de teste apaga o dia 90.
const trialVencido = new Date(2026, 0, 1, 12);
const hojeDepois = new Date(2026, 5, 1, 12);
checar('teste vencido, sem assinatura: bloqueado', false,
  estadoDaConta({ trialInicio: trialVencido, agora: hojeDepois }).ativa);
checar('e o motivo e o do teste', 'trial',
  estadoDaConta({ trialInicio: trialVencido, agora: hojeDepois }).motivo);
checar('o MESMO teste vencido, com assinaturaAte no futuro: ATIVO', true,
  estadoDaConta({
    trialInicio: trialVencido,
    assinaturaAte: new Date(2026, 11, 31, 12),
    agora: hojeDepois,
  }).ativa);


// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
