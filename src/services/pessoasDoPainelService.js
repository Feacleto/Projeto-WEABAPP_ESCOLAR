import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { criarCacheComValidade } from '../compartilhado/cacheComValidade.js';

/**
 * AS LEITURAS DAS ABAS FAMÍLIAS, AUXILIARES E CONTAS DO PAINEL DO DONO.
 *
 * ── CONTAGEM NO SERVIDOR, LISTA COM TETO
 * Os números das fichas saem de `getCountFromServer`: nenhum documento de
 * família trafega para montar um total. As duas listas (responsáveis e
 * vínculos de auxiliar) têm `limit` — consulta sem teto cresce com a base sem
 * ninguém ver (ver `testar:leituras-do-dono`).
 *
 * ── FALHA É `null`, NUNCA ZERO
 * Contagem que não veio devolve `null` e a tela escreve "—". Zero diria "não
 * há", e uma regra que negou a leitura não é isso. Lista que falhou é `[]`.
 *
 * ── O QUE FICA DE FORA, E O PORQUÊ
 * `acessosTemporarios` o dono não lê (rules): nada aqui o consulta. E "ligou
 * os avisos" (`fcmTokens` não vazio) não dá por `count()` — não há filtro de
 * "array não vazio" sem índice de campo —, então o degrau devolve `null`; a
 * coluna "avisos" da lista mostra, para os 300 primeiros, o que há.
 *
 * ── O QUE CHEGA AO NAVEGADOR DO DONO (05/10/2026)
 * A leitura de `users` com teto de 300 traz o documento INTEIRO de cada
 * família, inclusive telefone e tokens; a tela mostra menos, mas o dado
 * chega. O dono já pode ler isso, então não é furo; se um dia incomodar, a
 * saída é uma callable que devolva a lista enxuta.
 *
 * ── CACHE DE 90 s
 * As abas desmontam ao trocar; sem cache cada toque na barra repetiria todas
 * as contagens. `forcar` é para quem acabou de escrever.
 */

export const LIMITE_DA_LISTA = 300;
const VALIDADE = 90 * 1000;

/** `count()` ou `null` se a leitura falhar. */
async function contar(q) {
  try {
    return (await getCountFromServer(q)).data().count;
  } catch (err) {
    console.error('[pessoas] contagem falhou:', err);
    return null;
  }
}

const cacheDasFamilias = criarCacheComValidade({ validadeMs: VALIDADE });

async function buscarFamilias() {
  const users = collection(db, 'users');
  const children = collection(db, 'children');
  const ativas = where('active', '==', true);
  const [
    responsaveis,
    criancasComFamilia,
    convitesSemResposta,
    pedidosEsperando,
    criancasAtivas,
    comContrato,
    lista,
  ] = await Promise.all([
    contar(query(users, where('role', '==', 'parent'))),
    contar(query(children, ativas, where('inviteStatus', '==', 'used'))),
    contar(query(children, ativas, where('inviteStatus', '==', 'pending'))),
    // 'aguardando' é o valor que `pedidosDeAcesso.js` grava ao abrir o pedido.
    contar(query(collection(db, 'pedidosDeVinculo'), where('status', '==', 'aguardando'))),
    contar(query(children, ativas)),
    // ⚠️ CONTRATO ACEITO FICA "—" DE PROPÓSITO. A contagem pediria
    // `active == true` com `contratoVigente != null`, e essa combinação exige
    // um índice composto que não existe: a consulta falharia SEMPRE, com erro
    // no console a cada abertura. Medir isso pede o índice (ou o número na
    // foto diária da base), não uma consulta condenada.
    Promise.resolve(null),
    getDocs(query(users, where('role', '==', 'parent'), limit(LIMITE_DA_LISTA)))
      .then((snap) => snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
      .catch((err) => {
        console.error('[pessoas] lista de responsáveis falhou:', err);
        return [];
      }),
  ]);
  return {
    contagens: {
      responsaveis,
      criancasComFamilia,
      convitesSemResposta,
      pedidosEsperando,
      cadastradas: criancasAtivas,
      aceitaram: comContrato,
    },
    responsaveis: lista,
  };
}

/** Fichas, funil e lista de responsáveis. Nunca lança. */
export async function carregarFamiliasDoPainel({ forcar = false } = {}) {
  try {
    return await cacheDasFamilias.obter(buscarFamilias, { forcar });
  } catch {
    return null;
  }
}

const cacheDasAuxiliares = criarCacheComValidade({ validadeMs: VALIDADE });

/** Os vínculos `auxiliares/*` (o dono lê e lista). Falha devolve `null`. */
export async function carregarAuxiliaresDoPainel({ forcar = false } = {}) {
  try {
    return await cacheDasAuxiliares.obter(async () => {
      const snap = await getDocs(query(collection(db, 'auxiliares'), limit(LIMITE_DA_LISTA)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }, { forcar });
  } catch (err) {
    console.error('[pessoas] vínculos de auxiliar falharam:', err);
    return null;
  }
}

const cacheDasContas = criarCacheComValidade({ validadeMs: VALIDADE });

/** Totais por papel para a matriz de contas. Cada um `null` se falhar. */
export async function carregarTotaisDeContas({ forcar = false } = {}) {
  try {
    return await cacheDasContas.obter(async () => {
      const users = collection(db, 'users');
      const [totalFamilias, totalAuxiliares] = await Promise.all([
        contar(query(users, where('role', '==', 'parent'))),
        contar(query(users, where('role', '==', 'auxiliar'))),
      ]);
      return { totalFamilias, totalAuxiliares };
    }, { forcar });
  } catch {
    return { totalFamilias: null, totalAuxiliares: null };
  }
}

/** `niveis/{uid}` do motorista, ou `null` (sem documento ou sem leitura). */
export async function lerJornadaDoMotorista(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'niveis', uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error('[pessoas] jornada não lida:', err);
    return null;
  }
}
