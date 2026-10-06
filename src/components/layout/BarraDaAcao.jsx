import { useLayoutEffect, useRef, useState } from 'react';

/**
 * A BARRA DA AÇÃO, COLADA NO MENU (05/10/2026, densidade aprovada pelo dono).
 *
 * O botão verde do momento (Iniciar a rota, EMBARQUEI, Avisar falta) morava
 * num cartão branco com sombra que FLUTUAVA acima do menu: o fundo cinza
 * aparecia entre os dois, o conteúdo passava cortado por trás, e o dono
 * descreveu isso como "blocos soltos que se separam".
 *
 * Agora ela é presa como o próprio menu (`fixed`), de ponta a ponta, apoiada
 * nele. Era `sticky` no fim do conteúdo, e isso falhava em dois casos medidos
 * no navegador: em tela CURTA (Faltas) a barra parava onde o conteúdo acabava,
 * a 93 px do menu; e dentro de página com margem lateral a faixa branca ficava
 * estreita e o botão voltava a parecer solto.
 *
 * O ESPAÇO NO FIM é o que a `sticky` dava de graça: um bloco vazio com a
 * altura MEDIDA da barra, para o último cartão nunca ficar escondido atrás
 * dela. Medida, não chutada: a barra da rota tem uma linha a mais ("Depois:
 * …") e muda de altura quando o EMBARQUEI trava.
 */
export default function BarraDaAcao({ children }) {
  const ref = useRef(null);
  const [altura, setAltura] = useState(64);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const medir = () => setAltura(el.offsetHeight);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <div aria-hidden="true" className="mt-3 print:hidden" style={{ height: altura }} />
      <div ref={ref} className="barra-da-acao">
        {children}
      </div>
    </>
  );
}
