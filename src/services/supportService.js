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

// Categorias mais comuns — chips na UI. Cada um traz um placeholder
// pra ajudar o usuário a descrever o problema.
export const SUPPORT_CATEGORIES = [
  {
    value: 'cant_login',
    label: 'Não consigo entrar',
    placeholder: 'Diz qual mensagem aparece quando você tenta entrar.',
  },
  {
    value: 'wrong_data',
    label: 'Dado errado no app',
    placeholder: 'Foto, nome, valor, endereço — me conta o que tá fora.',
  },
  {
    value: 'payment_issue',
    label: 'Problema com pagamento',
    placeholder: 'PIX não aparece, valor errado, marquei e sumiu...',
  },
  {
    value: 'map_issue',
    label: 'Mapa não mostra a perua',
    placeholder: 'Quando você abre o mapa, o que aparece?',
  },
  {
    value: 'notification_issue',
    label: 'Aviso não está chegando',
    placeholder: 'Qual tipo de aviso? Quando deveria ter chegado?',
  },
  {
    value: 'feature_request',
    label: 'Quero sugerir algo novo',
    placeholder: 'Conta a ideia com suas palavras.',
  },
  {
    value: 'other',
    label: 'Outro problema',
    placeholder: 'Me explica o que tá acontecendo, com detalhes.',
  },
];

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

export async function openSupportTicket({ uid, role, category, description }) {
  if (!uid) throw new Error('Sem uid.');
  if (!category) throw new Error('Escolha uma categoria.');
  if (!description?.trim()) throw new Error('Descreva o problema.');

  await addDoc(collection(db, COLLECTION), {
    uid,
    role: role || 'parent',
    version: APP_VERSION,
    category,
    description: description.trim().slice(0, 2000),
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
  return SUPPORT_CATEGORIES.find((c) => c.value === valor)?.label || 'Outro problema';
}
