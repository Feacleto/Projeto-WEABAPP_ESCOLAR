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

/**
 * Padrão do ambiente. A branch sem Storage troca ESTA linha, e só ela.
 *
 * De volta a `true` em 06/09/2026: o Blaze entrou e o bucket padrão foi
 * criado em `southamerica-east1`, a mesma região do Firestore e das
 * functions. As `storage.rules` estão publicadas.
 *
 * Ela passou por `false` durante um dia, enquanto o projeto rodava no Spark
 * — projeto criado depois de 2024 não ganha bucket fora do Blaze. Voltou
 * junto de `CLOUD_FUNCTIONS_ENABLED_DEFAULT`, no mesmo commit, porque as
 * duas estavam desligadas pela MESMA causa. É por isso que elas são duas
 * constantes e não uma: cada recurso deriva da sua, e nenhuma apodrece
 * escondendo o que a outra já resolveu.
 */
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

/**
 * CLOUD FUNCTIONS — a bandeira de baixo, da qual as outras dependem.
 *
 * POR QUE ELA É UMA CAUSA, E NÃO UMA BANDEIRA POR RECURSO
 * Houve uma bandeira só para a roleta, e o motivo real não era a roleta: era
 * que NENHUMA Cloud Function estava no ar. Uma bandeira por recurso escondendo
 * a mesma causa é o caminho para uma delas apodrecer — alguém liga o Blaze,
 * vira a que lembra, e a outra fica escondendo algo que já funcionava. Então a
 * CAUSA virou constante, e cada recurso deriva.
 *
 * (A roleta foi apagada em 07/09/2026. O raciocínio fica porque ele vale para
 * a próxima bandeira que alguém quiser criar por recurso.)
 *
 * LIGADA EM 06/09/2026. As 12 functions do núcleo estão publicadas em
 * `southamerica-east1`, e `firebase functions:list` responde com elas.
 *
 * Com duas bandeiras separadas escondendo consequências da MESMA causa, uma
 * delas apodrece: alguém liga o Blaze, vira a que lembra, e a outra fica
 * escondendo um recurso que já funcionava. Então a causa vira uma constante,
 * e cada recurso deriva dela.
 *
 * O QUE DEPENDE DISTO (tudo httpsCallable):
 *   - a contratação de faixa (`contratarPlano`);
 *   - o resgate de convite do responsável (`redeemInvite`, `lookupInvite`) e
 *     por consequência o /first-access;
 *   - a geração de mensalidade e as cobranças (`generateMonthlyPayments`);
 *   - o formulário de parceria da home (`joinDriverWaitlist`);
 *   - a limpeza de privacidade dos depoimentos (`backfillTestimonialPrivacy`).
 *
 * O QUE **NÃO** DEPENDE, e por isso não deve ser escondido junto:
 *   - envio e leitura de avaliação (`addDoc`/`getDocs` direto);
 *   - a janela de avaliação (`platformConfig`);
 *   - a vitrine de depoimentos da landing — `getShowcase` é callable, mas o
 *     `.catch` dela já devolve `{ drivers: [] }` e os depoimentos vêm de
 *     leitura direta. Ela degrada calada, sem erro na tela: não precisa de
 *     bandeira, precisa continuar degradando.
 *
 * O override `VITE_CLOUD_FUNCTIONS_ENABLED=false` continua valendo, pro caso
 * de precisar simular o ambiente sem cloud sem desfazer o deploy.
 */
const CLOUD_FUNCTIONS_ENABLED_DEFAULT = true;

export const CLOUD_FUNCTIONS_ENABLED =
  import.meta.env.VITE_CLOUD_FUNCTIONS_ENABLED === 'true'
    ? true
    : import.meta.env.VITE_CLOUD_FUNCTIONS_ENABLED === 'false'
      ? false
      : CLOUD_FUNCTIONS_ENABLED_DEFAULT;

/**
 * A BANDEIRA `ENTRY_BONUS_ENABLED` FOI REMOVIDA EM 06/09/2026, E A ROLETA
 * INTEIRA EM 07/09/2026.
 *
 * A bandeira existia porque a roleta era de ENTRADA: aparecia no topo do painel
 * de quem acabou de criar conta, e sem cloud o cartão "Girar agora" ocupava o
 * lugar mais caro da tela para oferecer algo que não fechava o ciclo. Ela virou
 * prêmio de CONVERSÃO, e a bandeira deu lugar a uma condição de DADO
 * (`users.planoId`) — condição que vem do dado é melhor que condição que vem do
 * deploy, porque ela não precisa ser lembrada.
 *
 * Depois a roleta saiu de vez: o critério dela era SORTE, e sorte não sobrevive
 * à conversa no portão da escola. Quem faz esse papel agora é a escada de
 * fechamento, que é pública, reproduzível e com data — ver docs/descontos.md.
 *
 * As duas lições ficam registradas porque valem para o próximo recurso que
 * alguém quiser esconder: prefira dado a bandeira, e prefira régua a sorteio.
 */

