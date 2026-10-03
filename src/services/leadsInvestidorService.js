import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * OS CONTATOS DE INVESTIDOR QUE CHEGARAM PELO SITE (02/10/2026).
 *
 * Quem grava é a function `registrarInteresseInvestidor`, a partir do
 * formulário de alobuzinou.com.br/investidores. Só o DONO lê (rules), e esta
 * é a única leitura: a aba "Investidores" do painel.
 */
export function watchLeadsInvestidor(onUpdate) {
  return onSnapshot(
    query(collection(db, 'leadsInvestidor'), orderBy('criadoEm', 'desc')),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('leadsInvestidor:', err);
      onUpdate([]);
    }
  );
}
