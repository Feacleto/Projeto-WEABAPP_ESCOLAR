/**
 * Calendário festivo do Tio Nino — bolinha animada que aparece ao lado da
 * saudação dos dashboards. Cada mês tem um "tema" com emoji, cor, animação
 * e (opcionalmente) som temático.
 *
 * Decisões:
 *   - Páscoa fica fixa em mar+abr (sem cálculo da data real — varia ano a
 *     ano e a complexidade não compensa pro mood-setter visual).
 *   - Halloween/Natal/Páscoa têm som dedicado (clica toca, clica para).
 *   - Demais meses são puramente visuais (sem som).
 *   - Dezembro o Natal já roda em nov+dez pra pegar o clima antes.
 *
 * Uso: `getFestivityForDate(new Date())` → tema ou null.
 */

// Cada tema agora carrega:
//   - label    → string curta (tooltip do navegador)
//   - greeting → saudação grande dentro do balão (o "feliz X")
//   - subtitle → frase explicando POR QUE a bolinha está ali
const THEMES = {
  newYear: {
    key: 'newYear',
    emoji: '🎉',
    label: 'Ano Novo',
    greeting: 'Feliz Ano Novo!',
    subtitle: 'Que o ano que começou seja lindo pra você e pra criançada.',
    gradient: 'from-yellow-400 via-amber-500 to-orange-500',
    animation: 'animate-fest-bounce',
    sound: null,
  },
  carnival: {
    key: 'carnival',
    emoji: '🎭',
    label: 'Carnaval',
    greeting: 'Bom Carnaval!',
    subtitle: 'Cuidado com os foliões na rua e bom feriado!',
    gradient: 'from-fuchsia-500 via-purple-500 to-pink-500',
    animation: 'animate-fest-wiggle',
    sound: null,
  },
  easter: {
    key: 'easter',
    emoji: '🐰',
    label: 'Páscoa',
    greeting: 'Feliz Páscoa!',
    subtitle: 'Tempo de chocolate, família e gratidão.',
    gradient: 'from-pink-300 via-rose-400 to-purple-400',
    animation: 'animate-fest-float',
    sound: 'easter',
  },
  mothersDay: {
    key: 'mothersDay',
    emoji: '💐',
    label: 'Dia das Mães',
    greeting: 'Feliz Dia das Mães!',
    subtitle: 'Pra todas as mães que confiam o filho na perua todo dia.',
    gradient: 'from-pink-400 via-rose-400 to-red-400',
    animation: 'animate-fest-float',
    sound: null,
  },
  june: {
    key: 'june',
    emoji: '🎈',
    label: 'Festa Junina',
    greeting: 'Boa festa junina!',
    subtitle: 'Quentão, pé de moleque e fogueira — bom mês de junho!',
    gradient: 'from-amber-500 via-red-500 to-rose-600',
    animation: 'animate-fest-bounce',
    sound: null,
  },
  vacation: {
    key: 'vacation',
    emoji: '☀️',
    label: 'Férias de julho',
    greeting: 'Boas férias!',
    subtitle: 'Aproveite o descanso da criançada — você merece também.',
    gradient: 'from-cyan-400 via-sky-500 to-blue-500',
    animation: 'animate-fest-glow',
    sound: null,
  },
  fathersDay: {
    key: 'fathersDay',
    emoji: '🎩',
    label: 'Dia dos Pais',
    greeting: 'Feliz Dia dos Pais!',
    subtitle: 'Pra todos os pais que confiam o filho na perua todo dia.',
    gradient: 'from-slate-500 via-indigo-600 to-blue-700',
    animation: 'animate-fest-float',
    sound: null,
  },
  independence: {
    key: 'independence',
    emoji: '🇧🇷',
    label: 'Independência',
    greeting: 'Viva a Independência!',
    subtitle: 'Mês da pátria — Brasil que leva nossas crianças à escola.',
    gradient: 'from-green-500 via-yellow-400 to-blue-600',
    animation: 'animate-fest-sway',
    sound: null,
  },
  halloween: {
    key: 'halloween',
    emoji: '🎃',
    label: 'Halloween',
    greeting: 'Feliz Halloween!',
    subtitle: 'Cuidado com as criancinhas fantasiadas pela rua hoje.',
    gradient: 'from-orange-500 via-orange-600 to-purple-700',
    animation: 'animate-fest-wiggle',
    sound: 'halloween',
  },
  christmas: {
    key: 'christmas',
    emoji: '🎄',
    label: 'Natal',
    greeting: 'Feliz Natal!',
    subtitle: 'Que essa época seja cheia de paz pra você e pra criançada.',
    gradient: 'from-red-500 via-rose-600 to-green-700',
    animation: 'animate-fest-sparkle',
    sound: 'christmas',
  },
};

// Mapa simples: mês (1-12) → tema. Alguns meses compartilham tema (Páscoa,
// Natal). Outubro tem Halloween cobrindo o mês inteiro.
const MONTH_THEMES = {
  1: THEMES.newYear,
  2: THEMES.carnival,
  3: THEMES.easter,
  4: THEMES.easter,
  5: THEMES.mothersDay,
  6: THEMES.june,
  7: THEMES.vacation,
  8: THEMES.fathersDay,
  9: THEMES.independence,
  10: THEMES.halloween,
  11: THEMES.christmas,
  12: THEMES.christmas,
};

/**
 * Retorna o tema festivo do mês da data passada (default: hoje).
 * Nunca retorna null — todo mês tem tema.
 */
export function getFestivityForDate(date = new Date()) {
  const month = date.getMonth() + 1;
  return MONTH_THEMES[month] || null;
}
