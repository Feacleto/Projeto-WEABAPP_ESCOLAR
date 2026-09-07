/**
 * O QUE A MARCA NÃO PODE PROMETER — e o jeito de pegá-la prometendo.
 *
 * ── POR QUE ISTO É CÓDIGO E NÃO UM LEMBRETE
 * `docs/marca.md` registra que prometer segurança seria "a única mentira grande
 * deste conjunto": a plataforma **não inspeciona van, não confere CNH e não
 * treina ninguém**. Ela mostra onde a perua está e organiza a cobrança.
 *
 * Um lembrete num documento não sobrevive à quarta pessoa que escreve um texto
 * de selo às onze da noite. Uma lista de palavras com teste, sim.
 *
 * ── O CASO QUE MOTIVOU: O ADESIVO NA VAN
 * Ele fica na traseira do veículo, fala com quem nunca abriu o app e **não dá
 * para voltar atrás** — não existe deploy de adesivo. Se ele disser "transporte
 * seguro", a plataforma passou a afirmar uma coisa que ela não verifica, para
 * um público que não tem como conferir, num suporte permanente.
 *
 * ── O QUE PODE SER DITO
 * O que é verificável: que este motorista usa o Alô Buzinou, que a família
 * acompanha a rota, e — quando for o caso — que o **alvará municipal** dele foi
 * conferido, com a data. "Alvará em dia" é um fato com data e origem; "seguro"
 * é uma promessa sobre o futuro que ninguém pode cumprir.
 *
 * ⚠️ ESTA LISTA É GROSSEIRA DE PROPÓSITO. Ela pega a palavra, não a intenção —
 * então ela vai reclamar de texto inocente de vez em quando, e isso é melhor
 * que o contrário. Quem for barrado injustamente reescreve a frase; quem passar
 * injustamente imprime mil adesivos.
 */

/**
 * As raízes proibidas. Sem acento e em minúscula — a comparação normaliza os
 * dois lados, senão "SEGURO" e "Seguro" passariam batido.
 */
export const PROIBIDAS = [
  'segur', // seguro, segurança, segurar no sentido de garantir
  'protegid',
  'protecao',
  'vistoriad',
  'certificad', // ⚠️ ver abaixo: o CERTIFICADO da plataforma é outra coisa
  'garant',
  'fiscalizad',
  'homologad',
  'confiavel',
  'aprovado pela',
];

/**
 * ⚠️ "CERTIFICADO" ESTÁ NA LISTA, E O PRODUTO TEM UM CERTIFICADO.
 *
 * A palavra é proibida no texto que fala com a FAMÍLIA e com a rua, porque ali
 * ela soa como "a plataforma certifica que este motorista é bom" — que é
 * exatamente a promessa que não se pode fazer.
 *
 * O documento que o motorista pendura na van chama-se certificado no painel do
 * dono e na tela dele, onde o contexto é claro e o público é outro. Quem
 * precisa escrever a palavra num texto de família passa por aqui de propósito:
 * a exceção é consciente, não silenciosa.
 */
export const CONTEXTOS_QUE_PODEM_DIZER_CERTIFICADO = ['painel', 'motorista'];

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Este texto promete segurança? Devolve a raiz encontrada, ou `null`.
 *
 * `contexto` permite a exceção de "certificado" — ver acima. Qualquer outra
 * palavra da lista é proibida em todo contexto.
 */
export function promessaProibida(texto, contexto = 'familia') {
  const t = normalizar(texto);
  const podeCertificado = CONTEXTOS_QUE_PODEM_DIZER_CERTIFICADO.includes(contexto);
  return (
    PROIBIDAS.find((raiz) => {
      if (raiz === 'certificad' && podeCertificado) return false;
      return t.includes(raiz);
    }) || null
  );
}

/** Atalho: o texto está limpo? */
export function podeDizer(texto, contexto = 'familia') {
  return promessaProibida(texto, contexto) === null;
}
