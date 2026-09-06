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

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
