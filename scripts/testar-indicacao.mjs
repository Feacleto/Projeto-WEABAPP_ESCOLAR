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

import { readdirSync, readFileSync } from 'node:fs';
import { sep } from 'node:path';
import { PLANO as PLANOS_DO_PRECO, precoDoMes } from '../src/dominio/associacao/planos.js';
import {
  ESTADO,
  acharIndicacao,
  chaveDoTelefone,
  contarAtivas,
  mesmaPessoa,
  montarIndicacao,
  podeTransitar,
  reconciliarIndicacoes,
  resumoDoIndicador,
  situacaoDaIndicacao,
  escolherParaAtivar,
  validarIndicacao,
} from '../src/dominio/identidade/indicacao.js';
// A CÓPIA DO SERVIDOR, importada com outro nome para poder ser comparada.
// O deploy das functions não alcança `src/`, então a duplicação é obrigatória
// — o que este arquivo garante é que ela não divirja.
import {
  chaveDoTelefone as chaveServidor,
  contarAtivas as contarServidor,
  escolherParaAtivar as escolherServidor,
  escolherParaCadastrar,
  reconciliarIndicacoes as reconciliarServidor,
} from '../functions/lib/indicacao.js';

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
checar('e a tela mostra os quatro estados',
  { total: 5, pendentes: 2, cadastrados: 1, ativas: 2, encerradas: 0 },
  resumoDoIndicador(carteira));
checar('lista vazia não quebra',
  { total: 0, pendentes: 0, cadastrados: 0, ativas: 0, encerradas: 0 }, resumoDoIndicador());

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

// ═══════════ A ESCOLHA, E O ESPELHO DO SERVIDOR ══════════════════════════
//
// ⚠️ POR QUE ESTE BLOCO EXISTE
//
// `casarEAtivar` vivia só no cliente, chamada depois da baixa MANUAL da
// fatura. A regra do produto é que a indicação vale quando o indicado PAGA — e
// "pagar" passou a ter dois caminhos quando o gateway entrou.
//
// Sem uma cópia no servidor, ligar o gateway apagaria o gatilho da indicação
// para 100% dos indicadores, EM SILÊNCIO. Ninguém receberia erro; o desconto
// simplesmente não apareceria na fatura seguinte, e a queixa que isso produz
// — "indiquei e não recebi" — viaja mais rápido que a própria indicação.
//
// A cópia é obrigatória (o deploy das functions não alcança `src/`), então o
// que este bloco garante é que ela não DIVERGE. Caso por caso, não por
// leitura: é a mesma proteção que `testar:gateway` dá à régua de preço.
console.log('');
console.log('A ESCOLHA DA INDICAÇÃO — e a cópia do servidor');

const CHAVE = '11987654321';
const linha = (id, estado, extra) => ({ id, estado, ...extra });

// ── as duas regras de ordem ──────────────────────────────────────────────
// 1. ENTRE PENDENTES, VALE QUEM INDICOU PRIMEIRO. Premiar os dois pagaria 20%
//    por um cliente; premiar o último premiaria quem chegou depois de o
//    trabalho estar feito.
const duasPendentes = [
  linha('depois', ESTADO.PENDENTE, { chave: CHAVE, indicadorUid: 'x', em: 200 }),
  linha('antes', ESTADO.PENDENTE, { chave: CHAVE, indicadorUid: 'y', em: 100 }),
];
checar(
  'entre pendentes ganha quem indicou primeiro',
  'antes',
  escolherParaAtivar({ indicacoes: duasPendentes, indicadoUid: 'novo', chave: CHAVE })?.id
);

// 2. UMA JÁ CASADA COM ESTE UID GANHA DE QUALQUER PENDENTE — mesmo sendo mais
//    recente. Ela já foi resolvida antes; reabrir a disputa entregaria o
//    crédito a quem apenas indicou mais cedo.
const casadaEPendente = [
  linha('pendente-antiga', ESTADO.PENDENTE, { chave: CHAVE, indicadorUid: 'x', em: 10 }),
  linha('casada-nova', ESTADO.CADASTRADO, { indicadoUid: 'novo', indicadorUid: 'y', em: 900 }),
];
checar(
  'uma ja casada ganha de qualquer pendente',
  'casada-nova',
  escolherParaAtivar({ indicacoes: casadaEPendente, indicadoUid: 'novo', chave: CHAVE })?.id
);

// ── o que fica de fora ───────────────────────────────────────────────────
// JÁ ATIVA não é escolhida: reativar contaria a mesma indicação duas vezes, e
// é o erro que aparece quando o webhook e a baixa manual quitam a mesma
// fatura.
checar(
  'quem ja esta ativa fica fora',
  undefined,
  escolherParaAtivar({
    indicacoes: [linha('ja', ESTADO.ATIVA, { chave: CHAVE, indicadorUid: 'x', em: 1 })],
    indicadoUid: 'novo',
    chave: CHAVE,
  })?.id
);
// AUTO-INDICAÇÃO é barrada aqui também — último ponto antes de o desconto
// virar dinheiro. As rules não sabem comparar telefone.
checar(
  'auto-indicacao e barrada',
  null,
  escolherParaAtivar({
    indicacoes: [linha('eu', ESTADO.PENDENTE, { chave: CHAVE, indicadorUid: 'novo', em: 1 })],
    indicadoUid: 'novo',
    chave: CHAVE,
  })
);
checar('sem chave nao escolhe nada', null,
  escolherParaAtivar({ indicacoes: duasPendentes, indicadoUid: 'novo', chave: null }));
checar('sem uid do indicado nao escolhe nada', null,
  escolherParaAtivar({ indicacoes: duasPendentes, indicadoUid: null, chave: CHAVE }));
checar('lista vazia nao quebra', null,
  escolherParaAtivar({ indicacoes: [], indicadoUid: 'novo', chave: CHAVE }));

// ── AS DUAS CÓPIAS DECIDEM IGUAL ─────────────────────────────────────────
//
// Não é "leia e confie": é o mesmo caso passado nas duas funções, com o
// resultado comparado. Divergência aqui é fatura errada.
const CASOS = [
  { nome: 'duas pendentes', indicacoes: duasPendentes, indicadoUid: 'novo', chave: CHAVE },
  { nome: 'casada x pendente', indicacoes: casadaEPendente, indicadoUid: 'novo', chave: CHAVE },
  { nome: 'auto-indicacao', indicacoes: [linha('eu', ESTADO.PENDENTE, { chave: CHAVE, indicadorUid: 'novo', em: 1 })], indicadoUid: 'novo', chave: CHAVE },
  { nome: 'ja ativa', indicacoes: [linha('ja', ESTADO.ATIVA, { chave: CHAVE, indicadorUid: 'x', em: 1 })], indicadoUid: 'novo', chave: CHAVE },
  { nome: 'chave de outro', indicacoes: duasPendentes, indicadoUid: 'novo', chave: '11900000000' },
  { nome: 'vazia', indicacoes: [], indicadoUid: 'novo', chave: CHAVE },
  { nome: 'em como Date', indicacoes: [linha('d', ESTADO.PENDENTE, { chave: CHAVE, indicadorUid: 'x', em: new Date(5) })], indicadoUid: 'novo', chave: CHAVE },
];
for (const c of CASOS) {
  checar(
    `cliente e servidor escolhem igual: ${c.nome}`,
    escolherParaAtivar(c)?.id ?? null,
    escolherServidor(c)?.id ?? null
  );
}

// E A CHAVE DO TELEFONE TAMBÉM — é ela que decide SE alguém é o indicado.
// Divergir aqui faz a indicação simplesmente não ser encontrada.
const TELEFONES = [
  '(11) 98765-4321', '11987654321', '(11) 8765-4321', '011 98765-4321',
  '+55 11 98765-4321', '055 11 98765-4321', '(11) 3456-7890', '11 3456-7890',
  '', null, 'abc', '119', '5511987654321',
];
checar(
  'chaveDoTelefone: as duas copias concordam em todos os formatos',
  TELEFONES.map(chaveDoTelefone),
  TELEFONES.map(chaveServidor)
);
// Sonda positiva: se as duas quebrassem juntas, a comparação passaria verde.
checar('e a chave do celular tem o nono digito', '11987654321', chaveDoTelefone('(11) 8765-4321'));
checar('fixo NAO ganha o nono digito', '1134567890', chaveDoTelefone('(11) 3456-7890'));

// `contarAtivas` fecha o trio: é ela que produz o número que a fatura cobra.
const MISTURA = [
  linha('a', ESTADO.ATIVA, {}), linha('b', ESTADO.PENDENTE, {}),
  linha('c', ESTADO.ATIVA, {}), linha('d', ESTADO.CADASTRADO, {}),
];
checar('contarAtivas: as duas copias concordam', contarAtivas(MISTURA), contarServidor(MISTURA));
checar('e o numero e dois', 2, contarAtivas(MISTURA));


// ═══════════ A RECONCILIAÇÃO — O DESCONTO QUE PRECISA CAIR ════════════════
//
// ⚠️ POR QUE ESTE BLOCO EXISTE
//
// `users.indicacoesAtivas` só era escrito PARA CIMA. `casarEAtivar` reconta,
// mas só quando OUTRA indicação do mesmo indicador ativa — e nenhum caminho do
// projeto baixava o número quando o indicado cancelava. O desconto sobrevivia
// ao cliente que o justificava.
//
// Enquanto se cogitou dar prazo de 12 meses à indicação, o calendário
// resolveria isso de lado. A decisão foi NÃO ter prazo, e a partir dela esta
// função é a régua inteira. Por isso ela nasce com espelho e com teste.

const rec = (indicacoes, pagantes) =>
  reconciliarIndicacoes({ indicacoes, indicadosPagantes: pagantes });

const COM_INDICADO = (id, indicador, indicado, estado) => ({
  id,
  indicadorUid: indicador,
  indicadoUid: indicado,
  estado,
});

const CARTEIRA = [
  COM_INDICADO('a', 'ze', 'u1', ESTADO.ATIVA),
  COM_INDICADO('b', 'ze', 'u2', ESTADO.ATIVA),
  COM_INDICADO('c', 'ana', 'u3', ESTADO.ENCERRADA),
  COM_INDICADO('d', 'ana', null, ESTADO.PENDENTE),
];

const r1 = rec(CARTEIRA, ['u1', 'u3']);
checar('quem parou de pagar e encerrado', ['b'], r1.encerrar);
checar('e quem voltou e reaberto', ['c'], r1.reabrir);
checar('o indicador com uma ativa conta 1', 1, r1.ativasPorIndicador.ze);
checar('e a reaberta ja conta no mesmo passo', 1, r1.ativasPorIndicador.ana);

// ⚠️ O CASO QUE FAZ TODO O RESTO FUNCIONAR: quem perdeu a ULTIMA indicacao
// precisa aparecer com ZERO. Se a contagem so trouxesse as chaves que
// sobraram, o gravador nunca aprenderia a zerar ninguem — e o contador ficaria
// parado no valor antigo, que e exatamente o bug que esta funcao veio fechar.
const r2 = rec([COM_INDICADO('a', 'ze', 'u1', ESTADO.ATIVA)], []);
checar('quem perdeu a ultima indicacao aparece com zero', 0, r2.ativasPorIndicador.ze);
checar('e o indicador NAO some da contagem', true, 'ze' in r2.ativasPorIndicador);

// Rodar de novo chega no mesmo lugar: o dono pode fechar o mes a mao no mesmo
// dia em que a agendada rodou. Mesma razao de `casarEAtivar` recontar.
const jaAplicado = [
  COM_INDICADO('a', 'ze', 'u1', ESTADO.ATIVA),
  COM_INDICADO('b', 'ze', 'u2', ESTADO.ENCERRADA),
];
const r3 = rec(jaAplicado, ['u1']);
checar('idempotente: nada a encerrar na segunda passada', [], r3.encerrar);
checar('idempotente: nada a reabrir tambem', [], r3.reabrir);
checar('e a contagem se mantem', 1, r3.ativasPorIndicador.ze);

// Uma `ativa` sem `indicadoUid` e documento malformado. Ela CONTINUA contando:
// mante-la e um vazamento pequeno; encerra-la tira um desconto prometido de
// alguem por causa de um campo que o sistema deixou de gravar.
const orfa = [{ id: 'x', indicadorUid: 'ze', estado: ESTADO.ATIVA }];
checar('ativa sem indicado nao e encerrada', [], rec(orfa, []).encerrar);
checar('e continua contando', 1, rec(orfa, []).ativasPorIndicador.ze);

// A transicao existe nos dois sentidos, e so nos dois sentidos.
checar('ativa pode encerrar', true, podeTransitar(ESTADO.ATIVA, ESTADO.ENCERRADA));
checar('encerrada pode voltar a valer', true, podeTransitar(ESTADO.ENCERRADA, ESTADO.ATIVA));
checar('pendente NAO pula para encerrada', false, podeTransitar(ESTADO.PENDENTE, ESTADO.ENCERRADA));
checar('e encerrada nao volta para pendente', false, podeTransitar(ESTADO.ENCERRADA, ESTADO.PENDENTE));

// ⚠️ O ESPELHO, caso a caso — a mesma exigencia de `escolherParaAtivar`.
const CENARIOS_REC = [
  [CARTEIRA, ['u1', 'u3']],
  [CARTEIRA, []],
  [CARTEIRA, ['u1', 'u2', 'u3']],
  [jaAplicado, ['u1']],
  [jaAplicado, ['u1', 'u2']],
  [orfa, []],
  [[], ['u1']],
];
CENARIOS_REC.forEach(([lista, pagantes], i) => {
  const aqui = reconciliarIndicacoes({ indicacoes: lista, indicadosPagantes: pagantes });
  const la = reconciliarServidor({ indicacoes: lista, indicadosPagantes: pagantes });
  checar(`espelho da reconciliacao, caso ${i + 1}`, JSON.stringify(aqui), JSON.stringify(la));
});
// Sonda positiva: sem ela, duas funcoes quebradas do mesmo jeito passariam.
checar('e a comparacao tem conteudo', 'b',
  reconciliarServidor({ indicacoes: CARTEIRA, indicadosPagantes: ['u1', 'u3'] }).encerrar[0]);


// ═══════════ O QUE A INDICAÇÃO NÃO FAZ ═══════════════════════════════════
//
// Os dois casos abaixo travam decisões que a próxima boa ideia vai querer
// desfazer. Nenhum deles testa código novo: eles testam que uma porta
// continua fechada.

const PLANO_MENSAL = PLANOS_DO_PRECO.MENSAL;

// ── 1. O INDICADO NÃO GANHA DESCONTO POR TER SIDO INDICADO ────────────────
//
// ⚠️ A REGRA VEM DA FILA DO PORTÃO, e é a mais antiga deste projeto: dois
// motoristas que se cadastram no mesmo dia não podem pagar diferente por um
// motivo que nenhum dos dois controla. A escada qualquer um reproduz — é só
// decidir cedo. "Ter sido indicado" é sorte de quem você conhece, e é a
// conversa que não tem resposta quando os dois comparam a fatura.
//
// O indicado já leva o MAIOR desconto da casa (o primeiro degrau, por fechar
// no primeiro mês). O convite diz isso; a régua não acrescenta nada.
//
// O teste é comportamental: um desconto com origem inventada tem que ser
// IGNORADO, não somado. `descontosVigentes` já descarta o que não reconhece —
// e é justamente esse silêncio que faria alguém "só acrescentar uma origem"
// sem perceber que mudou a política de preço.
const comoIndicado = precoDoMes({
  criancas: 20,
  plano: PLANO_MENSAL,
  descontos: [{ origem: 'indicado', fracao: 0.1, ate: null }],
  mes: '2026-09',
});
const semNada = precoDoMes({ criancas: 20, plano: PLANO_MENSAL, mes: '2026-09' });
checar('ser indicado nao muda o preco de quem foi indicado',
  semNada.liquido, comoIndicado.liquido);
checar('e a origem inventada nao entra em desconto nenhum', 0, comoIndicado.desconto);
// Sonda positiva: uma origem RECONHECIDA desce o valor, entao a comparacao
// acima nao esta passando por o preco ser sempre igual.
checar('mas uma origem da regua desce mesmo',
  true,
  precoDoMes({
    criancas: 20,
    plano: PLANO_MENSAL,
    descontos: [{ origem: 'fechamento', fracao: 0.3, ate: null }],
    mes: '2026-09',
  }).liquido < semNada.liquido);

// ── 2. ONDE O CONVITE A INDICAR NUNCA APARECE ─────────────────────────────
//
// ⚠️ QUATRO LUGARES, E CADA UM POR UM MOTIVO DIFERENTE:
//
//   app da familia   ela nao indica motorista; o convite ali e ruido sobre
//                    dado sensivel de crianca
//   durante a rota   ele esta dirigindo com crianca dentro
//   cancelamento     desconto que so aparece quando ele ameaca sair prova
//                    que o preco era teatro. ⚠️ A TELA NASCEU EM 11/09/2026
//                    (`src/pages/tio/TioEncerrar.jsx`) e a cerca ja a cobre —
//                    este comentario dizia "ainda vai nascer" e virou falso no
//                    dia em que ela nasceu. O caso nomeado, logo abaixo, existe
//                    para que a regra nao dependa de a varredura estar certa.
//   sino nos 90 dias colide com a escada, que tem data; a indicacao nao tem
//
// A lista de PERMITIDOS e fechada de proposito. Um lugar novo e uma decisao
// de produto, e ela passa por aqui antes de passar pela tela.
const PERMITIDOS = [
  'src/pages/tio/TioPlanos.jsx',
  'src/pages/tio/TioTaxa.jsx',
  'src/pages/tio/TioSelo.jsx',
  'src/pages/tio/TioContratoAssociacao.jsx',
];

const arquivos = readdirSync('src', { recursive: true })
  // `sep` em vez de uma barra invertida literal: o teste roda no Windows de
  // quem desenvolve e no Linux do CI, e a comparação com a lista de
  // permitidos é por texto.
  .map((f) => `src/${String(f).split(sep).join('/')}`)
  .filter((f) => /\.(jsx?|mjs)$/.test(f));

/**
 * ⚠️ A CERCA OLHA O CÓDIGO, NUNCA OS COMENTÁRIOS — e isso custou um teste
 * vermelho antes de ser escrito assim.
 *
 * `OfertaDoFechamento` explica no cabeçalho POR QUE o convite não entra ali:
 * a folha é a escada, e "sino nos 90 dias colide com a escada, que tem data;
 * a indicação não tem" é justamente a linha desta lista. O comentário citava
 * o nome do componente para poder explicar a ausência dele — e a varredura
 * acusava o arquivo por isso.
 *
 * É a mesma lição que `testar-horarios` já tinha aprendido no tour: comentário
 * que conta a história tem que poder nomear o que ficou de fora; código que
 * fala com o motorista, não.
 */
const NL = String.fromCharCode(10);
function semComentarios(fonte) {
  return fonte
    .split(NL)
    .filter((linha) => {
      const t = linha.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join(NL);
}

const usam = arquivos.filter((f) => {
  if (f.endsWith('components/tio/ConviteParaIndicar.jsx')) return false;
  try {
    return semComentarios(readFileSync(f, 'utf8')).includes('ConviteParaIndicar');
  } catch {
    return false;
  }
});

// ⚠️ SONDA DO DESCOMENTADOR: sem ela, um `semComentarios` que apagasse o
// arquivo inteiro faria a cerca passar SEMPRE — e a lista de permitidos
// viraria decoração. Esta linha é código de verdade num dos quatro.
checar(
  'o descomentador nao apaga o codigo (sonda positiva)',
  true,
  semComentarios(readFileSync(PERMITIDOS[0], 'utf8')).includes('ConviteParaIndicar')
);

// ⚠️ O CASO NOMEADO DA TELA DE ENCERRAR.
//
// A varredura acima ja pegaria isto — mas ela passa por AUSENCIA, e ausencia
// tambem e o que acontece quando o arquivo nao existe mais, muda de nome ou
// nunca foi lido. Aqui a tela e apontada pelo nome: ou ela existe e esta
// limpa, ou o teste fala. E o lugar em que a tentacao de vender e maior —
// quem esta saindo e exatamente quem um desconto de ultima hora seguraria.
const TELA_DE_SAIR = 'src/pages/tio/TioEncerrar.jsx';
checar('a tela de encerrar existe', true, arquivos.includes(TELA_DE_SAIR));
checar(
  'e ela nao oferece desconto de indicacao para segurar quem esta saindo',
  false,
  semComentarios(readFileSync(TELA_DE_SAIR, 'utf8')).includes('ConviteParaIndicar')
);

checar('o convite aparece exatamente nos quatro lugares decididos',
  PERMITIDOS.slice().sort(), usam.slice().sort());
// Sonda positiva: se a varredura nao achasse nada, a comparacao acima ficaria
// verde no dia em que alguem apagasse o componente inteiro.
checar('e a varredura realmente leu os arquivos', true, arquivos.length > 50);


// ═══════════ O CASAMENTO NO CADASTRO — O FIM DOS QUATRO MESES DE SILÊNCIO ══
//
// `ESTADO.CADASTRADO` existia no domínio, tinha frase pronta, era contado no
// resumo e renderizado nas duas telas — e NADA o gravava. A indicação ia de
// `pendente` direto a `ativa`, na baixa da primeira fatura do indicado.
//
// O dinheiro estava certo; o buraco era de feedback, e durava o teste inteiro
// do indicado mais um mês. Quatro meses vendo "ainda não se cadastrou" depois
// de o colega já ter entrado é onde ele para de acreditar.

bloco('O casamento no cadastro — quem ganha a marca, e quem não ganha');

const EM = (n) => new Date(2026, 0, n, 12, 0, 0);
const pend = (id, indicador, chave, dia) => ({
  id,
  indicadorUid: indicador,
  chave,
  estado: ESTADO.PENDENTE,
  em: EM(dia),
});

const CHAVE_NOVA = '11987654321';

// ⚠️ VALE QUEM INDICOU PRIMEIRO — a mesma ordem de `escolherParaAtivar`.
// Marcar o segundo aqui e o primeiro na baixa faria a tela de um deles contar
// uma história que o dinheiro depois desmente.
const DISPUTA = [
  pend('tarde', 'ze', CHAVE_NOVA, 10),
  pend('cedo', 'ana', CHAVE_NOVA, 2),
];
checar('vale quem indicou primeiro', 'cedo',
  escolherParaCadastrar(DISPUTA, { indicadoUid: 'novo', chave: CHAVE_NOVA })?.id);

// ⚠️ A AUTO-INDICAÇÃO É BARRADA AQUI TAMBÉM. `validarIndicacao` já barra na
// criação, mas as rules não sabem comparar telefone — e este é o segundo
// ponto em que o mesmo uid poderia aparecer dos dois lados.
checar('ninguém casa com a própria indicação', null,
  escolherParaCadastrar([pend('a', 'novo', CHAVE_NOVA, 1)],
    { indicadoUid: 'novo', chave: CHAVE_NOVA }));

checar('telefone que ninguém indicou não casa', null,
  escolherParaCadastrar(DISPUTA, { indicadoUid: 'novo', chave: '11900000000' }));
checar('sem chave não casa', null,
  escolherParaCadastrar(DISPUTA, { indicadoUid: 'novo', chave: null }));
checar('sem uid não casa', null,
  escolherParaCadastrar(DISPUTA, { indicadoUid: null, chave: CHAVE_NOVA }));
checar('lista vazia não quebra', null,
  escolherParaCadastrar([], { indicadoUid: 'novo', chave: CHAVE_NOVA }));

// Quem já passou de `pendente` não volta: uma indicação ATIVA não é remarcada
// como cadastrada, e uma ENCERRADA não ressuscita por um cadastro novo.
checar('indicação já ativa não é remarcada', null,
  escolherParaCadastrar(
    [{ ...pend('a', 'ze', CHAVE_NOVA, 1), estado: ESTADO.ATIVA }],
    { indicadoUid: 'novo', chave: CHAVE_NOVA }
  ));
checar('nem uma encerrada', null,
  escolherParaCadastrar(
    [{ ...pend('a', 'ze', CHAVE_NOVA, 1), estado: ESTADO.ENCERRADA }],
    { indicadoUid: 'novo', chave: CHAVE_NOVA }
  ));

// ⚠️ E O ESTADO NOVO NÃO ATIVA DESCONTO NENHUM — a carência continua sendo o
// primeiro mês PAGO. Sem isto, cinco cadastros de teste dariam desconto real
// sobre receita que nunca entrou.
checar('cadastrado não conta como ativa', 0,
  contarAtivas([{ ...pend('a', 'ze', CHAVE_NOVA, 1), estado: ESTADO.CADASTRADO }]));
checar('e a transição pendente → cadastrado continua valendo', true,
  podeTransitar(ESTADO.PENDENTE, ESTADO.CADASTRADO));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
