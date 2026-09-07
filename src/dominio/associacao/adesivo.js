/**
 * O ADESIVO DE RUA — a mídia da plataforma na traseira da van.
 *
 * ── ELE É O OPOSTO DO CERTIFICADO, E CONFUNDIR OS DOIS FOI O ERRO INICIAL
 *
 *   |          | Adesivo             | Certificado                    |
 *   |----------|---------------------|--------------------------------|
 *   | diz      | "usa Alô Buzinou"   | "alvará conferido · 09/2026"   |
 *   | quem tem | todo associado      | quem enviou alvará e foi aceito|
 *   | ganha    | **pedindo**         | **conquistando**               |
 *
 * Valor não vem de preço, vem de exigência. O adesivo é fácil de propósito —
 * ele é propaganda, e propaganda que exige mérito não circula. O certificado é
 * difícil de propósito, pelo motivo inverso.
 *
 * ── QUEM PAGA É A PLATAFORMA, E ISSO DECIDE O RESTO
 * É mídia dela na van dele. Cobrar pelo adesivo seria cobrar do motorista para
 * fazer propaganda da plataforma — e o preço, qualquer que fosse, o faria
 * pensar duas vezes justamente na hora em que ela quer que ele não pense.
 *
 * ── ⚠️ O ENDEREÇO NÃO PODE IR PARA `users`
 * O documento `users` do motorista é LEGÍVEL PELAS FAMÍLIAS DELE — é a regra
 * que dá à mãe a chave PIX e o telefone. Endereço residencial ali expõe onde
 * ele mora a toda família que ele atende, e a maior parte dessas peruas sai da
 * casa do motorista.
 *
 * Ele mora em `taxaParceiros/{uid}`, que é `read: isOwner()` — o mesmo lugar do
 * CPF e do id no gateway, pelo mesmo motivo.
 *
 * ── O TEXTO DO ADESIVO NÃO PODE AFIRMAR SEGURANÇA
 * Ele fica na van, fala com quem nunca abriu o app e **não dá para voltar
 * atrás**: não existe deploy de adesivo. `marca/promessas.js` guarda a lista, e
 * o teste bate o texto daqui contra ela.
 *
 * ESTE ARQUIVO IMPORTA SÓ `marca/promessas.js` (`npm run testar:selo`).
 */

import { podeDizer } from '../../marca/promessas.js';

/**
 * Os quatro estados do pedido.
 *
 * `postado` existe separado de `entregue` porque o correio leva dias e o
 * motorista pergunta. Sem o estado do meio, a resposta seria "pedido" durante
 * duas semanas — e "pedido" há duas semanas parece esquecido.
 */
export const ESTADO = {
  NAO_PEDIDO: 'nao_pedido',
  PEDIDO: 'pedido',
  POSTADO: 'postado',
  ENTREGUE: 'entregue',
};

/**
 * O que vai impresso.
 *
 * ⚠️ NENHUMA PALAVRA SOBRE SEGURANÇA. O que ele afirma é verificável por quem
 * lê: este motorista usa o app, e a família acompanha a rota por ele.
 */
export const TEXTO = {
  linha1: 'Este transporte usa Alô Buzinou',
  linha2: 'a família acompanha a rota pelo celular',
  site: 'alobuzinou.com.br',
};

/** Os campos do endereço, e todos são obrigatórios — correio não adivinha. */
export const CAMPOS = ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'];

/**
 * TODO ASSOCIADO PODE PEDIR, DESDE O TESTE.
 *
 * Não há mérito aqui, e é o desenho: o adesivo é mídia da plataforma, e adiar
 * a mídia até ele contratar é adiar a propaganda até depois da hora em que ela
 * mais renderia — o motorista novo é o que mais conversa sobre o app.
 *
 * Suspenso não pede: mandar adesivo para quem está fora da plataforma é pagar
 * frete para pôr a marca numa van que não a usa.
 */
export function podePedir(motorista) {
  if (!motorista?.uid) return false;
  if (motorista.suspenso === true) return false;
  return true;
}

/** O endereço está completo? Devolve `{ ok, faltando }`. */
export function validarEndereco(endereco) {
  const faltando = CAMPOS.filter((c) => !String(endereco?.[c] || '').trim());
  return { ok: faltando.length === 0, faltando };
}

/**
 * As transições, e quem faz cada uma.
 *
 * O MOTORISTA SÓ PEDE, e só uma vez: o estado sai da mão dele no instante em
 * que o pedido existe. Pedir de novo depois de entregue é conversa — não é
 * botão, porque um botão de "pedir de novo" transforma um brinde em assinatura
 * de adesivos.
 */
export function podeTransitar(de, para, quem) {
  const atual = de || ESTADO.NAO_PEDIDO;
  if (quem === 'motorista') return para === ESTADO.PEDIDO && atual === ESTADO.NAO_PEDIDO;
  if (quem === 'dono') {
    if (para === ESTADO.POSTADO) return atual === ESTADO.PEDIDO;
    if (para === ESTADO.ENTREGUE) return atual === ESTADO.POSTADO;
    // Voltar ao começo é o conserto de um pedido errado — e ele existe porque
    // sem ele o único caminho seria editar o banco à mão.
    if (para === ESTADO.NAO_PEDIDO) return atual !== ESTADO.NAO_PEDIDO;
  }
  return false;
}

/**
 * A frase que o MOTORISTA lê sobre o próprio pedido.
 *
 * ⚠️ ELA DIZ HÁ QUANTO TEMPO. "Pedido" sozinho não distingue ontem de três
 * semanas atrás, e é a diferença entre esperar e reclamar.
 */
export function situacaoDoPedido(pedido, agora = new Date()) {
  const estado = pedido?.estado || ESTADO.NAO_PEDIDO;
  const desde = pedido?.em?.toDate?.() || (pedido?.em ? new Date(pedido.em) : null);
  const dias =
    desde && !Number.isNaN(desde.getTime())
      ? Math.max(0, Math.floor((agora.getTime() - desde.getTime()) / 86400000))
      : null;

  if (estado === ESTADO.NAO_PEDIDO) {
    return { estado, texto: 'Você ainda não pediu o seu adesivo.', dias: null };
  }
  if (estado === ESTADO.PEDIDO) {
    return {
      estado,
      texto: dias === null ? 'Pedido registrado.' : `Pedido há ${dias} ${dias === 1 ? 'dia' : 'dias'}. Vamos postar em breve.`,
      dias,
    };
  }
  if (estado === ESTADO.POSTADO) {
    return {
      estado,
      texto: dias === null ? 'Adesivo postado.' : `Postado há ${dias} ${dias === 1 ? 'dia' : 'dias'}.`,
      dias,
    };
  }
  return { estado, texto: 'Adesivo entregue. Bom proveito!', dias };
}

/** Guarda de última hora para variação de texto — mesmo motivo do certificado. */
export function textoPermitido(texto) {
  return podeDizer(texto, 'familia');
}
