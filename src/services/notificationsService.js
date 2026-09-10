import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { avisoDeMudancaDeHorario } from '../dominio/rota/horarios';
import { auth, db } from './../firebase/config';
// O COMENTARIO QUE JUSTIFICAVA AS COPIAS LOCAIS ERA FALSO.
// Dizia 'evita dependencia circular com utils/formatters' -- e o formatters
// nao tem uma unica linha de import. Nao havia ciclo possivel;
// havia duas definicoes de dinheiro que ja divergiam no valor vazio.
import { formatBRL } from '../compartilhado/formatters';

/**
 * O motorista DESTE responsável — não o motorista da plataforma.
 *
 * Continua sendo só um fallback: quem chama passa `child.adminUid`, e este
 * caminho existe pra corrida em que o perfil ainda não carregou.
 *
 * Lia `appState/init.adminUid`, que é o ponteiro ÚNICO da plataforma. Com um
 * motorista dava no mesmo; com dois, o aviso de falta do pai de um chegava ao
 * outro — que recebia o nome de uma criança que não é cliente dele, enquanto o
 * motorista certo nunca ficava sabendo.
 *
 * O doc do próprio responsável carrega `adminUid` desde o resgate do convite,
 * e ele sempre pode ler o próprio doc.
 *
 * EXPORTADO desde 30/08/2026, e o motivo é que ele era a ÚNICA cópia certa.
 * `absencesService` e `altPickupService` resolviam o motorista lendo
 * `appState/init.adminUid` — um ponteiro ÚNICO pra plataforma inteira. Com dois
 * motoristas isso não entregava ao motorista errado: a rule de `notifications`
 * exige `userId == userDoc().adminUid` pra quem não é motorista, então a
 * escrita era NEGADA, morria num `console.error`, e a tela do pai mostrava
 * sucesso. O aviso de falta simplesmente não chegava.
 *
 * Quem chama deve preferir `child.adminUid`, que é a verdade por criança e não
 * custa leitura. Isto aqui é o fallback pra quando o chamador não tem a criança
 * em mãos.
 */
export async function resolveAdminUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data().adminUid || null : null;
  } catch (err) {
    console.error('[notifications] Falha ao resolver adminUid:', err);
    return null;
  }
}

/**
 * Notificações = união de duas fontes:
 *
 * 1. **Eventos** (docs reais em /notifications/{id}):
 *    - 'payment_claimed'   — pai marcou pagamento como pago (vai pro tio)
 *    - 'payment_confirmed' — tio confirmou recebimento (vai pro pai)
 *
 * 2. **Lembretes derivados** dos pagamentos (calculados client-side, sem doc):
 *    - 'payment_due_5d'     — 5 dias antes do vencimento
 *    - 'payment_due_3d'     — 3 dias antes
 *    - 'payment_due_0d'     — no dia do vencimento
 *    - 'payment_overdue_3d' — 3 dias após (só se NÃO claimed)
 *    - 'payment_overdue_7d' — 7 dias após (só se NÃO claimed)
 *
 * Por que client-side? Sem Cloud Functions / scheduler, calcular na hora que
 * o usuário abre o app é mais barato e direto. Trade-off: o pai só "vê" o
 * lembrete quando abre a aba — não há push real. Aceito pra MVP.
 */

// =============================================================================
// Eventos persistidos (criados no momento da ação)
// =============================================================================

/**
 * Cria notificação pro tio quando o pai marca pagamento como pago.
 * Não bloqueia: erros são logados mas não estouram pro chamador.
 *
 * @param method 'pix' | 'cash' — como o pai disse que pagou
 */
export async function notifyPaymentClaimed({
  adminUid,
  paymentId,
  childName,
  monthLabel,
  amount,
  method = 'pix',
}) {
  // Fallback: se o caller não conseguiu carregar adminUid (race condition),
  // resolve pelo doc do PRÓPRIO responsável. Este comentário dizia
  // "busca do appState/init (público, sempre disponível)" — e era isso que o
  // código fazia, com um ponteiro único pra plataforma inteira.
  const targetUid = adminUid || (await resolveAdminUid());
  if (!targetUid) {
    console.warn('[notifyPaymentClaimed] Sem adminUid — notif não criada.');
    return;
  }
  const methodLabel = method === 'cash' ? 'em dinheiro' : 'via PIX';
  // ⚠️ A AÇÃO MUDA COM A FORMA DE PAGAMENTO, e é a única parte do aviso que
  // muda. Em dinheiro o risco é ele confirmar antes de ter a cédula na mão;
  // em PIX o comprovante existe e o passo é olhar. Eram duas frases inteiras
  // ("Confirme o recebimento quando estiver com o dinheiro em mãos"), e elas
  // não cabiam num aviso de tela bloqueada junto do valor e do mês.
  const acao =
    method === 'cash'
      ? 'Toque para confirmar quando receber.'
      : 'Toque para conferir o comprovante.';
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: targetUid,
      type: 'payment_claimed',
      // ⚠️ O TÍTULO DIZ QUEM E O QUÊ; O CORPO, QUANTO E O QUE FAZER.
      //
      // Era "Novo pagamento informado" com cinco informações emendadas no
      // corpo e um pedido no fim. O nome no título é o que faz ele saber de
      // qual conversa se trata sem abrir.
      //
      // ⚠️ MAS O NOME QUE ESTA FUNÇÃO RECEBE É O DA CRIANÇA, NÃO O DE QUEM
      // PAGOU. "Lucas informou um pagamento" põe uma criança de seis anos
      // fazendo PIX. O sujeito vira a família, impessoal, e o nome volta a
      // ser só o endereço da conversa — que é o papel que ele tem aqui.
      title: `Informaram o pagamento de ${childName}`,
      body: `${formatBRL(amount)} de ${monthLabel}, ${methodLabel}. ${acao}`,
      paymentId,
      paymentMethod: method,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Falha ao criar notificação payment_claimed:', err);
  }
}

/**
 * Cria notificação pro Tio quando o Pai aceita o contrato de transporte.
 */
export async function notifyContractAccepted({ adminUid, parentName, childName }) {
  const targetUid = adminUid || (await resolveAdminUid());
  if (!targetUid) {
    console.warn('[notifyContractAccepted] Sem adminUid — notif não criada.');
    return;
  }
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: targetUid,
      type: 'contract_accepted',
      title: 'Contrato aceito',
      body: `${parentName} aceitou o contrato de transporte de ${childName}.`,
      childName,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Falha ao criar notificação contract_accepted:', err);
  }
}

/**
 * Cria notificação pro pai quando o tio confirma recebimento.
 */
export async function notifyPaymentConfirmed({
  parentUid,
  paymentId,
  monthLabel,
  amount,
  childName,
}) {
  try {
    // O nome da criança entra no corpo porque um responsável pode ter dois
    // filhos: "pagamento confirmado" sem dizer de quem não informa nada.
    const who = childName ? ` de ${childName}` : '';
    await addDoc(collection(db, 'notifications'), {
      userId: parentUid,
      type: 'payment_confirmed',
      // ⚠️ O NOME DA CRIANÇA SOBE PARA O TÍTULO. Ele era "Pagamento
      // confirmado", e o corpo emendava tudo num período com dois-pontos e
      // parênteses: "O motorista confirmou o recebimento da mensalidade de
      // Lucas: R$ 250,00 (maio de 2026)". Quem tem dois filhos precisava
      // abrir o aviso para saber de qual mensalidade se trata.
      title: `Mensalidade${who} confirmada`,
      body: `${formatBRL(amount)} de ${monthLabel}. O motorista confirmou o recebimento.`,
      paymentId,
      childName: childName || null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Falha ao criar notificação payment_confirmed:', err);
  }
}

/**
 * Avisa o responsável quando o motorista muda o horário combinado.
 *
 * ── POR QUE ESTA NOTIFICAÇÃO É DIFERENTE DE TODAS AS OUTRAS
 * As outras contam algo que ACONTECEU e que a pessoa ia ver de qualquer jeito:
 * o pagamento entrou, o contrato foi aceito, a escola não tem aula. Esta conta
 * a mudança de um número que ela acha que já sabe — e é justamente por achar
 * que sabe que ela não vai abrir o app pra reler.
 *
 * O horário NUNCA esteve escondido dela: `HorarioDoDia` o mostra no cartão do
 * Início, que o próprio arquivo chama de "o motivo de ela abrir o app". Não
 * faltava informação, faltava alguém dizer que ela mudou. O motorista
 * ajustava em `/tio/horarios`, a mãe descia na hora antiga, e a perua já tinha
 * passado — com o app tendo sido a coisa que mudou o combinado.
 *
 * ── ⚠️ A FRASE NÃO DIZ A PARTIR DE QUANDO, E ISSO É DELIBERADO
 * A mudança vale na hora: nada no app agenda horário pro futuro. Escrever "a
 * partir de amanhã" seria inventar um comportamento que o código não tem — e
 * seria exatamente a frase em cima da qual ela decidiria a que horas sair de
 * casa.
 *
 * ── ⚠️ E O ERRO É ENGOLIDO, COMO NAS DEMAIS
 * Falhar aqui não pode desfazer o horário que já foi gravado: o acordo vale
 * mais que o aviso dele. O preço é conhecido — o motorista pode achar que
 * avisou sem ter avisado —, e é menor que o de a gravação falhar pela metade.
 */
export async function notifyScheduleChanged({
  parentUid,
  childId,
  childName,
  direcao,
  de,
  para,
}) {
  // Sem responsável vinculado não há a quem avisar: a criança está cadastrada
  // e o convite ainda não foi resgatado. Não é erro, é o caso comum do
  // primeiro dia.
  if (!parentUid) return;
  // Quem decide SE há aviso e QUAL é a frase é o domínio — inclusive o caso
  // "não mudou nada", que ele devolve como `null`.
  const aviso = avisoDeMudancaDeHorario({ nome: childName, direcao, de, para });
  if (!aviso) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: parentUid,
      type: 'schedule_changed',
      title: aviso.title,
      body: aviso.body,
      childId: childId || null,
      childName: childName || null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Falha ao criar notificação schedule_changed:', err);
  }
}

// =============================================================================
// Subscribe / mark read
// =============================================================================

/**
 * Quantas notificações a assinatura carrega.
 *
 * POR QUE EXISTE UM TETO, E POR QUE ELE É ALTO
 * A consulta era `where('userId','==',uid)` e mais nada: sem `limit`, sem
 * janela, com a ordenação feita em JS DEPOIS de baixar tudo. E ela é assinada
 * no `Header`, que está montado em TODAS as telas dos dois papéis — então o
 * custo é pago em toda sessão, o dia inteiro.
 *
 * Nada apaga notificação: o único `delete` da coleção está no encerramento de
 * conta. Um motorista com 20 crianças recebe algo como 40 a 60 por mês; em
 * dois anos são mais de mil documentos baixados a cada abertura do app, no
 * mesmo aparelho que está segurando mapa e GPS.
 *
 * O TETO MUDA O SIGNIFICADO DO CONTADOR, e isso é assumido: o "não lidas" do
 * sino passa a ser "não lidas ENTRE AS 100 MAIS RECENTES". 100 cobre uns dois
 * meses do usuário mais ativo, e notificação não lida há dois meses não é mais
 * uma pendência — é histórico. Se um dia o número precisar ser exato, o
 * caminho é um `count()` separado só pro contador, não subir este teto.
 *
 * A ordenação agora é do SERVIDOR (`orderBy`), senão o `limit` cortaria um
 * pedaço arbitrário em vez das mais recentes. Isso exige o índice composto
 * `(userId ASC, createdAt DESC)` — declarado em firestore.indexes.json.
 */
const TETO_DE_NOTIFICACOES = 100;

export function watchUserNotifications(userId, onUpdate, onError) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(TETO_DE_NOTIFICACOES)
  );
  return onSnapshot(
    q,
    (snap) => {
      // Já vem ordenado do servidor. A ordenação em JS que existia aqui era
      // consequência de não haver `orderBy` — e ela só conseguia ordenar o
      // que tivesse sido baixado, que era tudo.
      onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => {
      console.error('watchUserNotifications error:', err);
      if (onError) onError(err);
    }
  );
}

export async function markNotificationRead(notifId) {
  await updateDoc(doc(db, 'notifications', notifId), {
    readAt: serverTimestamp(),
  });
}

/**
 * Marca todas as notificações não-lidas do usuário como lidas (batch).
 */
export async function markAllNotificationsRead(userId) {
  const snap = await getDocs(
    query(collection(db, 'notifications'), where('userId', '==', userId))
  );
  const unread = snap.docs.filter((d) => !d.data().readAt);
  if (unread.length === 0) return 0;

  const batch = writeBatch(db);
  const now = new Date();
  unread.forEach((d) => {
    batch.update(d.ref, { readAt: now });
  });
  await batch.commit();
  return unread.length;
}

/**
 * O CONTRATO ESTÁ PRONTO PRA ELA ACEITAR.
 *
 * Sai do mesmo gesto em que o motorista manda o contrato pelo WhatsApp — e o
 * motivo de existir junto é que a conversa some. O link do WhatsApp abre um
 * PDF; este aviso leva ela pra dentro do app, onde o aceite acontece de
 * verdade (nome digitado, hash e data). Um mostra, o outro resolve.
 */
export async function notifyContratoPronto({ parentUid, childName }) {
  if (!parentUid) return;
  try {
    const nome = String(childName || '').trim().split(/\s+/)[0];
    await addDoc(collection(db, 'notifications'), {
      userId: parentUid,
      type: 'contrato_pronto',
      title: 'Seu contrato está pronto',
      // O corpo fecha com a AÇÃO. "Está esperando o seu aceite" descreve um
      // estado e deixa ela adivinhar o que fazer com ele.
      body: nome
        ? `O motorista emitiu o contrato de ${nome}. Toque para ler e aceitar.`
        : 'O motorista emitiu o contrato. Toque para ler e aceitar.',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Falha ao criar notificação contrato_pronto:', err);
  }
}

/**
 * O CHAMADO FOI RESPONDIDO.
 *
 * ⚠️ ESTE É O ÚNICO AVISO QUE FECHA UM CICLO QUE A PLATAFORMA ABRIU. O
 * `ChamadosTab` existe porque `supportTickets` recebia desde sempre e nenhuma
 * tela do dono lia — "quem pede ajuda e não recebe resposta cancela sem dizer
 * por quê". Só que responder no painel não avisava ninguém: a pessoa
 * continuava sem saber, e a metade do problema que a aba consertou era
 * justamente essa.
 */
export async function notifyChamadoRespondido({ uid }) {
  if (!uid) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: uid,
      type: 'chamado_respondido',
      title: 'Respondemos seu chamado',
      // ⚠️ O CORPO NÃO TRAZ A RESPOSTA, E É UMA ESCOLHA.
      //
      // Os recados de agenda passaram a carregar o conteúdo no corpo, e a
      // regra é boa. Aqui ela não vale: a resposta de um chamado pode conter
      // dado de conta, valor ou decisão de suspensão, e push aparece na tela
      // bloqueada de quem estiver por perto. O que cabe é dizer que existe.
      body: 'Sua mensagem foi respondida. Toque para ler.',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Falha ao criar notificação chamado_respondido:', err);
  }
}

/**
 * A INDICAÇÃO VIROU DESCONTO.
 *
 * ⚠️ ESTE AVISO EXISTE CONTRA UMA FRASE ESPECÍFICA: *"indiquei e não
 * recebi"* — que o CLAUDE.md registra como a queixa que viaja mais rápido que
 * a própria indicação numa rede de indicação. Ela nasce das duas pontas (o
 * telefone que não bateu, e a indicação que não devia valer), e as duas
 * produzem o mesmo silêncio. Dizer no minuto em que o desconto passa a valer é
 * o que tira a dúvida antes de ela virar conversa no portão.
 */
export async function notifyIndicacaoAtivou({ indicadorUid, ativas, descontoEmReais = null }) {
  if (!indicadorUid) return;
  try {
    const n = Number(ativas) || 0;
    await addDoc(collection(db, 'notifications'), {
      userId: indicadorUid,
      type: 'indicacao_ativou',
      title: 'Sua indicação valeu',
      // ⚠️ ESTA É A PEÇA QUE EVITA A QUEIXA MAIS CARA DO PROGRAMA.
      //
      // *"Indiquei e não recebi"* é a reclamação que, numa rede de indicação,
      // viaja mais rápido que a indicação — e ela nasce de o desconto existir
      // sem nunca ser dito em número. "Já entra na sua próxima fatura" não é
      // um número: ele não sabe se são dez centavos ou dez reais.
      //
      // O desconto por indicação é 10% da fatura dele. Quanto isso vale em
      // reais depende do tamanho da operação, e quem tem esse número é o
      // service que chama — por isso `descontoEmReais` entra por parâmetro, e
      // a frase cai para a versão sem valor quando ele não vem.
      body: descontoEmReais
        ? `${n > 1 ? `São ${n} indicações ativas` : 'Uma indicação sua começou a pagar'}. Sua próxima fatura cai ${descontoEmReais}.`
        : n > 1
          ? `São ${n} indicações ativas na sua próxima fatura.`
          : 'Uma indicação sua começou a pagar, e já entra na sua próxima fatura.',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Falha ao criar notificação indicacao_ativou:', err);
  }
}

/* ⚠️ OS LEMBRETES DERIVADOS FORAM EMBORA DAQUI (10/09/2026), e não foram
 * substituídos: foram PROMOVIDOS.
 *
 * Eram cinco lembretes de mensalidade calculados na hora, a partir dos
 * `payments` do responsável, que NUNCA viravam documento. Sem documento não
 * há push — então o lembrete só existia pra quem já tinha aberto o app, que
 * é exatamente o que um lembrete existe pra evitar.
 *
 * Os limiares agora moram em `functions/lib/reguaDosAvisos.js` e quem grava
 * é a varredura diária. Os NOMES DE TIPO são os mesmos, então o desenho do
 * sino (`NotificationsBody`) não mudou uma linha.
 *
 * A leitura por `localStorage` saiu junto: ela existia só porque lembrete
 * derivado não tinha doc onde gravar `readAt`. Agora tem. */
