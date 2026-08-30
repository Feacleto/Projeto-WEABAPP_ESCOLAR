import { useRef, useState } from 'react';

/**
 * PUXAR A FOLHA PRA BAIXO PRA FECHAR.
 *
 * O tracinho no topo das folhas é o sinal universal de "me puxa", e ele estava
 * desenhado nos dois componentes de folha sem estar ligado em nenhum: a pessoa
 * arrastava, nada acontecia, e aprendia que o gesto não existe neste app.
 * Affordance desenhada e morta é pior que affordance ausente, porque ensina o
 * contrário do que é verdade.
 *
 * UM HOOK, E NÃO A LÓGICA COPIADA NOS DOIS. `Sheet` e `AppSheet` são folhas
 * diferentes por motivos legítimos (uma tem a tampa escura da marca, a outra é
 * clara e interna), mas o GESTO é o mesmo — e gesto que se comporta diferente
 * conforme a folha é o tipo de inconsistência que ninguém reporta e todo mundo
 * sente. Duas cópias divergem no primeiro ajuste de limiar.
 *
 * QUEM MONTA DECIDE ONDE O GESTO PEGA, e a resposta certa é sempre o
 * cabeçalho — nunca o corpo. Numa folha comprida (a lista de notificações, o
 * formulário da associação) todo arrasto pra baixo dentro do conteúdo é
 * intenção de rolar; fechar ali faria a folha fugir da mão de quem só queria
 * ler o resto.
 */

/** Depois de quantos pixels o dedo já disse "fecha". */
const DISTANCIA = 90;

/**
 * E o atalho da pressa: um puxão curto e rápido também fecha.
 *
 * Sem isto, o gesto rápido — que é como a maioria das pessoas fecha — não
 * alcançaria os 90px, e a folha voltaria pro lugar dando a impressão de que
 * travou.
 */
const VELOCIDADE = 0.5; // px por ms

export function useArrastarPraFechar(onClose) {
  // Quanto o dedo já puxou. `null` = ninguém está arrastando, e é o que
  // devolve a transição suave pro lugar quando ele solta no meio.
  const [puxada, setPuxada] = useState(null);
  const inicio = useRef(null);

  const aoPegar = (e) => {
    // Só o botão principal / o dedo. Botão do meio e caneta com o botão
    // lateral apertado não são intenção de fechar nada.
    if (e.button !== undefined && e.button !== 0) return;

    // O GESTO NÃO COMEÇA EM CIMA DE UM CONTROLE — e ignorar isto quebrou o X.
    //
    // `setPointerCapture` redireciona todo evento seguinte, `pointerup`
    // incluído, pro elemento que capturou. Como a área de arrasto é a barra do
    // título e o X mora dentro dela, o `pointerup` deixava de acontecer sobre
    // o botão e o navegador nunca disparava o `click`: o X ficava inerte, sem
    // erro nenhum no console.
    //
    // Vale pra qualquer controle, e não só pro X: voltar, abas e campos de
    // busca também moram em cabeçalho de folha por aí. Quem toca num controle
    // quer o controle; quem quer arrastar toca no vazio ou na alça.
    if (e.target?.closest?.('button, a, input, textarea, select, label, [role="button"]')) {
      return;
    }

    inicio.current = { y: e.clientY, t: Date.now() };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const aoMover = (e) => {
    if (!inicio.current) return;
    const dy = e.clientY - inicio.current.y;
    // Só pra BAIXO. Puxar pra cima não abre nada e não pode descolar a folha
    // do rodapé — o que apareceria embaixo seria o fundo, não conteúdo.
    setPuxada(dy > 0 ? dy : 0);
  };

  const aoSoltar = (e) => {
    if (!inicio.current) return;
    const dy = e.clientY - inicio.current.y;
    const ms = Math.max(1, Date.now() - inicio.current.t);
    inicio.current = null;
    setPuxada(null);
    if (dy > DISTANCIA || dy / ms > VELOCIDADE) onClose?.();
  };

  return {
    /** Espalhe no elemento que deve responder ao gesto (o cabeçalho). */
    alcaProps: {
      onPointerDown: aoPegar,
      onPointerMove: aoMover,
      onPointerUp: aoSoltar,
      onPointerCancel: aoSoltar,
      // `touch-none` impede o navegador de ler o mesmo movimento como rolagem
      // da página por baixo. Sem isso metade dos puxões vira scroll e o gesto
      // falha de forma intermitente — o pior jeito de falhar, porque a pessoa
      // não descobre a regra, só desiste.
      className: 'touch-none',
    },
    /**
     * O estilo do painel que se move.
     *
     * Exposto como objeto de estilo, e não como um pacote de props, porque
     * quase toda folha do app já tem um `style` próprio — o `paddingBottom`
     * da faixa do sistema. Espalhar um pacote por cima do outro apagaria esse
     * padding e a folha encostaria na barra de gestos do iPhone. Quem já tem
     * style mescla: `style={{ paddingBottom: '…', ...estilo }}`; quem não tem
     * usa direto: `style={estilo}`.
     */
    estilo: {
        transform: puxada ? `translateY(${puxada}px)` : undefined,
        // Com o dedo na tela, zero transição: a folha tem que grudar no dedo.
        // Ao soltar sem fechar, a transição volta e ela desliza de volta em
        // vez de pular.
        transition: puxada !== null ? 'none' : undefined,
    },
    /** true enquanto o dedo está arrastando. */
    arrastando: puxada !== null,
  };
}
