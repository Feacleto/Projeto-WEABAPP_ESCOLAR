import { useEffect, useState } from 'react';
import { getFotosDaBase } from '../../services/adminMetricsService';
import { DIAS_DE_USO, semanasDasFotos } from '../../dominio/associacao/retratoDaBase.js';

/**
 * A EVOLUÇÃO DA BASE — motoristas rodando, uma barra por semana, no Hoje.
 *
 * Lê as fotos diárias (`fotosDaBase`), que o servidor grava às 23h50. Antes da
 * primeira foto não há gráfico, e a tela diz quando ele nasce em vez de
 * desenhar barras zeradas — zero seria uma medição que não aconteceu.
 *
 * A semana vale a ÚLTIMA foto dela (`semanasDasFotos`, testada em
 * `testar:retrato`).
 */
function rotuloDaSemana(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function EvolucaoDaBase() {
  const [semanas, setSemanas] = useState(null);

  useEffect(() => {
    let vivo = true;
    getFotosDaBase().then((fotos) => vivo && setSemanas(semanasDasFotos(fotos)));
    return () => {
      vivo = false;
    };
  }, []);

  if (semanas === null) return null;

  const maior = Math.max(1, ...semanas.map((s) => s.rodaramNaSemana));

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-bold text-text">
        Evolução: motoristas que rodaram em {DIAS_DE_USO} dias, por semana
      </h3>
      {semanas.length === 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-textMuted">
          O gráfico nasce com a primeira foto da base, que o servidor grava todo dia às 23h50.
          Até lá, o número de hoje está logo acima.
        </p>
      ) : (
        <>
          <div className="mt-4 flex h-40 items-end gap-1.5" role="img" aria-label="Motoristas rodando por semana">
            {semanas.map((s, i) => (
              <div key={s.semana} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="text-xs font-bold tabular-nums text-text">{s.rodaramNaSemana}</span>
                <span
                  className={`w-full max-w-[40px] rounded-t ${i === semanas.length - 1 ? 'bg-primary' : 'bg-primaryBorder'}`}
                  style={{ height: `${Math.max(2, (s.rodaramNaSemana / maior) * 110)}px` }}
                />
                <span className="text-xs text-textMuted">{rotuloDaSemana(s.semana)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-textMuted">
            Cada barra é a última foto da semana. Semana sem foto não aparece.
          </p>
        </>
      )}
    </div>
  );
}
