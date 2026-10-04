import { Mic } from 'lucide-react';
import { useDitado } from '../../hooks/useDitado';
import { juntarTexto, textoDitado } from '../../compartilhado/ditado.js';

/**
 * O MICROFONE DOS TEXTOS LONGOS — recado, aviso, notas (04/10/2026).
 *
 * Fica acima da caixa de texto, com a palavra "Falar" ao lado do ícone: num
 * campo grande, ícone sozinho no canto passa despercebido. O que ele fala SE
 * SOMA ao que já está escrito (`juntarTexto`).
 *
 * "Ouvindo… pode falar" é ESTADO, parado: o design system não deixa nada se
 * mexer sozinho, e a frase diz o que está acontecendo melhor que um pulso.
 *
 * Os campos de uma linha não usam este botão: o `Input` tem o microfone
 * dentro do próprio campo (prop `falar`).
 */
export default function BotaoDeFalar({ valor, onChange, rotulo = 'Falar' }) {
  const { suportado, ouvindo, naoEntendi, comecar, parar } = useDitado();
  if (!suportado) return null;

  const tocar = () => {
    if (ouvindo) return parar();
    comecar((bruto) => onChange(juntarTexto(valor, textoDitado(bruto, 'texto'))));
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={tocar}
        aria-pressed={ouvindo}
        className={`tap inline-flex h-12 items-center gap-2 rounded-xl px-4 text-base font-bold ${
          ouvindo ? 'bg-primary text-white' : 'bg-primaryChip text-primary'
        }`}
      >
        <Mic size={20} aria-hidden="true" />
        {ouvindo ? 'Parar' : rotulo}
      </button>
      <span aria-live="polite" className="text-sm font-semibold">
        {ouvindo ? (
          <span className="text-primary">Ouvindo… pode falar</span>
        ) : naoEntendi ? (
          <span className="text-textMuted">Não entendi. Toque e fale de novo.</span>
        ) : null}
      </span>
    </div>
  );
}
