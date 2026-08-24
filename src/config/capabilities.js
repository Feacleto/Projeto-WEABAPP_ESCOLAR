/**
 * O que este ambiente do Firebase realmente tem ligado.
 *
 * POR QUE ISTO EXISTE
 * O projeto pode rodar num Firebase sem Cloud Storage configurado — e nesse
 * caso três coisas do app não têm como funcionar: comprovante de pagamento,
 * foto de perfil e foto da criança. Sem uma bandeira, o que acontece é o pior
 * dos mundos: o botão de anexar aparece, o pai escolhe o arquivo, e o upload
 * falha com erro de rede. Ele fica achando que a internet dele está ruim e
 * tenta de novo, várias vezes, num caminho que nunca vai dar certo.
 *
 * Com a bandeira desligada, o botão simplesmente NÃO EXISTE. Ninguém tenta o
 * que não pode dar certo, e o resto do app segue igual.
 *
 * O QUE CONTINUA FUNCIONANDO SEM STORAGE
 * Tudo, menos anexar arquivo. Em particular:
 *   - O pai avisa que pagou, e o pagamento vai pra "aguardando confirmação".
 *     O que ele perde é a prova junto; não o aviso.
 *   - O motorista confirma o recebimento normalmente.
 *   - O recibo de dinheiro que a plataforma gera continua indo: ele é
 *     desenhado no próprio aparelho e compartilhado pelo celular do motorista,
 *     sem passar por Storage nenhum (ver receiptImageService).
 *   - Todo mundo tem avatar, porque o avatar é gerado no navegador a partir
 *     do id. Ninguém fica sem rosto na lista — só não dá pra trocar por foto.
 *
 * O QUE FICA INERTE
 * A detecção de comprovante duplicado. Ela compara a impressão digital do
 * arquivo, e sem arquivo não há o que comparar. A trilha de auditoria do
 * pagamento continua registrando quem avisou e quando.
 *
 * COMO DESLIGAR
 * Duas formas, e a ordem de precedência é esta:
 *   1. `VITE_STORAGE_ENABLED=false` no .env — pra teste local, sem tocar no
 *      código. O .env não é versionado, então isto não vaza pra ninguém.
 *   2. O padrão abaixo — é o que a branch sem Storage troca. Uma linha só,
 *      de propósito: branch que altera lógica apodrece, branch que altera uma
 *      constante continua recebendo merge da principal pra sempre.
 */

/** Padrão do ambiente. A branch sem Storage troca ESTA linha, e só ela. */
const STORAGE_ENABLED_DEFAULT = true;

export const STORAGE_ENABLED =
  import.meta.env.VITE_STORAGE_ENABLED === 'false'
    ? false
    : import.meta.env.VITE_STORAGE_ENABLED === 'true'
      ? true
      : STORAGE_ENABLED_DEFAULT;

/**
 * Mensagem única pro caso de alguém chamar upload com a bandeira desligada.
 *
 * Não deveria acontecer — a interface esconde os caminhos. Mas se acontecer, o
 * erro precisa dizer o que é, e não virar um "network error" genérico que
 * manda o próximo a debugar a conexão do usuário.
 */
export const STORAGE_OFF_MESSAGE =
  'Cloud Storage não está habilitado neste ambiente: anexo de arquivo está ' +
  'desligado (ver src/config/capabilities.js).';
