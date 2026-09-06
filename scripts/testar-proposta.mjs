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
import { ANTECIPACAO, planoPorId, precoDoMes } from '../src/dominio/associacao/planos.js';
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
const contaDe = (planoId, extra = {}) =>
  precoDoMes({ plano: planoPorId(planoId), mes: '2026-09', ...extra });

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
  conta: contaDe('ate25'),
  diasRestantes: 5,
});
checar('quem está em teste recebe a proposta', 'Propor contratação', emTeste.assunto);
checar('com o prazo dele', true, emTeste.texto.includes('5 dias'));
checar('e o preço da faixa dele', true, emTeste.texto.includes('R$ 149,00'));
checar('e a oferta de antecipação', true, emTeste.texto.includes(`${Math.round(ANTECIPACAO.fracao * 100)}%`));

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

bloco('3. Acima da tabela não recebe número');

// Aplicar um preço de prateleira a quem tem 60 crianças vira âncora abaixo do
// que qualquer conversa produziria. `precoDoMes` já devolve 'conversa'.
const grande = { ...NINO, criancasAtivas: 60 };
const acima = mensagemDeProposta({
  motorista: grande,
  degrau: 'em_teste',
  conta: precoDoMes({ plano: null, mes: '2026-09' }),
  diasRestantes: 3,
});
checar('o assunto muda', 'Falar sobre o plano', acima.assunto);
checar('e nenhum valor aparece', false, acima.texto.includes('R$'));
checar('mas diz que passou da tabela', true, acima.texto.includes('passou da'));

bloco('4. Os descontos dele entram no número');

const comDesconto = mensagemDeProposta({
  motorista: NINO,
  degrau: 'em_teste',
  conta: contaDe('ate25', { fundador: FUNDADOR.METADE }),
  diasRestantes: 10,
});
checar('mostra a tabela e o preço dele', true, comDesconto.texto.includes('R$ 74,50'));
checar('e a tabela continua visível', true, comDesconto.texto.includes('R$ 149,00'));
// Sem desconto, repetir o mesmo número duas vezes na mesma frase confunde.
checar(
  'sem desconto, o preço aparece uma vez só',
  1,
  (emTeste.texto.match(/R\$ 149,00/g) || []).length
);

bloco('5. Plural e prazo');

checar('uma criança, singular', true,
  mensagemDeProposta({ motorista: { ...NINO, criancasAtivas: 1 }, degrau: 'bloqueado' })
    .texto.includes('1 criança,'));
checar('um dia, singular', true,
  mensagemDeProposta({ motorista: NINO, degrau: 'em_teste', conta: contaDe('ate25'), diasRestantes: 1 })
    .texto.includes('em 1 dia'));
// Sem prazo conhecido a frase não pode virar "termina em null dias".
checar('sem prazo, a frase se ajusta', true,
  mensagemDeProposta({ motorista: NINO, degrau: 'em_teste', conta: contaDe('ate25') })
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
