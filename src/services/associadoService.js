import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth, db } from '../firebase/config';

/**
 * A INSCRIÇÃO NA LISTA DE ASSOCIADOS É O CADASTRO DO MOTORISTA.
 *
 * Não existem dois passos ("entre na lista" e depois "crie sua conta"). Quem
 * preenche sai com conta criada, entra no app e vê a própria posição na fila
 * enquanto a associação é negociada. O que ele NÃO tem ainda é acesso — e isso
 * é papel, não flag: a conta nasce `role: 'aguardando'`.
 *
 * POR QUE `aguardando` NÃO É `admin` COM UM BOOLEANO DESLIGADO
 * Com flag, ele já seria motorista pra toda regra do Firestore e cada uma
 * precisaria lembrar de checar. Uma que esquecesse — hoje ou daqui a seis
 * meses — e um inscrito não aprovado alcançaria criança, pagamento e rota de
 * quem já está dentro. Com papel próprio, `isAdmin()` é falso e ele não
 * alcança nada: esquecer uma checagem faz ele ver MENOS, não mais.
 *
 * A POSIÇÃO NA FILA É CONTADA, NÃO INVENTADA
 * É quantos se inscreveram antes dele, mais um. Sem prazo, sem contador
 * regressivo, sem vaga se esgotando — quem está decidindo confiar o próprio
 * negócio a uma plataforma repara em escassez fabricada, e o custo de ser
 * pego é a confiança inteira.
 */

/** Papel de quem se inscreveu e ainda não foi aprovado. */
export const PAPEL_AGUARDANDO = 'aguardando';

/**
 * Quantos já estão na fila antes desta pessoa.
 *
 * Conta os documentos de `waitlistDrivers`, e não os `users` com papel
 * aguardando: a lista é o registro de intenção, e alguém pode ter se
 * inscrito antes de a criação de conta existir. Contar `users` faria a fila
 * "encolher" pra quem entrou cedo, que é o oposto do que a tela promete.
 *
 * Falhar aqui devolve null em vez de zero. Zero seria pior que ausência: a
 * tela diria "você é o 1º da fila" pra quem talvez seja o décimo, e é o tipo
 * de erro que só aparece quando alguém compara com outro inscrito.
 */
export async function proximaPosicao() {
  try {
    const snap = await getCountFromServer(collection(db, 'waitlistDrivers'));
    return (snap.data().count || 0) + 1;
  } catch {
    return null;
  }
}

/**
 * Cria a conta do motorista inscrito, ou entra na que já existe.
 *
 * Devolve `{ uid, posicao, jaExistia }`.
 *
 * A senha é escolhida por ele no formulário. Google fica de fora aqui de
 * propósito: dentro da webview do WhatsApp o OAuth do Google é recusado, e
 * este formulário é justamente o que costuma ser aberto a partir de um link
 * compartilhado. Um caminho que falha na metade dos aparelhos é pior que um
 * campo de senha a mais.
 */
export async function inscreverAssociado({ email, senha, nome, telefone, cidade, criancas }) {
  const emailLimpo = String(email || '').trim().toLowerCase();

  let uid;
  let jaExistia = false;
  try {
    const cred = await createUserWithEmailAndPassword(auth, emailLimpo, senha);
    uid = cred.user.uid;
  } catch (err) {
    // Já se inscreveu antes e voltou. Entrar com a mesma senha é o caminho
    // certo — mandar ele "recuperar a senha" de uma conta que ele acabou de
    // tentar criar é o tipo de beco que faz a pessoa desistir.
    if (err?.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, emailLimpo, senha);
      uid = cred.user.uid;
      jaExistia = true;
    } else {
      throw err;
    }
  }

  const posicao = await proximaPosicao();

  // `merge: true` porque quem já tinha conta pode estar voltando pra corrigir
  // um dado — e porque sobrescrever um `role` já aprovado seria rebaixar
  // alguém que passou pela fila. A regra do Firestore recusaria de qualquer
  // forma (o create só aceita 'aguardando'), mas depender disso pra não
  // estragar dado é confiar na rede em vez de no código.
  const ref = doc(db, 'users', uid);
  const payload = {
    role: PAPEL_AGUARDANDO,
    name: String(nome || '').trim(),
    email: emailLimpo,
    phone: String(telefone || '').trim(),
    city: String(cidade || '').trim(),
    // Quantas crianças ele DIZ que transporta — estimativa da inscrição, e
    // não o limite contratado. O limite nasce no orçamento, em
    // `users.limiteCriancas`, e só o dono escreve.
    criancasEstimadas: Math.max(0, Number(criancas) || 0),
    createdAt: serverTimestamp(),
  };
  if (posicao != null) payload.posicaoNaFila = posicao;

  await setDoc(ref, payload, { merge: true });

  return { uid, posicao, jaExistia };
}

/**
 * Os inscritos aguardando aprovação, pro painel do dono.
 *
 * Lê `users` filtrando pelo papel — e não `waitlistDrivers` — porque o que o
 * dono aprova é uma CONTA, não um lead. A fila antiga continua existindo pra
 * quem se inscreveu antes deste fluxo; as duas telas convivem.
 */
export async function listarAguardando(max = 50) {
  const snap = await getDocs(
    query(collection(db, 'users'), where('role', '==', PAPEL_AGUARDANDO), limit(max))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Aprova um inscrito: `aguardando` → `admin`.
 *
 * Esta é a ÚNICA transição de papel que existe no app, e a regra que a
 * permite é estreita de propósito — só o dono, só saindo de 'aguardando', só
 * chegando em 'admin', e só três campos viajam. Não há caminho pra promover
 * ninguém a dono por aqui.
 *
 * Irreversível de propósito: desfazer um aceite é SUSPENDER, que deixa
 * rastro. Apagar o fato de que a conta foi aprovada um dia seria reescrever
 * história numa relação comercial.
 */
export async function aprovarAssociado(uid, aprovadorUid) {
  await setDoc(
    doc(db, 'users', uid),
    {
      role: 'admin',
      aprovadoEm: serverTimestamp(),
      aprovadoPor: aprovadorUid,
    },
    { merge: true }
  );
}
