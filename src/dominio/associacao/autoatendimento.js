/**
 * O AUTOATENDIMENTO — "Meus planos" (04/10/2026, desenho aprovado pelo dono).
 *
 * A tela de planos virou o autoatendimento do motorista: os mesmos blocos, na
 * mesma ordem, em toda fase da relação dele com a plataforma. O que muda de uma
 * fase para outra é a FALA do topo (e o tom dela), os números e o nome do botão
 * verde. Este arquivo decide a fase e guarda os textos curtos — as folhas de
 * explicação e as dúvidas —, para a tela só desenhar.
 *
 * Puro de propósito (sem Firebase, sem React): `npm run testar:autoatendimento`.
 *
 * ⚠️ OS TEXTOS DIZEM A REGRA DE HOJE, não a proposta. O preço novo (avulso,
 * desconto por uso, R$ 0,20 por indicação) ainda está em decisão com o dono;
 * enquanto ele não entrar em `planos.js`, nenhuma dúvida ou folha daqui pode
 * prometê-lo. O teste reprova as palavras do preço novo.
 *
 * ⚠️ NENHUMA FALA CONTA O TESTE ("mês 2 de 6"): deixa o motorista ansioso para
 * sair antes de acabar (decisão do dono). A data do fim só aparece na fase
 * `teste_fim`, que existe para ninguém ser cobrado de surpresa.
 */
import { diasRestantes, DIAS_DE_TRIAL } from './trial.js';
import { FRACAO_DA_MULTA, TETO_EM_MENSALIDADES, DIAS_SEM_MULTA } from './multa.js';
import { TOLERANCIA_DE_ATRASO } from './contaAtiva.js';
import { PRECO_DO_CONCORRENTE } from './vitrineDoPlano.js';

/** A partir de quantos dias do fim o teste entra na reta final. */
export const DIAS_DA_RETA_FINAL = 30;

export const FASE = {
  NAO_INICIADO: 'nao_iniciado',
  TESTE: 'teste',
  TESTE_FIM: 'teste_fim',
  PAUSADA: 'pausada',
  EM_DIA: 'em_dia',
  ATRASO: 'atraso',
  SAIDA: 'saida',
};

/**
 * Em que fase da relação ele está. A ordem das perguntas é a da urgência:
 * conta parada vem antes de tudo, depois a fatura atrasada, depois a saída
 * marcada; só então o teste e o cliente em dia.
 *
 * `conta` é o resultado de `estadoDaConta` (contaAtiva.js); `atrasoDias`, os
 * dias de atraso da fatura em aberto (ou null).
 */
export function faseDoAutoatendimento({
  conta = null,
  atrasoDias = null,
  jaContratou = false,
  renovacaoAutomatica,
  trialInicio = null,
  agora = new Date(),
} = {}) {
  if (conta && conta.ativa === false) return FASE.PAUSADA;
  if (atrasoDias !== null && atrasoDias > 0) return FASE.ATRASO;
  if (jaContratou) return renovacaoAutomatica === false ? FASE.SAIDA : FASE.EM_DIA;
  const restam = diasRestantes(trialInicio, agora);
  if (restam === null) return FASE.NAO_INICIADO;
  if (restam <= DIAS_DA_RETA_FINAL) return FASE.TESTE_FIM;
  return FASE.TESTE;
}

/** O tom do cartão de fala: verde para informar, âmbar para pagar, cinza parado. */
export function tomDaFala(fase) {
  if (fase === FASE.ATRASO) return 'aviso';
  if (fase === FASE.PAUSADA) return 'parado';
  return 'normal';
}

/** O que a conta perde quando para — a lista da fala cinza. */
export const O_QUE_PARA = [
  'Iniciar a rota',
  'Aviso de chegada às famílias',
  'Caixa e baixa das mensalidades',
  'Convite e contrato',
];

const pct = (f) => `${Math.round(f * 100)}%`;

/**
 * As folhas de explicação: UMA frase por folha (o motorista tem 40+ e não
 * gosta de ler). O título é a pergunta, a linha é a resposta. A da multa é a
 * única com duas, porque a comparação com o concorrente é o argumento.
 */
export const EXPLICACOES = {
  porCrianca: ['Por que por criança?', ['Você paga pelas crianças da sua turma no app.']],
  mes: ['Como dá esse valor?', ['É o número de crianças vezes o valor de cada uma.']],
  hoje: ['Por que R$ 0,00?', ['No teste grátis, nada é cobrado.']],
  mensal: ['Mensal', ['Cancela quando quiser. Sem multa.']],
  anual: ['Anual', ['O menor preço. Fica 12 meses.']],
  multa: [
    'Quando tem multa?',
    [
      `Só no anual, se sair antes de 12 meses: ${pct(FRACAO_DA_MULTA)} do que falta.`,
      `No concorrente: ${pct(PRECO_DO_CONCORRENTE.multaDoAnual)}.`,
    ],
  ],
  concorrente: ['De onde vem esse número?', ['Preço do plano mensal de outro app de van escolar.']],
  bolso: ['Como fiz a conta?', ['O que as famílias te pagam, dividido pelas crianças.']],
  fechamento: ['Desconto por decidir cedo', ['Quem assina no teste trava esse desconto para sempre.']],
  indicacao: ['Indicação', ['Cada colega que vira cliente baixa a sua conta.']],
};

/**
 * As dúvidas do fim da tela: as três primeiras aparecem, o resto abre em
 * "Ver todas". Respostas curtas e verdadeiras HOJE.
 */
export const DUVIDAS = [
  [
    'Quanto tempo dura o teste grátis?',
    `${Math.round(DIAS_DE_TRIAL / 30)} meses. Ele começa no 3º dia em que você roda a rota, e nada é cobrado nele. A gente avisa antes de qualquer cobrança.`,
  ],
  [
    'De onde vem o meu desconto?',
    'Assinando durante o teste, você trava um desconto que não acaba. E cada colega indicado que vira cliente baixa a sua conta.',
  ],
  [
    'Posso cancelar quando quiser?',
    `No mensal, sim, pelo próprio app, sem multa. No anual, sair antes dos 12 meses tem multa de ${pct(FRACAO_DA_MULTA)} do que falta, no máximo ${TETO_EM_MENSALIDADES} mensalidades, e nos primeiros ${DIAS_SEM_MULTA} dias não tem. Nada da sua turma é apagado.`,
  ],
  [
    'Pago por todas as crianças?',
    'Você paga pelas crianças ativas da sua turma no app. Tirou uma, a conta do mês seguinte já vem menor. A família nunca paga nada.',
  ],
  [
    'Qual a diferença entre mensal e anual?',
    'Mensal: sem prazo e sem multa. Anual: o menor preço por criança, com 12 meses de compromisso.',
  ],
  [
    'E se eu atrasar a fatura?',
    `Você tem até ${TOLERANCIA_DE_ATRASO} dias depois do vencimento. Depois disso a rota pausa até o pagamento, mas nada da turma é apagado.`,
  ],
  [
    'A mensalidade das famílias passa pela Alô Buzinou?',
    'Não. Ela vai inteira para o seu PIX. A Alô Buzinou cobra só a sua assinatura.',
  ],
];

/** Quantas dúvidas aparecem antes de "Ver todas". */
export const DUVIDAS_PRINCIPAIS = 3;

// ── A HISTÓRIA ───────────────────────────────────────────────────────────────

function emMs(v) {
  if (v == null) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

const ROTULO_DO_NIVEL = {
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
  platina: 'Platina',
  diamante: 'Diamante',
};

/**
 * Os marcos da história dele, em ordem de data, com o que o app JÁ GUARDA:
 * a conta, a primeira criança, a primeira família, o início do teste, o
 * plano assinado, as indicações e o nível. Total de viagens fica de fora —
 * elas são apagadas em 60 dias, e o número sairia menor que o real.
 *
 * `principal` marca os quatro que aparecem antes de "Ver história completa":
 * os momentos de virada, não os de cadastro.
 */
export function marcosDaHistoria({ perfil = {}, criancas = [], nivel = null, agora = Date.now() } = {}) {
  const marcos = [];
  const add = (quando, icone, texto, principal = false) => {
    const ms = emMs(quando);
    if (ms !== null) marcos.push({ ms, icone, texto, principal });
  };

  add(perfil.createdAt, 'conta', 'Você criou a sua conta.');

  const porData = (campo) =>
    criancas
      .map((c) => ({ c, ms: emMs(c?.[campo]) }))
      .filter((x) => x.ms !== null)
      .sort((a, b) => a.ms - b.ms);

  const primeira = porData('createdAt')[0];
  if (primeira) {
    const nome = String(primeira.c.name || '').trim().split(/\s+/)[0];
    add(primeira.ms, 'crianca', nome ? `Cadastrou a primeira criança, ${nome}.` : 'Cadastrou a primeira criança.', true);
  }

  const familias = porData('inviteUsedAt');
  if (familias[0]) add(familias[0].ms, 'familia', 'A primeira família entrou no app.', true);

  add(perfil.trialInicio, 'teste', 'Seu teste grátis começou.');
  add(perfil.contratadoEm, 'plano', 'Você assinou o seu plano. Obrigado pelo apoio.', true);

  const indicacoes = Number(perfil.indicacoesAtivas) || 0;
  if (indicacoes > 0) {
    marcos.push({
      ms: agora,
      icone: 'indicacao',
      texto:
        indicacoes === 1
          ? 'Um colega que você indicou é cliente.'
          : `${indicacoes} colegas que você indicou são clientes.`,
      principal: true,
      hoje: true,
    });
  }

  if (nivel && ROTULO_DO_NIVEL[nivel]) {
    marcos.push({
      ms: agora,
      icone: 'nivel',
      texto: `Você está no nível ${ROTULO_DO_NIVEL[nivel]}.`,
      principal: false,
      hoje: true,
    });
  }

  const comFamilia = criancas.filter((c) => c?.parentUid).length;
  if (comFamilia > 0) {
    marcos.push({
      ms: agora,
      icone: 'familia',
      texto:
        comFamilia === 1
          ? '1 família acompanha a perua pelo app.'
          : `${comFamilia} famílias acompanham a perua pelo app.`,
      principal: true,
      hoje: true,
    });
  }

  return marcos.sort((a, b) => a.ms - b.ms);
}

/** Os marcos principais, no máximo quatro, mantendo a ordem de data. */
export function marcosPrincipais(marcos, quantos = 4) {
  const principais = marcos.filter((m) => m.principal);
  return principais.slice(-quantos);
}
