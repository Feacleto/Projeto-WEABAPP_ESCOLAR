import { useState } from 'react';
import { CheckCircle2, ChevronRight, Circle } from 'lucide-react';
import { MISSOES, ultimaFeita } from '../../dominio/identidade/nivel.js';
import SeloDoNivel from './SeloDoNivel';
import EstradaDosNiveis from './EstradaDosNiveis';
import { ESTRADA_DO_MOTORISTA, fraseDoSonho, rotuloDoFeito } from './rotuloDoNivel';

/**
 * O NÍVEL NO MENU DO PERFIL (modelo D2, 04/10/2026, aprovado pelo dono).
 *
 * O selo de metal, a estrada (tocar num nível mostra o selo dele: "sonhar"),
 * o que ele fez por último e a próxima missão — e UM botão forte, "Ver todas
 * as missões".
 *
 * ⚠️ TUDO SAI DE `niveis/{uid}`, o documento que o servidor grava. A régua
 * inteira no aparelho pede a turma e um ano de despesas; abrir o menu não
 * pode custar isso. O resumo (`feitasEm`, `proxima`, `progresso`) é gravado
 * junto do nível — ver functions/lib/niveis.js.
 *
 * Props: { nivel, dados, onIr(caminho) }
 */
export default function NivelNoMenu({ nivel, dados, onIr }) {
  const [vendo, setVendo] = useState(nivel);
  if (!ESTRADA_DO_MOTORISTA.includes(nivel)) return null;

  const feitasEm = dados?.feitasEm || {};
  // As feitas que o servidor anotou, com o título do catálogo.
  const feitas = MISSOES
    .filter((m) => Object.prototype.hasOwnProperty.call(feitasEm, m.id))
    .map((m) => ({ id: m.id, nivel: m.nivel, titulo: m.titulo, pre: false, feita: true }));
  const ultima = ultimaFeita(feitas, feitasEm, nivel);
  const proxima = dados?.proxima || null;
  const destino = proxima ? MISSOES.find((m) => m.id === proxima.id)?.destino || '/tio/nivel' : null;

  // Quantas faltam só se sabe para o PRÓXIMO nível (o progresso é do atual).
  const iProximo = ESTRADA_DO_MOTORISTA.indexOf(nivel) + 1;
  const progresso = dados?.progresso;
  const faltam = vendo === ESTRADA_DO_MOTORISTA[iProximo] && progresso
    ? progresso.total - progresso.feitas
    : null;

  return (
    <div className="space-y-2.5 border-t border-neutro p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-bold text-text">Meu nível</span>
        <SeloDoNivel nivel={vendo} />
      </div>
      <EstradaDosNiveis
        estrada={ESTRADA_DO_MOTORISTA}
        atual={nivel}
        vendo={vendo}
        onVer={(c) => setVendo(c)}
      />
      <p className="text-sm leading-snug text-textMuted">
        {fraseDoSonho({ vendo, atual: nivel, estrada: ESTRADA_DO_MOTORISTA, faltam })}
      </p>

      {ultima && (
        <div className="flex items-center gap-2.5 rounded-xl bg-accent/15 px-3 py-2.5">
          <CheckCircle2 size={20} className="shrink-0 text-accentText" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm text-accentText">{rotuloDoFeito(ultima.em)}</span>
            <span className="block text-base font-bold leading-snug text-text">{ultima.titulo}</span>
          </span>
        </div>
      )}

      {proxima && (
        <button
          type="button"
          role="menuitem"
          onClick={() => onIr(destino)}
          className="tap flex w-full items-center gap-2.5 rounded-xl border-2 border-border bg-card px-3 py-2.5 text-left"
        >
          <Circle size={20} className="shrink-0 text-textMuted" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-textMuted">Próxima</span>
            <span className="block text-base font-bold leading-snug text-text">{proxima.titulo}</span>
          </span>
          <ChevronRight size={20} className="shrink-0 text-textMuted" aria-hidden />
        </button>
      )}

      <button
        type="button"
        role="menuitem"
        onClick={() => onIr('/tio/nivel')}
        className="tap flex h-12 w-full items-center justify-center gap-1 rounded-xl bg-primary text-base font-bold text-white shadow-focus"
      >
        Ver todas as missões
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}
