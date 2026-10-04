import { useEffect, useState } from 'react';

/**
 * OS TRÊS PONTINHOS DE ESPERA (04/10/2026, escolhido pelo dono entre quatro).
 *
 * Para quando uma tela inteira está abrindo — o Financeiro decidindo se há
 * senha, por exemplo. Os pontos acendem um depois do outro, com uma palavra
 * embaixo dizendo o que está acontecendo ("Abrindo"), e não um giro mudo.
 *
 * O ATRASO DE 300 ms é o mesmo do `Respiro`, pelo mesmo motivo: se a
 * resposta chegar antes, ninguém vê nada. Espera que pisca em toda abertura
 * é lembrada como lentidão.
 *
 * Exceção nomeada do design system (espera real, acaba sozinha). Com
 * "reduzir movimento" os pontos ficam parados.
 */
export default function PontosDeEspera({ titulo = '', rotulo = 'Abrindo', atraso = 300 }) {
  const [visivel, setVisivel] = useState(atraso <= 0);

  useEffect(() => {
    if (atraso <= 0) return undefined;
    const t = setTimeout(() => setVisivel(true), atraso);
    return () => clearTimeout(t);
  }, [atraso]);

  if (!visivel) return null;

  return (
    <div role="status" className="flex flex-col gap-4 py-6">
      {titulo && <h1 className="font-display text-2xl font-bold text-text">{titulo}</h1>}
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <span className="flex gap-2 text-primary" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{ animationDelay: `${i * 150}ms` }}
              className="h-3 w-3 rounded-full bg-current animate-ponto motion-reduce:animate-none"
            />
          ))}
        </span>
        <span className="text-base font-semibold text-textMuted">{rotulo}</span>
      </div>
    </div>
  );
}
