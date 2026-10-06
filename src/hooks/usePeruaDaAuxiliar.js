import { useEffect, useState } from 'react';

/**
 * QUAL PERUA ELA ESTÁ VENDO (05/10/2026, vínculo por par). Com dois tios
 * ativos, o topo de Hoje troca entre as duas; a escolha fica NESTE APARELHO
 * (localStorage), porque quem faz a ida com um e a volta com outro abre o app
 * e quer cair na perua em que estava. Com um tio só, não há escolha.
 *
 * ⚠️ A escolha guardada é só conveniência: se aquele tio não está mais entre
 * os ativos (ele desativou), vale o primeiro. E o armazenamento pode falhar
 * (janela anônima, dado bloqueado) — sem ele, a tela funciona igual.
 *
 * ⚠️ A TROCA MORA NA FOLHA DA MARCA (05/10/2026, decisão do dono): ela toca
 * no logo do cabeçalho e escolhe em "Trabalhando para". O Hoje, a Foto e o
 * cabeçalho leem a mesma escolha, cada um com o seu `usePeruaDaAuxiliar` —
 * então escolher AVISA as outras instâncias (um evento na janela), senão a
 * folha trocaria de tio e o Hoje por baixo continuaria no outro.
 */
const CHAVE = 'alobuzinou:perua-da-auxiliar';
const EVENTO = 'alobuzinou:trocou-de-perua';

function lerGuardada() {
  try {
    return window.localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function usePeruaDaAuxiliar(ativos) {
  const [escolhida, setEscolhida] = useState(lerGuardada);
  useEffect(() => {
    const ouvir = (e) => setEscolhida(e.detail);
    window.addEventListener(EVENTO, ouvir);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, []);
  const uids = (ativos || []).map((v) => v.motoristaUid);
  const atual = uids.includes(escolhida) ? escolhida : uids[0] || null;
  function escolher(uid) {
    setEscolhida(uid);
    try {
      window.localStorage.setItem(CHAVE, uid);
    } catch {
      // Sem armazenamento, a escolha vale até fechar o app.
    }
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: uid }));
  }
  return { motoristaUid: atual, escolher };
}
