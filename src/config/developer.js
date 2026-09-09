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

/**
 * A SEDE, EM PARTES — e `Socorro` é BAIRRO, não cidade.
 *
 * ⚠️ ESSA CONFUSÃO CUSTOU DUAS CORREÇÕES SEGUIDAS, e é o motivo de o endereço
 * estar em campos separados agora em vez de numa string só.
 *
 * O rodapé da landing publica "Rua das Trovas · Socorro — São Paulo/SP", e uma
 * auditoria de 09/09/2026 leu isso duas vezes errado: primeiro como
 * "São Paulo/SP" sendo a cidade (era o estado, então a cidade ficou implícita),
 * depois como "Socorro" sendo a cidade (é o bairro, no distrito de Santo
 * Amaro). Nas duas vezes a cláusula de foro saiu de uma inferência.
 *
 * O CEP fecha a dúvida: `04763-110` é da capital.
 *
 * `DEV_CITY` continua sendo a de EXIBIÇÃO — o "·" é separador visual, e ela
 * vive no rodapé da `/familia` e no cabeçalho do contrato. As outras são para
 * DOCUMENTO LEGAL, onde pontuação decorativa não cabe e cada parte do endereço
 * tem que ser inequívoca.
 */
export const DEV_CITY = 'Socorro · São Paulo, SP';
export const DEV_LOGRADOURO = 'Rua das Trovas';
export const DEV_BAIRRO = 'Socorro';
export const DEV_CIDADE_UF = 'São Paulo/SP';
export const DEV_CEP = '04763-110';

/**
 * A SEDE POR EXTENSO, para qualificar a parte nos documentos legais.
 *
 * ⚠️ SE A RUA TIVER NÚMERO, ele entra em `DEV_NUMERO` e a linha abaixo o
 * inclui. Ficou de fora porque o rodapé da landing não o publica, e inventar
 * número de endereço é pior que omitir: num documento com valor probatório, um
 * endereço que não existe é o mesmo que endereço nenhum.
 */
export const DEV_NUMERO = '';
export const DEV_ENDERECO = [
  DEV_NUMERO ? `${DEV_LOGRADOURO}, ${DEV_NUMERO}` : DEV_LOGRADOURO,
  DEV_BAIRRO,
  DEV_CIDADE_UF,
  `CEP ${DEV_CEP}`,
].join(', ');

/**
 * A COMARCA ELEITA — e ela NÃO se deriva da sede.
 *
 * ⚠️ ESTA CONSTANTE EXISTE PORQUE AS DUAS COISAS FORAM CONFUNDIDAS, DUAS VEZES,
 * EM SEQUÊNCIA.
 *
 * Foro de eleição é uma ESCOLHA das partes (CPC art. 63), não uma consequência
 * do endereço. **Hoje as duas coincidem** — a sede é na capital, e a comarca
 * eleita é a da capital —, e é justamente por coincidirem que a separação tem
 * que existir: no dia em que a empresa mudar de endereço, a eleição de foro
 * não muda sozinha.
 *
 * O que uma auditoria escreveu em 09/09/2026 foi "comarca de X, **sede do
 * controlador**" — uma cláusula que amarra o foro à sede e fica falsa por
 * dentro no dia em que os dois divergirem. E o X saiu errado duas vezes, pela
 * confusão entre bairro e cidade descrita acima. O erro nunca foi o valor: foi
 * derivar em vez de declarar.
 *
 * ⚠️ E ELA VALE MENOS CONTRA CONSUMIDOR DO QUE PARECE. O CDC dá ao consumidor
 * o foro do próprio domicílio (art. 101, I) e trata como abusiva a cláusula
 * que dificulte a defesa dele (art. 51, IV) — então, nos Termos, que governam
 * a relação com as FAMÍLIAS, esta eleição tende a não prevalecer. Ela pesa de
 * verdade no contrato de associação, onde a outra parte é o motorista
 * transportador. Manter é correto; contar com ela contra uma responsável, não.
 */
export const DEV_COMARCA = 'São Paulo/SP';
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
