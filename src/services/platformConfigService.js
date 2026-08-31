import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Os interruptores que o DONO da plataforma liga e desliga sem deploy.
 *
 * POR QUE NÃO ENTROU EM appState/init
 * Aquele documento já existe e seria o lugar óbvio — mas a regra dele é
 * `allow update: if isAdmin()`, e neste projeto `admin` significa MOTORISTA.
 * Qualquer parceiro poderia abrir e fechar o período de avaliação da
 * plataforma inteira. A separação de papéis é recente e custou caro (ver
 * dominio/identidade/papeis.js); jogar um interruptor de plataforma numa porta de
 * operação desfaria isso em silêncio.
 *
 * Então `platformConfig/*` nasce com a regra certa: leitura pra todo mundo
 * (o app precisa saber se a janela está aberta antes mesmo de decidir o que
 * desenhar), escrita só de `isOwner()`.
 *
 * POR QUE NÃO É CONSTANTE NO CÓDIGO
 * Porque abrir avaliação é decisão de calendário, não de release. Se morasse
 * numa constante, toda campanha dependeria de alguém buildar e publicar — e
 * na prática isso significa que a campanha não acontece.
 */

const REF = () => doc(db, 'platformConfig', 'app');

/** O padrão quando o documento não existe: janela FECHADA. */
const PADRAO = { reviewOpen: false, reviewUntil: null };

/**
 * A janela está aberta AGORA?
 *
 * Duas condições, e as duas importam: o interruptor tem que estar ligado E
 * a data-limite não pode ter passado. Sem o prazo, um período aberto e
 * esquecido vira permanente — que é o estado que a gente estava tentando
 * sair.
 *
 * Sem prazo definido, o interruptor sozinho manda: é o caso de "deixa aberto
 * até eu fechar".
 */
export function janelaAberta(config) {
  if (!config?.reviewOpen) return false;
  const ate = config.reviewUntil?.toDate?.() || config.reviewUntil;
  if (!ate) return true;
  return new Date(ate).getTime() >= Date.now();
}

/** Leitura única. */
export async function getPlatformConfig() {
  try {
    const snap = await getDoc(REF());
    return snap.exists() ? { ...PADRAO, ...snap.data() } : PADRAO;
  } catch (err) {
    // Sem permissão ou offline: a janela CONTINUA FECHADA. Errar pro lado
    // do silêncio é seguro; errar pro outro enche o painel de pedido.
    console.error('[platformConfig] leitura falhou:', err);
    return PADRAO;
  }
}

/** Assinatura reativa — o painel do dono reflete o que ele acabou de mudar. */
export function watchPlatformConfig(cb) {
  return onSnapshot(
    REF(),
    (snap) => cb(snap.exists() ? { ...PADRAO, ...snap.data() } : PADRAO),
    (err) => {
      console.error('[platformConfig] assinatura falhou:', err);
      cb(PADRAO);
    }
  );
}

/** Só o dono chega aqui — as rules garantem. */
export async function setReviewWindow({ aberta, ate }) {
  await setDoc(
    REF(),
    {
      reviewOpen: !!aberta,
      reviewUntil: ate ? new Date(ate) : null,
      reviewUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
