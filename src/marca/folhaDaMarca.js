/**
 * A FOLHA DA MARCA — o que aparece quando o tio (ou a auxiliar) toca no logo
 * do cabeçalho (05/10/2026, protótipo "Abrir o logo do tio", versão A com os
 * dados do B, aprovado pelo dono).
 *
 * Pela METADE, a folha é o cartão de visita: o logo, o nome, de onde ele é e
 * três ações (duas para a auxiliar). Na TELA CHEIA, é o SELO: a marca grande
 * na cor dela e a faixa do Alô Buzinou embaixo, como no adesivo — o "mostrar
 * a marca na tela" para a mãe no portão. Sem dado e sem botão nenhum ali.
 *
 * ⚠️ A FAMÍLIA NÃO TEM FOLHA. O logo do cabeçalho dela continua sendo só a
 * marca do motorista dela; quem decide é o Header, pelo papel.
 *
 * ⚠️ A AUXILIAR VÊ DO TIO SÓ O QUE JÁ VÊ HOJE: marca, logo e cor. Nunca o
 * nível, o plano, a assinatura, a nota das famílias, o adesivo ou dinheiro —
 * `testar:folha-da-marca` procura essas palavras na versão dela.
 *
 * Puro, sem React (`npm run testar:folha-da-marca`).
 */
import { mensagemDoCartaoDoTio, quemFala } from './mensagensDoLink.js';

export const DICA_DA_METADE = 'Puxe para cima para ver mais';
export const DICA_DA_CHEIA = 'Puxe para baixo para fechar';

/** A faixa do Alô Buzinou na tela cheia — os textos do adesivo da Platina. */
export const FAIXA_DO_SELO = {
  marca: 'Alô Buzinou',
  frase: 'Eu uso o app Alô Buzinou',
  site: 'alobuzinou.com.br',
};

/**
 * O link do cartão do tio (05/10/2026, decisão do dono): a página pública
 * `/conheca/<uid>`, que APRESENTA o tio a uma família nova. A prévia no
 * WhatsApp é o cartão grande dele ("Conheça {marca}", `cartaoDoLink`).
 */
export const CONHECA = 'https://alobuzinou.com/conheca';

export function linkDoCartaoDoTio(uid) {
  return `${CONHECA}/${encodeURIComponent(String(uid || '').trim())}`;
}

/**
 * "TN" para "Tio Nino", "VZ" para "Van do Zé" — como no protótipo aprovado:
 * o "Tio" fica (é como a família o chama), os conectivos saem.
 */
export function iniciaisDaMarca(nome) {
  const n = String(nome || '').trim();
  if (!n) return '';
  const partes = n.split(/\s+/).filter((p) => !/^(do|da|de|dos|das|e)$/i.test(p));
  return (partes.length ? partes : n.split(/\s+/)).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

/**
 * "Transporte escolar · Socorro, São Paulo". Sem bairro, só a cidade; sem
 * cidade, só "Transporte escolar" — nunca uma vírgula pendurada.
 */
export function subtituloDoTio({ regiao, city } = {}) {
  const lugar = [String(regiao || '').trim(), String(city || '').trim()].filter(Boolean);
  // Bairro sem cidade não diz onde fica ("Centro" existe em toda cidade).
  if (!String(city || '').trim()) return 'Transporte escolar';
  return `Transporte escolar · ${lugar.join(', ')}`;
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function emMs(valor) {
  if (valor == null) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (typeof valor.seconds === 'number') return valor.seconds * 1000;
  return null;
}

/**
 * O começo do período ATUAL do vínculo: o período aberto (`ate` nulo), e sem
 * períodos, o `aceitoEm`. Quem saiu e voltou conta da volta — "desde" é
 * desde quando ela está NESTA perua agora, não a soma da história.
 */
export function inicioDoVinculo(vinculo) {
  const periodos = Array.isArray(vinculo?.periodos) ? vinculo.periodos : [];
  const aberto = [...periodos].reverse().find((p) => p && p.ate == null && emMs(p.de) != null);
  if (aberto) return emMs(aberto.de);
  return emMs(vinculo?.aceitoEm);
}

/**
 * "Você trabalha nesta perua desde março". O ano só entra quando não é o de
 * agora — "desde março" lido em outubro do ano seguinte mentiria um ano.
 */
export function subtituloDaAuxiliar(vinculo, agora = new Date()) {
  const ms = inicioDoVinculo(vinculo);
  if (ms == null) return 'Você trabalha nesta perua';
  const d = new Date(ms);
  const ano = d.getFullYear() === agora.getFullYear() ? '' : ` de ${d.getFullYear()}`;
  return `Você trabalha nesta perua desde ${MESES[d.getMonth()]}${ano}`;
}

/**
 * As ações da folha pela metade, na ordem da tela. UM botão cheio por folha
 * (o primeiro); o resto é contorno.
 */
export function acoesDaFolha(papel, { marca } = {}) {
  if (papel === 'auxiliar') {
    const nome = String(marca || '').trim();
    return [
      { id: 'falar', rotulo: nome ? `Falar com ${quemFala(nome)}` : 'Falar com o motorista', cheio: true },
      { id: 'pix', rotulo: 'Ver o PIX da perua', cheio: false },
    ];
  }
  return [
    { id: 'cartao', rotulo: 'Mandar meu cartão a uma família', cheio: true },
    { id: 'previa', rotulo: 'Ver como as famílias me veem', cheio: false },
    { id: 'trocar', rotulo: 'Trocar logo ou cor', cheio: false },
  ];
}

/** O bloco "Trabalhando para" só existe com mais de um tio. */
export function mostraTrabalhandoPara(ativos) {
  return Array.isArray(ativos) && ativos.length > 1;
}

/**
 * O CARTÃO DO TIO, para uma família NOVA conhecê-lo (o texto aprovado pelo
 * dono mora em `mensagemDoCartaoDoTio`). Nunca "entrar": a família só entra
 * pelo convite de uma criança, que continua na ficha dela.
 */
export function mensagemDoCartao({ marca, uid } = {}) {
  return mensagemDoCartaoDoTio({ marca, url: linkDoCartaoDoTio(uid) });
}

/**
 * O ARRASTO NA ALÇA: o que fazer quando o dedo solta. `delta` é para CIMA
 * em pixels (positivo sobe). Um toque (quase sem arrasto) alterna; acima de
 * 80 px, sobe para a tela cheia; abaixo de -80, desce um degrau (da cheia
 * para a metade, da metade fecha). No meio, volta para onde estava.
 */
export const LIMIAR_DO_TOQUE = 8;
export const LIMIAR_DO_ARRASTO = 80;

export function aoSoltarAAlca(delta, cheia) {
  const d = Number(delta) || 0;
  if (Math.abs(d) < LIMIAR_DO_TOQUE) return cheia ? 'metade' : 'cheia';
  if (d > LIMIAR_DO_ARRASTO) return 'cheia';
  if (d < -LIMIAR_DO_ARRASTO) return cheia ? 'metade' : 'fechar';
  return cheia ? 'cheia' : 'metade';
}

/**
 * O cartão do dia no Hoje da auxiliar diz de quem é a perua (05/10/2026,
 * decisão do dono): "Perua do Tio Nino · ida sai 06h40". O artigo vem do
 * gênero do tio; sem gênero, "do". Sem viagem, só "Perua do Tio Nino".
 */
export function rotuloDaPerua({ marca, genero, direcao, hora } = {}) {
  const nome = String(marca || '').trim() || 'motorista';
  const artigo = genero === 'female' ? 'da' : 'do';
  const base = `Perua ${artigo} ${nome}`;
  if (!hora || (direcao !== 'ida' && direcao !== 'volta')) return base;
  return `${base} · ${direcao} sai ${hora}`;
}
