import { useContext } from 'react';
import { TrancaDoFinanceiroContext } from '../context/trancaDoFinanceiroContextObject';

const FORA_DO_PROVEDOR = {
  destravado: false,
  temSenha: undefined,
  preferencia: 'sempre',
  fluxo: null,
  abrirCom: () => {},
  trancar: () => {},
  definirPreferencia: () => {},
  iniciarCriacao: () => {},
  pedirTrocaDeSenha: () => {},
  irParaCriacao: () => {},
  cancelarFluxo: () => {},
};

/**
 * A tranca do Financeiro — ver `TrancaDoFinanceiroContext.jsx`.
 *
 * Fora do provedor responde TRANCADO e sem ação: quem chamar o hook por
 * engano numa tela sem provedor vê a tela fechada, nunca o caixa aberto.
 */
export function useTrancaDoFinanceiro() {
  return useContext(TrancaDoFinanceiroContext) || FORA_DO_PROVEDOR;
}
