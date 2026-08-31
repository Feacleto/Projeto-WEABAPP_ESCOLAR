import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
// A CHAVE PIX TEM UMA DEFINIÇÃO SÓ, e ela mora em `dominio/cobranca/pix.js`.
//
// Aqui existiam `validatePixKey` e `normalizePixKey`, e havia uma SEGUNDA
// `normalizePixKey` em `dominio/cobranca/pixPayload.js` — com a ordem dos argumentos
// invertida. Trocar um import pelo outro compilava, passava no lint e gerava
// chave inválida em silêncio. O reexport mantém este módulo como a porta que
// as telas já usam.
import { PIX_KEY_TYPES, validatePixKey, normalizePixKey } from '../dominio/cobranca/pix';

export { PIX_KEY_TYPES, validatePixKey, normalizePixKey };

/**
 * Os motoristas associados — a lista de parceiros do dono.
 *
 * POR QUE VIROU SERVICE
 * Esta consulta estava escrita À MÃO, byte a byte igual, em `TaxaTab.jsx` e
 * `FunilTab.jsx` — duas telas importando `firebase/firestore` direto, fora da
 * regra de camada. E ela é a definição de "quem é parceiro": `role == 'admin'`,
 * que neste projeto significa MOTORISTA. O predicado morava em três lugares
 * (contando `adminMetricsService`), e a migração de papel prevista no
 * `CLAUDE.md` deixaria dois deles para trás em silêncio.
 *
 * DEVOLVE `{ lista, falhou }`, E ISSO NÃO É PRECIOSISMO
 * As duas cópias tratavam o erro de formas diferentes — uma com `toast`, outra
 * só com `console.error` — e as duas acabavam em `[]`. No Funil isso tinha
 * efeito visível: `abrirOrcamento` recusa lead sem conta aprovada procurando
 * na lista, então uma leitura que FALHOU virava "este motorista não tem conta
 * aprovada", e o dono era mandado aprovar um cadastro que já estava aprovado.
 *
 * Lista vazia de verdade e lista vazia por falha não podem ser o mesmo valor
 * quando alguém decide alguma coisa com base nelas.
 *
 * Leitura única, e não assinatura: a lista de parceiros não muda enquanto a
 * tela está aberta.
 */
export async function listarParceiros() {
  try {
    const snap = await getDocs(
      query(collection(db, 'users'), where('role', '==', 'admin'))
    );
    return {
      lista: snap.docs.map((d) => ({ uid: d.id, ...d.data() })),
      falhou: false,
    };
  } catch (err) {
    console.error('[users] não deu pra listar os parceiros:', err);
    return { lista: [], falhou: true };
  }
}

/**
 * Marca que o usuário concluiu o tutorial de boas-vindas.
 *
 * Esse update é permitido pelas Firestore rules: o dono do doc users/{uid}
 * pode atualizar campos arbitrários desde que não mude o role.
 */
export async function markTutorialDone(uid) {
  return updateDoc(doc(db, 'users', uid), {
    tutorialDone: true,
    tutorialCompletedAt: serverTimestamp(),
  });
}

// ============================================================================
// PIX (admin/tio)
// ============================================================================


/**
 * A MARCA DO MOTORISTA — o nome e o logo que as famílias dele veem.
 *
 * NÃO É O NOME DA CONTA. `name` é o nome civil dele, usado em contrato, em
 * recibo e na fila do dono. Isto aqui é como ele se apresenta pros clientes:
 * "Tio Nino", "Tia Lene", "Van da Cris". Muita gente do ramo é conhecida só
 * pelo apelido, e obrigar o cabeçalho a mostrar "José Ednaldo dos Santos"
 * seria o app apresentando um estranho pras famílias que já o conhecem.
 *
 * ELE MUDA QUANDO QUISER, e não há aprovação no meio: é a vitrine dele.
 *
 * Escrito no próprio doc, então passa pelo ramo comum das rules — nenhum dos
 * dois campos é de gestão nem de privilégio, e o escopo `request.auth.uid ==
 * uid` já garante que ninguém reescreve a marca de outro.
 *
 * `logoURL` aceita `null` explicitamente: remover o logo é uma escolha, e
 * `undefined` seria ignorado pelo Firestore — o logo antigo continuaria lá,
 * com o app fingindo que a remoção deu certo.
 */
export async function setMarca(uid, { nome, logoURL } = {}) {
  if (!uid) throw new Error('Sem uid.');
  const dados = {};
  if (nome !== undefined) dados.marcaNome = String(nome || '').trim().slice(0, 40);
  if (logoURL !== undefined) dados.marcaLogoURL = logoURL || null;
  if (Object.keys(dados).length === 0) return;
  await updateDoc(doc(db, 'users', uid), dados);
}

export async function setAdminPixKey(adminUid, { pixKey, pixKeyType }) {
  await updateDoc(doc(db, 'users', adminUid), {
    pixKey: pixKey?.trim() || null,
    pixKeyType: pixKeyType || null,
  });
}

export async function clearAdminPixKey(adminUid) {
  await updateDoc(doc(db, 'users', adminUid), {
    pixKey: null,
    pixKeyType: null,
  });
}


/**
 * Subscribe ao doc do admin (atualiza UI quando ele troca a chave PIX).
 */
/**
 * O motorista de UMA criança — o dono da chave PIX que o responsável vê.
 *
 * Lia `appState/init.adminUid`, o ponteiro ÚNICO da plataforma. Com um
 * motorista dava no mesmo; com dois, o responsável do motorista B abria o
 * financeiro, via a chave PIX do motorista A e PAGAVA NELA. O dinheiro ia pra
 * conta errada e nada no sistema saberia — não há campo no pagamento que ligue
 * a cobrança a uma chave.
 *
 * O uid agora vem de quem chama, e a fonte é sempre `child.adminUid` (ou
 * `payment.adminUid`): o vínculo real, por criança.
 */
export function watchAdminProfile(adminUid, onUpdate, onError) {
  if (!adminUid) {
    onUpdate(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'users', adminUid),
    (snap) => onUpdate(snap.exists() ? { uid: adminUid, ...snap.data() } : null),
    (err) => {
      console.error('watchAdminProfile:', err);
      if (onError) onError(err);
    }
  );
}


