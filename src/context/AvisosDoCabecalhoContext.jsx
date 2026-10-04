import { createContext, useContext, useId, useLayoutEffect } from 'react';

/**
 * OS AVISOS DO MOTORISTA MORAM LOGO ABAIXO DO CABEÇALHO — não acima dele.
 *
 * ── POR QUE (03/10/2026, auditoria de UX)
 * O `TioLayout` desenhava os avisos (mensalidade em aberto, fim do teste,
 * associação encerrando, convite de push) ACIMA do <Outlet />. Como o
 * cabeçalho de cada tela mora DENTRO do Outlet, os avisos ficavam em cima
 * dele e roubavam o canto superior esquerdo — o lugar onde o olho procura
 * "onde estou". Quem abria o app via um cartão de cobrança antes do nome da
 * tela.
 *
 * ── COMO
 * O layout continua sendo o DONO dos avisos (é ele que sabe de fatura, de
 * cobrança ligada e de em que tela está); o `Header` só diz "eu existo" e
 * desenha o que o layout entregou, logo depois do `<header>`. Quem não tem
 * `Header` (algumas telas usam um cabeçalho próprio) não se registra, e aí o
 * layout desenha os avisos no topo, como antes — nenhuma tela fica sem eles.
 *
 * Só o PRIMEIRO cabeçalho registrado desenha: uma tela que monte dois (um no
 * carregando, outro no conteúdo) não repete o aviso.
 *
 * ⚠️ O ESTADO DE "FECHADO" DE CADA AVISO NÃO PODE MORAR SÓ NO COMPONENTE.
 * Desenhados dentro do cabeçalho, eles remontam a cada troca de tela — e um
 * `useState(false)` faria o aviso fechado voltar na tela seguinte. Por isso
 * o fechar de cada um mora no `sessionStorage` (ou numa variável de módulo).
 *
 * ⚠️ A SUSPENSÃO NÃO PASSA POR AQUI. Ela é uma cortina `fixed` por cima de
 * tudo, e dentro da tela (que anima com `transform`) o `fixed` deixaria de ser
 * relativo à janela. Ela continua no layout.
 */
const AvisosDoCabecalhoContext = createContext(null);

export const AvisosDoCabecalhoProvider = AvisosDoCabecalhoContext.Provider;

/**
 * Para o `Header`: registra este cabeçalho e devolve os avisos que ele deve
 * desenhar logo abaixo de si (ou `null`). Fora do painel do motorista não há
 * provedor, e nada muda.
 */
export function useAvisosDoCabecalho() {
  const ctx = useContext(AvisosDoCabecalhoContext);
  const id = useId();
  const registrar = ctx?.registrar;
  // Layout effect: registrar antes da pintura evita um quadro com os avisos
  // em cima do cabeçalho e o seguinte com eles embaixo.
  useLayoutEffect(() => (registrar ? registrar(id) : undefined), [registrar, id]);
  if (!ctx || ctx.dono !== id) return null;
  return ctx.avisos ?? null;
}
