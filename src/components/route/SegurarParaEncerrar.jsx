import { useEffect, useRef, useState } from 'react';
import { Square } from 'lucide-react';
import './rota.css';

/** O tempo do dedo. Curto o bastante para não irritar, longo o bastante
 *  para não acontecer encostando o celular no painel. */
const TEMPO_DE_SEGURAR = 800;

/**
 * SEGURAR PARA ENCERRAR — a confirmação que não pede para ler.
 *
 * Substituiu o "Encerrar" de dois toques (03/10/2026, design system: "durante
 * a rota, nada de confirmação"). Os dois toques eram melhores que um diálogo,
 * mas ainda eram dois toques que um polegar apressado dá sem querer — o
 * segundo caía no mesmo lugar do primeiro. Segurar 800 ms é um gesto que
 * ninguém faz por acidente, e soltar antes desfaz sem consequência.
 *
 * O fundo enche da esquerda enquanto ele segura, para o dedo saber que está
 * funcionando. No teclado, Espaço ou Enter segurado fazem o mesmo.
 *
 * `onComecar` avisa quem está em volta que ele começou a segurar (o clique
 * do som). `onEncerrar` é o fim do gesto, não necessariamente o fim da rota:
 * com criança ainda na viagem, quem está em volta abre a confirmação com os
 * nomes em vez de encerrar (ControleDeRota, 04/10/2026).
 *
 * `compacto` (03/10/2026): a forma da FAIXA VERDE do topo da rota — duas
 * linhas, "Encerrar" e "segure", num botão de 56 px no canto. O mecanismo é o
 * mesmo; mudou o lugar (o rodapé virou o botão da parada) e por isso o texto
 * encolheu sem perder o verbo nem a instrução.
 */
export default function SegurarParaEncerrar({
  onEncerrar,
  onComecar,
  disabled = false,
  compacto = false,
}) {
  const [segurando, setSegurando] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function comecar(ev) {
    if (disabled) return;
    if (ev.type === 'keydown') {
      if (ev.repeat || (ev.key !== ' ' && ev.key !== 'Enter')) return;
      ev.preventDefault();
    }
    if (ev.type === 'pointerdown' && ev.button !== 0) return;
    clearTimeout(timer.current);
    setSegurando(true);
    onComecar?.();
    timer.current = setTimeout(() => {
      setSegurando(false);
      onEncerrar?.();
    }, TEMPO_DE_SEGURAR);
  }

  function soltar() {
    clearTimeout(timer.current);
    setSegurando(false);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={comecar}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      onPointerCancel={soltar}
      onKeyDown={comecar}
      onKeyUp={soltar}
      onBlur={soltar}
      onContextMenu={(e) => e.preventDefault()}
      // O clique solto não faz nada de propósito: quem só toca recebe o
      // rótulo dizendo o que fazer, e a rota continua.
      onClick={(e) => e.preventDefault()}
      aria-label="Segure para encerrar a rota"
      className={`relative flex touch-none select-none items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dangerChip bg-card font-bold text-dangerText disabled:opacity-60 ${
        compacto ? 'h-14 w-[7.5rem] shrink-0 px-2' : 'h-[52px] w-full text-base'
      }`}
    >
      <span
        aria-hidden="true"
        data-segurando={segurando ? 'true' : 'false'}
        className="rota-enche absolute inset-0 bg-dangerChip"
      />
      {compacto ? (
        <span className="relative flex flex-col items-center leading-tight" aria-live="polite">
          <span className="inline-flex items-center gap-1.5 text-base">
            <Square size={14} aria-hidden="true" />
            Encerrar
          </span>
          <span className="text-sm font-semibold">
            {segurando ? 'continue…' : 'segure'}
          </span>
        </span>
      ) : (
        <span className="relative inline-flex items-center gap-2" aria-live="polite">
          <Square size={14} aria-hidden="true" />
          {segurando ? 'Continue segurando…' : 'Segure para encerrar a rota'}
        </span>
      )}
    </button>
  );
}
