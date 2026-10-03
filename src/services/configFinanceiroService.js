import { doc, increment, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * O QUE O FINANCEIRO SABE DO MOTORISTA, FORA DO DOCUMENTO QUE AS FAMÍLIAS LEEM
 * (03/10/2026).
 *
 * `configFinanceiro/{uid}` — só o próprio motorista lê. Mora fora de `users`
 * porque as famílias leem `users` inteiro (precisam da chave PIX), e regra
 * não esconde campo.
 *
 *   temSenha     bool — gravado SÓ pelo servidor, ao criar a senha
 *   usoDaPerua   'so_rota' | 'tambem_fora' | ausente (ainda não perguntado)
 *   kmDasRotas   número que só sobe — km somados no celular dele durante as
 *                rotas. É um contador, como o hodômetro: o km entre dois
 *                abastecimentos é a diferença entre as duas leituras dele.
 *
 * ⚠️ O km é somado no aparelho e só o TOTAL é gravado. Nenhuma coordenada sai
 * daqui — o trajeto do motorista não é guardado em lugar nenhum.
 */

export const USO_DA_PERUA = {
  SO_ROTA: 'so_rota',
  TAMBEM_FORA: 'tambem_fora',
};

/** Escuta a configuração. Sem documento, entrega `{}`. */
export function watchConfigFinanceiro(uid, onUpdate) {
  if (!uid) {
    onUpdate({});
    return () => {};
  }
  return onSnapshot(
    doc(db, 'configFinanceiro', uid),
    (snap) => onUpdate(snap.exists() ? snap.data() : {}),
    (err) => {
      console.error('[configFinanceiro]', err);
      onUpdate({});
    }
  );
}

/** A resposta à pergunta "a perua roda só nas rotas?". */
export function definirUsoDaPerua(uid, uso) {
  if (!Object.values(USO_DA_PERUA).includes(uso)) {
    throw new Error('Uso da perua desconhecido.');
  }
  return setDoc(doc(db, 'configFinanceiro', uid), { usoDaPerua: uso }, { merge: true });
}

/** Soma os km de uma rota ao contador. Só valores positivos. */
export function somarKmDasRotas(uid, km) {
  const valor = Math.round(Number(km) * 10) / 10;
  if (!uid || !Number.isFinite(valor) || valor <= 0) return Promise.resolve();
  return setDoc(doc(db, 'configFinanceiro', uid), { kmDasRotas: increment(valor) }, { merge: true });
}
