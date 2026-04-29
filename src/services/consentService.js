import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { LEGAL_VERSION } from '../pages/legal/legalContent';

// =============================================================================
// Aceite de Termos / Privacidade — persistido em users/{uid}
// =============================================================================

/**
 * Marca que o usuário aceitou os termos e a política da versão atual.
 * Chamado durante signup E pelo gate quando usuário antigo precisa re-aceitar
 * após upgrade da versão.
 */
export async function acceptTerms(uid) {
  await updateDoc(doc(db, 'users', uid), {
    termsAcceptedAt: serverTimestamp(),
    termsVersion: LEGAL_VERSION,
    privacyAcceptedAt: serverTimestamp(),
    privacyVersion: LEGAL_VERSION,
  });
}

/**
 * Verifica se o usuário aceitou a versão CORRENTE dos termos.
 * Retorna true se versão aceita == versão atual.
 */
export function hasAcceptedCurrentTerms(profile) {
  if (!profile) return false;
  return (
    profile.termsVersion === LEGAL_VERSION &&
    profile.privacyVersion === LEGAL_VERSION &&
    !!profile.termsAcceptedAt
  );
}

// =============================================================================
// Cookies — preferências persistidas em localStorage
// =============================================================================
//
// Estrutura: { essential: true, analytics: bool, decidedAt: ISO, version }
// "essential" sempre true — cookies essenciais não dependem de consentimento.
// "analytics" controla se Firebase Analytics pode ser inicializado.

const COOKIE_KEY = 'tn_cookie_consent_v1';
const COOKIE_VERSION = '1';

export function getCookieConsent() {
  try {
    const raw = localStorage.getItem(COOKIE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Se versão mudou, ignora pra refazer pergunta
    if (parsed.version !== COOKIE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCookieConsent({ analytics }) {
  const consent = {
    essential: true,
    analytics: !!analytics,
    decidedAt: new Date().toISOString(),
    version: COOKIE_VERSION,
  };
  try {
    localStorage.setItem(COOKIE_KEY, JSON.stringify(consent));
  } catch (err) {
    console.error('Falha ao salvar consentimento de cookies:', err);
  }
  return consent;
}

export function clearCookieConsent() {
  try {
    localStorage.removeItem(COOKIE_KEY);
  } catch (err) {
    console.error('Falha ao limpar consentimento:', err);
  }
}
