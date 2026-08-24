import { useId } from 'react';
import { MARK, TEXT, LOCKUP, STACKED } from './logoPaths';

/**
 * Logo do Alô Buzinou.
 *
 * POR QUE VETOR INLINE, E NÃO <img src="/logo.png">
 * O logo aparece em cima de fundo claro, de fundo quase-preto e de relatório
 * impresso. Em PNG isso são três arquivos que saem de sincronia; aqui é a
 * mesma geometria com uma prop de cor. E não pesa requisição nem pisca antes
 * de carregar — que é justo o que acontecia no login, onde o logo era o
 * primeiro byte da tela.
 *
 * O texto também é path (Nunito 900 convertido em curva por
 * scripts/brand/build_brand.py). Nenhuma webfont a mais no caminho crítico,
 * e o desenho não muda se a fonte não chegar — o celular do pai dentro do
 * ônibus, com 3G ruim, vê a marca certa.
 *
 * TONS
 *   color  — esmeralda sobre fundo claro (padrão)
 *   onDark — carroceria branca, janela VAZADA (o fundo escuro vaza por ela)
 *   mono   — tudo em currentColor; herda a cor do texto ao redor
 *
 * O circunflexo do "ô" é a buzina: as mesmas ondas do ícone, com peso
 * recalculado pro corpo do texto.
 */

const TONES = {
  color: {
    body: '#1F5F3F',
    window: '#FFFFFF',
    arcs: '#52C41A',
    alo: '#1F5F3F',
    buzinou: '#52C41A',
  },
  onDark: {
    body: '#FFFFFF',
    window: null, // vazada
    arcs: '#52C41A',
    alo: '#FFFFFF',
    buzinou: '#52C41A',
  },
  mono: {
    body: 'currentColor',
    window: null,
    arcs: 'currentColor',
    alo: 'currentColor',
    buzinou: 'currentColor',
  },
};

const [MX, MY, MW, MH] = MARK.viewBox.split(' ').map(Number);

function Arcs({ paths, width, color }) {
  return paths.map((d) => (
    <path
      key={d}
      d={d}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      fill="none"
    />
  ));
}

/** A marca sozinha (perua + balão + ondas), no espaço de design do mark. */
function MarkShapes({ t, maskId }) {
  // Janela vazada precisa de máscara, não de fill-rule: as rodas ENCOSTAM na
  // carroceria, e com evenodd a sobreposição delas viraria buraco também.
  if (t.window === null) {
    return (
      <>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={MX} y={MY} width={MW} height={MH}>
          <path d={MARK.body} fill="#fff" />
          <Arcs paths={MARK.arcs} width={MARK.arcWidth} color="#fff" />
          <path d={MARK.window} fill="#000" />
        </mask>
        <g mask={`url(#${maskId})`}>
          <rect x={MX} y={MY} width={MW} height={MH} fill={t.body} />
        </g>
      </>
    );
  }
  return (
    <>
      <path d={MARK.body} fill={t.body} />
      <path d={MARK.window} fill={t.window} />
      <Arcs paths={MARK.arcs} width={MARK.arcWidth} color={t.arcs} />
    </>
  );
}

// useId() devolve algo como ":r3:" — os dois-pontos quebram url(#id) em
// alguns renderizadores de SVG, então saem fora.
const safeId = (id) => `ab${id.replace(/:/g, '')}`;

function Svg({ viewBox, height, className, label, children, ...rest }) {
  // Largura calculada pelo viewBox em vez de width:'auto' — o Safari do iOS
  // trata SVG inline com largura automática como 100% do pai, e o logo
  // esticava a linha inteira do cabeçalho. Aqui as duas medidas são
  // explícitas. Sem height, quem chama controla pelo className.
  const [, , vw, vh] = viewBox.split(' ').map(Number);
  const size = height ? { height, width: (height * vw) / vh } : undefined;
  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className={className}
      style={size}
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Só o ícone — pra avatar, cabeçalho apertado, botão. */
export function LogoMark({ tone = 'color', height, className, label, ...rest }) {
  const t = TONES[tone] || TONES.color;
  const maskId = safeId(useId());
  return (
    <Svg viewBox={MARK.viewBox} height={height} className={className} label={label} {...rest}>
      <MarkShapes t={t} maskId={maskId} />
    </Svg>
  );
}

/**
 * Logo completo. variant='lockup' (ícone + nome na linha) ou 'stacked'
 * (ícone em cima, nome embaixo — pra tela centralizada, tipo login).
 */
export default function Logo({
  variant = 'lockup',
  tone = 'color',
  height,
  className,
  label = 'Alô Buzinou',
  ...rest
}) {
  const t = TONES[tone] || TONES.color;
  const L = variant === 'stacked' ? STACKED : LOCKUP;
  const maskId = safeId(useId());
  return (
    <Svg viewBox={L.viewBox} height={height} className={className} label={label} {...rest}>
      <g transform={L.markTransform}>
        <MarkShapes t={t} maskId={maskId} />
      </g>
      <g transform={L.textTransform}>
        <path d={TEXT.alo} fill={t.alo} />
        <path d={TEXT.buzinou} fill={t.buzinou} />
        <Arcs paths={TEXT.accent} width={TEXT.accentWidth} color={t.buzinou} />
      </g>
    </Svg>
  );
}
