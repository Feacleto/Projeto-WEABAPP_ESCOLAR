import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { playSound } from './soundService';

// A parte pura da migração mora em utils pra poder ser testada sem Firebase.
export { chaveDoNome, proporEscolasDasCriancas } from '../utils/nomeEscola';

/**
 * ESCOLAS — as que este motorista atende.
 *
 * POR QUE VIRAR ENTIDADE
 * A escola era três campos soltos no cadastro da criança: `school`,
 * `schoolAddress`, `schoolLat/Lng`. O motorista digitava o nome e geocodificava
 * o endereço UMA VEZ POR CRIANÇA — cinco crianças da mesma escola são cinco
 * digitações, cinco chamadas ao Nominatim e cinco chances de divergir.
 *
 * E o custo não era só trabalho repetido. O agrupamento de aviso em massa é
 * `c.school === schoolName`, comparação exata de string digitada à mão: quem
 * escreveu "E.M. Rui Barbosa" numa criança e "EM Rui Barbosa" noutra tem duas
 * escolas pro sistema, e o aviso de "não vai ter aula" alcança metade da turma.
 * O pai da outra metade manda a criança pro portão fechado.
 *
 * Com `schoolId`, o vínculo é um id. Nome com typo passa a ser cosmético.
 *
 * DE PROPÓSITO SEM HORÁRIO DE ENTRADA E SAÍDA
 * A escola não guarda horário escolar. O que organiza o dia é o horário que o
 * motorista combinou com cada pai (ver `utils/horarios`), e o horário da
 * escola só existiria pra validar — validação que ele não pediu e que custaria
 * mais um campo obrigatório em cada cadastro.
 */

function uidAtual() {
  return auth.currentUser?.uid || null;
}

const colEscolas = () => collection(db, 'schools');

/**
 * Cria uma escola. `adminUid` vem da sessão e não de parâmetro — pelo mesmo
 * motivo de `addChild`: quem cadastra é quem opera, e deixar isso configurável
 * seria criar um jeito de cadastrar escola na conta de outro motorista.
 */
export async function addEscola(data) {
  const adminUid = uidAtual();
  if (!adminUid) throw new Error('Sem sessão.');
  const nome = data?.nome?.trim();
  if (!nome) throw new Error('Diga o nome da escola.');

  const ref = await addDoc(colEscolas(), {
    nome,
    endereco: data.endereco?.trim() || '',
    lat: toCoord(data.lat),
    lng: toCoord(data.lng),
    // true = endereço salvo sem coordenada; dá pra resolver depois sem travar
    // o cadastro da criança, que é o que o motorista está tentando fazer.
    geoPending: toCoord(data.lat) == null || toCoord(data.lng) == null,
    adminUid,
    ativa: true,
    createdAt: serverTimestamp(),
  });
  // Som de "gravou". Mora no serviço e não na tela porque o mesmo fato é
  // disparado de mais de um lugar — e um som que só toca em metade dos
  // caminhos ensina que o silêncio às vezes também é sucesso.
  playSound('salvo');
  return ref.id;
}

export async function updateEscola(id, data) {
  if (!id) return;
  const updates = { ...data, updatedAt: serverTimestamp() };
  if ('nome' in updates) updates.nome = updates.nome?.trim() || '';
  if ('lat' in updates) updates.lat = toCoord(updates.lat);
  if ('lng' in updates) updates.lng = toCoord(updates.lng);
  if ('lat' in updates || 'lng' in updates) {
    updates.geoPending = updates.lat == null || updates.lng == null;
  }
  // `adminUid` nunca é atualizável: mudar o dono do documento é escrever na
  // operação alheia em duas etapas. A rule também recusa, mas não custa nada
  // o cliente não tentar.
  delete updates.adminUid;
  await updateDoc(doc(db, 'schools', id), updates);
  playSound('salvo');
}

/**
 * Apaga a escola. Não mexe nas crianças: elas guardam `school` (nome) e as
 * coordenadas como cópia, então uma escola apagada por engano não apaga o
 * endereço de entrega de ninguém no meio da rota.
 */
export async function removeEscola(id) {
  if (!id) return;
  await deleteDoc(doc(db, 'schools', id));
}

export function watchEscolas(adminUid, onUpdate, onError) {
  if (!adminUid) {
    onUpdate([]);
    return () => {};
  }
  const q = query(colEscolas(), where('adminUid', '==', adminUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((e) => e.ativa !== false)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
      onUpdate(list);
    },
    (err) => {
      console.error('watchEscolas error:', err);
      if (onError) onError(err);
    }
  );
}

export async function listEscolas(adminUid) {
  if (!adminUid) return [];
  const snap = await getDocs(query(colEscolas(), where('adminUid', '==', adminUid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.ativa !== false);
}

/** Mapa { id: escola } — formato que `utils/horarios` consome. */
export function porId(escolas) {
  const m = {};
  for (const e of escolas || []) m[e.id] = e;
  return m;
}

/**
 * Cria a escola de um grupo proposto e carimba `schoolId` nas crianças dele.
 *
 * Grava o `school` canônico junto: o nome continua copiado dentro da criança
 * de propósito. Ele é o que o pai vê e o que a rota usa se a escola for
 * apagada — e uma escola apagada por engano não pode apagar o endereço de
 * entrega de ninguém no meio da rota.
 *
 * Batch pra ser tudo ou nada: metade das crianças vinculadas é pior que
 * nenhuma, porque o aviso em massa passaria a alcançar só metade da turma sem
 * o motorista ter como perceber.
 */
export async function criarEscolaEVincular(grupo) {
  const adminUid = uidAtual();
  if (!adminUid) throw new Error('Sem sessão.');
  if (!grupo?.nome) throw new Error('Grupo sem nome.');

  const escolaId = await addEscola({
    nome: grupo.nome,
    endereco: grupo.endereco,
    lat: grupo.lat,
    lng: grupo.lng,
  });

  const criancas = grupo.criancas || [];
  const CHUNK = 400;
  for (let i = 0; i < criancas.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const c of criancas.slice(i, i + CHUNK)) {
      batch.update(doc(db, 'children', c.id), {
        schoolId: escolaId,
        school: grupo.nome,
        ...(grupo.endereco ? { schoolAddress: grupo.endereco } : {}),
        ...(grupo.lat != null ? { schoolLat: grupo.lat, schoolLng: grupo.lng } : {}),
      });
    }
    await batch.commit();
  }
  return { escolaId, vinculadas: criancas.length };
}

function toCoord(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
