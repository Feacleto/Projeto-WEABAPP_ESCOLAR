/**
 * O QUE VAI PARA O GATEWAY — a régua da cobrança da taxa.
 *
 * POR QUE ESTE TESTE
 * Cada caso aqui é um jeito de cobrar errado o motorista, e nenhum deles dá
 * erro na hora: cobrança duplicada do mesmo mês, valor com centavo a mais,
 * vencimento um dia adiantado por causa do fuso, CPF que o gateway recusa com
 * um 400 sem explicação. O sintoma aparece na conta de alguém, dias depois.
 *
 * A função que ele exercita é a única parte deste caminho que roda sem rede —
 * o resto é `asaasApi.js`, que só transporta.
 *
 * COMO RODAR
 *   node scripts/testar-gateway.mjs      (ou: npm run testar:gateway)
 */

import {
  documentoValido,
  podeCobrar,
  dadosDaCobranca,
  dadosDoCliente,
  rotuloDoMes,
  paraDiaISO,
} from '../functions/lib/cobrancaDaTaxa.js';
import { urlDoAmbiente, SANDBOX, PRODUCAO } from '../functions/lib/asaasApi.js';
import { assinaturaAteDoMes as noServidor } from '../functions/lib/eventoDeCobranca.js';
import { assinaturaAteDoMes as noApp } from '../src/dominio/associacao/contaAtiva.js';
import {
  PLANOS as planosNoServidor,
  ESCADA as escadaNoServidor,
  RETORNO as retornoNoServidor,
  dentroDoTrial,
  degrauDaDecisao as degrauNoServidor,
  descontoDoDegrau,
  mesDaqui as mesDaquiContrato,
  cobertoAteOMesSeguinte,
} from '../functions/lib/reguaDoServidor.js';
import {
  PLANOS as planosNoApp,
  ESCADA_DE_FECHAMENTO as escadaNoApp,
  RETORNO as retornoNoApp,
  descontoDoFechamento,
} from '../src/dominio/associacao/planos.js';
import { degrauDaDecisao as degrauNoApp } from '../src/dominio/associacao/trial.js';
// ⚠️ DE `reguaDoServidor.js`, NUNCA DE `contratacao.js`.
//
// `contratacao.js` requer `firebase-functions`, que só existe em
// `functions/node_modules` — não rastreado pelo git, e o CI roda um `npm ci` na
// raiz. Enquanto este arquivo importava de lá, ele MORRIA no CI com
// `Cannot find module 'firebase-functions/v2/https'` e levava os 11 scripts
// seguintes da bateria com ele, pelo `&&` do `package.json`.
//
// `scripts/testar-imports.mjs` prova que nenhum script da bateria alcança um
// módulo que requer o SDK — é o que impede o fio de partir de novo.
import { MESES_DE_CONTRATO as mesesNoServidor } from '../functions/lib/reguaDoServidor.js';

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

const CPF = '52998224725';
const CNPJ = '11222333000181';

const aberta = {
  tioUid: 'tio1',
  mes: '2026-09',
  total: 149,
  status: 'aberta',
  vencimento: dia('2026-09-10'),
};

// ───────────────────────────── o documento ─────────────────────────────────

bloco('1. CPF e CNPJ — conferidos aqui porque o gateway recusa sem explicar');

checar('CPF válido volta só com os dígitos', CPF, documentoValido(CPF));
checar('e pontuado dá no mesmo', CPF, documentoValido('529.982.247-25'));
checar('CNPJ válido também', CNPJ, documentoValido('11.222.333/0001-81'));

// O dígito verificador é o ponto: sem ele, qualquer erro de digitação passa e
// vira um 400 opaco na cara de quem digitou.
checar('um dígito trocado não passa', null, documentoValido('52998224726'));
checar('CNPJ com dígito trocado idem', null, documentoValido('11222333000182'));

// 111.111.111-11 passa em qualquer conta de dígito verificador ingênua, e é o
// erro de digitação mais comum que existe.
checar('onze dígitos iguais não passam', null, documentoValido('11111111111'));
checar('catorze iguais também não', null, documentoValido('00000000000000'));

checar('tamanho errado não passa', null, documentoValido('5299822472'));
checar('vazio não passa', null, documentoValido(''));
checar('nulo não quebra', null, documentoValido(null));

// ───────────────────────────── a fatura pode? ──────────────────────────────

bloco('2. Qual fatura vira cobrança');

checar('fatura aberta com valor, pode', { pode: true, motivo: null }, podeCobrar(aberta));

// A ORDEM: fatura isenta nasce quitada COM total zero. "Já está paga" é uma
// resposta mais útil para quem olha a tela do mês que "o valor é zero".
checar(
  'quitada não é recobrada',
  'Esta fatura já está quitada.',
  podeCobrar({ ...aberta, status: 'quitada', total: 0 }).motivo
);
checar(
  'valor zero não vira cobrança',
  'Fatura sem valor a cobrar.',
  podeCobrar({ ...aberta, total: 0 }).motivo
);
checar('valor negativo idem', false, podeCobrar({ ...aberta, total: -5 }).pode);

// A PRIMEIRA GUARDA CONTRA COBRAR DUAS VEZES. A segunda pergunta ao próprio
// gateway, e mora em `asaasApi.acharCobrancaPorReferencia`.
checar(
  'fatura que já tem cobrança não gera outra',
  'Esta fatura já tem cobrança no gateway.',
  podeCobrar({ ...aberta, asaasPaymentId: 'pay_1' }).motivo
);
checar('fatura inexistente não quebra', false, podeCobrar(null).pode);

// ───────────────────────────── o corpo enviado ─────────────────────────────

bloco('3. O que o gateway recebe');

const corpo = dadosDaCobranca({
  fatura: aberta,
  faturaId: 'tio1_2026-09',
  clienteId: 'cus_1',
  hoje: dia('2026-09-01'),
});

checar('cobra por PIX', 'PIX', corpo.billingType);
checar('o valor sai com duas casas', 149, corpo.value);
checar('o vencimento futuro é respeitado', '2026-09-10', corpo.dueDate);
// O ELO COM A FATURA: é por ele que se pergunta "este mês já foi cobrado?".
checar('a referência é o id da fatura', 'tio1_2026-09', corpo.externalReference);
checar('e o cliente é o do gateway', 'cus_1', corpo.customer);
checar(
  'a descrição diz o mês por extenso',
  'Alô Buzinou — associação de setembro/2026',
  corpo.description
);

// O dono fecha o mês quando dá, e a régua da casa vence no dia 10. Fechar dia
// 14 produz uma fatura que JÁ VENCEU — e o gateway recusa data passada.
checar(
  'vencimento no passado vira hoje',
  '2026-09-14',
  dadosDaCobranca({ fatura: aberta, faturaId: 'x', clienteId: 'c', hoje: dia('2026-09-14') }).dueDate
);
checar(
  'no próprio dia do vencimento, mantém',
  '2026-09-10',
  dadosDaCobranca({ fatura: aberta, faturaId: 'x', clienteId: 'c', hoje: dia('2026-09-10') }).dueDate
);
checar(
  'fatura sem vencimento cobra hoje em vez de quebrar',
  '2026-09-14',
  dadosDaCobranca({
    fatura: { ...aberta, vencimento: null },
    faturaId: 'x',
    clienteId: 'c',
    hoje: dia('2026-09-14'),
  }).dueDate
);

// O FUSO. `toISOString()` converte para UTC: às 22h de um UTC-3 ele devolve o
// DIA SEGUINTE, e a cobrança nasceria com um dia a mais de prazo.
checar('22h não vira o dia seguinte', '2026-09-10', paraDiaISO(new Date(2026, 8, 10, 22, 0, 0)));
checar('01h não volta um dia', '2026-09-10', paraDiaISO(new Date(2026, 8, 10, 1, 0, 0)));

// Centavo: `centavos()` já arredonda ao fechar a fatura, mas o valor chega
// aqui como número solto e ponto flutuante não perdoa.
checar(
  'centavo quebrado é arredondado, não truncado',
  149.9,
  dadosDaCobranca({ fatura: { ...aberta, total: 149.899999 }, faturaId: 'x', clienteId: 'c' }).value
);

// ───────────────────────────── o cliente ───────────────────────────────────

bloco('4. O cadastro do motorista no gateway');

const cliente = dadosDoCliente({
  motorista: { name: '  Nino Silva ', email: 'nino@exemplo.com', phone: '(11) 98888-7777' },
  cpfCnpj: '529.982.247-25',
  tioUid: 'tio1',
});

checar('o nome vai sem espaço sobrando', 'Nino Silva', cliente.name);
checar('o documento vai só com dígitos', CPF, cliente.cpfCnpj);
checar('o telefone também', '11988887777', cliente.mobilePhone);
// Nome repete; uid não. É o uid que amarra o cliente do gateway ao motorista.
checar('a referência é o uid do motorista', 'tio1', cliente.externalReference);

checar(
  'sem documento válido não há cliente',
  null,
  dadosDoCliente({ motorista: { name: 'Nino' }, cpfCnpj: '123', tioUid: 'tio1' })
);
checar(
  'motorista sem telefone não manda campo vazio',
  undefined,
  dadosDoCliente({ motorista: { name: 'Nino' }, cpfCnpj: CPF, tioUid: 'tio1' }).mobilePhone
);

// ───────────────────────────── o ambiente ──────────────────────────────────

bloco('5. Sandbox por padrão — errar para o lado que não cobra ninguém');

checar('sem configuração, sandbox', SANDBOX, urlDoAmbiente(undefined));
checar('vazio, sandbox', SANDBOX, urlDoAmbiente(''));
checar('lixo, sandbox', SANDBOX, urlDoAmbiente('prod'));
checar('só a palavra exata liga produção', PRODUCAO, urlDoAmbiente('producao'));
checar('e ela não é sensível a caixa', PRODUCAO, urlDoAmbiente('PRODUCAO'));

bloco('6. O rótulo do mês');

checar('setembro', 'setembro/2026', rotuloDoMes('2026-09'));
checar('janeiro', 'janeiro/2027', rotuloDoMes('2027-01'));
checar('mês fora da faixa devolve o cru em vez de inventar', '2026-13', rotuloDoMes('2026-13'));

bloco('7. As duas cópias de "até quando a conta está paga" concordam');

// POR QUE HÁ DUAS. O deploy das functions só leva a pasta `functions/`, então
// o webhook não alcança `src/dominio`. A cópia é deliberada — e é ESTE bloco
// que impede que ela vire divergência: sem ele, o app e o servidor poderiam
// discordar sobre até quando alguém está pago, e a diferença só apareceria na
// tela de um motorista bloqueado que acabou de pagar.
const iso = (d) => (d ? d.toISOString() : null);
let divergiu = null;
for (let ano = 2026; ano <= 2031 && !divergiu; ano += 1) {
  for (let m = 1; m <= 12; m += 1) {
    const mes = `${ano}-${String(m).padStart(2, '0')}`;
    if (iso(noServidor(mes)) !== iso(noApp(mes))) {
      divergiu = mes;
      break;
    }
  }
}
checar('setenta e dois meses seguidos, nenhuma divergência', null, divergiu);
// A virada de ano é onde um cálculo ingênuo erra, e onde as duas errariam
// diferente. Ancorado aqui além da varredura acima.
checar('dezembro vira janeiro nas duas', iso(noApp('2026-12')), iso(noServidor('2026-12')));
checar('e mês inválido devolve nulo nas duas', null, noServidor('maio'));

bloco('8. A régua espelhada no servidor bate com a do app');

// POR QUE HÁ DUAS. `contratarPlano` roda nas functions, que não alcançam
// `src/dominio` — o deploy só leva a pasta `functions/`. O que foi espelhado é
// só a TABELA (id, teto, preço), nenhuma aritmética; e é este bloco que impede
// a cópia de virar divergência.
//
// Divergir aqui não dá erro: dá um motorista pagando R$ 149 com teto de 10,
// descoberto na primeira fatura.
checar(
  'as faixas são as mesmas, na mesma ordem',
  planosNoApp.map((p) => `${p.id}:${p.ate}:${p.preco}`),
  planosNoServidor.map((p) => `${p.id}:${p.ate}:${p.preco}`)
);
// A antecipação (50% fixo em qualquer dia do teste) virou a ESCADA em
// 07/09/2026, e o espelhamento dela está no bloco 10.
checar('o contrato dura 12 meses nos dois lados', 12, mesesNoServidor);

bloco('9. Quem ainda merece o desconto de antecipação');

const agora = dia('2026-09-15');
// QUEM NUNCA RODOU UMA ROTA conta como dentro do teste: o relógio dele nem
// começou, e recusar o desconto puniria justamente quem decidiu antes de
// precisar.
checar('sem trialInicio, está dentro', true, dentroDoTrial(null, agora));
checar('no primeiro dia, dentro', true, dentroDoTrial(dia('2026-09-15'), agora));
checar('no octogésimo nono dia, ainda dentro', true, dentroDoTrial(dia('2026-06-18'), agora));
// 90 dias corridos a partir de 17/06 fecham em 15/09 — o dia 90 já é fora.
checar('no nonagésimo, acabou', false, dentroDoTrial(dia('2026-06-17'), agora));
checar('muito depois, fora', false, dentroDoTrial(dia('2026-01-01'), agora));

bloco('10. A ESCADA DE FECHAMENTO nos dois lados');

// ⚠️ A ESCADA É A SEGUNDA COISA ESPELHADA, depois da tabela de faixas — e é a
// que mais dói se divergir. A tela ANUNCIA um degrau (`planos.js`, com o
// relógio do aparelho) e o servidor GRAVA um (`contratacao.js`, com o dele).
// Divergir aqui é o motorista lendo 50% e recebendo uma fatura de 30%, com um
// contrato assinado no meio.
checar(
  'os três degraus, na mesma ordem e com a mesma fração',
  escadaNoApp.map((e) => `${e.degrau}:${e.fracao}`),
  escadaNoServidor.map((e) => `${e.degrau}:${e.fracao}`)
);
checar('e o retorno também', retornoNoApp.fracao, retornoNoServidor.fracao);
checar('com o mesmo prazo', retornoNoApp.prazoDias, retornoNoServidor.prazoDias);
checar('e o mesmo rótulo de degrau', retornoNoApp.degrau, retornoNoServidor.degrau);

// A escada DESCE nos dois lados. Um degrau posterior valendo mais inverteria o
// incentivo inteiro, e é um erro de digitação de distância.
checar(
  'ela desce no servidor',
  true,
  escadaNoServidor.every((e, i) => i === 0 || e.fracao < escadaNoServidor[i - 1].fracao)
);

bloco('10b. E as duas contas de DEGRAU concordam, dia por dia');

// ⚠️ SÃO DUAS IMPLEMENTAÇÕES DA MESMA CONTA, e isso é deliberado: a do app é
// para MOSTRAR (relógio do aparelho), a do servidor é para GRAVAR. A régua de
// tempo mora em `trial.js`, a fração em `planos.js`, e a autoridade em
// `contratacao.js` — três arquivos, uma resposta, e este bloco é o que prova.
//
// O laço vai até 125 para cobrir os três degraus, a janela de retorno (90–119)
// e o nada que vem depois.
const base = new Date(2026, 5, 1, 12);
let degrausIguais = true;
let fracoesIguais = true;
for (let d = 0; d <= 125; d += 1) {
  const agoraD = new Date(base.getTime() + d * 86400000);
  const noApp = degrauNoApp({ inicio: base, agora: agoraD });
  const noSrv = degrauNoServidor(base, agoraD);
  if (JSON.stringify(noApp) !== JSON.stringify(noSrv)) degrausIguais = false;
  if (descontoDoFechamento(noApp) !== descontoDoDegrau(noSrv)) fracoesIguais = false;
}
checar('o degrau é o mesmo em todos os 126 dias', true, degrausIguais);
checar('e a fração também', true, fracoesIguais);

// Os pontos de virada, nomeados — o laço acima pega a divergência, estes dizem
// QUAL é a régua, e é isso que alguém confere ao mudá-la.
const emDia = (n) => degrauNoServidor(base, new Date(base.getTime() + n * 86400000));
checar('dia 0 é o primeiro degrau', 1, emDia(0));
checar('dia 29 ainda é o primeiro', 1, emDia(29));
checar('dia 30 vira o segundo', 2, emDia(30));
checar('dia 60 vira o terceiro', 3, emDia(60));
checar('dia 89 é o último dia do terceiro', 3, emDia(89));
checar('dia 90 já é retorno', 'retorno', emDia(90));
checar('dia 119 é o último do retorno', 'retorno', emDia(119));
checar('dia 120 não tem mais degrau', null, emDia(120));
// ⚠️ SEM `trialInicio` O DEGRAU É 1 nos dois lados: quem nunca rodou uma rota
// não gastou um dia do teste, e é o mais antecipado de todos.
checar('sem trialInicio, degrau 1 no servidor', 1, degrauNoServidor(null, agora));
checar('e no app também', 1, degrauNoApp({ inicio: null, agora }));

bloco('11. Até quando o desconto vale');

// INCLUSIVE O MÊS ATUAL: 12 meses a partir de setembro terminam em AGOSTO do
// ano seguinte, não em setembro. Um mês a mais por acidente de aritmética é o
// tipo de erro que ninguém confere — e era meia mensalidade extra por
// associado, silenciosa, crescendo com a base.
const setembro = new Date(2026, 8, 15, 12);
checar('1 mês cobre só o mês corrente', '2026-09', mesDaquiContrato(1, setembro));
checar('2 meses cobrem este e o próximo', '2026-10', mesDaquiContrato(2, setembro));
checar('12 meses viram o ano', '2027-08', mesDaquiContrato(12, setembro));

bloco('12. `mesDaqui` — houve DUAS cópias, e elas divergiam em um mês inteiro');

// ⚠️ SOBROU UMA, e é por isso que este bloco encurtou. A segunda vivia em
// `premioDeConversao.js`, apagado em 07/09/2026 junto com a roleta. As duas
// tinham semânticas diferentes: a da contratação somava os meses sem o `-1`,
// então "12 meses" durava TREZE.
//
// Os casos abaixo ficam porque a ARMADILHA continua — ela é do `setMonth`, não
// da cópia —, e quem escrever a próxima função de prazo precisa vê-los.
const jan31 = new Date(2027, 0, 31, 12);
checar('12 meses a partir de setembro terminam em agosto', '2027-08', mesDaquiContrato(12, setembro));

// ⚠️ `setMonth` PRESERVA O DIA, e 31 não existe em todo mês. Contratar em
// 31/01 com "2 meses" produzia 31/02 → 03/03: TRÊS meses de desconto por dois.
checar('31 de janeiro + 2 meses não vaza para março', '2027-02', mesDaquiContrato(2, jan31));
checar('31 de março + 12 meses não vaza', '2028-02', mesDaquiContrato(12, new Date(2027, 2, 31, 12)));
// 12 meses INCLUSIVOS a partir de fevereiro de 2028 terminam em janeiro de
// 2029 — fev/28 é o primeiro dos doze. (Escrevi '2029-02' na primeira versão
// deste caso; o teste estava errado, não o código.)
checar('29 de fevereiro bissexto não vaza', '2029-01', mesDaquiContrato(12, new Date(2028, 1, 29, 12)));

bloco('13. Contratar destrava a conta');

// ⚠️ O BECO SEM SAÍDA: `contratarPlano` gravava `planoId` e não `assinaturaAte`
// — e é só esse campo que `estadoDaConta` e `isAdmin()` consultam. O motorista
// contratava, aceitava o contrato, voltava ao painel e via a MESMA tela
// dizendo pra contratar. Depois de ter decidido pagar.
const emSetembro = cobertoAteOMesSeguinte(setembro);
checar('contratar cobre até o fim do mês seguinte', '2026-10-31',
  `${emSetembro.getFullYear()}-${String(emSetembro.getMonth() + 1).padStart(2, '0')}-${String(emSetembro.getDate()).padStart(2, '0')}`);
// Meio-dia: as functions rodam em UTC, e a data a 00:00 volta um dia no Brasil.
checar('e nasce ao meio-dia, não à meia-noite', 12, emSetembro.getHours());
// Dezembro precisa virar o ano — o caso que um cálculo ingênuo erra.
const emDezembro = cobertoAteOMesSeguinte(new Date(2026, 11, 15, 12));
checar('dezembro cobre até o fim de janeiro', 2027, emDezembro.getFullYear());
checar('e o mês é janeiro', 1, emDezembro.getMonth() + 1);

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
