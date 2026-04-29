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
  await updateDoc(doc(db, 'users', uid), updates);
}
