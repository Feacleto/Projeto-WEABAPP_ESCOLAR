/**
 * Monta o `tokens.css` a partir do tailwind.config.js — função pura.
 *
 * POR QUE EXISTE
 * O site (landing/) é HTML estático sem build e não lê Tailwind. Ele tinha as
 * próprias cores, fontes e raios, e foi assim que site e app viraram dois
 * produtos (as nove diferenças do docs/design-system.md). Agora o valor mora
 * num lugar só, e as duas cópias em CSS são GERADAS:
 *
 *   src/design/tokens.css  — o app (index.css importa), para CSS cru:
 *                            keyframes, pinos do mapa, peças sem Tailwind
 *   landing/tokens.css     — o site, carregado antes do estilo de cada página
 *
 * `npm run tokens` escreve as duas; `npm run testar:design` falha se alguma
 * ficou para trás. Mesmo desenho do JSON-LD da landing contra developer.js:
 * cópia só é aceitável com um teste que a compare.
 *
 * OS NOMES DO SITE são em português (--verde, --areia, --linha) e continuam
 * valendo: são apelidos para o token do app, nunca um segundo valor.
 */

/** Apelidos do site → nome do token no Tailwind. */
export const APELIDOS = {
  preto: 'text',
  texto: 'textBody',
  cinza: 'textMuted',
  areia: 'bg',
  branco: 'card',
  recuo: 'surface',
  neutro: 'neutro',
  linha: 'border',
  'linha-forte': 'borderStrong',
  verde: 'primary',
  'verde-esc': 'primaryDark',
  vivo: 'accent',
  menta: 'menta',
  'noite-verde': 'onNightAccent',
  'noite-texto': 'onNightMuted',
  'ok-suave': 'primarySoft',
  'ok-chip': 'primaryChip',
  'ok-borda': 'primaryBorder',
  'ok-texto': 'accentText',
  'vivo-tinta': 'onAccent',
  aviso: 'warning',
  'aviso-texto': 'warningText',
  'aviso-suave': 'warningSoft',
  'aviso-chip': 'warningChip',
  'aviso-borda': 'warningBorder',
  perigo: 'danger',
  'perigo-texto': 'dangerText',
  'perigo-suave': 'dangerSoft',
  'perigo-chip': 'dangerChip',
  'perigo-borda': 'dangerBorder',
  info: 'info',
  'info-chip': 'infoChip',
  escola: 'escola',
  'escola-chip': 'escolaChip',
  perua: 'perua',
  ouro: 'ouro',
};

function familia(lista) {
  return lista.join(', ');
}

export function montarTokensCss(cfg) {
  const t = cfg.theme.extend;
  const cores = t.colors;
  const linhas = [];
  const v = (nome, valor) => linhas.push(`  --${nome}: ${valor};`);

  linhas.push('  /* ── cores, pelo nome do app ── */');
  for (const [nome, valor] of Object.entries(cores)) v(`cor-${nome}`, valor);

  linhas.push('  /* ── os mesmos valores, pelo nome do site ── */');
  for (const [apelido, token] of Object.entries(APELIDOS)) {
    if (typeof cores[token] !== 'string') {
      throw new Error(`Apelido "${apelido}" aponta para "${token}", que não existe no tailwind.config.js`);
    }
    v(apelido, `var(--cor-${token})`);
  }

  linhas.push('  /* ── fontes ── */');
  v('display', familia(t.fontFamily.display));
  v('corpo', familia(t.fontFamily.sans));
  v('mono', familia(t.fontFamily.mono));

  linhas.push('  /* ── forma ── */');
  v('r-sm', t.borderRadius.lg);
  v('r-md', t.borderRadius.xl);
  v('r-lg', t.borderRadius['2xl']);
  v('r-xl', t.borderRadius['3xl']);
  v('r-pill', '999px');
  v('sombra-rest', t.boxShadow.rest);
  v('sombra-foco', t.boxShadow.focus);
  v('sombra-float', t.boxShadow.float);

  linhas.push('  /* ── movimento ── */');
  for (const [nome, valor] of Object.entries(t.transitionDuration)) v(`dur-${nome}`, valor);
  for (const [nome, valor] of Object.entries(t.transitionTimingFunction)) v(`curva-${nome}`, valor);

  return [
    '/* GERADO por `npm run tokens` a partir de tailwind.config.js. NÃO EDITE À MÃO:',
    '   mude o valor lá e rode o comando. `npm run testar:design` falha se esta',
    '   cópia ficar diferente da fonte. Regras de uso: docs/design-system.md */',
    ':root {',
    ...linhas,
    '}',
    '',
  ].join('\n');
}
