import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  monthKeyOf,
  watchDespesasRecentes,
  watchExpensesByMonth,
  watchExpensesByMonths,
} from '../services/expensesService';
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

/**
 * As despesas dos últimos `n` meses, contando o atual — a janela de 12 meses
 * de onde saem a média da manutenção, o custo por criança e a alta do diesel
 * ("Sua perua", 03/10/2026). Sem ordem garantida: quem lê ordena.
 *
 * Os meses entram na CHAVE, então a virada do mês troca a escuta no próximo
 * render. `n` vai até 30 (o limite do `in` do Firestore).
 */
export function useDespesasDosUltimosMeses(n = 12) {
  const { user } = useAuth();
  const quantos = Math.max(1, Math.min(Number(n) || 12, 30));
  const hoje = new Date();
  const meses = [];
  for (let i = 0; i < quantos; i += 1) {
    meses.push(monthKeyOf(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)));
  }
  const chave = user?.uid ? `${user.uid}:${meses.join(',')}` : null;
  const [snap, setSnap] = useState({ chave: null, lista: null });

  useEffect(() => {
    if (!chave) return undefined;
    const keys = chave.split(':')[1].split(',');
    return watchExpensesByMonths(
      keys,
      (lista) => setSnap({ chave, lista }),
      () => setSnap({ chave, lista: [] })
    );
  }, [chave]);

  const pronto = snap.chave === chave;
  return { despesas: (pronto && snap.lista) || [], carregando: !pronto };
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
 * `configFinanceiro/{uid}` — o documento inteiro como veio: `usoDaPerua`,
 * `kmDasRotas`, `temSenha`, `combustivelDaPerua`, `postos`, `planoDaTroca` e
 * `guardado` (os quatro últimos podem faltar). `null` enquanto carrega; sem
 * documento, `{}`.
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
