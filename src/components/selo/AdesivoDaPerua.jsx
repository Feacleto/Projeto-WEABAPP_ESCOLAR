import { useId } from 'react';
import { MARK } from '../common/logoPaths';
import { CORES_DO_ADESIVO as C } from '../../config/paletaCategorica';
import { TEXTO } from '../../dominio/associacao/adesivo.js';

/**
 * O ADESIVO DA PERUA, desenhado — modelo "Faixa fina" (04/10/2026, aprovado
 * pelo dono).
 *
 * O DESTAQUE É O TIO: o logo e o nome dele ocupam quase todo o disco, na cor
 * da marca dele. O Alô Buzinou assina numa faixa verde fina embaixo, como
 * marca: a frase pequena que ele escolheu, "Alô Buzinou" grande e o site
 * pequeno.
 *
 * É o mesmo desenho na tela do Selo (o tio vê o que vai receber antes de
 * pedir) e no painel do dono (o que vai para a gráfica). Por isso é SVG puro,
 * com as cores da gráfica em `CORES_DO_ADESIVO`.
 *
 * ⚠️ O ADESIVO NÃO ESCREVE O NÍVEL: ele é prêmio da 1ª Platina, e a Platina
 * oscila. Colado num vidro, ele diria algo que pode deixar de ser verdade.
 *
 * Sem logo, a inicial do nome da marca num círculo branco.
 */
export default function AdesivoDaPerua({ marcaNome, logoURL, cor, frase, className, titulo }) {
  const id = useId().replace(/:/g, '');
  const fundo = cor || C.faixa;
  const nome = String(marcaNome || '').trim() || 'Sua marca';
  const iniciais = nome
    .split(/\s+/)
    .filter((p) => !/^(tio|tia|do|da|de|dos|das)$/i.test(p))
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || nome[0].toUpperCase();
  // Nome comprido encolhe a letra em vez de passar da borda do disco.
  const tamanhoDoNome = nome.length > 14 ? 40 : nome.length > 10 ? 50 : 60;

  return (
    <svg
      viewBox="0 0 400 400"
      role="img"
      aria-label={titulo || `Adesivo: ${nome}, ${frase} ${TEXTO.marca}`}
      className={className}
    >
      <defs>
        <clipPath id={`disco-${id}`}>
          <circle cx="200" cy="200" r="190" />
        </clipPath>
        <clipPath id={`logo-${id}`}>
          <circle cx="200" cy="120" r="60" />
        </clipPath>
      </defs>
      <circle cx="200" cy="200" r="198" fill={C.branco} />
      <g clipPath={`url(#disco-${id})`}>
        <rect width="400" height="284" fill={fundo} />
        <rect y="284" width="400" height="116" fill={C.faixa} />
      </g>
      <circle cx="200" cy="200" r="194" fill="none" stroke={C.borda} strokeWidth="6" />

      <circle cx="200" cy="120" r="64" fill={C.branco} />
      {logoURL ? (
        <image
          href={logoURL}
          x="140"
          y="60"
          width="120"
          height="120"
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#logo-${id})`}
        />
      ) : (
        <text
          x="200"
          y="142"
          textAnchor="middle"
          fill={fundo}
          fontFamily="Bricolage Grotesque, sans-serif"
          fontWeight="800"
          fontSize="60"
        >
          {iniciais}
        </text>
      )}

      <text
        x="200"
        y="250"
        textAnchor="middle"
        fill={C.branco}
        fontFamily="Bricolage Grotesque, sans-serif"
        fontWeight="800"
        fontSize={tamanhoDoNome}
      >
        {nome}
      </text>

      <svg x="88" y="300" width="50" height="48" viewBox={MARK.viewBox}>
        <path d={MARK.body} fill={C.branco} />
        <path d={MARK.window} fill={C.faixa} />
        {MARK.arcs.map((d) => (
          <path key={d} d={d} fill="none" stroke={C.buzina} strokeWidth={MARK.arcWidth} strokeLinecap="round" />
        ))}
      </svg>
      <text x="146" y="306" fill={C.letraPequena} fontFamily="Instrument Sans, sans-serif" fontWeight="700" fontSize="16">
        {frase}
      </text>
      <text x="146" y="333" fill={C.branco} fontFamily="Bricolage Grotesque, sans-serif" fontWeight="800" fontSize="27">
        {TEXTO.marca}
      </text>
      <text x="147" y="351" fill={C.letraPequena} fontFamily="Instrument Sans, sans-serif" fontWeight="600" fontSize="13">
        {TEXTO.site}
      </text>
    </svg>
  );
}
