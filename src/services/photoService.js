import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { STORAGE_ENABLED, STORAGE_OFF_MESSAGE } from '../config/capabilities';
import { storage } from '../firebase/config';

/**
 * Upload de fotos pra Firebase Storage.
 *
 * Fluxo:
 *   1. Recebe File (ex: <input type=file>)
 *   2. Redimensiona pra MAX_SIZE px (mantém aspect ratio)
 *   3. Comprime como JPEG q=0.85
 *   4. Upload Storage no path apropriado
 *   5. Retorna URL pública (downloadURL)
 *
 * Os paths são sobrescritíveis (sempre o mesmo id) — nova foto substitui a anterior.
 */

const MAX_SIZE = 400; // px (foto de perfil — não precisa mais)
const JPEG_QUALITY = 0.85;

/**
 * Redimensiona e comprime uma imagem client-side via canvas.
 * Retorna um Blob JPEG menor.
 */
export async function resizeAndCompress(file, maxSize = MAX_SIZE) {
  if (!file) throw new Error('Nenhum arquivo informado.');

  // Cria um bitmap a partir do arquivo (rápido, sem File Reader)
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // Calcula novas dimensões mantendo aspect
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  // Converte pra Blob JPEG comprimido
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Falha ao comprimir imagem.'));
      },
      'image/jpeg',
      JPEG_QUALITY
    );
  });
}

/**
 * Upload de foto de perfil (tio ou pai).
 * Path: profilePhotos/{uid}
 * Retorna a downloadURL.
 */
export async function uploadProfilePhoto(uid, file) {
  if (!uid) throw new Error('Sem uid.');
  const blob = await resizeAndCompress(file);
  // A interface não oferece este caminho quando Storage está desligado.
  // Se a execução chegou aqui, é chamada nova que não checou — e o erro
  // precisa dizer isso, em vez de virar falha de rede genérica que manda
  // o próximo a debugar a conexão do usuário.
  if (!STORAGE_ENABLED) throw new Error(STORAGE_OFF_MESSAGE);

  const storageRef = ref(storage, `profilePhotos/${uid}`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return await getDownloadURL(storageRef);
}

/**
 * O LOGO DA MARCA DO MOTORISTA — o que aparece no cabeçalho das famílias.
 * Path: marcaLogos/{uid}
 *
 * NÃO É A FOTO DE PERFIL, e por isso não reusa o path dela. A foto de perfil
 * é o rosto dele num avatar de 32px; o logo é a identidade do negócio, e ele
 * vai pro topo da tela de todo responsável que ele atende. Um motorista pode
 * querer o próprio rosto nos dois lugares — mas quem decide é ele, e com um
 * path só essa escolha não existiria.
 *
 * Passa pelo mesmo `resizeAndCompress`: logo vem de print de rede social, de
 * foto de adesivo da van, de PNG de 4 MB que alguém mandou no WhatsApp. Sem
 * reduzir, o cabeçalho do pai — que carrega em dado móvel, toda vez — pagaria
 * por isso.
 */
export async function uploadMarcaLogo(uid, file) {
  if (!uid) throw new Error('Sem uid.');
  const blob = await resizeAndCompress(file);
  if (!STORAGE_ENABLED) throw new Error(STORAGE_OFF_MESSAGE);

  const storageRef = ref(storage, `marcaLogos/${uid}`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return await getDownloadURL(storageRef);
}

export async function deleteMarcaLogo(uid) {
  if (!uid) return;
  try {
    await deleteObject(ref(storage, `marcaLogos/${uid}`));
  } catch {
    // Já não existia. Apagar o que não está lá não é erro.
  }
}

/**
 * Upload de foto de criança. Só admin pode (verificado nas storage.rules).
 * Path: childPhotos/{childId}
 */
export async function uploadChildPhoto(childId, file) {
  if (!childId) throw new Error('Sem childId.');
  const blob = await resizeAndCompress(file);
  // A interface não oferece este caminho quando Storage está desligado.
  // Se a execução chegou aqui, é chamada nova que não checou — e o erro
  // precisa dizer isso, em vez de virar falha de rede genérica que manda
  // o próximo a debugar a conexão do usuário.
  if (!STORAGE_ENABLED) throw new Error(STORAGE_OFF_MESSAGE);

  const storageRef = ref(storage, `childPhotos/${childId}`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return await getDownloadURL(storageRef);
}

export async function deleteProfilePhoto(uid) {
  if (!uid) return;
  try {
    await deleteObject(ref(storage, `profilePhotos/${uid}`));
  } catch (err) {
    // 404 / object-not-found é OK (não existia)
    if (err?.code !== 'storage/object-not-found') {
      console.error('Falha ao apagar foto de perfil:', err);
    }
  }
}

export async function deleteChildPhoto(childId) {
  if (!childId) return;
  try {
    await deleteObject(ref(storage, `childPhotos/${childId}`));
  } catch (err) {
    if (err?.code !== 'storage/object-not-found') {
      console.error('Falha ao apagar foto da criança:', err);
    }
  }
}

// ============================================================================
// Comprovante de pagamento
// ============================================================================

/**
 * Sobe o comprovante que o pai anexa ao avisar que pagou.
 *
 * Aceita imagem (foto do print) e PDF (o que o banco gera). Imagem passa
 * pelo resize; PDF sobe como está, porque comprimir PDF no cliente não vale
 * a complexidade — as rules limitam a 2 MB de qualquer forma.
 *
 * Retorna a URL de download.
 */
export async function uploadPaymentReceipt(paymentId, file) {
  if (!paymentId) throw new Error('Sem paymentId.');
  if (!file) throw new Error('Sem arquivo.');

  const isPdf = file.type === 'application/pdf';
  const payload = isPdf ? file : await resizeAndCompress(file);

  // A interface não oferece este caminho quando Storage está desligado.
  // Se a execução chegou aqui, é chamada nova que não checou — e o erro
  // precisa dizer isso, em vez de virar falha de rede genérica que manda
  // o próximo a debugar a conexão do usuário.
  if (!STORAGE_ENABLED) throw new Error(STORAGE_OFF_MESSAGE);

  const fileRef = ref(storage, `paymentReceipts/${paymentId}`);
  await uploadBytes(fileRef, payload, {
    contentType: isPdf ? 'application/pdf' : 'image/jpeg',
  });
  return getDownloadURL(fileRef);
}

/**
 * O CONTRATO QUE JÁ EXISTIA — foto ou PDF, guardado como prova do passado.
 *
 * POR QUE ISTO EXISTE
 * O motorista que chega ao app já tem acordo com as famílias dele, no papel
 * ou num PDF trocado por WhatsApp. O contrato do app não substitui a memória
 * daquilo: ele é gerado dos campos (mensalidade, vencimento, vigência) e
 * passa a valer da assinatura em diante. O que veio antes -- e é o que
 * responde uma discussão sobre o que foi combinado no ano passado -- só
 * existe naquele arquivo.
 *
 * NÃO É O CONTRATO DO APP, e a interface precisa dizer isso. Este anexo não
 * é lido, não gera cobrança e não vale como aceite; é arquivo morto,
 * proposital. Quem confunde os dois acaba achando que anexar o papel dispensa
 * o aceite do responsável -- e aí opera sem contrato nenhum válido.
 *
 * QUEM SOBE É O MOTORISTA. O responsável está do outro lado da mesa da
 * negociação: documento que define quanto ele paga não pode entrar pela mão
 * dele, pelo mesmo princípio que faz o pai só escrever `claimed` e nunca
 * `paid`.
 */
export async function uploadContratoAnterior(childId, file) {
  if (!childId) throw new Error('Sem childId.');
  if (!file) throw new Error('Sem arquivo.');

  const isPdf = file.type === 'application/pdf';
  // Foto de contrato passa pelo resize como qualquer imagem: são páginas
  // fotografadas de perto, e 4 MB por página estouraria o limite das rules
  // sem ganhar legibilidade nenhuma.
  const payload = isPdf ? file : await resizeAndCompress(file);
  if (!STORAGE_ENABLED) throw new Error(STORAGE_OFF_MESSAGE);

  const fileRef = ref(storage, `contratosAnteriores/${childId}`);
  await uploadBytes(fileRef, payload, {
    contentType: isPdf ? 'application/pdf' : 'image/jpeg',
  });
  return getDownloadURL(fileRef);
}

export async function deleteContratoAnterior(childId) {
  if (!childId) return;
  try {
    await deleteObject(ref(storage, `contratosAnteriores/${childId}`));
  } catch {
    // Já não existia. Apagar o que não está lá não é erro.
  }
}

/** Remove o comprovante (pai trocando o arquivo errado, ou admin limpando). */
export async function deletePaymentReceipt(paymentId) {
  try {
    await deleteObject(ref(storage, `paymentReceipts/${paymentId}`));
  } catch (err) {
    // Não existir não é erro — o chamador só quer garantir que não está lá.
    if (err?.code !== 'storage/object-not-found') throw err;
  }
}

/**
 * SHA-256 do arquivo, em hexadecimal.
 *
 * PARA QUE SERVE
 * Detectar comprovante REUSADO — mandar o mesmo print de julho como se fosse
 * o de agosto. É o abuso mais comum e mais fácil de acontecer sem má-fé
 * (a pessoa procura na galeria e pega o arquivo errado).
 *
 * O que isto NÃO faz: verificar se o pagamento existiu. Nenhuma análise de
 * imagem faz isso — só a conciliação com o extrato do banco faz. Aqui o
 * objetivo é dar ao tio um AVISO ("este comprovante é idêntico ao de julho")
 * e deixar a decisão com ele. Heurística que acusa sozinha erra e estraga
 * relação.
 *
 * Usa Web Crypto, disponível em qualquer navegador em contexto seguro.
 */
export async function fileHash(file) {
  if (!file || !crypto?.subtle) return null;
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (err) {
    console.error('fileHash:', err);
    return null;
  }
}
