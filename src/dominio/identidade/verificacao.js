/**
 * O CERTIFICADO — o alvará do motorista, conferido, com data.
 *
 * ── ELE NÃO BLOQUEIA NADA, E ISSO É A DECISÃO 6
 * Criar operação, cadastrar aluno, convidar responsável, rodar rota e cobrar
 * são livres no minuto zero. A verificação é ESTADO, nunca portão — boca a boca
 * morre em fila de aprovação, e o que torna isso seguro aqui é um fato do
 * modelo: **a plataforma não apresenta motorista a família**. Ele traz as
 * famílias que já o conhecem offline.
 *
 * A decisão estava "aceita · firme" desde sempre e nunca tinha sido
 * implementada: não existia campo, tela nem regra. Isto é a primeira
 * implementação dela.
 *
 * ── ALVARÁ, NÃO CNH — E O MOTIVO É TÉCNICO, NÃO DE PUDOR
 * Para emitir o alvará de transporte escolar, a prefeitura JÁ exige CNH
 * categoria D, curso de transporte escolar, antecedentes criminais e vistoria
 * do veículo. Conferir o alvará apoia a plataforma numa conferência que o poder
 * público já fez — sem guardar documento de identidade, que, se vazar, é
 * material de fraude pronto.
 *
 * E é mais forte: "alvará municipal em dia" diz mais que "vi a CNH dele".
 *
 * Exceção: município que não emite alvará. Só aí, CRLV + vistoria + CNH — e
 * isso é conversa, não estado novo.
 *
 * ── VALOR NÃO VEM DE PREÇO, VEM DE EXIGÊNCIA
 * Pago, o selo parece abusivo. Automático, não vale nada. Conquistado resolve
 * os dois — e é por isso que a conferência é trabalho de gente, e por isso ela
 * não escala sozinha. É a primeira coisa desde que o consultor saiu do caminho
 * que volta a pôr o dono no caminho crítico.
 *
 * ── O QUE O SELO PODE DIZER
 * Um fato com data e origem: "alvará municipal conferido em 09/2026". Nunca uma
 * promessa sobre o futuro. `marca/promessas.js` guarda a lista de palavras que
 * não podem aparecer, e o teste bate os textos deste arquivo contra ela.
 *
 * ESTE ARQUIVO IMPORTA SÓ `marca/promessas.js` (`npm run testar:selo`).
 */

import { podeDizer } from '../../marca/promessas.js';

/**
 * Os quatro estados da decisão 6, e nada além deles.
 *
 * `recusada` volta para `enviada` quando ele manda outro documento — não existe
 * estado "recusada definitiva". Documento vencido não é caráter: é papel.
 */
export const ESTADO = {
  NAO_INICIADA: 'nao_iniciada',
  ENVIADA: 'enviada',
  VERIFICADA: 'verificada',
  RECUSADA: 'recusada',
};

/** Faltando isto para o alvará vencer, ele entra na fila do dono. */
export const AVISO_DE_VENCIMENTO = 30;

/**
 * O texto do selo, para cada público.
 *
 * ⚠️ NENHUM DELES AFIRMA SEGURANÇA. A plataforma não inspeciona van, não
 * confere CNH e não treina ninguém — ela conferiu um papel, numa data, e é isso
 * que os três dizem. O teste bate cada string contra `marca/promessas.js`.
 */
export const TEXTO = {
  /** Na tela em que a família aceita o convite. */
  familia: 'Alvará municipal de transporte escolar conferido',
  /** No adesivo e no papel que ele pendura. Sem data porque ela vai ao lado. */
  impresso: 'Alvará municipal conferido',
  /** Enquanto não foi conferido — e ele NÃO é um alerta. Ver `seloDaFamilia`. */
  ausente: 'Alvará ainda não enviado à plataforma',
};

function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor?.toDate === 'function') {
    const d = valor.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof valor === 'number' || typeof valor === 'string') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** 'MM/AAAA' — como a data aparece no selo. */
export function mesAno(data) {
  const d = paraData(data);
  if (!d) return null;
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/**
 * O estado REAL da verificação neste instante.
 *
 * ⚠️ ALVARÁ VENCIDO NÃO É "VERIFICADO". O campo guarda o que o dono decidiu
 * quando conferiu; o que a família vê depende do calendário. Sem esta função, o
 * selo continuaria dizendo "conferido" três anos depois — e aí ele passa a
 * afirmar uma coisa falsa, que é pior do que não existir.
 */
export function estadoDaVerificacao(motorista, agora = new Date()) {
  const estado = motorista?.verificacao || ESTADO.NAO_INICIADA;
  if (estado !== ESTADO.VERIFICADA) return estado;

  const validade = paraData(motorista?.alvaraValidade);
  const hoje = paraData(agora);
  // Sem validade cadastrada, vale o que o dono decidiu. Inventar vencimento
  // seria a plataforma revogando um selo que ela mesma concedeu.
  if (!validade || !hoje) return ESTADO.VERIFICADA;
  return hoje.getTime() > validade.getTime() ? ESTADO.NAO_INICIADA : ESTADO.VERIFICADA;
}

/** Dias até o alvará vencer. `null` sem validade, negativo se já venceu. */
export function diasParaVencer(motorista, agora = new Date()) {
  const validade = paraData(motorista?.alvaraValidade);
  const hoje = paraData(agora);
  if (!validade || !hoje) return null;
  return Math.floor((validade.getTime() - hoje.getTime()) / MS_POR_DIA);
}

/**
 * O que a FAMÍLIA vê na tela em que ela aceita o convite.
 *
 * ⚠️ A AUSÊNCIA DO SELO NÃO É UM ALERTA. Quem não enviou o alvará não é
 * suspeito — o modelo inteiro parte de que a família já conhece este motorista
 * offline. Um aviso vermelho ali transformaria a plataforma em avalista de
 * quem ela não conhece, e cobraria da família uma desconfiança que não é dela.
 *
 * Então: quando há selo, ele aparece. Quando não há, **não aparece nada**.
 * A pressão é social — o motorista com selo o exibe, e é isso que faz o vizinho
 * querer o dele. É a decisão 6: pressão social, nunca técnica.
 */
export function seloDaFamilia(motorista, agora = new Date()) {
  if (estadoDaVerificacao(motorista, agora) !== ESTADO.VERIFICADA) return null;
  return {
    texto: TEXTO.familia,
    // A DATA IMPRESSA JUNTO. Sem ela o selo é uma opinião; com ela é um fato
    // que a pessoa pode julgar velho ou recente por conta própria.
    conferidoEm: mesAno(motorista?.verificadoEm),
  };
}

/**
 * As transições que existem, e quem pode fazer cada uma.
 *
 * O MOTORISTA SÓ ENVIA. Verificar e recusar são do dono — se o enviado pudesse
 * se marcar verificado, o selo não valeria nada, e ele valeria menos ainda por
 * parecer que vale.
 */
export function podeTransitar(de, para, quem) {
  const atual = de || ESTADO.NAO_INICIADA;
  if (quem === 'motorista') {
    // Ele envia de qualquer estado que não seja "esperando conferência" — e
    // reenviar depois de recusado é o caminho normal, não uma exceção.
    return para === ESTADO.ENVIADA && atual !== ESTADO.ENVIADA;
  }
  if (quem === 'dono') {
    if (para === ESTADO.VERIFICADA || para === ESTADO.RECUSADA) {
      return atual === ESTADO.ENVIADA;
    }
    // Revogar um selo concedido: volta ao começo, não a "recusada" — recusada
    // é sobre um documento específico que ele mandou.
    return para === ESTADO.NAO_INICIADA && atual === ESTADO.VERIFICADA;
  }
  return false;
}

/** A recusa exige motivo: ele precisa saber o que reenviar. */
export function validarRecusa(motivo) {
  const m = String(motivo || '').trim();
  if (m.length < 10) {
    return {
      ok: false,
      erro: 'Diga o que está errado. Sem isso ele reenvia o mesmo documento.',
    };
  }
  return { ok: true, erro: null };
}

/**
 * O selo pode dizer isto? Guarda de última hora para texto novo.
 *
 * Exportada porque a próxima pessoa que escrever uma variação do texto — numa
 * peça de marketing, num e-mail — precisa de um lugar óbvio para conferir.
 */
export function textoPermitido(texto) {
  return podeDizer(texto, 'familia');
}
