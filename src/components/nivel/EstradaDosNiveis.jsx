import { Fragment } from 'react';
import { NOME_DO_NIVEL } from './rotuloDoNivel';
import { METAL_DO_NIVEL } from '../../config/paletaCategorica';

/**
 * A ESTRADA DOS NÍVEIS, em uma linha (modelo D2, 04/10/2026).
 *
 * ⚠️ A BOLINHA É VERDE, O METAL É SÓ O BRILHO (decisão do dono). Os níveis
 * conquistados são bolinhas cheias na cor da estrada; os próximos, vazios. O
 * metal aparece no halo em volta de UMA bolinha: a de onde a pessoa está, ou a
 * que ela tocou para ver como fica o selo daquele nível ("sonhar").
 *
 * Tocar numa bolinha chama `onVer(chave)`; quem desenha o selo e a frase é
 * quem usa a estrada — o menu do perfil e o topo de "Meu nível".
 *
 * Props: { estrada: string[], atual, vendo, onVer }
 */
export default function EstradaDosNiveis({ estrada, atual, vendo, onVer }) {
  const ia = estrada.indexOf(atual);
  return (
    <div>
      <div className="flex items-center px-1 pt-1.5">
        {estrada.map((chave, i) => {
          const tem = i <= ia;
          const aqui = i === ia;
          const olhando = chave === vendo && !aqui;
          const brilho = METAL_DO_NIVEL[chave]?.brilho;
          const halo = aqui || olhando ? `0 0 0 3px #fff, 0 0 0 6px ${brilho}, 0 0 20px 8px ${brilho}` : undefined;
          return (
            <Fragment key={chave}>
              {i > 0 && (
                <span aria-hidden className={`h-1 flex-1 rounded-full ${i <= ia ? 'bg-primary' : 'bg-border'}`} />
              )}
              <button
                type="button"
                onClick={() => onVer?.(chave)}
                aria-label={`Ver o selo ${NOME_DO_NIVEL[chave]}`}
                aria-pressed={chave === vendo}
                // 48px de toque com a bolinha de 26–30px dentro.
                className="tap -m-2.5 flex h-12 w-12 shrink-0 items-center justify-center"
              >
                <span
                  className={`block rounded-full border-[3px] ${aqui ? 'h-[30px] w-[30px]' : 'h-[26px] w-[26px]'} ${
                    tem ? 'border-primary bg-primary' : 'border-border bg-card'
                  }`}
                  style={{ boxShadow: halo }}
                />
              </button>
            </Fragment>
          );
        })}
      </div>
      <div className="flex justify-between pt-1 text-xs font-semibold text-textMuted">
        {estrada.map((chave, i) => (
          <span
            key={chave}
            className={`w-14 ${i === 0 ? 'text-left' : i === estrada.length - 1 ? 'text-right' : 'text-center'} ${
              chave === atual ? 'text-text' : ''
            }`}
          >
            {chave === 'diamante' ? 'Diam.' : NOME_DO_NIVEL[chave]}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * O ANEL DE PROGRESSO do nível em que a pessoa está.
 *
 * A parte cheia é verde (a estrada); a VAZIA tem a cor do PRÓXIMO nível,
 * discreta, com um brilho leve dele (decisão do dono, 04/10/2026): o que falta
 * já tem a cara do que vem.
 */
export function AnelDoNivel({ feitas, total, atual, proximo }) {
  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;
  const cor = METAL_DO_NIVEL[proximo]?.brilho || 'rgb(var(--tema-primary))';
  return (
    <div
      className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(rgb(var(--tema-primary)) 0 ${pct}%, ${cor}55 ${pct}% 100%)`,
        boxShadow: proximo ? `0 0 16px 2px ${cor}40` : undefined,
      }}
      role="img"
      aria-label={`${pct}% ${atual ? `d${atual === 'prata' || atual === 'platina' ? 'a' : 'o'} ${NOME_DO_NIVEL[atual]}` : ''}`}
    >
      <div className="flex h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-card">
        <span className="font-display text-3xl font-extrabold tabular-nums text-text">{pct}%</span>
        {atual && (
          <span className="text-xs font-semibold text-textMuted">
            d{atual === 'prata' || atual === 'platina' ? 'a' : 'o'} {NOME_DO_NIVEL[atual]}
          </span>
        )}
      </div>
    </div>
  );
}
