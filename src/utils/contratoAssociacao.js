/**
 * O CONTEÚDO DO CONTRATO DE ASSOCIAÇÃO — aritmética e texto, sem Firebase.
 *
 * POR QUE ISTO SAIU DO SERVICE
 * Este objeto é o que o associado assina: ele vira o hash SHA-256 que prova o
 * que foi aceito. E ele já saiu ERRADO duas vezes, pela mesma razão de forma:
 * a função é pura, morava atrás de um `import { db }`, e este projeto testa
 * com scripts Node puros — o script não conseguia nem importar o módulo.
 *
 *   1. `montarContrato` lia `base.mensalidadeMedia`, nome que ninguém
 *      produzia (registrado em utils/taxa.js, no `resumirBase`).
 *   2. Com periodicidade MENSAL e qualquer carência, `mesesCobrados` era
 *      `max(0, 1 - carencia)` = ZERO. O contrato saía com R$ 0,00 por mês,
 *      pelos doze meses de vigência — não só durante a carência — e era
 *      hasheado e aceito assim. A roleta de entrada concede de 1 a 4 meses,
 *      então o caminho COMUM caía exatamente aí.
 *
 * Duas vezes o mesmo furo. Agora tem teste: `npm run testar:contrato`.
 *
 * O QUE ESTE ARQUIVO IMPORTA, E POR QUÊ
 * Só constantes puras: os dados da contratada (`config/developer`) e o teto do
 * dia de vencimento (`utils/taxa`). Nada que toque Firebase — é o que o mantém
 * testável. Se precisar de dado do banco, receba por parâmetro.
 */

// A EXTENSÃO `.js` É EXPLÍCITA AQUI, E NÃO É DESCUIDO.
//
// O resto do app importa sem extensão porque o Vite resolve. O Node não —
// e o Node é quem roda `scripts/testar-contrato.mjs`. Sem a extensão, o
// teste morre em ERR_MODULE_NOT_FOUND antes da primeira asserção, e este
// arquivo volta a ser exatamente o que ele deixou de ser: intestável.
//
// Vite aceita a extensão explícita sem reclamar. É o único formato que
// funciona nos dois, então é o formato que vale para tudo que precisa ser
// testado com Node puro.
import {
  DEV_NAME,
  DEV_CNPJ,
  DEV_CITY,
  DEV_EMAIL,
  DEV_PHONE_DISPLAY,
} from '../config/developer.js';
// O teto de 28 é a mesma regra da fatura — duas definições de "dia possível"
// divergindo entre o contrato e a cobrança é como um promete o que a outra
// não cumpre.
import { limitarDiaVencimento } from './taxa.js';

/**
 * Versão do texto das cláusulas. Subir aqui exige novo aceite.
 *
 * 2 — o contrato passou a dizer QUANDO a taxa vence.
 *
 * A versão 1 tinha a cláusula de suspensão por inadimplência sem nenhuma
 * cláusula definindo atraso: "havendo atraso" sobre um documento que não
 * marcava data. O associado assinava, com hash, um papel que não dizia o
 * prazo — e depois recebia um aviso de fatura em aberto. Subir a versão custa
 * uma rodada de reassinatura, e custava zero enquanto nenhum contrato tinha
 * sido emitido.
 */
export const VERSAO_CONTRATO = 2;

/** Quantos meses de vigência cada periodicidade gera. */
const VIGENCIA_MESES = { mensal: 12, semestral: 6, anual: 12, anual12: 12 };

const ROTULO_PER = {
  mensal: 'mensal',
  semestral: 'semestral',
  anual: 'anual à vista',
  anual12: 'anual em 12×',
};

function somaMeses(data, n) {
  const d = new Date(data);
  d.setMonth(d.getMonth() + n);
  return d;
}

/**
 * Monta o conteúdo do contrato a partir da negociação.
 *
 * Devolve um objeto puro — nada de JSX. É o mesmo dado que a tela renderiza e
 * que entra no hash: se a tela montasse o texto por conta própria, o hash
 * provaria um conteúdo e a pessoa teria lido outro.
 */
export function montarContrato({ motorista, negociacao, base, config }) {
  const agora = new Date();
  const per = negociacao?.periodicidade || 'mensal';
  const meses = VIGENCIA_MESES[per] || 12;
  const modo = negociacao?.modo || 'percentual';
  const valor = Number(negociacao?.valor) || 0;
  const carencia = Math.max(0, Number(negociacao?.isencaoMeses) || 0);
  const desconto = Math.max(0, Number(negociacao?.descontoAntecipacao) || 0);

  const criancas = Number(base?.criancas) || 0;
  const mensalidadeMedia = Number(base?.mensalidadeMedia) || 0;
  const baseMensal = criancas * mensalidadeMedia;

  const cheia = modo === 'gratuito' ? 0 : modo === 'fixo' ? valor : baseMensal * (valor / 100);

  // Quantos meses o PERÍODO DE COBRANÇA cobre. Não confundir com a vigência:
  // o mensal vige 12 meses e cobra 1 de cada vez; semestral e anual cobram o
  // bloco inteiro de uma vez.
  const mesesDoPeriodo = per === 'mensal' ? 1 : meses;

  // A CARÊNCIA NÃO REDUZ A MENSALIDADE — ELA ADIA O INÍCIO DA COBRANÇA.
  //
  // Descontá-la do período só faz sentido onde o período é um BLOCO pago de
  // uma vez: dois meses de carência num semestral significam pagar quatro.
  //
  // No mensal o período é UM mês, e `1 - carencia` dava ZERO para qualquer
  // carência. O contrato saía com `valorPorPeriodo: 0` e
  // `valorMensalReconhecido: 0` — R$ 0,00 por mês, pelos doze meses de
  // vigência, não só durante a carência — e era hasheado e assinado assim.
  // A roleta de entrada concede de 1 a 4 meses (functions/lib/entryBonus.js),
  // então o caminho comum caía exatamente aqui.
  //
  // É a SEGUNDA vez que este contrato sai zerado por um campo mal lido; a
  // primeira está registrada em taxaService.js:269-280 (`mensalidadeMedia`
  // que ninguém produzia). As duas vezes passaram porque esta função é pura
  // e mora atrás de um import de Firestore, que a torna intestável.
  //
  // A carência continua dita em dois lugares que estão corretos:
  // `carenciaMeses` logo abaixo, e `isencaoAte` na fatura — que é quem de
  // fato zera a cobrança dos primeiros meses (taxaService.isentoEm).
  const mesesCobrados =
    per === 'mensal' ? 1 : Math.max(0, mesesDoPeriodo - carencia);

  const totalPeriodo = cheia * mesesCobrados * (1 - desconto / 100);

  return {
    versao: VERSAO_CONTRATO,
    emitidoEm: agora.toISOString(),
    vigenciaInicio: agora.toISOString(),
    vigenciaFim: somaMeses(agora, meses).toISOString(),
    vigenciaMeses: meses,

    contratada: {
      razao: DEV_NAME,
      cnpj: DEV_CNPJ,
      cidade: DEV_CITY,
      email: DEV_EMAIL,
      telefone: DEV_PHONE_DISPLAY,
    },
    associado: {
      uid: motorista?.uid || '',
      nome: motorista?.name || '',
      cidade: motorista?.city || '',
      email: motorista?.email || '',
      telefone: motorista?.phone || '',
    },

    taxa: {
      modo,
      valor,
      rotuloRegra:
        modo === 'gratuito'
          ? 'gratuidade integral'
          : modo === 'fixo'
            ? `R$ ${valor.toFixed(2)} fixos por mês`
            : `${valor}% sobre a mensalidade das crianças ativas`,
      periodicidade: per,
      rotuloPeriodicidade: ROTULO_PER[per] || per,
      // O DIA VIAJA DENTRO DO CONTRATO, não como ponteiro pra régua.
      //
      // Mesma razão de todo o resto deste objeto: o que foi aceito tem que
      // continuar legível depois que a casa mudar de padrão. Um contrato que
      // dissesse "vence no dia definido pela plataforma" não prometeria nada.
      diaVencimento: limitarDiaVencimento(
        negociacao?.diaVencimento ?? config?.diaVencimento
      ),
      carenciaMeses: carencia,
      descontoAntecipacao: desconto,
      baseCriancas: criancas,
      baseMensalidade: mensalidadeMedia,
      valorPorPeriodo: Number(totalPeriodo.toFixed(2)),
      valorMensalReconhecido: Number((totalPeriodo / mesesDoPeriodo).toFixed(2)),
    },
  };
}

/**
 * Quantos dias faltam pro fim da vigência. Negativo = já venceu.
 *
 * Vencer NÃO suspende ninguém, e isso é decisão: cortar por vencimento de
 * papel suspenderia quem está pagando em dia. Suspensão continua sendo coisa
 * de inadimplência. O que o vencimento faz é entrar na fila do dono.
 */
export function diasParaVencer(contrato) {
  const fim = contrato?.conteudo?.vigenciaFim;
  if (!fim) return null;
  return Math.ceil((new Date(fim) - new Date()) / 86400000);
}

/** Está na janela de renovação? */
export function precisaRenovar(contrato, janelaDias = 60) {
  const d = diasParaVencer(contrato);
  return d !== null && d <= janelaDias;
}
