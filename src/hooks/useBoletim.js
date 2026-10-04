import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { watchArrears, watchPaymentsSince } from '../services/paymentsService';
import { addMonths, getCurrentMonthKey } from '../compartilhado/formatters';

/**
 * O ÚLTIMO BOLETIM FECHADO QUE ELE ABRIU, neste aparelho — o que apaga o selo
 * "Boletim de setembro pronto" da tela trancada. Guarda só o mês ('AAAA-MM').
 */
const chaveDoVisto = (uid) => `boletimVisto:${uid}`;

export function lerBoletimVisto(uid) {
  if (!uid) return null;
  try {
    return localStorage.getItem(chaveDoVisto(uid));
  } catch {
    return null;
  }
}

export function marcarBoletimVisto(uid, mes) {
  if (!uid || !mes) return;
  try {
    localStorage.setItem(chaveDoVisto(uid), mes);
  } catch {
    /* sem armazenamento, o selo só fica até o dia 7 */
  }
}

/** Quantos meses o Boletim alcança: os 12 do seletor, contando o corrente. */
export const MESES_DO_BOLETIM = 12;

/**
 * AS MENSALIDADES QUE O BUZI E O BOLETIM LEEM, ao vivo.
 *
 * Duas escutas, as duas do próprio motorista:
 *   - os últimos 12 meses (o "quanto entrou" e o Boletim fechado de cada mês);
 *   - o que está ABERTO de antes disso (o atrasado velho não some da lista
 *     só porque passou da janela).
 * Juntas por id. Devolve `null` enquanto qualquer uma não chegou — resposta
 * montada com meia lista diria "nenhum atrasado" por um segundo.
 */
export function useBoletim() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const desde = useMemo(() => addMonths(getCurrentMonthKey(), -(MESES_DO_BOLETIM - 1)), []);
  const [janela, setJanela] = useState({ uid: null, lista: null });
  const [antigos, setAntigos] = useState({ uid: null, lista: null });
  const [atualizadoEm, setAtualizadoEm] = useState(null);

  useEffect(() => {
    if (!uid) return undefined;
    return watchPaymentsSince(desde, uid, (lista) => {
      setJanela({ uid, lista });
      setAtualizadoEm(new Date());
    });
  }, [uid, desde]);

  useEffect(() => {
    if (!uid) return undefined;
    return watchArrears(desde, uid, (lista) => {
      setAntigos({ uid, lista });
      setAtualizadoEm(new Date());
    });
  }, [uid, desde]);

  const pagamentos = useMemo(() => {
    if (janela.uid !== uid || antigos.uid !== uid || !janela.lista || !antigos.lista) return null;
    const porId = new Map();
    [...antigos.lista, ...janela.lista].forEach((p) => porId.set(p.id, p));
    return [...porId.values()];
  }, [uid, janela, antigos]);

  return { pagamentos, atualizadoEm, desde };
}
