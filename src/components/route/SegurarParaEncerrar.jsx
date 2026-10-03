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
 * `onComecar` avisa quem está em volta que ele começou a segurar — é a deixa
 * para mostrar quem ainda está pendente ANTES de a rota fechar.
 */
export default function SegurarParaEncerrar({ onEncerrar, onComecar, disabled = false }) {
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
      className="relative flex h-[52px] w-full touch-none select-none items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dangerChip bg-card text-[15px] font-bold text-dangerText disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        data-segurando={segurando ? 'true' : 'false'}
        className="rota-enche absolute inset-0 bg-dangerChip"
      />
      <span className="relative inline-flex items-center gap-2" aria-live="polite">
        <Square size={14} aria-hidden="true" />
        {segurando ? 'Continue segurando…' : 'Segure para encerrar a rota'}
      </span>
    </button>
  );
}
