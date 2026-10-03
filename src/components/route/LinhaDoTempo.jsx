import { Bus, Check, School } from 'lucide-react';
import './rota.css';

/**
 * AS PEÇAS DA LINHA DO TEMPO DA ROTA — só desenho, nenhuma regra.
 *
 * Cada parada é uma linha em três colunas: a HORA COMBINADA à esquerda (com a
 * hora real embaixo, quando aconteceu), o NÓ no trilho e o conteúdo. O trilho
 * é cheio (limão) nas paradas feitas e tracejado no que falta: a linha verde
 * vai até onde a perua chegou, sem número nenhum para ler.
 *
 * ⚠️ NENHUMA PREVISÃO EM MINUTOS. A coluna da hora é o combinado e o
 * acontecido — nunca uma estimativa (regra do produto, docs/design-system.md).
 */

/** O título de cada metade da viagem ("Buscar em casa", "Deixar na escola"). */
export function GrupoDaLinha({ children }) {
  return (
    <p className="rotulo mb-1 flex items-center gap-2 after:h-px after:flex-1 after:bg-border">
      {children}
    </p>
  );
}

/**
 * Uma parada.
 *   tipo   'casa' | 'escola' — a escola é losango violeta, como no mapa
 *   estado 'feito' | 'agora' | 'falta' | 'off'
 *   hora   o combinado ('06:40'); a escola não tem
 *   real   a hora em que aconteceu, quando se sabe
 *   estala o check acabou de nascer de um toque (a mola do sistema, uma vez)
 */
export function ItemDaLinha({
  tipo = 'casa',
  estado,
  hora,
  real,
  primeiro = false,
  ultimo = false,
  estala = false,
  children,
}) {
  const escola = tipo === 'escola';
  const feito = estado === 'feito';
  const agora = estado === 'agora';
  const off = estado === 'off';

  // O trilho atrás do nó. Primeira e última linha não esticam para fora.
  const trilho = `absolute left-1/2 -translate-x-1/2 border-l-[3px] ${
    feito ? 'border-solid border-accent' : 'border-dashed border-borderStrong'
  } ${primeiro ? 'top-[18px]' : 'top-0'} ${ultimo ? 'h-5' : 'bottom-0'}`;

  let no;
  if (agora) {
    no = `mt-3.5 h-[26px] w-[26px] border-[3px] border-card bg-perua text-white ring-[3px] ring-perua/35 ${
      escola ? 'rotate-45 rounded-md' : 'rounded-full'
    }`;
  } else if (feito) {
    no = `mt-3 h-[22px] w-[22px] border-[3px] border-accent bg-accent text-onAccent ${
      escola ? 'rotate-45 rounded-md' : 'rounded-full'
    } ${estala ? 'rota-estala' : ''}`;
  } else if (escola) {
    no = 'mt-3 h-[22px] w-[22px] rotate-45 rounded-md border-[3px] border-escola bg-escolaChip';
  } else {
    no = `mt-3 h-[22px] w-[22px] rounded-full border-[3px] border-borderStrong bg-card ${
      off ? 'border-dashed' : ''
    }`;
  }
  const IconeAgora = escola ? School : Bus;

  return (
    <div className="grid grid-cols-[44px_26px_minmax(0,1fr)] gap-x-2">
      <span
        className={`text-right font-mono tabular-nums ${agora ? 'pt-4' : 'pt-3'} ${
          off ? 'text-textMuted' : 'text-text'
        }`}
      >
        {hora && <span className="block text-sm font-bold">{hora}</span>}
        {real && (
          <span className="block text-xs font-medium text-textMuted" aria-label={`aconteceu às ${real}`}>
            {real}
          </span>
        )}
      </span>
      <span className="relative flex justify-center" aria-hidden="true">
        <span className={trilho} />
        <b className={`relative z-[1] flex items-center justify-center ${no}`}>
          {feito && (
            <Check size={12} className={escola ? '-rotate-45' : ''} />
          )}
          {agora && <IconeAgora size={14} className={escola ? '-rotate-45' : ''} />}
        </b>
      </span>
      <div className="min-w-0 pb-2.5 pt-1.5">{children}</div>
    </div>
  );
}
