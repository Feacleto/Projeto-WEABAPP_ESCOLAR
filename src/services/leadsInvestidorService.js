import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
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
    // Teto de segurança (03/10/2026): a coleção só cresce, e o formulário é público.
    query(collection(db, 'leadsInvestidor'), orderBy('criadoEm', 'desc'), limit(300)),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('leadsInvestidor:', err);
      onUpdate([]);
    }
  );
}
