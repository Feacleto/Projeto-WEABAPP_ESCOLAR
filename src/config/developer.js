/**
 * Dados oficiais da Desenvolva Algo — quem desenvolveu o Alô Buzinou.
 *
 * Ficam num módulo só porque aparecem em mais de uma tela pública (home e
 * /conheca) e são dados LEGAIS: CNPJ ou contato desatualizado em uma tela e
 * certo na outra é o tipo de divergência que ninguém percebe até alguém
 * precisar do número. Um lugar pra mudar, todas as telas mudam.
 */

export const DEV_NAME = 'Desenvolva Algo';
export const DEV_CNPJ = '65.000.217/0001-47';
export const DEV_CITY = 'Socorro · São Paulo, SP';
export const DEV_PHONE_RAW = '5511969170709';
export const DEV_PHONE_DISPLAY = '(11) 96917-0709';
export const DEV_EMAIL = 'desenvolvaalgo@gmail.com';
export const DEV_INSTAGRAM_URL =
  'https://www.instagram.com/desenvolvaalgo?igsh=MWR2YnE3cmZieTlraA%3D%3D&utm_source=qr';

/** Link de WhatsApp já com a mensagem escrita — o motorista só envia. */
export function devWhatsAppLink(mensagem) {
  return `https://wa.me/${DEV_PHONE_RAW}?text=${encodeURIComponent(mensagem)}`;
}

/**
 * Canal comercial do Alô Buzinou — o "consultor" que conversa com o
 * motorista sobre a vaga de associado e a taxa.
 *
 * Hoje é o MESMO número da Desenvolva Algo, porque hoje é a mesma pessoa
 * atendendo. Fica com nome próprio de propósito: no dia em que o produto
 * tiver uma linha comercial separada, muda aqui e todas as telas mudam
 * juntas — em vez de alguém ter que caçar `devWhatsAppLink` no meio do
 * código e descobrir tarde que o número do suporte técnico virou o número
 * de vendas.
 */
export const SALES_PHONE_RAW = DEV_PHONE_RAW;

/** WhatsApp do consultor, com a mensagem já escrita. */
export function salesWhatsAppLink(mensagem) {
  return `https://wa.me/${SALES_PHONE_RAW}?text=${encodeURIComponent(mensagem)}`;
}

/** Link de email com assunto (e corpo, se houver) prontos. */
export function devMailLink(assunto, corpo = '') {
  const qs = [
    `subject=${encodeURIComponent(assunto)}`,
    corpo && `body=${encodeURIComponent(corpo)}`,
  ]
    .filter(Boolean)
    .join('&');
  return `mailto:${DEV_EMAIL}?${qs}`;
}
