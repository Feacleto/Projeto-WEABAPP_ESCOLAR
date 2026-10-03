import { useLocation } from 'react-router-dom';
import Respiro from '../common/Respiro';
import FinanceiroTrancado from './FinanceiroTrancado';
import PrimeiraSenhaDoFinanceiro from './PrimeiraSenhaDoFinanceiro';
import EsqueciASenhaDoFinanceiro from './EsqueciASenhaDoFinanceiro';
import DigiteASenhaDoFinanceiro from './DigiteASenhaDoFinanceiro';
import { useTrancaDoFinanceiro } from '../../hooks/useTrancaDoFinanceiro';
import {
  CAIXA,
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
 *   5. no caixa?                       → a tela trancada
 *   6. noutro destino (link direto)?   → o teclado, a caminho DAQUELE destino
 *
 * Isto é cortina, não cofre: a segurança dos dados continua nas rules. Ver
 * `senhaDoFinanceiroService`.
 */
export default function GuardaDoFinanceiro({ children, voltarPara = null }) {
  const { pathname } = useLocation();
  const tranca = useTrancaDoFinanceiro();
  const aqui = normalizarCaminho(pathname);

  if (!rotaProtegida(aqui)) return children;

  if (tranca.fluxo === 'esqueci') return <EsqueciASenhaDoFinanceiro voltarPara={voltarPara} />;
  if (tranca.fluxo === 'criar' && tranca.temSenha !== undefined) {
    return <PrimeiraSenhaDoFinanceiro troca={tranca.temSenha} destino={aqui} voltarPara={voltarPara} />;
  }
  if (tranca.destravado) return children;
  if (tranca.temSenha === undefined) return <Respiro />;
  if (!tranca.temSenha) return <PrimeiraSenhaDoFinanceiro destino={aqui} voltarPara={voltarPara} />;
  if (aqui === CAIXA) return <FinanceiroTrancado />;
  return <DigiteASenhaDoFinanceiro destino={aqui} voltarPara={voltarPara} />;
}
