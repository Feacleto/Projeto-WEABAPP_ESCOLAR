import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
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
  const storageRef = ref(storage, `profilePhotos/${uid}`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return await getDownloadURL(storageRef);
}

/**
 * Upload de foto de criança. Só admin pode (verificado nas storage.rules).
 * Path: childPhotos/{childId}
 */
export async function uploadChildPhoto(childId, file) {
  if (!childId) throw new Error('Sem childId.');
  const blob = await resizeAndCompress(file);
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
