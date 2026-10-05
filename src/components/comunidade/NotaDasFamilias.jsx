import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { minhaNotaDasFamilias } from '../../services/comunidadeService';
import { MIN_RESPOSTAS, semestrePorExtenso } from '../../dominio/identidade/comunidade.js';

/**
 * A NOTA QUE AS FAMÍLIAS DÃO AO TIO — o lado dele (etapa 2, 05/10/2026).
 *
 * Só a média do semestre que já FECHOU, com pelo menos cinco respostas, e do
 * semestre corrente só QUANTAS famílias responderam: a média mudando a cada
 * nota denunciaria quem deu cada uma, e a família só é sincera se souber
 * que ele não vai saber. A tela diz isso a ele, para a espera não parecer
 * defeito.
 */
export default function NotaDasFamilias() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    minhaNotaDasFamilias()
      .then((d) => vivo && setDados(d))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, []);

  if (erro || !dados) return null;
  const { anterior, atual } = dados;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-base font-bold text-text">Nota das famílias</p>
      {anterior.media != null ? (
        <p className="mt-1 flex items-center gap-2">
          <Star size={28} className="fill-ouro text-ouro" aria-hidden="true" />
          <span className="font-display text-3xl font-extrabold text-primary">
            {anterior.media.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}
          </span>
          <span className="text-base text-textMuted">
            de {anterior.total} famílias, no {semestrePorExtenso(anterior.semestre)}
          </span>
        </p>
      ) : (
        <p className="mt-1 text-base text-textMuted">
          A média aparece quando um semestre fecha com pelo menos {MIN_RESPOSTAS} famílias respondendo.
        </p>
      )}
      <p className="mt-2 text-sm text-textMuted">
        Neste semestre, {atual.total} {atual.total === 1 ? 'família respondeu' : 'famílias responderam'}.
        Você nunca vê quem deu cada nota.
      </p>
    </div>
  );
}
