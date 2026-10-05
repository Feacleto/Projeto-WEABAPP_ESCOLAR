import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Os índices econômicos que o SERVIDOR busca — o IPCA acumulado em 12 meses
 * do IBGE (`indicesEconomicos/ipca`) e, desde 05/10/2026, a Selic meta e o
 * dólar PTAX do Banco Central (`/selic` e `/dolar`), para a "Economia do
 * mês" do motorista.
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

const numeroOuNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const textoOuNull = (v) => (typeof v === 'string' && v ? v : null);

/**
 * `{ mes: 'AAAA-MM', ipca12m, mesAntes, ipca12mAntes, fonte, atualizadoEm }`
 * | null. `mesAntes`/`ipca12mAntes` são `null` no documento gravado antes de
 * 05/10/2026 — a tela mostra o número sem a seta.
 */
function lerIpca(snap) {
  if (!snap.exists()) return null;
  const d = snap.data();
  if (typeof d.ipca12m !== 'number' || typeof d.mes !== 'string') return null;
  return {
    mes: d.mes,
    ipca12m: d.ipca12m,
    mesAntes: textoOuNull(d.mesAntes),
    ipca12mAntes: numeroOuNull(d.ipca12mAntes),
    fonte: d.fonte || 'IBGE',
    atualizadoEm: d.atualizadoEm?.toDate?.() || null,
  };
}

/** `{ data, valor, desde, dataAntes, valorAntes, fonte }` | null (datas 'AAAA-MM-DD'). */
function lerSerieDoBc(snap) {
  if (!snap.exists()) return null;
  const d = snap.data();
  if (typeof d.valor !== 'number' || typeof d.data !== 'string') return null;
  return {
    data: d.data,
    valor: d.valor,
    desde: textoOuNull(d.desde),
    dataAntes: textoOuNull(d.dataAntes),
    valorAntes: numeroOuNull(d.valorAntes),
    fonte: d.fonte || 'Banco Central',
  };
}

/**
 * Os três índices de uma vez, `{ ipca, selic, dolar }` — cada um `null`
 * quando não há documento ou a leitura falhou. `onUpdate` só é chamado
 * depois que os três responderam pela primeira vez, para a tela não piscar
 * de "sem dado" para o número.
 */
export function watchIndicesEconomicos(onUpdate) {
  const leitores = { ipca: lerIpca, selic: lerSerieDoBc, dolar: lerSerieDoBc };
  const valores = {};
  const chegou = new Set();
  const avisar = () => {
    if (chegou.size === Object.keys(leitores).length) onUpdate({ ...valores });
  };
  const paradas = Object.entries(leitores).map(([id, ler]) =>
    onSnapshot(
      doc(db, 'indicesEconomicos', id),
      (snap) => {
        valores[id] = ler(snap);
        chegou.add(id);
        avisar();
      },
      (err) => {
        console.error(`[indices] assinatura de ${id} falhou:`, err);
        valores[id] = null;
        chegou.add(id);
        avisar();
      }
    )
  );
  return () => paradas.forEach((parar) => parar());
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
