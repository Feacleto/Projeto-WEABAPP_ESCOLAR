import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
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
