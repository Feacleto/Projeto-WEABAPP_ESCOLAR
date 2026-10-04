import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { TRILHA } from '../dominio/identidade/nivel.js';

/**
 * OS MARCOS PARTICULARES DA TRILHA "MEU NEGÓCIO" (docs/niveis.md, seção 6).
 *
 * "Revisão da perua feita", "Tenho contador", "Tenho CNPJ" — coisas que o app
 * não tem como conferir, e que por isso são DECLARADAS por ele. Moram em
 * `configFinanceiro/{uid}.marcosDeclarados.{chave}`, que só o próprio
 * motorista lê (fora de `users`, que as famílias leem inteiro).
 *
 * ⚠️ MARCO DECLARADO NUNCA CONTA PARA O NÍVEL (regra 2 de niveis.md): a régua
 * `calcularNivel` lê o campo só para a tela mostrar "você marcou". Quem
 * passar a somá-lo no Diamante transforma um clique em degrau.
 *
 * As chaves aceitas saem da própria TRILHA, para que um marco novo na régua
 * não precise ser lembrado aqui — e a rule de `configFinanceiro` (lista de
 * PERMITIDOS) precisa conhecer o mapa `marcosDeclarados` com as mesmas chaves.
 *
 * Grava booleano (true ao marcar, false ao desfazer) com `merge`: as outras
 * chaves do documento e os outros marcos ficam intactos.
 */

export const CHAVES_DOS_MARCOS = TRILHA.flatMap((fase) => fase.marcos.map((m) => m.id));

export function marcarMarcoDeclarado(uid, chave, feito) {
  if (!uid) throw new Error('Entre de novo para salvar.');
  if (!CHAVES_DOS_MARCOS.includes(chave)) throw new Error('Marco desconhecido.');
  return setDoc(
    doc(db, 'configFinanceiro', uid),
    { marcosDeclarados: { [chave]: feito === true } },
    { merge: true }
  );
}
