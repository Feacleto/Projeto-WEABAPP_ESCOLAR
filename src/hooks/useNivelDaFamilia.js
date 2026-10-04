import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useActiveChild } from './useActiveChild';
import { usePaymentsByParent } from './usePayments';
import { useChildAbsenceHistory } from './useAbsences';
import { useRelogio } from './useRelogio';
import { permissaoDeAvisos } from '../compartilhado/browserEnv';
import { horariosCombinados } from '../dominio/rota/horarios.js';
import { calcularNivelDaFamilia } from '../dominio/identidade/nivelDaFamilia.js';

/**
 * O NÍVEL DA FAMÍLIA, calculado NO CELULAR DELA (`dominio/identidade/
 * nivelDaFamilia.js`). Nada é gravado: a conta usa o que ela já lê — as
 * mensalidades dela e as faltas do filho — e ninguém mais a vê.
 *
 * É POR MOTORISTA. Mãe com filhos em duas peruas tem um combinado com cada
 * tio, então o selo é o do motorista do filho ATIVO: as mensalidades entram
 * filtradas pelo `adminUid` dele, e irmãos com o mesmo tio somam como uma
 * família só (a régua junta pelo mês).
 *
 * ⚠️ As faltas são as do filho ativo (com a hora combinada dele). Irmãos na
 * mesma perua quase sempre faltam juntos e têm a mesma hora; ler a falta de
 * cada irmão pediria uma escuta por criança para um ganho quase nulo.
 *
 * "Avisos ligados" é a permissão DESTE aparelho mais um token gravado — o
 * mesmo par que diz se o aviso de chegada vai tocar aqui.
 *
 * Devolve `null` enquanto a criança não chegou: selo que aparece e some no
 * primeiro segundo é pior que selo que demora.
 */
export function useNivelDaFamilia() {
  const { user, profile } = useAuth();
  const { child } = useActiveChild();
  const adminUid = child?.adminUid || null;
  const { payments, loading } = usePaymentsByParent(user?.uid || null);
  const { history: faltas } = useChildAbsenceHistory(child?.id || null, adminUid);
  // O relógio anda de minuto em minuto: o Ouro cai no dia seguinte ao
  // vencimento sem ninguém precisar reabrir o app.
  const agora = useRelogio();

  const tokens = profile?.fcmTokens;
  const temToken = Array.isArray(tokens) ? tokens.length > 0 : !!tokens;

  return useMemo(() => {
    if (!child || loading) return null;
    const doTio = payments.filter((p) => !adminUid || p.adminUid === adminUid);
    const h = horariosCombinados(child);
    return calcularNivelDaFamilia({
      avisosLigados: permissaoDeAvisos() === 'granted' && temToken,
      segundoResponsavel: String(child.parent2Phone || '').replace(/\D/g, '').length >= 10,
      pagamentos: doTio,
      faltas,
      horas: { pega: h.pega, entrega: h.entrega },
      agora: agora.getTime(),
    });
  }, [child, loading, payments, adminUid, faltas, temToken, agora]);
}
