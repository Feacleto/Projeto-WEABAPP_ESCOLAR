import { useState } from 'react';

/**
 * QUAL PERUA ELA ESTÁ VENDO (05/10/2026, vínculo por par). Com dois tios
 * ativos, o topo de Hoje troca entre as duas; a escolha fica NESTE APARELHO
 * (localStorage), porque quem faz a ida com um e a volta com outro abre o app
 * e quer cair na perua em que estava. Com um tio só, não há escolha.
 *
 * ⚠️ A escolha guardada é só conveniência: se aquele tio não está mais entre
 * os ativos (ele desativou), vale o primeiro. E o armazenamento pode falhar
 * (janela anônima, dado bloqueado) — sem ele, a tela funciona igual.
 */
const CHAVE = 'alobuzinou:perua-da-auxiliar';

function lerGuardada() {
  try {
    return window.localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function usePeruaDaAuxiliar(ativos) {
  const [escolhida, setEscolhida] = useState(lerGuardada);
  const uids = (ativos || []).map((v) => v.motoristaUid);
  const atual = uids.includes(escolhida) ? escolhida : uids[0] || null;
  function escolher(uid) {
    setEscolhida(uid);
    try {
      window.localStorage.setItem(CHAVE, uid);
    } catch {
      // Sem armazenamento, a escolha vale até fechar o app.
    }
  }
  return { motoristaUid: atual, escolher };
}
