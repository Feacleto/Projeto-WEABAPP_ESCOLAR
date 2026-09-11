import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
// A regra é pura e mora no domínio, que o Node carrega — aqui só se repassa,
// para quem já importa este service não precisar conhecer os dois caminhos.
export { escadaAberta } from '../dominio/associacao/ofertaDaPrimeiraRota.js';

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

/**
 * A JANELA DO DESCONTO DE FECHAMENTO — o dono abre e fecha a concessão.
 *
 * ── ⚠️ ELA MORA AQUI E NÃO EM `taxaConfig`, E O MOTIVO É QUEM PRECISA LER
 * `taxaConfig` é `read: isOwner()` de propósito: a estrutura de preço da
 * plataforma não vaza nem entre parceiros. Mas as telas que ANUNCIAM o
 * desconto rodam no cliente — a folha da oferta e o `AvisoDoTrial` —, e sem
 * saber que a janela fechou elas prometeriam um desconto que o servidor não
 * vai gravar.
 *
 * É exatamente o defeito do dia de vencimento, que fez TODO contrato assinado
 * dizer "todo dia 10": a tela lendo um campo que ela não tinha. `platformConfig`
 * já nasceu com a regra certa — `read: if true`, `write: if isOwner()` —, e
 * "existe desconto de conversão em aberto" é informação de VITRINE, não
 * estrutura de preço. Uma fonte só, lida pelos dois lados.
 *
 * ── ⚠️ ABERTA É O PADRÃO, E A AUSÊNCIA CONTA COMO ABERTA
 * Base antiga não tem o campo, e tratar ausente como fechada tiraria o
 * desconto de todo mundo que contratasse depois do deploy — sem ninguém ter
 * desligado nada e sem erro em lugar nenhum. Desligar precisa ser um ato; o
 * silêncio do banco não pode valer por ele.
 *
 * ── ⚠️ E ELA NÃO ALCANÇA QUEM JÁ TEM
 * Fechar a janela não mexe em nenhum desconto concedido: eles estão gravados
 * em `users.descontos` com `ate: null`, o contrato assinado declara "sem prazo
 * enquanto este contrato estiver vigente", e `contratarPlano` preserva pelo
 * ramo `jaTinha`. Não conceder é diferente de desfazer o que foi concedido.
 */
export async function setJanelaEscada(aberta) {
  await setDoc(
    REF(),
    { janelaEscada: aberta !== false, atualizadoEm: serverTimestamp() },
    { merge: true }
  );
}
