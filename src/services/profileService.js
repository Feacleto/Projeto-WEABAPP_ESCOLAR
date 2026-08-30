import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Atualiza campos do próprio perfil (users/{uid}).
 * As Firestore rules garantem que role nunca muda — qualquer outro campo
 * é livre pro dono. Recebe um objeto parcial.
 */
export async function updateProfile(uid, data) {
  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.companyName !== undefined) updates.companyName = data.companyName;
  if (data.companyDocument !== undefined) updates.companyDocument = data.companyDocument;
  if (data.companyAddress !== undefined) updates.companyAddress = data.companyAddress;
  await updateDoc(doc(db, 'users', uid), updates);
}

/**
 * Define ou remove a foto de perfil (URL pública do Storage).
 * Passa null pra resetar e voltar ao avatar gerado automaticamente.
 */
export async function setProfilePhotoURL(uid, photoURL) {
  await updateDoc(doc(db, 'users', uid), { photoURL: photoURL || null });
}
