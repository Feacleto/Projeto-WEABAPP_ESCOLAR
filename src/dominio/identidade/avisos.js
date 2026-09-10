/**
 * A ESPÉCIE DE CADA AVISO, E O QUE PODE SER DESLIGADO.
 *
 * ── ⚠️ POR QUE ISTO PRECISOU EXISTIR
 * O app tinha 31 tipos de aviso e **nenhuma preferência**. Quem se irritasse
 * com um aviso comercial tinha uma opção só: desligar push no sistema
 * operacional — e aí perdia *"Lucas chegou em casa"*, que é o produto. Esse
 * era o maior risco do conjunto, e ele cresce a cada tipo novo: cada peça de
 * oferta que entra aumenta a chance de alguém desligar o aparelho inteiro.
 *
 * ── A PREFERÊNCIA É POR ESPÉCIE, NUNCA POR TIPO
 * Trinta e um interruptores é uma tela que ninguém lê e que envelhece a cada
 * tipo novo — e o tipo novo nasceria LIGADO sem ninguém ter escolhido isso.
 * Duas chaves cabem numa frase, e todo tipo futuro entra classificado.
 *
 * ── O QUE NÃO PODE SER DESLIGADO, E POR QUÊ
 * `fato` é o produto acontecendo: a criança embarcou, chegou, o motorista
 * mandou recado. Desligar isso é desligar o app — e quem faria isso não
 * queria silêncio, queria sair.
 * `estado` é a conta dela mudando de estado: a rota atrasou, a conta pausou.
 * São poucos, são raros, e são exatamente os que ela precisa receber no dia
 * em que acontecerem.
 *
 * `prazo` (uma data chegando) e `oferta` (a plataforma querendo algo dela)
 * são desligáveis. ⚠️ **Desligar o prazo NÃO cancela a dívida** — a fatura
 * continua, o e-mail continua, e a tela continua mostrando. O que para é o
 * toque no aparelho. A tela precisa dizer isso, senão a pessoa desliga
 * achando que resolveu a cobrança.
 *
 * ── O DOCUMENTO CONTINUA SENDO ESCRITO
 * A preferência silencia o PUSH, não o registro: `notifications` recebe o
 * documento do mesmo jeito e o sino mostra. Apagar o registro seria a pessoa
 * pedir silêncio e receber amnésia — e depois não ter como conferir o que foi
 * dito sobre o dinheiro dela.
 *
 * ⚠️ ESTE ARQUIVO NÃO IMPORTA NADA, e tem espelho em
 * `functions/lib/avisos.js` porque quem aplica o guarda é o `push.js`, que
 * roda no servidor e não alcança `src/`. `npm run testar:preferencias`
 * compara os dois caso a caso.
 */

/**
 * As quatro espécies, e cada uma responde a uma pergunta diferente sobre por
 * que aquele aviso existe.
 */
export const ESPECIE = {
  /** Aconteceu agora, e ela precisa saber agora. */
  FATO: 'fato',
  /** Mudou o que ela pode fazer, ou o que o app consegue prometer. */
  ESTADO: 'estado',
  /** Uma data está chegando. */
  PRAZO: 'prazo',
  /** A plataforma quer algo dela. */
  OFERTA: 'oferta',
};

/**
 * ⚠️ SÓ PRAZO E OFERTA SE DESLIGAM. Ver o cabeçalho: fato é o produto, estado
 * é a conta dela.
 */
export const DESLIGAVEIS = [ESPECIE.PRAZO, ESPECIE.OFERTA];

/**
 * TODO tipo que o app escreve em `notifications`, com a espécie dele.
 *
 * ⚠️ TIPO NOVO ENTRA AQUI NA MESMA ALTERAÇÃO que o cria, e
 * `testar:preferencias` falha enquanto não entrar — ele varre o código
 * procurando `type:` e compara com esta lista. Sem isso, o tipo novo cairia
 * no padrão de `especieDoAviso` e ninguém saberia qual chave o desliga.
 */
export const ESPECIE_DO_AVISO = {
  // ── o dia da criança ────────────────────────────────────────────────────
  rota_iniciada: ESPECIE.FATO,
  proxima_parada: ESPECIE.FATO,
  child_arrived_school: ESPECIE.FATO,
  child_arrived_home: ESPECIE.FATO,
  nao_embarcou: ESPECIE.FATO,
  agenda_entry: ESPECIE.FATO,
  agenda_broadcast: ESPECIE.FATO,
  agenda_school_entry: ESPECIE.FATO,
  school_no_class: ESPECIE.FATO,
  schedule_changed: ESPECIE.FATO,
  absence_confirm: ESPECIE.FATO,
  absence_declared: ESPECIE.FATO,
  alt_pickup: ESPECIE.FATO,

  // ── o dinheiro entre a família e o motorista ────────────────────────────
  payment_claimed: ESPECIE.FATO,
  payment_confirmed: ESPECIE.FATO,
  contrato_pronto: ESPECIE.FATO,
  contract_accepted: ESPECIE.FATO,
  chamado_respondido: ESPECIE.FATO,
  indicacao_ativou: ESPECIE.FATO,

  // ── o app não está conseguindo prometer o que promete ───────────────────
  rota_atrasada: ESPECIE.ESTADO,
  comercial_retorno: ESPECIE.ESTADO,

  // ── uma data chegando ───────────────────────────────────────────────────
  payment_due_5d: ESPECIE.PRAZO,
  payment_due_3d: ESPECIE.PRAZO,
  payment_due_0d: ESPECIE.PRAZO,
  payment_overdue_3d: ESPECIE.PRAZO,
  payment_overdue_7d: ESPECIE.PRAZO,
  fatura_vence: ESPECIE.PRAZO,
  alvara_vence: ESPECIE.PRAZO,

  // ── a plataforma querendo algo ──────────────────────────────────────────
  convite_parado: ESPECIE.OFERTA,
  comercial_teste_comecou: ESPECIE.OFERTA,
  comercial_degrau_vira: ESPECIE.OFERTA,
  comercial_indicacao: ESPECIE.OFERTA,
};

/**
 * A espécie de um tipo.
 *
 * ⚠️ O PADRÃO É `FATO`, e é o padrão SEGURO — não o conveniente. Tipo que
 * alguém esqueceu de classificar continua tocando o aparelho, em vez de
 * sumir em silêncio numa preferência que a pessoa nem sabe que existe. Um
 * aviso a mais é ruído; um aviso de chegada que não toca é a mãe na calçada.
 */
export function especieDoAviso(tipo) {
  return ESPECIE_DO_AVISO[String(tipo || '')] || ESPECIE.FATO;
}

/** Esta espécie pode ser desligada pela pessoa? */
export function podeDesligar(especie) {
  return DESLIGAVEIS.includes(especie);
}

/**
 * O TOQUE SAI? — a única pergunta que o `push.js` faz.
 *
 * `desligadas` é `users.avisosDesligados`, uma lista de ESPÉCIES. Qualquer
 * coisa fora de `DESLIGAVEIS` que apareça ali é ignorada: sem esse filtro,
 * gravar `['fato']` à mão (ou um bug de tela) calaria o produto inteiro para
 * aquela pessoa, e nada na interface explicaria por quê.
 */
export function tocaNoAparelho(tipo, desligadas = []) {
  const especie = especieDoAviso(tipo);
  if (!podeDesligar(especie)) return true;

  const lista = Array.isArray(desligadas) ? desligadas : [];
  return !lista.includes(especie);
}

/**
 * O que a tela de preferências mostra: as duas chaves, com o nome que a
 * pessoa reconhece e a frase que impede o mal-entendido caro.
 */
export const CHAVES_DE_AVISO = [
  {
    especie: ESPECIE.PRAZO,
    titulo: 'Vencimentos',
    descricao:
      'Lembretes de mensalidade e de prazos da sua conta. Desligar para o celular de tocar — a cobrança e o e-mail continuam.',
  },
  {
    especie: ESPECIE.OFERTA,
    titulo: 'Novidades e condições',
    descricao:
      'Desconto por indicação, condição do período de teste e convites parados. Nada disso é urgente.',
  },
];

/**
 * A lista limpa para gravar, a partir do que a tela marcou.
 *
 * Ordena e tira repetido para o documento não mudar de valor sem mudar de
 * sentido — `['oferta','prazo']` e `['prazo','oferta']` são a mesma
 * preferência, e gravar as duas formas faz o histórico do documento parecer
 * que a pessoa mexeu duas vezes.
 */
export function normalizarPreferencias(desligadas = []) {
  const lista = Array.isArray(desligadas) ? desligadas : [];
  return DESLIGAVEIS.filter((e) => lista.includes(e));
}
