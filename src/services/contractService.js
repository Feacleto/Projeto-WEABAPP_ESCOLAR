import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
// `formatBRL` mora em `compartilhado/formatters.js`. Ele nao precisa de Firestore,
// e cinco componentes importavam ESTE service so pra formatar moeda.
import { formatBRL } from '../compartilhado/formatters';

export { formatBRL };
import { db } from '../firebase/config';

/**
 * Contrato de prestação de serviço de transporte escolar.
 *
 * - Conteúdo gerado a partir dos dados de admin (CONTRATADA) + child/parent
 *   (CONTRATANTE). Versionado via `CONTRACT_VERSION` pra evolução.
 * - Aceite eletrônico: pai entra no app, vê o contrato, digita o nome e marca
 *   o checkbox. App grava `contractAcceptedAt`, `contractAcceptedByUid`,
 *   `contractAcceptedName`, `contractHash` (SHA-256 dos dados) e `userAgent`
 *   no doc da criança.
 * - Placeholders fictícios usados se admin não preencheu dados da empresa,
 *   pra preservar a alta fidelidade visual do MVP.
 */

export const CONTRACT_VERSION = 1;

const PLACEHOLDER = {
  companyName: 'Tio Nino Transporte Escolar',
  companyDocument: '00.000.000/0000-00',
  companyAddress: 'São Paulo - SP',
};

/**
 * Monta o objeto de dados que alimenta o template do contrato.
 * Se algum campo da empresa do admin não está preenchido, usa placeholder.
 */
export function buildContractData({ child, admin }) {
  const today = new Date();
  const year = today.getFullYear();
  const monthlyFee = Number(child?.monthlyFee) || 0;
  const dueDay = Number(child?.dueDay) || 10;

  return {
    version: CONTRACT_VERSION,
    issuedAt: today.toISOString(),
    contractedYear: year,

    // CONTRATADA — Tio
    company: {
      name: admin?.companyName?.trim() || PLACEHOLDER.companyName,
      document:
        admin?.companyDocument?.trim() || PLACEHOLDER.companyDocument,
      address: admin?.companyAddress?.trim() || PLACEHOLDER.companyAddress,
      representative: admin?.name?.trim() || 'Representante legal',
      phone: admin?.phone || '',
      email: admin?.email || '',
    },

    // CONTRATANTE — Responsável
    parent: {
      name: child?.parentName?.trim() || '',
      email: child?.parentEmail?.trim() || '',
      phone: child?.parentPhone || '',
      address: child?.address?.trim() || '',
    },

    // ALUNO
    student: {
      name: child?.name?.trim() || '',
      homeAddress: child?.address?.trim() || '',
      school: child?.school?.trim() || '',
      schoolAddress: child?.schoolAddress?.trim() || '',
    },

    // FINANCEIRO
    finance: {
      monthlyFee, // numérico — formatamos na renderização
      dueDay,     // dia do mês 1-28
      installments: 12, // 12 parcelas, INCLUINDO férias (regra explícita)
    },

    // VIGÊNCIA
    period: {
      startDate: `01/01/${year}`,
      endDate: `31/12/${year}`,
      year,
    },

    // META
    inviteCode: child?.inviteCode || '',
    childId: child?.id || '',
  };
}

/**
 * Calcula um hash SHA-256 do conteúdo do contrato.
 * Usado como evidência: prova que o contrato aceito é o mesmo conteúdo
 * preservado depois (qualquer mudança gera hash diferente).
 *
 * Roda no browser via Web Crypto (built-in, sem libs).
 */
export async function computeContractHash(data) {
  const json = JSON.stringify(data);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(json);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Registra o aceite do contrato. Chamado quando o Pai digita o nome
 * e confirma o checkbox no ContractAcceptanceGate.
 *
 * As Firestore rules garantem:
 *   - parentUid do child == request.auth.uid
 *   - só pode escrever os campos de aceite (não pode mexer no resto)
 *   - aceite único: depois de aceitar, não pode reescrever
 */
export async function acceptContract({
  childId,
  parentUid,
  parentName,
  contractHash,
}) {
  if (!childId || !parentUid || !parentName) {
    throw new Error('Dados insuficientes pra aceitar contrato.');
  }
  await updateDoc(doc(db, 'children', childId), {
    contractVersion: CONTRACT_VERSION,
    contractAcceptedAt: serverTimestamp(),
    contractAcceptedByUid: parentUid,
    contractAcceptedName: parentName.trim(),
    contractHash: contractHash || null,
    contractUserAgent:
      typeof navigator !== 'undefined' ? navigator.userAgent : '',
  });
}

/**
 * Checa se o contrato corrente da criança foi aceito pelo pai.
 * Considera a versão atual — se a versão for bumped, exige novo aceite.
 */
export function hasAcceptedContract(child) {
  if (!child) return false;
  if (!child.contractAcceptedAt) return false;
  // Se a versão do aceite é antiga, exige novo aceite
  if ((child.contractVersion || 0) < CONTRACT_VERSION) return false;
  return true;
}

