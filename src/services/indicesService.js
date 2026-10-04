import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Os índices econômicos que o SERVIDOR busca no IBGE — hoje só o IPCA
 * acumulado em 12 meses, em `indicesEconomicos/ipca`.
 *
 * Quem grava é a agendada `atualizarIndicesEconomicos` (functions/lib/
 * indicesEconomicos.js), uma vez por dia; o cliente só LÊ, e só o motorista
 * (rules). O número é referência para o "Preciso aumentar?" — o app informa
 * a inflação oficial, nunca sugere o reajuste.
 *
 * ⚠️ FALHA DE LEITURA DEVOLVE `null`, nunca um número. A tela trata `null`
 * como "sem o índice agora" e some com a linha; inventar 0% seria pior que
 * calar.
 */

const REF_IPCA = () => doc(db, 'indicesEconomicos', 'ipca');

/** `{ mes: 'AAAA-MM', ipca12m, fonte, atualizadoEm }` | null */
function lerIpca(snap) {
  if (!snap.exists()) return null;
  const d = snap.data();
  if (typeof d.ipca12m !== 'number' || typeof d.mes !== 'string') return null;
  return {
    mes: d.mes,
    ipca12m: d.ipca12m,
    fonte: d.fonte || 'IBGE',
    atualizadoEm: d.atualizadoEm?.toDate?.() || null,
  };
}

export function watchIpca(onUpdate) {
  return onSnapshot(
    REF_IPCA(),
    (snap) => onUpdate(lerIpca(snap)),
    (err) => {
      console.error('[indices] assinatura do IPCA falhou:', err);
      onUpdate(null);
    }
  );
}
