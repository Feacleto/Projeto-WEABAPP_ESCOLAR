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
// A identidade da plataforma e os documentos que a citam. Os três têm que ler
// a mesma fonte — ver o bloco no fim deste arquivo.
import {
  DEV_CIDADE_UF,
  DEV_CNPJ,
  DEV_COMARCA,
  DEV_ENDERECO,
  DEV_NAME,
} from '../src/config/developer.js';
import {
  COMPANY_INFO,
  CONTROLADOR_POR_EXTENSO,
  TERMS_SECTIONS,
} from '../src/pages/legal/legalContent.js';
import {
  FUNDADOR,
  ORIGEM,
  PISO_DA_FATURA,
  PLANO,
  PLANOS_DISPONIVEIS,
  centavos,
  precoDaTabela,
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
    plano: PLANO.MENSAL,
    criancas: 20,
    diaVencimento: 10,
    agora: HOJE,
    ...extra,
  });

// ───────────────────────── o contrato de tabela ────────────────────────────

bloco('1. O contrato declara uma TAXA, não um valor');

const base = montar();

checar('o plano contratado viaja no documento', 'mensal', base.plano.id);
checar('e o rótulo dele também', 'Mensal', base.plano.rotulo);

// ⚠️ A CLÁUSULA É A TAXA, E É ISSO QUE ELIMINA A REASSINATURA POR CRESCIMENTO.
// Na versão 4 o contrato congelava o preço da FAIXA, então ganhar uma criança
// que cruzasse a fronteira exigia documento novo e aceite novo — burocracia no
// exato momento em que ele acabara de fechar um cliente.
checar('a taxa por criança é cláusula', 5.9, base.plano.taxaPorCrianca);
checar('a marginal acima da 40ª também', 4.9, base.plano.taxaAcimaDe40);
checar('e o mínimo mensal também', 49, base.plano.minimoMensal);
checar('a virada da taxa é na 40ª', 40, base.plano.criancasNaTaxaCheia);

// ⚠️ O TAMANHO E O VALOR SÃO EXEMPLO, NÃO ACORDO. A fatura acompanha a
// operação; um documento que apresentasse este número como o preço contratado
// se contradiria na primeira criança nova.
checar('o tamanho da operação na assinatura fica registrado', 20, base.plano.criancasNaAssinatura);
checar('e a conta que ele produz hoje', 118, base.plano.precoTabela);
checar('sem desconto, paga a taxa vezes o tamanho', 118, base.valores.valorMensal);
checar('a cobrança é mensal', 'mensal', base.valores.periodicidade);

// ⚠️ NÃO EXISTE MAIS TETO DE CRIANÇAS, e o campo não pode voltar nem como
// `null`: teto nulo se lê como "sem limite acordado" em vez de "não há teto
// neste modelo". Nada trava quando a operação cresce.
checar('o contrato não fala em teto de crianças', undefined, base.plano.teto);

// O anual é o mesmo documento com outra taxa.
const anual = montar({ plano: PLANO.ANUAL });
checar('o anual declara a própria taxa', 2.9, anual.plano.taxaPorCrianca);
checar('e o próprio mínimo', 29, anual.plano.minimoMensal);
checar('vinte crianças no anual custam R$ 58', 58, anual.valores.valorMensal);

bloco('2. Doze meses para todo mundo — não há periodicidade a escolher');

checar('a vigência é de doze meses', 12, base.vigenciaMeses);
checar('e a data de fim confere', '2027-09-15', base.vigenciaFim.slice(0, 10));
checar('começa hoje', '2026-09-15', base.vigenciaInicio.slice(0, 10));

// ───────────────────────────── os descontos ────────────────────────────────

bloco('3. Desconto entra com a data em que acaba');

// ⚠️ `ate: null` É O VITALÍCIO, e ele é o caso NORMAL do fechamento desde
// 10/09/2026. O contrato precisa saber registrar um desconto sem data — a
// versão 4 só sabia registrar prazo, porque prazo era tudo o que existia.
const fecha1 = { origem: ORIGEM.FECHAMENTO, fracao: 0.3, ate: null, degrau: 1 };
const comAntecipacao = montar({ descontos: [fecha1] });

checar('trinta por cento da conta', 82.6, comAntecipacao.valores.valorMensal);
checar('e a fração fica registrada', 0.3, comAntecipacao.valores.descontoFechamento);
checar('o documento registra que ele não expira', null, comAntecipacao.valores.descontos[0].ate);
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
  59,
  montar({ descontos: [legado] }).valores.valorMensal
);
checar(
  'e aparece na linha de fechamento',
  0.5,
  montar({ descontos: [legado] }).valores.descontoFechamento
);
// ⚠️ QUANDO HÁ PRAZO, ELE VIAJA JUNTO — e continua sendo o que impede um
// desconto COM data de virar preço por omissão. O que mudou em 10/09/2026 é
// que o fechamento deixou de ter data (ver o bloco 3): a linha abaixo passou a
// ser exercitada pelo LEGADO e pela CONCESSÃO, que seguem tendo prazo.
checar(
  'a validade viaja junto quando existe',
  '2027-09',
  montar({ descontos: [legado] }).valores.descontos[0].ate
);
checar('sem desconto, a lista é vazia e não nula', [], base.valores.descontos);

bloco('4. Fundador e fechamento não somam — vale o maior');

// Somando, um fundador de metade chegaria a 100% e a partir dali a INDICAÇÃO
// valeria zero justamente para quem mais indica.
const fundadorAntecipado = montar({ fundador: FUNDADOR.METADE, descontos: [fecha1] });
// Metade (fundador) contra 30% (fechamento): vale o maior, que é a metade.
checar('vale o maior dos dois, não a soma', 0.5, fundadorAntecipado.valores.descontoTotal);
checar('e o valor é o do fundador', 59, fundadorAntecipado.valores.valorMensal);

// O vitalício não é rebaixado pela regra do maior.
checar(
  'o vitalício continua não pagando',
  0,
  montar({ fundador: FUNDADOR.VITALICIO, descontos: [fecha1] }).valores.valorMensal
);

bloco('5. A conta nunca vira crédito — e agora nunca vira migalha');

// ⚠️ ERAM 5 INDICAÇÕES, e viraram 10 quando a taxa caiu de 10% para 5%. O que
// este bloco prova não é o número, é que existe um caminho até 100% nominais
// que NÃO passa pelo fundador vitalício — e que o piso o segura.
const tudo = montar({
  fundador: FUNDADOR.METADE,
  indicacoesAtivas: 10,
  descontos: [fecha1],
});
checar('as fontes de desconto param em 100%', 1, tudo.valores.descontoTotal);
// ⚠️ ANTES ISTO ERA ZERO, e era o vazamento: um contrato assinado dizendo que
// o associado não deve nada. O piso é o que o fecha.
checar('e o mensal para no PISO, não em zero', PISO_DA_FATURA, tudo.valores.valorMensal);
checar('o contrato registra que o piso mordeu', true, tudo.valores.pisoAplicado);
checar('e quanto ele absorveu', 19, tudo.valores.descontoAbsorvido);

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
checar('e o valor mensal continua sendo o de tabela', 118, comIsencao.valores.valorMensal);
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

// A 5 trouxe a taxa por criança, o desconto vitalício e a saída assimétrica —
// o associado encerra na hora, a plataforma mantém 30 dias de aviso.
checar('a versão é a 5', 5, VERSAO_CONTRATO);
checar('e ela viaja no documento', 5, base.versao);

// A contratada e o associado são identificados: contrato sem parte é papel.
checar('o associado é identificado', 'tio1', base.associado.uid);
checar('a contratada tem CNPJ', true, Boolean(base.contratada.cnpj));

bloco('10. Plano desconhecido é recusa, não zero');

// Aplicar desconto sobre um preço inexistente produziria R$ 0 —
// indistinguível de "não paga" — e é exatamente o caso em que alguém precisa
// conversar.
const acima = montar({ plano: 'trimestral' });
checar('sem plano válido, não há valor mensal', null, acima.valores.valorMensal);
checar('nem preço de tabela', null, acima.plano.precoTabela);
checar('nem taxa por criança', null, acima.plano.taxaPorCrianca);
checar('e o id não é inventado', null, acima.plano.id);

checar('há dois planos, e só dois', 2, PLANOS_DISPONIVEIS.length);

// ⚠️ NÃO HÁ MAIS "ACIMA DA TABELA". Com preço linear toda operação tem preço,
// de três a trezentas crianças — o caso que exigia conversa deixou de existir,
// e com ele a única porta pela qual um contrato podia nascer sem valor.
checar('toda operação tem preço, inclusive a muito grande', true, precoDaTabela({ criancas: 300, plano: PLANO.MENSAL }) > 0);

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
  //
  // ⚠️ ARREDONDA COMO A RÉGUA ARREDONDA, e isto não é preciosismo: a soma
  // acontece em ponto flutuante dos dois lados, e `precoDoMes` passa o
  // resultado por `fracaoDeDesconto` (quatro casas). Somando cru aqui,
  // 0,5 + 0,1 + 0,3 dá 0,8999999999999999 e a invariante reprova um contrato
  // que está correto. Ficou escondido enquanto os números escolhidos calhavam
  // de somar exato — a taxa de indicação mudou de 10% para 5% e apareceu.
  Math.round(
    Math.min(
      1,
      Math.max(v.descontoFundador || 0, v.descontoFechamento || 0) +
        (v.descontoIndicacao || 0) +
        (v.descontoConcessao || 0)
    ) * 10000
  ) / 10000;

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
//
// ⚠️ O RAMO NULO PRECISA SER PEDIDO, NÃO INFERIDO.
//
// Ele era `if (v.valorMensal == null) return checar(nome, null, ...)` — e
// isso transformava a invariante numa tautologia sempre que o valor fosse
// nulo. Existia para o caso 'plano desconhecido', e valia para os SEIS
// chamadores: se `montarContrato` regredisse a nunca calcular `valorMensal`,
// os seis ficariam verdes — num bloco que existe por causa de um contrato
// assinado que se contradizia.
const valorSeExplica = (nome, c, esperaNulo = false) => {
  const v = c.valores;
  if (esperaNulo) return checar(nome, null, v.valorMensal);
  if (v.valorMensal == null) {
    return checar(`${nome} — valorMensal não podia ser nulo aqui`, 'um número', null);
  }
  const esperado = centavos(
    centavos(c.plano.precoTabela * (1 - v.descontoTotal)) + (v.descontoAbsorvido || 0)
  );
  return checar(nome, esperado, v.valorMensal);
};

valorSeExplica('sem desconto', base);
valorSeExplica('com fechamento', comAntecipacao);
valorSeExplica('com o piso mordendo', tudo);
valorSeExplica('fundador com fechamento', fundadorAntecipado);
valorSeExplica('plano desconhecido', montar({ plano: 'trimestral' }), true);
valorSeExplica('vitalício, que escapa do piso', montar({ fundador: FUNDADOR.VITALICIO }));

conferirSoma('sem desconto nenhum', base);
conferirSoma('só fechamento', comAntecipacao);
conferirSoma('fundador com fechamento', fundadorAntecipado);

const concessao = { origem: ORIGEM.CONCESSAO, fracao: 0.3, ate: '2027-02' };
const comConcessao = montar({ descontos: [concessao] });
// Era ESTE o caso que faltava: o valor descia e nenhuma linha dizia por quê.
checar('a concessão desce o valor', 82.6, comConcessao.valores.valorMensal);
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

// ═══════ A IDENTIDADE DA PLATAFORMA TEM UM LUGAR SÓ ══════════════════════
//
// ⚠️ POR QUE ESTE BLOCO EXISTE
//
// Em 09/09/2026 a identidade do controlador foi escrita nos documentos legais
// COPIANDO os valores à mão — e a cidade saiu errada: inferida do rodapé da
// landing, que traz "São Paulo/SP" como ESTADO. A sede é em Socorro.
//
// O efeito era uma cláusula de foro elegendo a comarca da capital, que não é
// a competente — cláusula que não se executa. E o defeito é do tipo que só
// aparece quando alguém precisa dela.
//
// O que este bloco garante não é o VALOR (esse muda quando a empresa mudar de
// endereço): é que os três documentos leiam a MESMA fonte. Enquanto isso for
// verdade, um conserto num lugar conserta os três.
console.log('');
console.log('A identidade da plataforma vem de um lugar so');

checar(
  'os Termos usam a razao social de developer.js',
  DEV_NAME,
  COMPANY_INFO.razaoSocial
);
checar('e o CNPJ tambem', DEV_CNPJ, COMPANY_INFO.cnpj);
checar('e a cidade — a de DOCUMENTO, nao a de exibicao', DEV_CIDADE_UF, COMPANY_INFO.cidade);
checar('e o endereco', DEV_ENDERECO, COMPANY_INFO.endereco);

// O contrato de associação lê a MESMA fonte, e é o outro documento que a
// mesma pessoa assina. Antes ele dizia "Desenvolva Algo" enquanto os Termos
// diziam só "Alô Buzinou".
{
  const c = montarContrato({
    motorista: { name: 'Tio Teste', city: 'Amparo/SP' },
    plano: PLANO.MENSAL,
    criancas: 20,
    mes: '2026-09',
  });
  checar('o contrato de associacao usa a mesma razao social', DEV_NAME, c.contratada.razao);
  checar('e o mesmo CNPJ', DEV_CNPJ, c.contratada.cnpj);
  checar('e a cidade de DOCUMENTO, sem o separador visual', DEV_CIDADE_UF, c.contratada.cidade);
  checar('e o endereco da sede', DEV_ENDERECO, c.contratada.endereco);
}

// ⚠️ A CLÁUSULA DE FORO PRECISA NOMEAR UMA COMARCA, e a de exibição não serve.
//
// `DEV_CITY` é 'Socorro · São Paulo, SP' — o "·" é separador visual. Num
// documento legal isso não é o nome de uma comarca.
const clausulaDeForo = TERMS_SECTIONS
  .flatMap((sec) => sec.paragraphs)
  .find((par) => /comarca/i.test(par));

checar('existe clausula de foro para medir', true, Boolean(clausulaDeForo));
checar(
  'o foro nomeia a comarca DECLARADA',
  true,
  clausulaDeForo.includes(DEV_COMARCA)
);
checar(
  'e NAO usa a string de exibicao, com o separador visual',
  false,
  clausulaDeForo.includes('·')
);

// ⚠️ A CLÁUSULA NÃO PODE AMARRAR O FORO À SEDE — e amarrou, duas vezes.
//
// Foro de eleição é ESCOLHA (CPC art. 63); sede é fato. **Hoje as duas
// coincidem** (sede na capital, comarca da capital), e é por coincidirem que
// este caso importa: sem ele, a amarração passa despercebida até a empresa
// mudar de endereço, e aí a cláusula muda sozinha sem ninguém decidir.
//
// O valor errado veio duas vezes de inferência sobre o rodapé da landing
// ("Rua das Trovas · Socorro — São Paulo/SP"): primeiro lendo São Paulo/SP
// como cidade quando é o estado, depois lendo Socorro como cidade quando é o
// BAIRRO. O erro nunca foi o valor — foi derivar em vez de declarar.
checar(
  'e NAO afirma que a comarca eleita e a sede',
  false,
  /sede do controlador/i.test(clausulaDeForo)
);

// A RESSALVA DO CONSUMIDOR não é cortesia: sem ela a cláusula é abusiva
// (CDC art. 51, IV) e o juiz a afasta inteira. Com ela, vale onde pode valer —
// e nos Termos a outra parte é a FAMÍLIA.
const ressalva = TERMS_SECTIONS
  .flatMap((sec) => sec.paragraphs)
  .find((par) => /domic[íi]lio/i.test(par));
checar('a eleicao de foro traz a ressalva do consumidor', true, Boolean(ressalva));

// ⚠️ O BAIRRO NÃO É A CIDADE, e foi essa confusão que produziu os dois erros.
// `Socorro` é bairro da capital (CEP 04763-110); a cidade é São Paulo. Um
// endereço legal que troque os dois nomeia um município que não é o certo.
checar('a cidade da sede e a capital, nao o bairro', 'São Paulo/SP', DEV_CIDADE_UF);
checar('o bairro aparece no endereco', true, DEV_ENDERECO.includes('Socorro'));
checar('e o CEP tambem — e ele e o que fecha a duvida', true, DEV_ENDERECO.includes('04763-110'));
checar('a comarca eleita nao e um bairro', false, DEV_COMARCA.includes('Socorro'));
checar('e cita o artigo que a sustenta', true, /101/.test(ressalva || ''));

// E o controlador se identifica por extenso — sem isso, o art. 9º I da LGPD
// e o art. 33 do CDC ficam sem resposta no documento.
checar('o controlador se identifica com razao social', true,
  CONTROLADOR_POR_EXTENSO.includes(DEV_NAME));
checar('com CNPJ', true, CONTROLADOR_POR_EXTENSO.includes(DEV_CNPJ));
checar('e com a sede', true, CONTROLADOR_POR_EXTENSO.includes(DEV_ENDERECO));


console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
