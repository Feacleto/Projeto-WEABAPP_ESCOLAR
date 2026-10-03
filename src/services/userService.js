import {
  collection,
  doc,
  documentId,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { criarCacheComValidade } from '../compartilhado/cacheComValidade.js';
// A CHAVE PIX TEM UMA DEFINIÇÃO SÓ, e ela mora em `dominio/cobranca/pix.js`.
//
// Aqui existiam `validatePixKey` e `normalizePixKey`, e havia uma SEGUNDA
// `normalizePixKey` em `dominio/cobranca/pixPayload.js` — com a ordem dos argumentos
// invertida. Trocar um import pelo outro compilava, passava no lint e gerava
// chave inválida em silêncio. O reexport mantém este módulo como a porta que
// as telas já usam.
import { PIX_KEY_TYPES, validatePixKey, normalizePixKey, maskCpf } from '../dominio/cobranca/pix';

export { PIX_KEY_TYPES, validatePixKey, normalizePixKey, maskCpf };

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
 *
 * ⚠️ A LISTA DE MOTORISTAS É UMA SÓ PARA O PAINEL INTEIRO (03/10/2026).
 *
 * A visão geral, a carteira (`carregarConsole`) e a aba Mês (`TaxaTab`) liam
 * cada uma a sua cópia de `role == 'admin'` — três idas ao banco pela mesma
 * lista na abertura do painel, e de novo a cada troca de aba. Agora as três
 * pedem a `parceirosDoDono`, que guarda a leitura por 90 segundos e entrega a
 * mesma promessa a quem pedir junto (ver `compartilhado/cacheComValidade.js`).
 *
 * Quem acabou de ESCREVER num motorista passa `forcar: true` — é o que
 * `carregarConsole({ forcar })` já fazia, e ele repassa para cá.
 */
const VALIDADE_DOS_PARCEIROS = 90 * 1000;
const cacheDosParceiros = criarCacheComValidade({ validadeMs: VALIDADE_DOS_PARCEIROS });

async function buscarParceiros() {
  const snap = await getDocs(
    query(collection(db, 'users'), where('role', '==', 'admin'))
  );
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/** A lista crua, com cache. LANÇA se a leitura falhar — quem chama decide. */
export function parceirosDoDono({ forcar = false } = {}) {
  return cacheDosParceiros.obter(buscarParceiros, { forcar });
}

export async function listarParceiros({ forcar = false } = {}) {
  try {
    return { lista: await parceirosDoDono({ forcar }), falhou: false };
  } catch (err) {
    console.error('[users] não deu pra listar os parceiros:', err);
    return { lista: [], falhou: true };
  }
}

/**
 * SÓ AS PESSOAS QUE A TELA VAI MOSTRAR — por `uid`, em lotes de 30.
 *
 * Existe porque a caixa de chamados precisa do NOME e do TELEFONE de quem
 * abriu, e `supportTickets` guarda só o `uid` e o papel. E o chamado vem dos
 * dois lados: `listarParceiros` acima traz só `role == 'admin'`, então usá-la
 * ali deixaria todo chamado de família sem nome e sem botão de responder.
 *
 * ⚠️ ELA SUBSTITUIU `listarUsuarios`, QUE BAIXAVA `users` INTEIRA (03/10/2026).
 * Para mostrar o nome de vinte pessoas, a aba lia a base toda — cem motoristas
 * e trezentas famílias, com telefone e endereço de cada uma, a cada abertura.
 * Agora ela lê só quem abriu um chamado que está na tela.
 *
 * 30 é o teto do operador `in` no Firestore; acima disso a consulta é recusada.
 * Só o dono lista `users` (`allow list: if isOwner()`), e uma consulta por
 * `documentId()` é uma listagem como outra qualquer para as rules.
 *
 * Devolve `{ porUid, falhou }`: mapa vazio por falha e mapa vazio porque
 * ninguém foi pedido não podem ser o mesmo valor (mesmo motivo de
 * `listarParceiros`).
 */
export const LOTE_DE_UIDS = 30;

export async function buscarUsuariosPorUid(uids = []) {
  const unicos = [...new Set((Array.isArray(uids) ? uids : []).filter(Boolean))];
  const porUid = {};
  if (!unicos.length) return { porUid, falhou: false };
  try {
    const lotes = [];
    for (let i = 0; i < unicos.length; i += LOTE_DE_UIDS) {
      lotes.push(unicos.slice(i, i + LOTE_DE_UIDS));
    }
    const snaps = await Promise.all(
      lotes.map((lote) =>
        getDocs(query(collection(db, 'users'), where(documentId(), 'in', lote)))
      )
    );
    snaps.forEach((snap) =>
      snap.docs.forEach((d) => {
        porUid[d.id] = { uid: d.id, ...d.data() };
      })
    );
    return { porUid, falhou: false };
  } catch (err) {
    console.error('[users] não deu pra buscar as pessoas:', err);
    return { porUid, falhou: true };
  }
}

/**
 * Marca que o usuário concluiu o tutorial de boas-vindas.
 *
 * Esse update é permitido pelas Firestore rules: o dono do doc users/{uid}
 * pode atualizar campos arbitrários desde que não mude o role.
 */
/**
 * ELE MOSTRA A PERUA NO MAPA DAS FAMÍLIAS, OU NÃO.
 *
 * ⚠️ ISTO NÃO É CONFORTO — É A METADE QUE FALTAVA DE UM CONSENTIMENTO.
 * A Política de Privacidade declara a base legal da geolocalização como
 * **consentimento do titular (art. 7º, I)**, e a LGPD manda que consentimento
 * possa ser revogado "a qualquer momento, mediante manifestação expressa, por
 * procedimento gratuito e facilitado" (art. 8º, §5º). Até 11/09/2026 não
 * havia como revogar: ou ele compartilhava, ou não rodava a rota. O documento
 * prometia uma escolha que o app não oferecia.
 *
 * ⚠️ AUSENTE SIGNIFICA LIGADO. Quem nunca viu a chave não pode ter o mapa
 * apagado das famílias dele sem ter escolhido nada — e ele nem saberia que
 * existe um botão para religar.
 *
 * Não precisou de rule nova: o `update` de `users` é lista de PROIBIDOS
 * (`trialInicio`, `assinaturaAte`, `plano`), e preferência não é cláusula —
 * mentir aqui não vira desconto nem prazo. Mesmo critério de
 * `avisosDesligados` e de `ultimaRota`.
 */
export async function setCompartilharLocalizacao(uid, compartilha) {
  if (!uid) return;
  await updateDoc(doc(db, 'users', uid), {
    compartilhaLocalizacao: compartilha !== false,
  });
}

/**
 * O primeiro acesso do RESPONSÁVEL (02/10/2026) — nome e WhatsApp, só o que
 * veio preenchido, e o carimbo de que o passo dos avisos já foi mostrado.
 *
 * `update` do próprio documento: a política de `users` para o próprio dono é
 * lista de PROIBIDOS, e nenhum destes está nela. ⚠️ `phone` aqui é contato e
 * não vincula nada — a chave dos irmãos é `phoneChave`, que só o servidor
 * grava (ver `functions/lib/vincularIrmao.js`).
 */
export async function salvarPrimeiroAcessoDoResponsavel(uid, { name, phone, avisosPerguntados } = {}) {
  if (!uid) throw new Error('Sem uid.');
  const dados = {};
  if (String(name || '').trim()) dados.name = String(name).trim();
  if (String(phone || '').trim()) dados.phone = String(phone).trim();
  if (avisosPerguntados) dados.avisosPerguntadosEm = serverTimestamp();
  if (Object.keys(dados).length === 0) return;
  await updateDoc(doc(db, 'users', uid), dados);
}

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


