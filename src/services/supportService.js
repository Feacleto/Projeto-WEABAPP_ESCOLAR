import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  query,
  limit,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { notifyChamadoRespondido } from './notificationsService';
import { APP_VERSION } from '../version';

/**
 * Chamados de suporte abertos pelos usuários. Cada chamado vai pra
 * `supportTickets/` e fica acessível pra ele (dono) e pra admin do app
 * (que vê tudo). Sem update/delete — chamado é imutável.
 *
 * Forma do doc:
 *   {
 *     uid, role, version, category, description,
 *     deviceInfo: { userAgent, platform, screen, language },
 *     status: 'open',
 *     createdAt
 *   }
 */

const COLLECTION = 'supportTickets';

// Os assuntos da folha de suporte. `frase` é o que vai na mensagem do
// WhatsApp, escrita como a pessoa diria — ela não digita nada se não quiser.
// `naTela: false` mantém o rótulo para os chamados antigos (a aba do dono lê
// por aqui) sem oferecer o assunto de novo: "sugerir algo" virou "Outra coisa".
export const SUPPORT_CATEGORIES = [
  {
    value: 'cant_login',
    label: 'Não consigo entrar',
    frase: 'Não estou conseguindo entrar no app.',
  },
  {
    value: 'map_issue',
    label: 'O mapa não mostra a perua',
    frase: 'O mapa não está mostrando a perua.',
  },
  {
    value: 'notification_issue',
    label: 'O aviso não está chegando',
    frase: 'Os avisos do app não estão chegando no meu celular.',
  },
  {
    value: 'payment_issue',
    label: 'Problema com pagamento',
    frase: 'Estou com um problema no pagamento.',
  },
  {
    value: 'wrong_data',
    label: 'Tem um dado errado',
    frase: 'Tem uma informação errada no app.',
  },
  {
    value: 'other',
    label: 'Outra coisa',
    frase: 'Preciso de ajuda com:',
  },
  {
    value: 'feature_request',
    label: 'Sugestão',
    frase: 'Tenho uma sugestão para o app:',
    naTela: false,
  },
];

/**
 * O aparelho em uma palavra, para a mensagem do WhatsApp — o suporte lê
 * "Android" ou "iPhone", não um userAgent.
 */
export function aparelhoEmPalavras() {
  try {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone';
    if (/Android/i.test(ua)) return 'Android';
    return 'Computador';
  } catch {
    return '';
  }
}

/**
 * Pega informações do dispositivo automaticamente — útil pro admin
 * resolver o problema sem ficar perguntando "que celular você usa?".
 */
function getDeviceInfo() {
  try {
    return {
      userAgent: navigator.userAgent || '',
      platform: navigator.platform || '',
      language: navigator.language || '',
      screen:
        typeof window !== 'undefined' && window.screen
          ? `${window.screen.width}x${window.screen.height}`
          : '',
    };
  } catch {
    return {};
  }
}

/**
 * ⚠️ O CHAMADO CONTINUA SENDO GRAVADO, mesmo com a conversa indo pro WhatsApp
 * (03/10/2026). É ele que alimenta a aba Chamados do dono — a fila de quem
 * espera e o tempo até responder. `description` é a mensagem inteira que foi
 * para o WhatsApp, para o dono achar a conversa certa.
 */
export async function openSupportTicket({ uid, role, category, description }) {
  if (!uid) throw new Error('Sem uid.');
  if (!category) throw new Error('Escolha uma categoria.');

  await addDoc(collection(db, COLLECTION), {
    uid,
    role: role || 'parent',
    version: APP_VERSION,
    category,
    description: String(description || '').trim().slice(0, 2000),
    deviceInfo: getDeviceInfo(),
    status: 'open',
    createdAt: serverTimestamp(),
  });
}

/**
 * A CAIXA DE ENTRADA DO DONO — e ela não existia até 06/09/2026.
 *
 * O motorista E o responsável abrem chamado pelo menu de perfil, `addDoc`
 * grava, as rules liberam a leitura ao dono — e NENHUMA tela lia. Quem pedia
 * ajuda não recebia resposta, e não dizia por quê: cancelava.
 *
 * `limit` alto e ordenação no cliente, de propósito: a ordem que a caixa
 * precisa não é a de data (ver `dominio/suporte/chamados.js` — quem espera há
 * mais tempo vem primeiro), e ordenar isso no Firestore exigiria um índice
 * composto por um critério que muda de sentido conforme o status.
 */
export function watchChamados(cb, onError, max = 300) {
  return onSnapshot(
    query(collection(db, COLLECTION), limit(max)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[suporte] a caixa não assinou:', err);
      onError?.(err);
    }
  );
}

/**
 * Marca que a plataforma respondeu.
 *
 * NÃO É "FECHADO", e a diferença é o ponto: a maior parte dos chamados precisa
 * de uma segunda mensagem antes de acabar. Fundir os dois faria "respondi" e
 * "resolvi" virarem a mesma coisa — e aí ou a caixa nunca esvazia, ou fecha o
 * que não terminou.
 *
 * O texto da resposta NÃO é gravado: ela sai pelo WhatsApp, que é onde a
 * conversa continua. Guardar aqui uma cópia do que foi dito criaria um
 * histórico pela metade — sem o que a pessoa respondeu depois — e é pior que
 * não ter nenhum.
 */
/**
 * ⚠️ O `uid` DE QUEM ABRIU VEM POR PARÂMETRO, e não de uma leitura aqui.
 *
 * Quem chama é o `ChamadosTab`, que já tem o chamado inteiro na mão — ler o
 * documento de novo só pra descobrir o dono seria uma ida ao banco para um
 * dado que já está na tela.
 *
 * E o aviso é o que fecha o ciclo que esta aba abriu. Ela existe porque
 * `supportTickets` recebia desde sempre e nenhuma tela do dono lia — "quem
 * pede ajuda e não recebe resposta cancela sem dizer por quê". Só que
 * responder no painel também não avisava ninguém: metade do problema
 * continuava de pé.
 */
export async function marcarRespondido(id, ownerUid, uidDeQuemAbriu) {
  if (!id) throw new Error('Sem chamado.');
  await updateDoc(doc(db, COLLECTION, id), {
    status: 'respondido',
    respondidoEm: serverTimestamp(),
    respondidoPor: ownerUid || null,
  });
  // Depois da marcação, nunca antes: avisar de uma resposta que não foi
  // registrada é pior que não avisar.
  await notifyChamadoRespondido({ uid: uidDeQuemAbriu });
}

/** Acabou. */
export async function fecharChamado(id, ownerUid) {
  if (!id) throw new Error('Sem chamado.');
  await updateDoc(doc(db, COLLECTION, id), {
    status: 'fechado',
    fechadoEm: serverTimestamp(),
    fechadoPor: ownerUid || null,
  });
}

/** O rótulo da categoria, para a tela e para o texto da resposta. */
export function rotuloDaCategoria(valor) {
  return SUPPORT_CATEGORIES.find((c) => c.value === valor)?.label || 'Outra coisa';
}
