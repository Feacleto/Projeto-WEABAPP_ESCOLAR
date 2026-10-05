import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, getStorageLazy } from '../firebase/config';
import { STORAGE_ENABLED, STORAGE_OFF_MESSAGE } from '../config/capabilities';
import { exigirCloud, mensagemDeErro } from './callableError';
import { resizeAndCompress } from './photoService';
import { PUBLICO, idDaAvaliacao, idDoPedidoDaFoto, pedidoDaFoto, semestreDe } from '../dominio/identidade/comunidade.js';

/**
 * A COMUNIDADE (05/10/2026, etapa 1): a foto da turma na época festiva e os
 * tios parceiros. Regras em `dominio/identidade/comunidade.js`; quem decide
 * é o servidor (`functions/lib/comunidade.js`).
 *
 * O caminho da foto: o app sobe o arquivo para a pasta do tio no Storage
 * (ninguém lê por lá), e a callable `publicarFotoDaTurma` confere o "sim" de
 * cada família marcada e só então cria a publicação com o link de leitura.
 */

/** A foto da turma é maior que a de perfil: 1600 px no lado maior. */
const LADO_DA_FOTO = 1600;

function idDoArquivo() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function publicarFotoDaTurma(uid, arquivo, { publico, criancas, epoca, legenda, todasMarcadas, semCrianca }) {
  if (!STORAGE_ENABLED) throw new Error(STORAGE_OFF_MESSAGE);
  exigirCloud('publicar a foto');
  const blob = await resizeAndCompress(arquivo, LADO_DA_FOTO);
  const caminho = `fotosDaTurma/${uid}/${idDoArquivo()}.jpg`;
  await uploadBytes(ref(await getStorageLazy(), caminho), blob, { contentType: 'image/jpeg' });
  try {
    const { data } = await httpsCallable(functions, 'publicarFotoDaTurma')({
      caminho,
      publico,
      criancas: publico === PUBLICO.PARCEIROS ? [] : criancas,
      epoca,
      legenda: legenda || null,
      todasMarcadas: !!todasMarcadas,
      semCrianca: !!semCrianca,
    });
    return data;
  } catch (err) {
    throw new Error(mensagemDeErro(err, 'publicar a foto'), { cause: err });
  }
}

export async function apagarFotoDaTurma(id) {
  exigirCloud('apagar a foto');
  try {
    await httpsCallable(functions, 'apagarFotoDaTurma')({ id });
  } catch (err) {
    throw new Error(mensagemDeErro(err, 'apagar a foto'), { cause: err });
  }
}

/** Os tios parceiros e os posts deles. `{ parceiros, fotos }`. */
export async function meusParceiros() {
  exigirCloud('ver os tios parceiros');
  try {
    const { data } = await httpsCallable(functions, 'meusParceiros')({});
    return { parceiros: data?.parceiros || [], fotos: data?.fotos || [] };
  } catch (err) {
    throw new Error(mensagemDeErro(err, 'ver os tios parceiros'), { cause: err });
  }
}

/** As fotos que o próprio tio publicou e ainda valem (para apagar antes do prazo). */
export function watchMinhasFotos(uid, cb, onError) {
  if (!uid) return () => {};
  return onSnapshot(
    query(collection(db, 'fotosDaTurma'), where('adminUid', '==', uid), limit(40)),
    (snap) => {
      const agora = Date.now();
      cb(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((f) => (f.expiraEm?.toMillis?.() || 0) > agora)
          .sort((a, b) => (b.criadaEm?.toMillis?.() || 0) - (a.criadaEm?.toMillis?.() || 0))
      );
    },
    onError
  );
}

/**
 * As fotos "para as famílias" do motorista da criança, que ainda valem.
 *
 * ⚠️ A CONSULTA PRECISA PROVAR O FILTRO DAS RULES: `adminUid`, `publico` e
 * `expiraEm` maior que AGORA. A margem de dez minutos cobre o relógio do
 * celular atrasado: com o "agora" do aparelho antes do do servidor, a
 * consulta pediria uma foto que as rules já consideram vencida, e a consulta
 * inteira seria recusada.
 */
export function watchFotosDaTurma(adminUid, cb, onError) {
  if (!adminUid) return () => {};
  const corte = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);
  return onSnapshot(
    query(
      collection(db, 'fotosDaTurma'),
      where('adminUid', '==', adminUid),
      where('publico', '==', PUBLICO.FAMILIAS),
      where('expiraEm', '>', corte),
      limit(10)
    ),
    (snap) =>
      cb(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.criadaEm?.toMillis?.() || 0) - (a.criadaEm?.toMillis?.() || 0))
      ),
    onError
  );
}

/** O "sim" (ou o "não") da família para a foto da turma. Só ela escreve. */
export async function responderFotoDaTurma(childId, sim) {
  await updateDoc(doc(db, 'children', childId), {
    fotoDaTurmaConsentida: !!sim,
    fotoDaTurmaEm: serverTimestamp(),
  });
}

/* ── A AVALIAÇÃO DO TIO PELA FAMÍLIA (etapa 2) ─────────────────────────── */

/**
 * A família dá (ou muda) a nota do semestre. O id carrega o uid dela e o
 * semestre: uma por família por semestre, e as rules conferem as duas coisas.
 */
export async function avaliarOTio(adminUid, familiaUid, nota) {
  const semestre = semestreDe(new Date());
  await setDoc(doc(db, 'avaliacoesDoTio', idDaAvaliacao(adminUid, familiaUid, semestre)), {
    adminUid,
    familiaUid,
    semestre,
    nota,
    em: serverTimestamp(),
  });
}

/** A nota que ELA deu neste semestre (ou `null`). Só ela lê a própria. */
export function watchMinhaAvaliacao(adminUid, familiaUid, cb) {
  if (!adminUid || !familiaUid) return () => {};
  const id = idDaAvaliacao(adminUid, familiaUid, semestreDe(new Date()));
  return onSnapshot(
    doc(db, 'avaliacoesDoTio', id),
    (snap) => cb(snap.exists() ? snap.data().nota : null),
    () => cb(null)
  );
}

/** O que o tio vê: `{ anterior: { semestre, total, media|null }, atual: { semestre, total } }`. */
export async function minhaNotaDasFamilias() {
  exigirCloud('ver a nota das famílias');
  try {
    const { data } = await httpsCallable(functions, 'minhaNotaDasFamilias')({});
    return data;
  } catch (err) {
    throw new Error(mensagemDeErro(err, 'ver a nota das famílias'), { cause: err });
  }
}

/* ── A REDE DE PARCEIROS (fase 1, 05/10/2026) ──────────────────────────── */

/**
 * Avisa o parceiro que ele foi indicado a uma família. Nunca trava a tela:
 * o WhatsApp da família já abriu, e o aviso ao parceiro é um a mais.
 */
export async function avisarParceiroIndicado(parceiroUid) {
  try {
    exigirCloud('avisar o parceiro');
    await httpsCallable(functions, 'avisarParceiroIndicado')({ parceiroUid });
  } catch {
    // Silêncio de propósito: ver acima.
  }
}

/**
 * Pergunta às famílias que ainda não responderam se o filho pode aparecer na
 * foto da turma. Um aviso por criança por mês: o id carrega o mês, e o
 * segundo envio no mesmo mês é recusado pelas rules (já existe, e só ela
 * mexe no aviso dela) — isso conta como "já perguntado", não como erro.
 * Devolve quantos avisos novos saíram.
 */
export async function pedirSimDaFoto(criancas, marca) {
  const resultados = await Promise.allSettled(
    criancas.map((c) =>
      setDoc(doc(db, 'notifications', idDoPedidoDaFoto(c.id)), {
        userId: c.parentUid,
        childId: c.id,
        ...pedidoDaFoto({ marca, nomeCrianca: c.name }),
        read: false,
        createdAt: serverTimestamp(),
      })
    )
  );
  return resultados.filter((r) => r.status === 'fulfilled').length;
}
