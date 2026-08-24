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

/**
 * CLOUD FUNCTIONS — a bandeira de baixo, da qual as outras dependem.
 *
 * POR QUE ELA É SEPARADA DA ROLETA
 * A roleta estava desligada por uma bandeira própria, e o motivo real dela
 * estar desligada não é a roleta: é que NENHUMA Cloud Function está no ar
 * neste projeto. Conferido contra o ambiente: `firebase functions:list`
 * responde 403 `SERVICE_DISABLED` — "Cloud Functions API has not been used in
 * project projeto-tio-nino-digital before or it is disabled". Functions v2 só
 * roda no plano Blaze, e o projeto está no Spark.
 *
 * Com duas bandeiras separadas escondendo consequências da MESMA causa, uma
 * delas apodrece: alguém liga o Blaze, vira a que lembra, e a outra fica
 * escondendo um recurso que já funcionava. Então a causa vira uma constante,
 * e cada recurso deriva dela.
 *
 * O QUE DEPENDE DISTO (tudo httpsCallable):
 *   - a roleta de entrada (`spinEntryBonus`) — ver ENTRY_BONUS_ENABLED acima;
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
 * COMO LIGAR quando o Blaze entrar: `VITE_CLOUD_FUNCTIONS_ENABLED=true` no
 * .env pra testar, ou esta linha vira `true` de vez.
 */
const CLOUD_FUNCTIONS_ENABLED_DEFAULT = false;

export const CLOUD_FUNCTIONS_ENABLED =
  import.meta.env.VITE_CLOUD_FUNCTIONS_ENABLED === 'true'
    ? true
    : import.meta.env.VITE_CLOUD_FUNCTIONS_ENABLED === 'false'
      ? false
      : CLOUD_FUNCTIONS_ENABLED_DEFAULT;

/**
 * A ROLETA DA CONDIÇÃO DE ENTRADA — ligada ou desligada NO APP.
 *
 * POR QUE ESTÁ DESLIGADA
 * A roleta promete meses sem taxa e grava o resultado numa Cloud Function.
 * Enquanto o cloud não está de pé, o cartão "Girar agora" ocupa o topo do
 * painel do motorista — o lugar mais caro da tela — pra oferecer algo que
 * não fecha o ciclo. Ele abre o painel pra ver a rota do dia e a primeira
 * coisa que lê é um brinde.
 *
 * O QUE ESTA BANDEIRA NÃO TOCA
 * A VITRINE. `Home`, `Familia`, `PartnerPitch` e `WaitlistSheet` seguem
 * anunciando a roleta, por decisão de produto: ela é argumento de venda e o
 * texto da rodada é o que traz associado. A consequência é conhecida e
 * aceita — quem se associar por causa dela não vai encontrá-la no app até o
 * cloud subir. E não é preciso lembrar desta linha quando ele subir: ela
 * DERIVA de `CLOUD_FUNCTIONS_ENABLED` acima, então o cartão reaparece junto
 * com o resto. `BonusNudge`, `BonusSheet` e `entryBonusService` continuam no
 * repositório, intactos — desligar não é apagar.
 *
 * O override `VITE_ENTRY_BONUS_ENABLED=false` continua valendo, pro caso de
 * o cloud estar de pé e a roleta ainda não ser pra mostrar.
 */
export const ENTRY_BONUS_ENABLED =
  CLOUD_FUNCTIONS_ENABLED &&
  import.meta.env.VITE_ENTRY_BONUS_ENABLED !== 'false';
