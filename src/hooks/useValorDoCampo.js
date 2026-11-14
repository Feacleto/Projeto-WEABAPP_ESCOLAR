import { useState } from 'react';
import { FASE } from '../compartilhado/salvarPorCampo.js';

/**
 * O VALOR DO BANCO ENTRA NO CAMPO SÓ QUANDO ELE NÃO ESTÁ DIGITANDO E A
 * ESCRITA DELE NÃO FALHOU (achado M4).
 *
 * O campo era remontado (`key`) a cada valor novo do banco. Numa escrita
 * RECUSADA, o Firestore desfaz o valor local, a escuta traz o antigo, e o
 * campo remontava com ele — "Não salvou" em cima do valor velho, e o que ele
 * digitou sumia. Agora: digitando, nada entra; em erro, fica o que ele
 * digitou (e o "Tentar de novo" reenvia); fora disso, o banco manda.
 * Ao REABRIR a linha, o campo em erro nasce com o texto digitado, que o
 * salvador da tela guarda (`digitado`).
 */
export function useValorDoCampo(valorDoBanco, estado) {
  const emErro = estado?.fase === FASE.ERRO;
  const [valor, setValor] = useState(() => (emErro && estado.digitado != null ? estado.digitado : valorDoBanco));
  const [visto, setVisto] = useState(valorDoBanco);
  const [editando, setEditando] = useState(false);
  if (valorDoBanco !== visto) {
    setVisto(valorDoBanco);
    if (!editando && !emErro) setValor(valorDoBanco);
  }
  return { valor, setValor, editando, setEditando };
}
