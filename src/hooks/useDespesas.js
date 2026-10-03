import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { watchDespesasRecentes, watchExpensesByMonth } from '../services/expensesService';
import { watchConfigFinanceiro } from '../services/configFinanceiroService';

/**
 * As escutas do Financeiro por trás da senha (03/10/2026).
 *
 * Mesmo desenho de `useChildren`: O ESTADO CARREGA A CHAVE. Trocar de mês ou
 * de categoria não zera nada dentro do efeito — o que chegou da chave anterior
 * simplesmente deixa de casar, e a tela volta a "carregando" (`null`).
 */

/** Despesas de um mês. `null` enquanto carrega. */
export function useDespesasDoMes(monthKey) {
  const { user } = useAuth();
  const chave = user?.uid && monthKey ? `${user.uid}:${monthKey}` : null;
  const [snap, setSnap] = useState({ chave: null, lista: null });

  useEffect(() => {
    if (!chave) return undefined;
    return watchExpensesByMonth(
      monthKey,
      (lista) => setSnap({ chave, lista }),
      () => setSnap({ chave, lista: [] })
    );
  }, [chave, monthKey]);

  return snap.chave === chave ? snap.lista : null;
}

/** As últimas `quantas` despesas de uma categoria. `null` enquanto carrega. */
export function useDespesasRecentes(categoria, quantas = 10) {
  const { user } = useAuth();
  const chave = user?.uid && categoria ? `${user.uid}:${categoria}:${quantas}` : null;
  const [snap, setSnap] = useState({ chave: null, lista: null });

  useEffect(() => {
    if (!chave) return undefined;
    return watchDespesasRecentes(
      categoria,
      quantas,
      (lista) => setSnap({ chave, lista }),
      () => setSnap({ chave, lista: [] })
    );
  }, [chave, categoria, quantas]);

  return snap.chave === chave ? snap.lista : null;
}

/**
 * `configFinanceiro/{uid}` — uso da perua e contador de km das rotas.
 * `null` enquanto carrega; sem documento, `{}`.
 */
export function useConfigDoFinanceiro() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const [snap, setSnap] = useState({ chave: null, config: null });

  useEffect(() => {
    if (!uid) return undefined;
    return watchConfigFinanceiro(uid, (config) => setSnap({ chave: uid, config }));
  }, [uid]);

  return snap.chave === uid ? snap.config : null;
}
