import { useEffect, useRef } from 'react';
import {
  generateMonthlyPayments,
  cleanOldPayments,
} from '../services/paymentsService';
import { getCurrentMonthKey } from '../utils/formatters';

const STORAGE_KEY = 'tn_auto_billing_v1';

/**
 * Hook (admin only) que dispara a geração de mensalidades do mês corrente
 * quando o Tio abre o app.
 *
 * Estratégia de idempotência:
 *   1. localStorage marca a última `monthKey` em que rodamos. Se for igual
 *      ao mês atual, não chama de novo (evita N requests no mesmo mês).
 *   2. Como fallback, `generateMonthlyPayments` é idempotente por design
 *      (consulta payments existentes antes de criar).
 *
 * Não bloqueia UI — fire-and-forget. Falhas só são logadas.
 *
 * Roda uma vez por sessão por mês.
 */
export function useAutoBilling(role) {
  const ranRef = useRef(false);

  useEffect(() => {
    if (role !== 'admin') return;
    if (ranRef.current) return;

    const currentMonth = getCurrentMonthKey();
    const lastRunMonth = readLastRunMonth();
    if (lastRunMonth === currentMonth) {
      ranRef.current = true;
      return;
    }

    ranRef.current = true;

    generateMonthlyPayments(currentMonth)
      .then((result) => {
        writeLastRunMonth(currentMonth);
        if (result.created > 0) {
          console.info(
            `[autoBilling] Geradas ${result.created} mensalidades de ${currentMonth}.`
          );
        }
      })
      .catch((err) => {
        console.error('[autoBilling] Falha ao gerar mensalidades:', err);
      });

    // Cleanup de pagamentos antigos (> 12 meses) — retenção 1 ano rolling.
    cleanOldPayments(12)
      .then((deleted) => {
        if (deleted > 0) {
          console.info(`[autoBilling] Apagados ${deleted} pagamentos antigos.`);
        }
      })
      .catch((err) => {
        console.error('[autoBilling] Falha ao limpar pagamentos antigos:', err);
      });
  }, [role]);
}

function readLastRunMonth() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeLastRunMonth(monthKey) {
  try {
    localStorage.setItem(STORAGE_KEY, monthKey);
  } catch {
    // silent — pode falhar em modo anônimo / quota excedida
  }
}
