/**
 * A DIGITAL OU O ROSTO NO FINANCEIRO (03/10/2026).
 *
 * WebAuthn com o autenticador da PLATAFORMA (o leitor de digital ou a câmera
 * de rosto do próprio celular), com `userVerification: 'required'` — o
 * sistema só devolve a credencial depois de conferir o dedo ou o rosto do
 * dono do aparelho.
 *
 * ── A CONFERÊNCIA É LOCAL, E ISSO É DECISÃO DO DONO
 * Nada vai ao servidor: o id da credencial fica neste aparelho
 * (`alobuzinou:financeiro:biometria:{uid}`) e "deu certo" é o navegador
 * devolver a credencial. O ganho é o que o dono pediu: a digital funciona SEM
 * INTERNET — no meio-fio, no sinal ruim, é ela que abre quando a senha (que
 * é conferida no servidor) não consegue.
 *
 * ── ⚠️ O LIMITE, ESCRITO
 * É CORTINA CONTRA QUEM ESTÁ DO LADO, NÃO COFRE. A sessão do Firebase é a
 * mesma com ou sem digital: quem tem as ferramentas do navegador lê os
 * documentos sem passar por aqui. O que ela impede é a auxiliar, o filho ou o
 * colega VEREM o caixa na tela — o mesmo limite da senha
 * (`senhaDoFinanceiroService`). E qualquer digital cadastrada no celular
 * abre: quem tem a própria digital no aparelho do motorista passa. A
 * separação de verdade é a conta própria da auxiliar.
 *
 * Sem suporte no aparelho, `biometriaDisponivel()` responde `false` e a opção
 * simplesmente não aparece. Todo acesso ao armazenamento está em try/catch:
 * janela anônima e site bloqueado devolvem "desligada", nunca um erro.
 */

const chave = (uid) => `alobuzinou:financeiro:biometria:${uid}`;

function lerCredencial(uid) {
  if (!uid) return null;
  try {
    return window.localStorage.getItem(chave(uid)) || null;
  } catch {
    return null;
  }
}

function paraBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(texto) {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const cheio = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(cheio);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Desafio local: sem servidor, ele só precisa existir e não se repetir. */
function desafio() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return b;
}

/** O aparelho tem digital ou rosto que o navegador sabe usar? */
export async function biometriaDisponivel() {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
    const fn = window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable;
    if (typeof fn !== 'function') return false;
    return await fn.call(window.PublicKeyCredential);
  } catch {
    return false;
  }
}

/** Já foi ligada neste aparelho, para esta conta? */
export function biometriaLigada(uid) {
  return !!lerCredencial(uid);
}

/**
 * Cadastra a digital/rosto. Devolve `true` se ligou; `false` se a pessoa
 * cancelou ou o aparelho recusou (nunca lança: "agora não" não é erro).
 */
export async function ligarBiometria(uid, nome) {
  if (!uid) return false;
  try {
    const credencial = await navigator.credentials.create({
      publicKey: {
        challenge: desafio(),
        rp: { name: 'Alô Buzinou', id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(uid),
          name: nome || 'Motorista',
          displayName: nome || 'Motorista',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
        },
        timeout: 60000,
        attestation: 'none',
      },
    });
    if (!credencial?.rawId) return false;
    try {
      window.localStorage.setItem(chave(uid), paraBase64Url(credencial.rawId));
    } catch {
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[biometria] não ligou:', err?.name || err);
    return false;
  }
}

/**
 * Pede a digital/rosto. `true` = conferiu (destrava); `false` = cancelou,
 * falhou ou não está ligada — quem chama cai no teclado.
 */
export async function conferirBiometria(uid) {
  const id = lerCredencial(uid);
  if (!id) return false;
  try {
    const resposta = await navigator.credentials.get({
      publicKey: {
        challenge: desafio(),
        rpId: window.location.hostname,
        allowCredentials: [{ type: 'public-key', id: deBase64Url(id) }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!resposta;
  } catch (err) {
    console.warn('[biometria] não conferiu:', err?.name || err);
    return false;
  }
}

/** Esquece a credencial neste aparelho. A senha continua valendo. */
export function desligarBiometria(uid) {
  if (!uid) return;
  try {
    window.localStorage.removeItem(chave(uid));
  } catch {
    // Sem armazenamento, não havia o que esquecer.
  }
}
