/**
 * A INDICAÇÃO — quem trouxe quem, e quando isso vira desconto.
 *
 * POR QUE ESTE TESTE VEM ANTES DE QUALQUER TELA
 * As duas falhas possíveis produzem a MESMA queixa — *"indiquei e não
 * recebi"* — e numa rede de indicação a reclamação viaja mais rápido que a
 * indicação:
 *
 *   NORMALIZAÇÃO: a mesma pessoa é `(11) 98765-4321`, `11987654321`,
 *   `+55 11 98765-4321` e `(11) 8765-4321` — o número antigo, sem o nono
 *   dígito, que muita gente ainda dita de cabeça. Comparar texto perde a
 *   indicação, e quem perde é quem trouxe cliente.
 *
 *   AUTO-INDICAÇÃO: ele indica o próprio número com outra máscara e leva 10%
 *   por não ter feito nada. Cinco vezes e a conta zera.
 *
 * COMO RODAR
 *   node scripts/testar-indicacao.mjs      (ou: npm run testar:indicacao)
 */

import {
  ESTADO,
  acharIndicacao,
  chaveDoTelefone,
  contarAtivas,
  mesmaPessoa,
  montarIndicacao,
  podeTransitar,
  resumoDoIndicador,
  situacaoDaIndicacao,
  validarIndicacao,
} from '../src/dominio/identidade/indicacao.js';

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

// ═════════════════ 1. A NORMALIZAÇÃO DO TELEFONE ═══════════════════════════

bloco('1. As quatro formas do mesmo celular');

const ESPERADO = '11987654321';
checar('só dígitos', ESPERADO, chaveDoTelefone('11987654321'));
checar('com máscara', ESPERADO, chaveDoTelefone('(11) 98765-4321'));
checar('com DDI', ESPERADO, chaveDoTelefone('+55 11 98765-4321'));
checar('com DDI colado', ESPERADO, chaveDoTelefone('5511987654321'));
checar('com zero de operadora antes do DDI', ESPERADO, chaveDoTelefone('055 11 98765-4321'));
checar('com espaços e traços à vontade', ESPERADO, chaveDoTelefone(' 11 - 9 8765 4321 '));

// ⚠️ ESTE É O TRAIÇOEIRO. Muita gente ainda dita o número de oito dígitos, e é
// a mesma pessoa. Comparar texto perderia a indicação em silêncio.
bloco('2. O nono dígito');

checar('celular antigo ganha o 9', ESPERADO, chaveDoTelefone('(11) 8765-4321'));
checar('e é a MESMA pessoa', true, mesmaPessoa('(11) 8765-4321', '11987654321'));
checar('começando em 7 também', '11976543210', chaveDoTelefone('(11) 7654-3210'));
checar('começando em 6 também', '11965432100', chaveDoTelefone('(11) 6543-2100'));

// ⚠️ FIXO NÃO GANHA O NONO DÍGITO. Acrescentá-lo criaria um número que não
// existe — e faria dois fixos diferentes colidirem numa chave inventada.
checar('fixo em 3 fica como está', '1133334444', chaveDoTelefone('(11) 3333-4444'));
checar('fixo em 2 fica como está', '1122223333', chaveDoTelefone('(11) 2222-3333'));
checar('fixo não vira celular', false, mesmaPessoa('(11) 3333-4444', '11933334444'));

bloco('3. O que não é telefone');

checar('curto demais', null, chaveDoTelefone('98765'));
checar('vazio', null, chaveDoTelefone(''));
checar('nulo', null, chaveDoTelefone(null));
checar('só letras', null, chaveDoTelefone('não tenho'));
// Dois inválidos NÃO são "a mesma pessoa" — senão todo campo em branco casaria
// com todo campo em branco, e a primeira indicação vazia levaria o desconto.
checar('dois vazios não são a mesma pessoa', false, mesmaPessoa('', ''));

// ═════════════════ 2. A AUTO-INDICAÇÃO ═════════════════════════════════════

bloco('4. Ninguém indica a si mesmo');

const eu = { uid: 'tio1', name: 'Nino', phone: '(11) 98765-4321' };

checar('indicar outro passa', true,
  validarIndicacao({ indicador: eu, telefone: '(11) 91111-2222' }).ok);

// ⚠️ COM OUTRA MÁSCARA CONTINUA SENDO ELE. É o caso que a comparação de texto
// deixaria passar — e são 10% por não ter feito nada.
checar('o próprio número, digitado igual', false,
  validarIndicacao({ indicador: eu, telefone: '(11) 98765-4321' }).ok);
checar('o próprio número, sem máscara', false,
  validarIndicacao({ indicador: eu, telefone: '11987654321' }).ok);
checar('o próprio número, com DDI', false,
  validarIndicacao({ indicador: eu, telefone: '+55 11 98765-4321' }).ok);
checar('o próprio número, no formato antigo', false,
  validarIndicacao({ indicador: eu, telefone: '(11) 8765-4321' }).ok);
checar('e o erro diz o que é', true,
  validarIndicacao({ indicador: eu, telefone: '11987654321' }).erro.includes('seu próprio'));

bloco('5. Nem duas vezes a mesma pessoa');

// Contaria em dobro por uma pessoa só.
const jaIndicados = ['(11) 91111-2222'];
checar('repetir o mesmo número', false,
  validarIndicacao({ indicador: eu, telefone: '11911112222', jaIndicados }).ok);
checar('repetir com outra máscara também', false,
  validarIndicacao({ indicador: eu, telefone: '(11) 9 1111-2222', jaIndicados }).ok);
checar('outro número passa', true,
  validarIndicacao({ indicador: eu, telefone: '(21) 93333-4444', jaIndicados }).ok);

bloco('6. E sem os dados não vira indicação');

checar('telefone inválido', false, validarIndicacao({ indicador: eu, telefone: '123' }).ok);
checar('sem indicador', false, validarIndicacao({ telefone: '11911112222' }).ok);
checar('entrada vazia', false, validarIndicacao().ok);

// ═════════════════ 3. O REGISTRO ═══════════════════════════════════════════

bloco('7. O registro guarda a chave, e o que ele digitou');

const AGORA = new Date('2026-09-15T12:00:00');
const ind = montarIndicacao({
  indicador: eu, telefone: '(11) 8765-0000', nome: 'Zé da Van', agora: AGORA,
});
checar('a chave é normalizada', '11987650000', ind.chave);
// O TEXTO DIGITADO VAI JUNTO: mostrar `11987650000` para quem digitou
// `(11) 8765-0000` faz ele achar que indicou outra pessoa.
checar('e o digitado é preservado', '(11) 8765-0000', ind.telefoneDigitado);
checar('nasce pendente', ESTADO.PENDENTE, ind.estado);
checar('com quem indicou', 'tio1', ind.indicadorUid);

let barrou = false;
try {
  montarIndicacao({ indicador: eu, telefone: '11987654321' });
} catch {
  barrou = true;
}
checar('auto-indicação não vira registro', true, barrou);

// ═════════════════ 4. A CARÊNCIA ═══════════════════════════════════════════

bloco('8. O desconto entra quando o indicado PAGA');

// ⚠️ SEM A CARÊNCIA, CINCO CADASTROS DE TESTE DARIAM 50% DE DESCONTO REAL
// sobre receita que nunca entrou.
checar('pendente vira cadastrado', true,
  podeTransitar(ESTADO.PENDENTE, ESTADO.CADASTRADO));
checar('cadastrado vira ativa', true,
  podeTransitar(ESTADO.CADASTRADO, ESTADO.ATIVA));
// Pular a etapa do meio é pular a carência inteira.
checar('mas pendente NÃO vira ativa', false,
  podeTransitar(ESTADO.PENDENTE, ESTADO.ATIVA));
checar('e ativa não volta', false, podeTransitar(ESTADO.ATIVA, ESTADO.CADASTRADO));
checar('nem se ativa de novo', false, podeTransitar(ESTADO.ATIVA, ESTADO.ATIVA));

bloco('9. A conta que vale é a das ativas');

const carteira = [
  { chave: 'a', estado: ESTADO.ATIVA },
  { chave: 'b', estado: ESTADO.ATIVA },
  { chave: 'c', estado: ESTADO.CADASTRADO },
  { chave: 'd', estado: ESTADO.PENDENTE },
  { chave: 'e', estado: ESTADO.PENDENTE },
];
checar('duas valem desconto', 2, contarAtivas(carteira));

// ⚠️ OS TRÊS NÚMEROS SÃO SEPARADOS DE PROPÓSITO. "Indiquei 5" e "2 valem
// desconto" são frases diferentes — juntá-las é exatamente como nasce o
// "indiquei e não recebi".
checar('e a tela mostra os três estados',
  { total: 5, pendentes: 2, cadastrados: 1, ativas: 2 },
  resumoDoIndicador(carteira));
checar('lista vazia não quebra',
  { total: 0, pendentes: 0, cadastrados: 0, ativas: 0 }, resumoDoIndicador());

bloco('10. A frase diz o que FALTA');

// "Cadastrado" sozinho parece que já deu certo, e o desconto não veio.
checar('cadastrado diz o que falta', true,
  situacaoDaIndicacao({ estado: ESTADO.CADASTRADO }).includes('pagar o primeiro mês'));
checar('ativa diz que está valendo', true,
  situacaoDaIndicacao({ estado: ESTADO.ATIVA }).includes('valendo'));
checar('pendente diz que não se cadastrou', true,
  situacaoDaIndicacao({}).includes('não se cadastrou'));

bloco('11. O cadastro do indicado encontra quem o indicou');

const pendentes = [
  { chave: '11987650000', estado: ESTADO.PENDENTE, indicadorUid: 'tio1' },
  { chave: '21933334444', estado: ESTADO.ATIVA, indicadorUid: 'tio2' },
];
// Ele digita o número DELE, na forma que ele usa — e a chave é que casa.
checar('acha pelo número antigo', 'tio1',
  acharIndicacao(pendentes, '(11) 8765-0000')?.indicadorUid);
checar('acha com DDI', 'tio1', acharIndicacao(pendentes, '+5511987650000')?.indicadorUid);
// Já ativa não é achada de novo: contaria duas vezes.
checar('já ativa não é reaproveitada', null, acharIndicacao(pendentes, '21933334444'));
checar('quem ninguém indicou não acha nada', null,
  acharIndicacao(pendentes, '(31) 95555-6666'));
checar('telefone inválido não acha nada', null, acharIndicacao(pendentes, 'abc'));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
