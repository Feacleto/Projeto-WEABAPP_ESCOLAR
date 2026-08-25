import { useEffect, useMemo, useState } from 'react';
import {
  watchPaymentsByMonth,
  watchPaymentsByChild,
  watchPaymentsByParent,
} from '../services/paymentsService';
import { useAuth } from './useAuth';

/**
 * Subscribe aos pagamentos de um mês (admin).
 */
/**
 * A assinatura de uma lista de pagamentos, com o estado carregando a CHAVE.
 *
 * Os três hooks abaixo faziam a mesma coisa de três jeitos iguais, e todos
 * com o mesmo defeito: `setPayments([])` e `setLoading(true)` no corpo do
 * efeito. Isso é um render a mais e, pior, deixa um quadro em que a tela já
 * sabe que o mês (ou a criança) mudou e ainda mostra os pagamentos do
 * anterior — num app de dinheiro, é o valor errado exibido com confiança.
 *
 * Guardar a chave junto do dado fecha a janela sem tocar em estado dentro do
 * efeito: enquanto o snapshot novo não chega, `naChave` é falso e a tela
 * recebe lista vazia com `loading: true`, que é a verdade.
 */
function useAssinaturaDePagamentos(chave, assinar) {
  const [snap, setSnap] = useState({ chave: null, payments: [], error: null });

  useEffect(() => {
    if (!chave) return undefined;
    return assinar(
      (list) => setSnap({ chave, payments: list, error: null }),
      (err) => setSnap({ chave, payments: [], error: err })
    );
    // `assinar` é recriado a cada render por construção (fecha sobre os
    // parâmetros); a chave é o que de fato identifica a assinatura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const naChave = snap.chave === chave;
  return {
    payments: naChave ? snap.payments : [],
    loading: chave ? !naChave : false,
    error: naChave ? snap.error : null,
  };
}
export function usePaymentsByMonth(monthKey) {
  const { user } = useAuth();
  return useAssinaturaDePagamentos(
    monthKey && user?.uid ? `${monthKey}|${user.uid}` : null,
    (ok, erro) => watchPaymentsByMonth(monthKey, user?.uid, ok, erro)
  );
}

/**
 * Subscribe ao histórico de pagamentos de uma criança.
 *
 * SERVE OS DOIS PAPÉIS, E O ESCOPO SAI DAQUI
 * A mesma tela de histórico (`ChildPaymentHistory`) é montada no app do
 * motorista e no do responsável. As rules liberam um pelo `adminUid` e o
 * outro pelo `parentUid`, então o filtro tem que acompanhar quem está
 * olhando: com o filtro errado a consulta é NEGADA e a tela fica vazia
 * justamente pra quem tinha direito de ver.
 *
 * A decisão mora no hook e não na tela porque a tela já recebe `role` como
 * vocabulário (muda a palavra do status), e misturar "como eu falo" com "o
 * que eu posso ler" é como esses dois se desencontram numa refatoração.
 */
export function usePaymentsByChild(childId) {
  const { user, profile } = useAuth();

  const escopo = useMemo(
    () =>
      profile?.role === 'parent'
        ? { parentUid: user?.uid }
        : { adminUid: user?.uid },
    [profile?.role, user?.uid]
  );

  // O papel entra na chave: a mesma criança lida como responsável e como
  // motorista são duas assinaturas diferentes, e trocar de papel sem trocar de
  // chave manteria o resultado do escopo anterior na tela.
  return useAssinaturaDePagamentos(
    childId && user?.uid ? `${childId}|${profile?.role}|${user.uid}` : null,
    (ok, erro) => watchPaymentsByChild(childId, escopo, ok, erro)
  );
}

/**
 * Subscribe aos pagamentos do responsável autenticado (Pai).
 * Filtra por parentUid (compatível com firestore.rules).
 */
export function usePaymentsByParent(parentUid) {
  return useAssinaturaDePagamentos(parentUid || null, (ok, erro) =>
    watchPaymentsByParent(parentUid, ok, erro)
  );
}
