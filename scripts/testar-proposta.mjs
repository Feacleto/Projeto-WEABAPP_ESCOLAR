/**
 * A PROPOSTA — a mensagem que o dono manda para cada degrau.
 *
 * POR QUE ESTE TESTE
 * Mensagem errada não dá erro: ela é enviada, lida por uma pessoa, e o estrago
 * é de relação. Oferecer desconto de conversão a quem nem cadastrou a turma
 * soa como cobrança antes da entrega; perguntar "precisa de ajuda pra começar?"
 * a quem roda há dois meses soa como quem não olhou nada.
 *
 * E tem o caso que custa dinheiro: escrever um preço para quem está ACIMA da
 * tabela. Ali não há preço de prateleira, e um número na mensagem vira âncora
 * abaixo do que a conversa produziria.
 *
 * COMO RODAR
 *   node scripts/testar-proposta.mjs      (ou: npm run testar:proposta)
 */

import { mensagemDeProposta, linkDaProposta } from '../src/dominio/associacao/proposta.js';
import { PLANO, descontoDoFechamento, precoDaTabela, precoDoMes } from '../src/dominio/associacao/planos.js';
import { FUNDADOR } from '../src/dominio/associacao/planos.js';

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

const NINO = { name: 'Nino Silva Santos', phone: '11988887777', criancasAtivas: 14 };
const contaDe = (criancas, extra = {}) =>
  precoDoMes({ criancas, plano: PLANO.MENSAL, mes: '2026-09', ...extra });

// ───────────────────────────── os quatro degraus ───────────────────────────

bloco('1. Cada degrau tem a sua mensagem');

const naoComecou = mensagemDeProposta({ motorista: NINO, degrau: 'nao_comecou' });
checar('quem não rodou recebe ajuda, não preço', 'Ajudar a começar', naoComecou.assunto);
// PREÇO AQUI SOA COMO COBRANÇA ANTES DA ENTREGA: o relógio do teste dele nem
// começou, então o valor é de uma coisa que ainda não existe para ele.
checar('e a mensagem não fala em R$', false, naoComecou.texto.includes('R$'));
// E ela diz a coisa que tira a pressa — que é justamente o que trava quem
// criou conta e não voltou.
checar('mas diz que o relógio não começou', true, naoComecou.texto.includes('primeira rota'));

const emTeste = mensagemDeProposta({
  motorista: NINO,
  degrau: 'em_teste',
  conta: contaDe(14),
  diasRestantes: 5,
});
checar('quem está em teste recebe a proposta', 'Propor contratação', emTeste.assunto);
checar('com o prazo dele', true, emTeste.texto.includes('5 dias'));
checar('e o preço da faixa dele', true, emTeste.texto.includes('R$ 82,60'));
// ⚠️ A OFERTA É A DO DEGRAU DELE, NÃO UM NÚMERO FIXO.
//
// Faltando 5 dias, ele está no TERCEIRO degrau — 10%, não os 30% do primeiro
// mês. A mensagem antiga dizia sempre o degrau 1, e o dono a leria, mandaria, e o
// servidor gravaria outra coisa: o motorista veria um número no WhatsApp e outro na
// fatura. A proposta nunca inventa preço, e agora também não inventa desconto.
checar('e a oferta é a do TERCEIRO degrau', true, emTeste.texto.includes('10%'));
checar('e NÃO a do primeiro', false, emTeste.texto.includes('30%'));

// O degrau anda com o prazo. Estes três casos são a régua vista de fora.
const noDegrau = (dias) =>
  mensagemDeProposta({
    motorista: NINO,
    degrau: 'em_teste',
    conta: contaDe(14),
    diasRestantes: dias,
  }).texto;
checar('faltando 90 dias, primeiro degrau', true, noDegrau(90).includes('30%'));
checar('faltando 61, ainda o primeiro', true, noDegrau(61).includes('30%'));
checar('faltando 60, o segundo', true, noDegrau(60).includes('20%'));
checar('faltando 31, ainda o segundo', true, noDegrau(31).includes('20%'));
checar('faltando 30, o terceiro', true, noDegrau(30).includes('10%'));
checar('faltando 1, ainda o terceiro', true, noDegrau(1).includes('10%'));
// Sem prazo conhecido, o degrau é o primeiro — quem não rodou rota não gastou
// um dia do teste. Mesma escolha de `degrauDaDecisao`.
checar('sem prazo, o primeiro degrau', true, noDegrau(null).includes('30%'));
checar('e a régua bate com planos.js', 0.1, descontoDoFechamento(3));

const bloqueado = mensagemDeProposta({ motorista: NINO, degrau: 'bloqueado' });
checar('quem parou recebe resgate', 'Chamar de volta', bloqueado.assunto);
// ⚠️ O RESGATE NÃO PROMETE DESCONTO. Quem concede é o dono, com motivo e
// prazo, na folha de concessão. Prometer aqui e não conceder depois é pior que
// não ter falado.
checar('e ele NÃO promete desconto', false, bloqueado.texto.includes('%'));
// O que ele promete é o que é verdade e resolve o medo real de quem foi
// bloqueado: os dados continuam lá.
checar('promete que nada foi perdido', true, bloqueado.texto.includes('continuam lá'));

const ativo = mensagemDeProposta({ motorista: NINO, degrau: 'contratado' });
checar('quem está pagando recebe pedido de indicação', 'Pedir indicação', ativo.assunto);

bloco('2. O nome é o primeiro, e a conversa é de pessoa pra pessoa');

checar('só o primeiro nome', true, ativo.texto.startsWith('Oi Nino!'));
checar('sem nome não quebra', true, mensagemDeProposta({ degrau: 'contratado' }).texto.startsWith('Oi '));

bloco('3. Toda operação recebe número, inclusive a muito grande');

// ⚠️ ESTE BLOCO TESTAVA O OPOSTO ATÉ 10/09/2026.
// Com preço por faixa, quem passava de 40 crianças não tinha preço de tabela e a
// proposta mandava "a gente conversa" — o maior associado da base era o único
// que recebia uma mensagem sem valor, e tinha que perguntar.
//
// Com preço linear isso deixou de existir: 60 crianças têm preço tanto quanto 6.
// O que continua valendo é a regra de sempre — a proposta nunca INVENTA preço,
// todo número sai de `precoDaTabela` ou de `precoDoMes`.
const grande = { ...NINO, criancasAtivas: 60 };
const acima = mensagemDeProposta({
  motorista: grande,
  degrau: 'em_teste',
  conta: precoDoMes({ criancas: 60, plano: PLANO.MENSAL, mes: '2026-09' }),
  diasRestantes: 3,
});
checar('o assunto é o mesmo de todo mundo', 'Propor contratação', acima.assunto);
checar('e o valor aparece', true, acima.texto.includes('R$'));
checar('ninguém mais é mandado conversar', false, acima.texto.includes('passou da'));
// A taxa marginal acima da 40ª entra no número, e ele bate com a régua.
const cheio60 = precoDaTabela({ criancas: 60, plano: PLANO.MENSAL });
checar('o número é o da régua, com a marginal', true, acima.texto.includes(String(cheio60).replace('.', ',')));

bloco('4. Os descontos dele entram no número');

const comDesconto = mensagemDeProposta({
  motorista: NINO,
  degrau: 'em_teste',
  conta: contaDe(14, { fundador: FUNDADOR.METADE }),
  diasRestantes: 10,
});
checar('mostra a tabela e o preço dele', true, comDesconto.texto.includes('R$ 41,30'));
checar('e a tabela continua visível', true, comDesconto.texto.includes('R$ 82,60'));
// Sem desconto, repetir o mesmo número duas vezes na mesma frase confunde.
checar(
  'sem desconto, o preço aparece uma vez só',
  1,
  (emTeste.texto.match(/R\$ 82,60/g) || []).length
);

bloco('5. Plural e prazo');

checar('uma criança, singular', true,
  mensagemDeProposta({ motorista: { ...NINO, criancasAtivas: 1 }, degrau: 'bloqueado' })
    .texto.includes('1 criança,'));
checar('um dia, singular', true,
  mensagemDeProposta({ motorista: NINO, degrau: 'em_teste', conta: contaDe(20), diasRestantes: 1 })
    .texto.includes('em 1 dia'));
// Sem prazo conhecido a frase não pode virar "termina em null dias".
checar('sem prazo, a frase se ajusta', true,
  mensagemDeProposta({ motorista: NINO, degrau: 'em_teste', conta: contaDe(20) })
    .texto.includes('está acabando'));

// ───────────────────────────── o link ──────────────────────────────────────

bloco('6. O link do WhatsApp');

const link = linkDaProposta('11988887777', 'oi tudo bem');
checar('põe o DDI do Brasil', true, link.startsWith('https://wa.me/5511988887777'));
checar('e o texto vai codificado', true, link.includes('oi%20tudo%20bem'));
checar('telefone já com DDI não duplica', true,
  linkDaProposta('5511988887777', 'x').startsWith('https://wa.me/5511988887777'));
checar('pontuação não atrapalha', true,
  linkDaProposta('(11) 98888-7777', 'x').startsWith('https://wa.me/5511988887777'));

// SEM TELEFONE, SEM LINK. Quem chama esconde o botão — botão que abre uma
// conversa vazia faz a pessoa achar que o app travou.
checar('telefone curto não vira link', null, linkDaProposta('1198', 'x'));
checar('vazio idem', null, linkDaProposta('', 'x'));
checar('nulo idem', null, linkDaProposta(null, 'x'));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
