import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { watchAcessosDeHoje } from '../services/substitutaDeUmDiaService';
import { chaveDeHoje } from '../dominio/rota/rotaDaSubstituta.js';

/**
 * Os links de substituta de HOJE do motorista logado (F3). `null` enquanto
 * carrega; com a chave junto, para a troca de conta (ou a virada do dia) não
 * mostrar a lista anterior — o mesmo cuidado de `useSubstitutas`.
 */
export function useAcessosDeSubstituta() {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const hoje = chaveDeHoje();
  const chave = uid ? `${uid}|${hoje}` : null;
  const [estado, setEstado] = useState({ chave: null, lista: null });
  useEffect(() => {
    if (!uid) return undefined;
    const k = `${uid}|${hoje}`;
    return watchAcessosDeHoje(
      uid,
      hoje,
      (lista) => setEstado({ chave: k, lista }),
      () => setEstado({ chave: k, lista: [] })
    );
  }, [uid, hoje]);
  return { acessos: estado.chave === chave ? estado.lista : null, hoje };
}
