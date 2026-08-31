/**
 * AS CORES QUE SÓ PRECISAM DIFERIR ENTRE SI.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * O sistema de cor do app tem uma regra: toda cor SIGNIFICA alguma coisa.
 * Âmbar é "atender", vermelho é perda, violeta é a escola, verde é a ação.
 * O nome diz o papel, e é o que impede a próxima pessoa de escolher pelo
 * gosto — foi um nome vago (`secondary`, "a segunda cor") que fez a cor de
 * aviso do app virar enfeite da porta de entrada.
 *
 * Só que existe uma categoria de cor em que essa regra não se aplica, e
 * forçá-la produz o oposto do que se quer. São as PALETAS CATEGÓRICAS: dez
 * tipos de recado, quatro estados da criança, cinco fatias de um gráfico. Ali
 * a cor não carrega significado nenhum — o trabalho dela é ser DIFERENTE DA
 * VIZINHA, e só. Se as dez virarem tons de âmbar em nome da coerência, o
 * motorista deixa de distinguir "reunião de pais" de "a perua quebrou".
 *
 * Então este arquivo é uma licença poética com endereço fixo. A regra do
 * projeto passa a ser: **cor crua do Tailwind é permitida em
 * `src/components/festive/`, em `src/marca/festivities.js` e aqui — e
 * proibida em qualquer outro lugar.** Um lugar com licença é o que evita que
 * o resto do código peça licença.
 *
 * O QUE NÃO ENTRA AQUI
 * Cor que responde a uma pergunta do usuário ("isso está atrasado?", "isso é
 * da escola?") não é categórica, é semântica, e o lugar dela é o
 * tailwind.config.js com nome próprio. Na dúvida: se trocar duas dessas cores
 * de lugar muda o que a tela AFIRMA, não é categórica.
 */

/**
 * Os quatro estados da criança no dia, no cartão do responsável.
 *
 * Vivia solto dentro do PaiDashboard. É a informação mais importante daquela
 * tela — o gradiente é o que ela lê antes de ler a palavra — e mesmo assim
 * era uma constante anônima no meio de um arquivo de 900 linhas.
 *
 * Os hex são idênticos aos de antes: aqui eles ganham nome e endereço, não
 * cor nova. Uma observação que só aparece quando se põe os quatro lado a
 * lado: o de "na escola" (roxo → rosa) é o único que não tem parentesco com o
 * token `escola` (#6D28D9), que é a cor da escola em todo o resto do app.
 * Vale alinhar, e não neste commit — alinhar aqui é mudar a tela dela.
 */
export const GRADIENTE_STATUS = {
  home: 'from-slate-500 via-slate-600 to-slate-700',
  onboard: 'from-blue-500 via-indigo-600 to-violet-700',
  atSchool: 'from-purple-500 via-fuchsia-600 to-pink-600',
  delivered: 'from-emerald-500 via-emerald-600 to-green-700',
};

/**
 * Os dez tipos de recado da agenda.
 *
 * Dez cores que precisam ser dez, porque o motorista escolhe o tipo por
 * reconhecimento antes de ler o rótulo. Os dois últimos não são sobre a
 * escola, são sobre a operação dele — e é de propósito que `atraso` divide a
 * cor com `sick`: os dois são "hoje saiu do previsto".
 */
export const GRADIENTE_AGENDA = {
  sick: 'from-amber-500 to-orange-600',
  conflict: 'from-rose-500 to-red-600',
  read_agenda: 'from-blue-500 to-indigo-600',
  teacher_request: 'from-violet-500 to-purple-600',
  meeting: 'from-emerald-500 to-green-700',
  event: 'from-fuchsia-500 to-pink-600',
  no_class: 'from-slate-500 to-slate-700',
  atraso: 'from-amber-500 to-orange-600',
  quebrou: 'from-rose-600 to-red-700',
  other: 'from-cyan-500 to-blue-600',
};

/**
 * As fatias de um gráfico.
 *
 * `neutro` é a fatia que não é nada — "sem informação", "outros". Ela é a
 * única com significado de verdade, e por isso é a mais apagada das cinco.
 */
export const SERIE_GRAFICO = {
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  gray: 'bg-gray-400',
};

/**
 * O par de cor do avatar por gênero.
 *
 * Azul e rosa não dizem nada sobre a criança — o trabalho deles é a mesma
 * coisa que o dos gradientes acima: fazer duas fichas na mesma lista não
 * parecerem a mesma ficha. `default` é o verde da marca, que é o que aparece
 * quando o gênero não foi informado, e é a maioria.
 *
 * Vale lembrar que o avatar DESENHADO respeita gênero pelo cabelo (ver
 * marca/avatarUrl.js) — isto aqui é só o fundo de quando não há desenho.
 */
export const COR_GENERO = {
  male: 'bg-sky-100 text-sky-700',
  female: 'bg-pink-100 text-pink-700',
  default: 'bg-primary/10 text-primary',
};
