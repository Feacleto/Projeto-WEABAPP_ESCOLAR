/**
 * O CONTEÚDO DO CONTRATO DE ASSOCIAÇÃO — o documento que o motorista assina.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Este contrato já saiu com valor ZERO duas vezes, por duas causas diferentes,
 * e as duas vezes ele foi hasheado com SHA-256 e aceito eletronicamente. Um
 * documento assinado dizendo que o associado não deve nada.
 *
 * As duas vinham de aritmética de COMBINAÇÃO: percentual sobre base de
 * crianças, vezes periodicidade, menos carência. Cinco números negociáveis se
 * cruzando, e cada cruzamento um caminho que ninguém tinha percorrido.
 *
 * O MODELO NEGOCIADO MORREU EM 06/09/2026, e com ele as duas causas. Hoje o
 * contrato sai de uma FAIXA de tabela, doze meses para todo mundo, cobrança
 * mensal. Este arquivo mudou junto — mas continua existindo pela mesma razão:
 * o número que vai para o hash não pode nascer de código sem teste.
 *
 * O QUE ELE PROTEGE AGORA são os dois novos jeitos de errar:
 *   - desconto SEM PRAZO, que vira preço para sempre;
 *   - o contrato apontando para a régua da casa em vez de congelar o combinado.
 *
 * COMO RODAR
 *   node scripts/testar-contrato.mjs      (ou: npm run testar:contrato)
 */

import {
  VERSAO_CONTRATO,
  JANELA_DE_RENOVACAO,
  montarContrato,
  diasParaVencer,
  precisaRenovar,
} from '../src/dominio/associacao/contratoAssociacao.js';
import {
  FUNDADOR,
  ORIGEM,
  PISO_DA_FATURA,
  PLANOS,
  centavos,
  planoPorId,
} from '../src/dominio/associacao/planos.js';

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

const MOTORISTA = {
  uid: 'tio1',
  name: 'Nino Silva',
  city: 'São Paulo',
  email: 'nino@exemplo.com',
  phone: '11988887777',
};

/** Meio-dia: em 00:00 qualquer fuso de uma hora rouba um dia. */
const dia = (iso) => new Date(`${iso}T12:00:00`);
const HOJE = dia('2026-09-15');

const montar = (extra = {}) =>
  montarContrato({
    motorista: MOTORISTA,
    plano: planoPorId('ate25'),
    diaVencimento: 10,
    agora: HOJE,
    ...extra,
  });

// ───────────────────────── o contrato de tabela ────────────────────────────

bloco('1. O contrato sai de uma FAIXA, não de uma negociação');

const base = montar();

checar('a faixa contratada viaja no documento', 'ate25', base.plano.id);
checar('e o rótulo dela também', 'De 11 a 25 crianças', base.plano.rotulo);
// O TETO É A ÚNICA COISA QUE O PLANO CAPA. Não existe Básico/Pro, e é essa a
// cláusula que o associado precisa poder cobrar de volta.
checar('o teto de crianças é cláusula', 25, base.plano.teto);
checar('o preço de tabela fica registrado', 149, base.plano.precoTabela);
checar('sem desconto, paga a tabela', 149, base.valores.valorMensal);
checar('a cobrança é mensal', 'mensal', base.valores.periodicidade);

bloco('2. Doze meses para todo mundo — não há periodicidade a escolher');

checar('a vigência é de doze meses', 12, base.vigenciaMeses);
checar('e a data de fim confere', '2027-09-15', base.vigenciaFim.slice(0, 10));
checar('começa hoje', '2026-09-15', base.vigenciaInicio.slice(0, 10));

// ───────────────────────────── os descontos ────────────────────────────────

bloco('3. Desconto entra com a data em que acaba');

const fecha1 = { origem: ORIGEM.FECHAMENTO, fracao: 0.5, ate: '2027-09', degrau: 1 };
const comAntecipacao = montar({ descontos: [fecha1] });

checar('metade da conta', 74.5, comAntecipacao.valores.valorMensal);
checar('e a fração fica registrada', 0.5, comAntecipacao.valores.descontoFechamento);
// O DEGRAU VIAJA NO DOCUMENTO. A fração sozinha não distingue 15% de
// fechamento de 15% de concessão, e são espécies diferentes: uma é régua, a
// outra é exceção com dono e motivo.
checar('e o degrau também', 1, comAntecipacao.valores.descontos[0].degrau);

// ⚠️ O LEGADO `antecipacao` PRODUZ O MESMO CONTRATO. É o mesmo instrumento com
// o nome antigo; ignorá-lo faria a fatura de quem já o tem subir em silêncio, e
// o contrato dele deixaria de explicar o valor.
const legado = { origem: ORIGEM.ANTECIPACAO, fracao: 0.5, ate: '2027-09' };
checar(
  'antecipação antiga vale como fechamento',
  74.5,
  montar({ descontos: [legado] }).valores.valorMensal
);
checar(
  'e aparece na linha de fechamento',
  0.5,
  montar({ descontos: [legado] }).valores.descontoFechamento
);
// ESTA É A LINHA QUE IMPEDE O DESCONTO DE VIRAR PREÇO. Sem a data dentro do
// contrato, o desconto de conversão passa a ser a tabela daquele associado —
// e a receita prevista deixa de bater com a real sem ninguém apontar quando.
checar('a validade viaja junto', '2027-09', comAntecipacao.valores.descontos[0].ate);
checar('sem desconto, a lista é vazia e não nula', [], base.valores.descontos);

bloco('4. Fundador e fechamento não somam — vale o maior');

// Somando, um fundador de metade chegaria a 100% e a partir dali a INDICAÇÃO
// valeria zero justamente para quem mais indica.
const fundadorAntecipado = montar({ fundador: FUNDADOR.METADE, descontos: [fecha1] });
checar('metade + metade continua metade', 0.5, fundadorAntecipado.valores.descontoTotal);
checar('e o valor é o mesmo de quem só antecipou', 74.5, fundadorAntecipado.valores.valorMensal);

// O vitalício não é rebaixado pela regra do maior.
checar(
  'o vitalício continua não pagando',
  0,
  montar({ fundador: FUNDADOR.VITALICIO, descontos: [fecha1] }).valores.valorMensal
);

bloco('5. A conta nunca vira crédito — e agora nunca vira migalha');

const tudo = montar({
  fundador: FUNDADOR.METADE,
  indicacoesAtivas: 5,
  descontos: [fecha1],
});
checar('as fontes de desconto param em 100%', 1, tudo.valores.descontoTotal);
// ⚠️ ANTES ISTO ERA ZERO, e era o vazamento: um contrato assinado dizendo que
// o associado não deve nada. O piso é o que o fecha.
checar('e o mensal para no PISO, não em zero', PISO_DA_FATURA, tudo.valores.valorMensal);
checar('o contrato registra que o piso mordeu', true, tudo.valores.pisoAplicado);
checar('e quanto ele absorveu', 34, tudo.valores.descontoAbsorvido);

// ⚠️ A CLÁUSULA DO PISO VAI SEMPRE, aplicada ou não. Uma cláusula que só
// aparece quando pesa contra o associado é uma cláusula que ele descobre na
// fatura.
checar('o piso é cláusula mesmo sem morder', PISO_DA_FATURA, base.valores.pisoDaFatura);
checar('e sem morder, nada foi absorvido', false, base.valores.pisoAplicado);
checar('nem em reais', 0, base.valores.descontoAbsorvido);

// O vitalício escapa do piso: é 100% sem prazo, contratado quando o produto
// não tinha nenhum caso de uso.
checar(
  'o vitalício não é alcançado pelo piso',
  0,
  montar({ fundador: FUNDADOR.VITALICIO, indicacoesAtivas: 5 }).valores.valorMensal
);

bloco('6. Isenção não é desconto de 100%');

// As duas chegam a zero e contam histórias diferentes: uma produz fatura de
// R$ 0, a outra diz que aquele mês não tem fatura. Confundir as duas apaga o
// registro do que foi concedido.
const comIsencao = montar({ isencaoAte: '2026-11' });
checar('os meses sem taxa ficam no contrato', '2026-11', comIsencao.valores.isencaoAte);
checar('e o valor mensal continua sendo o de tabela', 149, comIsencao.valores.valorMensal);
checar('sem prêmio, não há isenção', null, base.valores.isencaoAte);

// ──────────────────────────── o vencimento ─────────────────────────────────

bloco('7. O dia de vencimento respeita o teto de 28');

// Dia 30 não existe em todo mês, e "o último dia" muda de número quatro vezes
// por ano. Uma fatura de fevereiro nasceria sem data.
checar('dia 31 vira 28', 28, montar({ diaVencimento: 31 }).valores.diaVencimento);
checar('dia 0 vira 1', 1, montar({ diaVencimento: 0 }).valores.diaVencimento);
checar('dia válido passa', 5, montar({ diaVencimento: 5 }).valores.diaVencimento);
checar('lixo cai no padrão da casa', 10, montar({ diaVencimento: 'qualquer' }).valores.diaVencimento);

// O CONTRATO DIZ O DIA, e não aponta pra régua. Um documento que dissesse
// "vence no dia que a plataforma escolher" não prometeria nada.
checar('o dia está DENTRO do documento', true, typeof base.valores.diaVencimento === 'number');

// ────────────────────────── vigência e renovação ───────────────────────────

bloco('8. A janela de renovação');

const emitido = { conteudo: base };
checar('faltam 365 dias no dia da emissão', 365, diasParaVencer(emitido, HOJE));
checar('não precisa renovar ainda', false, precisaRenovar(emitido, JANELA_DE_RENOVACAO, HOJE));
checar(
  'a 30 dias do fim, precisa',
  true,
  precisaRenovar(emitido, JANELA_DE_RENOVACAO, dia('2027-08-20'))
);
// Vencer NÃO suspende: cortar por vencimento de papel bloquearia quem está
// pagando em dia. Suspensão continua sendo coisa de inadimplência.
checar('vencido dá dias negativos, e só', -16, diasParaVencer(emitido, dia('2027-10-01')));
checar('contrato sem conteúdo não quebra', null, diasParaVencer(null, HOJE));

// ────────────────────────── o hash e a estabilidade ────────────────────────

bloco('9. O documento é estável — é ele que vira hash');

// Duas montagens com a MESMA entrada precisam dar o mesmo objeto, byte a byte.
// Se algo aqui dependesse do relógio, o hash mudaria entre a tela que a pessoa
// leu e o registro do que ela aceitou.
checar('mesma entrada, mesmo documento', JSON.stringify(base), JSON.stringify(montar()));

checar('a versão é a 4 — a escada e o piso', 4, VERSAO_CONTRATO);
checar('e ela viaja no documento', 4, base.versao);

// A contratada e o associado são identificados: contrato sem parte é papel.
checar('o associado é identificado', 'tio1', base.associado.uid);
checar('a contratada tem CNPJ', true, Boolean(base.contratada.cnpj));

bloco('10. Acima da tabela é conversa, não zero');

// Aplicar desconto sobre um preço inexistente produziria R$ 0 —
// indistinguível de "não paga" — e é exatamente o caso em que alguém precisa
// conversar.
const acima = montar({ plano: null });
checar('sem faixa, não há valor mensal', null, acima.valores.valorMensal);
checar('nem preço de tabela', null, acima.plano.precoTabela);
checar('nem teto', null, acima.plano.teto);

checar('a régua tem três faixas', 3, PLANOS.length);

// ═══════ A INVARIANTE QUE PEGA O DESCONTO INVISÍVEL ════════════════════════

bloco('11. As linhas do contrato fecham com o total');

/**
 * ⚠️ ESTE BLOCO NASCEU DE UM BUG REAL, e o bug era meu.
 *
 * A concessão (06/09/2026) entrou em `users.descontos`, então `valorMensal` e
 * `descontoTotal` já a levavam em conta — mas nenhuma LINHA do contrato a
 * explicava, porque `montarContrato` não copiava `descontoConcessao`.
 *
 * O documento saía se contradizendo: um valor mensal que a soma das linhas não
 * conseguia justificar. Num contrato assinado com hash e data, isso não é um
 * detalhe de tela.
 *
 * O teste certo não é "a concessão aparece" — esse pega UM caso. É a soma
 * fechar, e essa invariante pega o PRÓXIMO desconto que alguém inventar e
 * esquecer de listar.
 */
const somaDasLinhas = (v) =>
  // Fundador e fechamento não somam entre si — vale o maior (ver
  // FUNDADOR_E_FECHAMENTO_SOMAM). O resto soma.
  Math.min(
    1,
    Math.max(v.descontoFundador || 0, v.descontoFechamento || 0) +
      (v.descontoIndicacao || 0) +
      (v.descontoConcessao || 0)
  );

const conferirSoma = (nome, contrato) =>
  checar(nome, contrato.valores.descontoTotal, somaDasLinhas(contrato.valores));

// ═══════ A SEGUNDA INVARIANTE: O VALOR SE EXPLICA PELAS LINHAS ═════════════
//
// ⚠️ A soma das FRAÇÕES fechar não basta mais, e é o piso que abriu esse
// buraco. Um contrato pode dizer "desconto total: 100%" e "valor mensal:
// R$ 34" — as frações somam certo, e o documento continua se contradizendo,
// porque nada liga uma coisa à outra.
//
// Esta invariante fecha o elo: o valor mensal precisa ser o preço de tabela
// menos o desconto total, MAIS o que o piso absorveu. Se alguém acrescentar
// uma trava nova (um teto por faixa, um mínimo por criança) sem registrá-la no
// documento, é aqui que aparece.
const valorSeExplica = (nome, c) => {
  const v = c.valores;
  if (v.valorMensal == null) return checar(nome, null, v.valorMensal);
  const esperado = centavos(
    centavos(c.plano.precoTabela * (1 - v.descontoTotal)) + (v.descontoAbsorvido || 0)
  );
  return checar(nome, esperado, v.valorMensal);
};

valorSeExplica('sem desconto', base);
valorSeExplica('com fechamento', comAntecipacao);
valorSeExplica('com o piso mordendo', tudo);
valorSeExplica('fundador com fechamento', fundadorAntecipado);
valorSeExplica('acima da tabela', montar({ plano: null }));
valorSeExplica('vitalício, que escapa do piso', montar({ fundador: FUNDADOR.VITALICIO }));

conferirSoma('sem desconto nenhum', base);
conferirSoma('só fechamento', comAntecipacao);
conferirSoma('fundador com fechamento', fundadorAntecipado);

const concessao = { origem: ORIGEM.CONCESSAO, fracao: 0.3, ate: '2027-02' };
const comConcessao = montar({ descontos: [concessao] });
// Era ESTE o caso que faltava: o valor descia e nenhuma linha dizia por quê.
checar('a concessão desce o valor', 104.3, comConcessao.valores.valorMensal);
checar('e o contrato a LISTA', 0.3, comConcessao.valores.descontoConcessao);
conferirSoma('só concessão', comConcessao);

conferirSoma('concessão sobre fundador', montar({
  fundador: FUNDADOR.METADE,
  descontos: [concessao],
}));
conferirSoma('tudo junto', montar({
  fundador: FUNDADOR.METADE,
  indicacoesAtivas: 2,
  descontos: [concessao, fecha1],
}));

// E a data da concessão viaja junto, como a das outras — é ela que o
// ContratoDoc imprime ao lado da linha.
checar('a validade da concessão está no contrato', '2027-02',
  comConcessao.valores.descontos.find((d) => d.origem === ORIGEM.CONCESSAO)?.ate);

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
