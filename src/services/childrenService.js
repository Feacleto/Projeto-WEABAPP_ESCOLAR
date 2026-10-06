import {
  collection,
  deleteField,
  doc,
  getDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { generateInviteCode } from '../dominio/identidade/generateInviteCode';
import { chaveDoTelefone } from '../dominio/identidade/indicacao.js';
import { inviteCodeExists } from './inviteCodeService';
import { playSound } from './soundService';

// Estados simplificados pra 4. Cada criança passa por:
//   home → onboard → atSchool → onboard → delivered
// O segundo "onboard" reaproveita o mesmo estado, mudando o que o tio faz
// com base no turno atual (pickup vs dropoff).
export const STATUS_CYCLE = ['home', 'onboard', 'atSchool', 'delivered'];

export const STATUS_LABELS = {
  home: 'Em casa',
  onboard: 'Na perua',
  atSchool: 'Na escola',
  delivered: 'Entregue',
};

export function getNextStatus(current) {
  const idx = STATUS_CYCLE.indexOf(current);
  if (idx === -1) return 'home';
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
}

/**
 * Retorna o status "efetivo" levando em conta o reset diário automático.
 * Se statusUpdatedAt é de outro dia, considera 'home' (criança recomeça
 * o dia em casa). Evita Cloud Function pra resetar à meia-noite.
 */
export function getEffectiveStatus(child) {
  if (!child) return 'home';
  const updated = child.statusUpdatedAt?.toDate?.();
  if (!updated) return child.status || 'home';

  const today = new Date();
  const sameDay =
    updated.getFullYear() === today.getFullYear() &&
    updated.getMonth() === today.getMonth() &&
    updated.getDate() === today.getDate();

  return sameDay ? child.status || 'home' : 'home';
}

// Garante invite code único consultando o Firestore.
// Probabilidade de colisão é baixa (1/9000), mas vale checar antes de salvar.
async function generateUniqueInviteCode(maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateInviteCode();
    if (!(await inviteCodeExists(code))) return code;
  }
  throw new Error('Não foi possível gerar um código único. Tente novamente.');
}

/**
 * Cadastra uma nova criança e retorna { id, inviteCode }.
 * Status inicial: "home", inviteStatus: "pending", active: true.
 */
/**
 * Reserva o id da criança ANTES de salvar (03/10/2026). Não grava nada: só
 * sorteia a chave do documento, como o próprio `addChild` faria. O cadastro
 * usa para mostrar o avatar certo enquanto ele preenche os passos.
 */
export function reservarIdDeCrianca() {
  return doc(collection(db, 'children')).id;
}

export async function addChild(data) {
  const inviteCode = await generateUniqueInviteCode();

  const payload = {
    name: data.name?.trim() || '',
    // Sem `|| 'male'`: completar o silêncio com um chute é como o campo
    // ficou errado em toda base antiga. Null é a resposta honesta pra
    // "ninguém respondeu", e o avatar sabe lidar com ela.
    gender: data.gender || null,
    birthDate: data.birthDate?.trim() || '', // YYYY-MM-DD
    parentName: data.parentName?.trim() || '',
    parentEmail: data.parentEmail?.trim().toLowerCase() || '',
    parentPhone: data.parentPhone?.trim() || '',
    // A CHAVE DO TELEFONE (03/10/2026): é por ela que o servidor acha esta
    // criança quando o responsável entra sem o link e informa o WhatsApp
    // (`pedirAcessoPeloTelefone`) — antes ele lia toda criança sem
    // responsável da plataforma. Ver `chaveDoTelefoneDaCrianca`.
    ...chaveDoTelefoneDaCrianca(data.parentPhone),
    parent2Name: data.parent2Name?.trim() || '',
    parent2Phone: data.parent2Phone?.trim() || '',
    address: data.address?.trim() || '',
    // O CEP, quando a pessoa consultou um. Ele NÃO é pedaço do endereço aqui —
    // `address` já traz rua, número e cidade prontos pra leitura. Ele é a
    // CHAVE: guardado, dá pra reconsultar a rua nos Correios e recalcular a
    // coordenada de uma criança antiga sem pedir nada ao motorista.
    //
    // Número e complemento não sobem: eles vivem dentro de `address`, e uma
    // segunda cópia deles seria uma segunda verdade sobre onde a criança mora.
    cep: data.cep?.trim() || '',
    // ATENÇÃO: Number('') é 0 — sem o coalesce abaixo, uma criança salva sem
    // geocoding ficava em lat/lng 0,0 (golfo da Guiné) e o mapa desenhava
    // aquilo como se fosse a casa dela. Ausente tem que ser null.
    lat: toCoord(data.lat),
    lng: toCoord(data.lng),
    // true = endereço salvo sem coordenada; o tio resolve depois.
    geoPending: toCoord(data.lat) == null || toCoord(data.lng) == null,
    // "NÃO SEI O NÚMERO AGORA" (02/10/2026): a casa foi cadastrada pela rua,
    // e a FAMÍLIA confirma o número no primeiro acesso dela. As partes da
    // rua vão junto porque é delas que o endereço é remontado com o número
    // — o texto de `address` não se parte de volta com segurança.
    ...(data.numeroPendente
      ? { numeroPendente: true, enderecoPartes: data.enderecoPartes || null }
      : {}),
    // O vínculo com a entidade escola. O nome e as coordenadas continuam
    // copiados aqui de propósito: é o que a rota usa e o que o pai vê, então
    // uma escola apagada por engano não apaga o endereço de entrega de
    // ninguém no meio da rota.
    schoolId: data.schoolId || null,
    school: data.school?.trim() || '',
    schoolAddress: data.schoolAddress?.trim() || '',
    // Cópia do telefone da escola (03/10/2026) — ver `definirTelefoneDaEscola`.
    schoolPhone: String(data.schoolPhone || '').replace(/\D/g, ''),
    schoolLat: toCoord(data.schoolLat),
    schoolLng: toCoord(data.schoolLng),
    // O COMBINADO COM O RESPONSÁVEL — a hora em que a perua encosta na porta
    // e a hora em que a criança volta. É o que organiza o dia do motorista e
    // o que o pai lê pra saber quando esperar. Vazio é aceitável no cadastro
    // (ele muitas vezes cadastra no meio da rota); até ser preenchido, a
    // criança opera com horário PRESUMIDO pelo período — e a tela cobra.
    horaPega: data.horaPega?.trim() || '',
    horaEntrega: data.horaEntrega?.trim() || '',
    // TURMA E PROFESSORA: o motorista PODE dizer no cadastro, os dois
    // opcionais (02/10/2026, pedido do dono) — é como ele chama a criança no
    // portão. A família corrige na ficha. A SALA saiu: muda no meio do ano e
    // ele não entra na sala.
    turma: data.turma?.trim() || '',
    professora: data.professora?.trim() || '',
    period: data.period || 'morning',
    pickupPeriod: data.pickupPeriod || data.period || 'morning',
    // A VOLTA SEGUE A IDA, e o default 'afternoon' era uma viagem inventada.
    //
    // Todo cadastro sem `dropoffPeriod` explícito nascia 'afternoon', e
    // 'afternoon' presume entrega às 17h30 (dominio/rota/horarios). Resultado: uma
    // criança da manhã, que volta ~12h30, ganhava uma volta fantasma às 17h30
    // no dia do motorista — e ao meio-dia, entregando de verdade, a tela
    // apontava pra ela.
    //
    // Sem `data.dropoffPeriod`, a volta é do MESMO período da ida: quem é
    // pego de manhã volta no fim da manhã. Continua chute, e continua saindo
    // com `presumido: true` pra tela cobrar a confirmação.
    dropoffPeriod:
      data.dropoffPeriod || data.pickupPeriod || data.period || 'morning',
    monthlyFee: Number(data.monthlyFee) || 0,
    dueDay: clampDueDay(data.dueDay),
    // O prazo do contrato com a família, escolhido pelo motorista no cadastro
    // ('AAAA-MM-DD'). Ausente, o contrato usa a vigência padrão.
    ...(data.vigenciaInicio && data.vigenciaFim
      ? { vigenciaInicio: data.vigenciaInicio, vigenciaFim: data.vigenciaFim }
      : {}),
    notes: data.notes?.trim() || '',
    // Posta pelo assento da perua só com o nome (05/10/2026): "falta completar".
    ...(data.cadastroRapido ? { cadastroRapido: true } : {}),
    inviteCode,
    inviteStatus: 'pending',
    // O convite vale 15 dias a partir daqui (03/10/2026, decisão do dono) —
    // `functions/lib/reguaDoConvite.js`. "Gerar link novo" regrava.
    inviteCriadoEm: serverTimestamp(),
    parentUid: null,
    // DE QUEM É ESTA CRIANÇA — o vínculo que faltava.
    //
    // Sem este campo, `children` era uma coleção sem dono: as rules liberavam
    // qualquer `isAdmin()` a ler e escrever QUALQUER criança, e o segundo
    // motorista da plataforma leria o endereço, a escola e o telefone das
    // famílias do primeiro. Passava despercebido porque só existia um.
    //
    // O uid vem do login, e não de parâmetro: quem cadastra é quem opera, e
    // deixar isso configurável seria criar um jeito de cadastrar criança na
    // conta de outro motorista.
    adminUid: auth.currentUser?.uid || null,
    status: 'home',
    statusUpdatedAt: serverTimestamp(),
    active: true,
    createdAt: serverTimestamp(),
  };

  // ⚠️ SÓ A CRIANÇA — O CONTADOR NÃO É MAIS DO CLIENTE (03/10/2026).
  //
  // Até aqui ia um `increment(1)` em `users.criancasAtivas` no mesmo lote, e
  // as rules exigiam o par. Era o cobrado escrevendo o número que multiplica
  // a fatura dele: as rules vigiavam o passo de um em um, nunca se o passo
  // correspondia a uma criança de verdade. Hoje as rules recusam o campo ao
  // cliente, e o gatilho `functions/lib/contadorDaTurma.js` RECONTA a turma a
  // cada criança criada, desativada, apagada ou trocada de motorista. O
  // número no perfil chega alguns segundos depois; a fatura não depende dele
  // (o fechamento conta no banco).
  // O id pode vir RESERVADO pelo formulário (`reservarIdDeCrianca`): é ele
  // que sorteia o avatar, e o cadastro mostra a criança no topo desde o
  // passo 2 — o rosto de lá tem que ser o mesmo da ficha depois de salvar.
  const docRef = data.id ? doc(db, 'children', data.id) : doc(collection(db, 'children'));
  await setDoc(docRef, payload);

  // Aqui havia um `addChildToDefaultPlan`, que enfileirava a criança nos seis
  // turnos de `routePlans`. Saiu junto com os turnos: a fila não é mais uma
  // lista salva que precisa ser mantida em dia, é o resultado de ordenar quem
  // tem horário. Criança nova aparece na rota por existir, não por ter sido
  // inscrita — que era exatamente o passo que falhava calado.
  // Som de "gravou". Mora no serviço e não na tela porque o mesmo fato é
  // disparado de mais de um lugar — e um som que só toca em metade dos
  // caminhos ensina que o silêncio às vezes também é sucesso.
  playSound('salvo');
  return { id: docRef.id, inviteCode };
}

export async function getChild(id) {
  const snap = await getDoc(doc(db, 'children', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Atualiza dados gerais (não usar pra mudar status — use updateChildStatus).
export async function updateChild(id, data) {
  const updates = { ...data };

  // `active` NÃO PASSA POR AQUI, e a recusa é barata perto do estrago.
  //
  // Esta função repassava o payload inteiro. `updateChild(id, {active: true})`
  // reativaria a criança por um caminho que ninguém revisou. O contador de
  // `criancasAtivas` é do servidor desde 03/10/2026 e se acerta sozinho; a
  // recusa fica porque ativar e desativar têm caminhos próprios.
  //
  // Hoje nenhum chamador faz isso (conferido nos quatro call sites), então é
  // armadilha e não bug — do tipo que alguém arma sem perceber, meses depois,
  // passando um objeto de formulário inteiro. Ativação e desativação têm
  // caminhos próprios (`deactivateChild`, `deactivateChildAndParent`).
  if ('active' in updates) {
    throw new Error(
      'Use deactivateChild: `active` decide a fatura e tem caminho próprio.'
    );
  }
  if ('lat' in updates) updates.lat = toCoord(updates.lat);
  if ('lng' in updates) updates.lng = toCoord(updates.lng);
  if ('schoolLat' in updates) updates.schoolLat = toCoord(updates.schoolLat);
  if ('schoolLng' in updates) updates.schoolLng = toCoord(updates.schoolLng);
  // Mantém geoPending coerente sempre que a coordenada de casa é tocada.
  if ('lat' in updates || 'lng' in updates) {
    updates.geoPending = updates.lat == null || updates.lng == null;
  }
  // O telefone mudou, a chave muda junto — no MESMO write. Separadas, a
  // criança ficaria com a chave do número antigo e o pedido de acesso do
  // número novo não a acharia.
  if ('parentPhone' in updates) {
    Object.assign(updates, chaveDoTelefoneDaCrianca(updates.parentPhone));
  }
  if (updates.monthlyFee != null) updates.monthlyFee = Number(updates.monthlyFee);
  if (updates.dueDay != null) updates.dueDay = clampDueDay(updates.dueDay);
  await updateDoc(doc(db, 'children', id), updates);
  playSound('salvo');
}

/**
 * `{ parentPhoneChave }` do telefone do responsável — a mesma normalização da
 * indicação e do irmão (`chaveDoTelefone`, com o nono dígito), espelhada no
 * servidor em `functions/lib/indicacao.js`.
 *
 * ⚠️ TELEFONE SEM CHAVE GRAVA `null`, NÃO OMITE. Trocar um número válido por
 * um inválido deixaria a chave do antigo na criança — e o pedido de acesso de
 * quem tem o número antigo continuaria achando-a.
 *
 * O servidor NÃO confia neste campo para decidir nada: ele só ENCONTRA a
 * criança, e a régua do pedido recalcula a chave do `parentPhone` antes de
 * abrir qualquer coisa (`criancasQueEsperam`). Por isso as rules não precisam
 * protegê-lo.
 */
export function chaveDoTelefoneDaCrianca(telefone) {
  return { parentPhoneChave: chaveDoTelefone(telefone) || null };
}

/**
 * Normaliza coordenada: string vazia, null, undefined e NaN viram null.
 * Nunca 0 — 0 é uma coordenada válida no meio do Atlântico e o mapa a desenha.
 */
function toCoord(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Restringe o dueDay pro intervalo 1-28 (evita problemas com fevereiro).
 * Pra meses com mais dias, o paymentsService já clampa pro último dia.
 */
function clampDueDay(value) {
  const n = Math.round(Number(value) || 10);
  if (!Number.isFinite(n)) return 10;
  return Math.min(Math.max(1, n), 28);
}

export async function updateChildStatus(id, status) {
  await updateDoc(doc(db, 'children', id), {
    status,
    statusUpdatedAt: serverTimestamp(),
  });
  // Som de mudança de status — feedback pro Tio ao avançar na rota
  playSound('status_change');
}

/**
 * Define ou remove a foto da criança. Null reseta pro avatar gerado.
 */
export async function setChildPhotoURL(id, photoURL) {
  await updateDoc(doc(db, 'children', id), { photoURL: photoURL || null });
}

/**
 * A INFORMAÇÃO DE SAÚDE — só a RESPONSÁVEL escreve, e o consentimento vai no
 * MESMO write (`docs/consentimento-saude.md`).
 *
 * As rules recusam um campo sem o outro: nota sem data é o dado sem o
 * registro do consentimento. Por isso não existe "salvar a nota" e "marcar o
 * consentimento" separados — é uma função só, e ela grava os dois.
 * `saudeConsentidaEm` é a hora do SERVIDOR: a data do consentimento não pode
 * ser a do relógio do aparelho.
 */
export async function salvarSaudeDaCrianca(id, notas) {
  const texto = String(notas || '').trim();
  if (!texto) throw new Error('Escreva a informação antes de salvar.');
  await updateDoc(doc(db, 'children', id), {
    saudeNotas: texto,
    saudeConsentidaEm: serverTimestamp(),
  });
}

/**
 * Apagar é revogar (art. 18, VI, e art. 8º, §5º): os dois campos saem
 * juntos. Guardar a data de um consentimento sem o dado que ele autorizava
 * não serve a ninguém — e as rules também recusam.
 */
export async function apagarSaudeDaCrianca(id) {
  await updateDoc(doc(db, 'children', id), {
    saudeNotas: deleteField(),
    saudeConsentidaEm: deleteField(),
  });
}

export async function deactivateChild(id) {
  // DESATIVAR LIBERA A VAGA — a fatura conta crianças ATIVAS.
  //
  // ⚠️ Aqui havia uma transação que descontava `users.criancasAtivas` com
  // `increment(-1)`. Saiu em 03/10/2026: o contador é do SERVIDOR
  // (`functions/lib/contadorDaTurma.js` reconta a cada mudança de `active`),
  // e as rules recusam o campo ao cliente. Recontar também acaba com o
  // decremento duplo de duas abas, que a transação existia para evitar.
  // `inativadoEm` (03/10/2026): a DATA da saída. Sem ela o Financeiro não
  // sabe até quando a criança contava na turma de um mês passado. Não existe
  // caminho de reativar (`updateChild` recusa `active`); se um nascer, ele
  // apaga este campo no mesmo write.
  await updateDoc(doc(db, 'children', id), { active: false, inativadoEm: serverTimestamp() });
  // `active: false` basta: a fila do dia filtra por ele. Não há mais lista
  // salva de onde a criança precise ser retirada — e portanto não há mais
  // como ela sobrar numa rota depois de desativada.
}

/**
 * Subscribe à lista de crianças ativas DESTE motorista.
 *
 * O `adminUid` NÃO É OPCIONAL, e o motivo é o formato da negativa: as rules
 * exigem que a consulta prove o escopo, e uma consulta sem o filtro é
 * rejeitada INTEIRA — não vem "as que ele pode ver", vem erro de permissão e
 * a tela fica vazia. Sem uid, então, não adianta nem chamar: devolvemos lista
 * vazia e um unsubscribe inerte, que é o mesmo resultado sem gastar uma
 * consulta negada e sem poluir o console de quem for depurar outra coisa.
 *
 * Ordenação é client-side pra evitar índice composto no Firestore.
 */
export function watchActiveChildren(adminUid, onUpdate, onError) {
  if (!adminUid) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    collection(db, 'children'),
    where('adminUid', '==', adminUid),
    where('active', '==', true)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
      onUpdate(list);
    },
    (err) => {
      console.error('watchActiveChildren error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * A turma INTEIRA deste motorista — ativas e as que saíram (03/10/2026).
 *
 * Existe para "Turma e contratos" no Financeiro: quem saiu só aparece na
 * conta de entradas e saídas se a consulta trouxer `active: false` também.
 * O escopo é o mesmo de `watchActiveChildren` (adminUid da sessão), e por
 * isso a consulta passa nas rules sem índice composto.
 */
export function watchTurmaInteira(adminUid, onUpdate, onError) {
  if (!adminUid) {
    onUpdate([]);
    return () => {};
  }
  const q = query(collection(db, 'children'), where('adminUid', '==', adminUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
      onUpdate(list);
    },
    (err) => {
      console.error('watchTurmaInteira error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe a um doc específico de criança (usado pelo painel do Pai).
 */
export function watchChild(id, onUpdate, onError) {
  return onSnapshot(
    doc(db, 'children', id),
    (snap) => {
      onUpdate(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    },
    (err) => {
      console.error('watchChild error:', err);
      if (onError) onError(err);
    }
  );
}
