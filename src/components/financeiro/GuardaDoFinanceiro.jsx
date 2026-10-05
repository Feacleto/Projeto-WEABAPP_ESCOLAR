import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PontosDeEspera from '../common/PontosDeEspera';
import PrimeiraSenhaDoFinanceiro from './PrimeiraSenhaDoFinanceiro';
import EsqueciASenhaDoFinanceiro from './EsqueciASenhaDoFinanceiro';
import DigiteASenhaDoFinanceiro from './DigiteASenhaDoFinanceiro';
import { useTrancaDoFinanceiro } from '../../hooks/useTrancaDoFinanceiro';
import { aquecerSenhaDoFinanceiro } from '../../services/senhaDoFinanceiroService';
import {
  normalizarCaminho,
  rotaProtegida,
} from '../../dominio/identidade/trancaDoFinanceiro.js';

/**
 * O GUARDA DO FINANCEIRO (03/10/2026) — decide o que aparece no lugar das
 * telas de dinheiro.
 *
 * ⚠️ ELE DECIDE PELO CAMINHO, NÃO PELA ROTA EM QUE FOI MONTADO. No `/tio` ele
 * envolve o `<Outlet />` do `TioLayout` inteiro e só age quando
 * `rotaProtegida(pathname)` — então toda tela nova pendurada em
 * `/tio/finance/…` nasce protegida, sem ninguém lembrar de embrulhá-la. Uma
 * lista de rotas embrulhadas à mão seria a tela que alguém esquece. Em
 * `/tio/taxa`, que mora fora do layout, ele envolve a rota no `App.jsx`
 * (`voltarPara`: lá não há barra de baixo, e a tela precisa de saída).
 *
 * A ordem das perguntas:
 *   1. está trocando/criando a senha?  → o fluxo (vale até com o Financeiro
 *      aberto: "Trocar a senha" dos ajustes acontece lá dentro)
 *   2. destravado?                     → as telas de verdade
 *   3. ainda não se sabe se há senha?  → espera, sem piscar a tela errada
 *   4. não há senha?                   → a primeira vez
 *   5. trancado?                       → o teclado, a caminho DAQUELE destino
 *
 * ⚠️ O CAIXA NÃO TEM MAIS TELA TRANCADA PRÓPRIA (04/10/2026, simulação "Rota
 * e Central"). Ela tinha Abastecer, PIX e Despesa sem senha para a auxiliar;
 * agora o lugar da auxiliar é a ROTA (a Central sem senha), e fora dela a
 * Central é do motorista: abre direto no teclado.
 *
 * Isto é cortina, não cofre: a segurança dos dados continua nas rules. Ver
 * `senhaDoFinanceiroService`.
 */
export default function GuardaDoFinanceiro({ children, voltarPara = null }) {
  const { pathname } = useLocation();
  const tranca = useTrancaDoFinanceiro();
  const aqui = normalizarCaminho(pathname);
  const vaiPedirSenha = rotaProtegida(aqui) && tranca.temSenha === true && !tranca.destravado;

  // ⚠️ ACORDA O SERVIDOR DA SENHA ENQUANTO ELE OLHA A TELA (04/10/2026). A
  // conferência é uma callable, e a primeira chamada depois de um tempo parado
  // espera a function "ligar" — 3 a 10 s com o teclado na mão. Um pedido vazio
  // assim que a tela trancada aparece faz essa espera acontecer enquanto ele
  // ainda está lendo, não depois de digitar.
  useEffect(() => {
    if (vaiPedirSenha) aquecerSenhaDoFinanceiro();
  }, [vaiPedirSenha]);

  if (!rotaProtegida(aqui)) return children;

  if (tranca.fluxo === 'esqueci') return <EsqueciASenhaDoFinanceiro voltarPara={voltarPara} />;
  if (tranca.fluxo === 'criar' && tranca.temSenha !== undefined) {
    return <PrimeiraSenhaDoFinanceiro troca={tranca.temSenha} destino={aqui} voltarPara={voltarPara} />;
  }
  if (tranca.destravado) return children;
  if (tranca.temSenha === undefined) return <PontosDeEspera titulo="Financeiro" rotulo="Abrindo" />;
  if (!tranca.temSenha) return <PrimeiraSenhaDoFinanceiro destino={aqui} voltarPara={voltarPara} />;
  return <DigiteASenhaDoFinanceiro destino={aqui} voltarPara={voltarPara} />;
}
