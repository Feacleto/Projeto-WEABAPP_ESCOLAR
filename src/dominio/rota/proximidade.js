/**
 * QUÃO PERTO A PERUA ESTÁ — e o que sai do celular do motorista.
 *
 * ── POR QUE A CONTA MUDOU DE LADO (11/09/2026)
 * O aviso de *"está chegando"* era calculado no celular da MÃE: ela recebia a
 * coordenada da perua e media a distância até a casa dela. Isso amarrava duas
 * coisas que não têm nada a ver uma com a outra — **o aviso passava a depender
 * de o motorista compartilhar a posição**. No dia em que ele pudesse desligar
 * o mapa, o aviso morreria junto.
 *
 * Agora quem mede é o celular DELE, que já tem a posição exata e já tem os
 * endereços das crianças. Ele publica só o RESULTADO — uma palavra por
 * criança — e a coordenada exata nunca sai do aparelho.
 *
 * Três ganhos, e o terceiro não era o objetivo:
 *   1. o aviso deixa de depender do mapa. A chave controla só o mapa.
 *   2. um caminho só. Duas contas para a mesma frase divergem, sempre.
 *   3. o aviso vira DADO GRAVADO, e não estado de tela. Hoje ele só dispara
 *      com o app da mãe aberto; gravado, dá pra virar notificação de verdade
 *      depois, sem ela estar olhando.
 *
 * ── ESTE ARQUIVO NÃO IMPORTA NADA, e é o que o mantém testável
 * A distância entra pronta, por parâmetro. Quem busca coordenada é o service.
 */

/** A perua está "chegando" a partir daqui. */
export const NEAR_KM = 2;
/** E "na porta" a partir daqui. */
export const ARRIVED_KM = 0.4;

export const ZONA = {
  LONGE: 'longe',
  PERTO: 'perto',
  CHEGOU: 'chegou',
};

/**
 * ⚠️ O MAPA É REFERÊNCIA, E ESTE É O TAMANHO DELA.
 *
 * A posição publicada é encaixada numa grade de 150 m. O GPS de celular
 * acerta em 5 a 20 m, então isto é dez vezes mais grosso: mostra A QUADRA,
 * nunca a porta.
 *
 * ⚠️ 150 m NÃO É UM NÚMERO ESCOLHIDO POR GOSTO — é o teto que `ARRIVED_KM`
 * permite. Com 400 m de "chegou", um arredondamento de 500 m (ou os 2 km que
 * chegaram a ser cogitados) faria o aviso de chegada virar sorteio. Mexer
 * aqui sem olhar o `ARRIVED_KM` quebra o aviso, não o mapa.
 */
export const PRECISAO_DO_MAPA_M = 150;

/** Metros por grau de latitude. Constante o bastante para uma grade. */
const METROS_POR_GRAU = 111320;

/**
 * Em que faixa a perua está, para UMA criança. `null` sem distância.
 *
 * São FAIXAS e não números porque é isso que a tela diz e é isso que dispara
 * o aviso — publicar a distância em km seria publicar a posição de volta, por
 * triangulação: três casas com distância conhecida dão o ponto exato.
 */
export function zonaDaPerua(distanceKm) {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return null;
  if (distanceKm > NEAR_KM) return ZONA.LONGE;
  if (distanceKm > ARRIVED_KM) return ZONA.PERTO;
  return ZONA.CHEGOU;
}

/**
 * A posição encaixada na grade de referência.
 *
 * ⚠️ ENCAIXAR, NUNCA SORTEAR. A tentação é somar um erro aleatório a cada
 * envio — e é o pior dos dois: quem guardar trinta envios e tirar a média
 * recupera o ponto verdadeiro **mais rápido** do que sem ruído nenhum.
 * Encaixado numa grade, o valor publicado é o MESMO enquanto ele estiver na
 * mesma célula, e média nenhuma passa disso.
 *
 * O passo da longitude é calculado a partir da latitude JÁ encaixada — senão
 * a mesma célula daria dois resultados perto da borda.
 */
export function arredondarParaReferencia(pos, metros = PRECISAO_DO_MAPA_M) {
  if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return null;

  const passoLat = metros / METROS_POR_GRAU;
  const lat = Math.round(pos.lat / passoLat) * passoLat;

  // Um grau de longitude encolhe conforme se afasta do equador.
  const cos = Math.cos((lat * Math.PI) / 180);
  const passoLng = metros / (METROS_POR_GRAU * (Math.abs(cos) < 0.01 ? 0.01 : cos));
  const lng = Math.round(pos.lng / passoLng) * passoLng;

  // Seis casas já são ~10 cm: mais que isso é ruído de ponto flutuante
  // fingindo precisão que a grade acabou de tirar.
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

/**
 * Quem MUDOU de faixa desde a última medição.
 *
 * ⚠️ SÓ A MUDANÇA VIRA ESCRITA. Publicar a faixa de vinte crianças a cada 30
 * segundos seriam 40 escritas por minuto durante a rota inteira, para dizer
 * vinte vezes a mesma coisa. Na mudança, são no máximo duas por criança por
 * viagem — longe→perto e perto→chegou.
 *
 * @param anteriores  { [childId]: zona } da última medição
 * @param atuais      { [childId]: zona } de agora
 * @returns [{ childId, zona }] — só as diferentes
 */
export function zonasQueMudaram(anteriores = {}, atuais = {}) {
  const saida = [];
  for (const [childId, zona] of Object.entries(atuais || {})) {
    if (!zona) continue;
    if ((anteriores || {})[childId] === zona) continue;
    saida.push({ childId, zona });
  }
  return saida;
}
