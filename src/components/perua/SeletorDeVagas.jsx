import { Minus, Plus } from 'lucide-react';
import { VAGAS_MAXIMO, VAGAS_MINIMO, limitarVagas } from '../../dominio/identidade/vagasDaPerua.js';

/**
 * O "−  15  +" das vagas. Botões de 48 px e o número grande: é tocado em pé,
 * com uma mão. O valor que sai daqui é SEMPRE inteiro (`limitarVagas`), que é
 * o que a rule de `configFinanceiro` exige.
 */
export default function SeletorDeVagas({ valor, onChange }) {
  const mudar = (d) => onChange(limitarVagas(valor + d));
  const botao =
    'tap flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-card text-text disabled:opacity-40';
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => mudar(-1)}
        disabled={valor <= VAGAS_MINIMO}
        aria-label="Menos uma vaga"
        className={botao}
      >
        <Minus size={22} aria-hidden="true" />
      </button>
      <output
        aria-live="polite"
        className="min-w-[2.5ch] text-center font-display text-[32px] font-extrabold tabular-nums text-text"
      >
        {valor}
      </output>
      <button
        type="button"
        onClick={() => mudar(1)}
        disabled={valor >= VAGAS_MAXIMO}
        aria-label="Mais uma vaga"
        className={botao}
      >
        <Plus size={22} aria-hidden="true" />
      </button>
      <span className="text-base text-textMuted">vagas</span>
    </div>
  );
}
