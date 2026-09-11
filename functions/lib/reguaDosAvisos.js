/**
 * A RÉGUA DOS AVISOS DE TEMPO — pura, sem nenhum `require`.
 *
 * São os avisos que ninguém dispara com um gesto: eles nascem de uma DATA
 * chegando. Vencimento de mensalidade, convite que ninguém resgatou, fatura da
 * plataforma, alvará expirando. Alguém tem que varrer e perguntar "cabe hoje?",
 * e quem responde é este arquivo.
 *
 * ── ⚠️ POR QUE ELE NÃO REQUER NADA
 * A regra do CLAUDE.md, aprendida com a bateria partida no meio: módulo de
 * `functions/lib/` que é RÉGUA não requer `firebase-admin` nem
 * `firebase-functions`. Esses pacotes vivem em `functions/node_modules`, que o
 * git não rastreia, e o CI roda um `npm ci` na raiz. Quem precisa do SDK é o
 * `onSchedule`, e ele mora em `enviarAvisosDoDia.js`.
 *
 * ── ⚠️ O LEMBRETE DE MENSALIDADE MUDOU DE CASA, E NÃO GANHOU UM ESPELHO
 * Ele existia em `deriveParentReminders` (cliente), que NÃO GRAVA NADA: os
 * cinco lembretes eram calculados na hora só pra desenhar a lista do sino. Sem
 * documento não há push — ou seja, o lembrete só existia se ela abrisse o app,
 * que é exatamente o que um lembrete existe pra evitar.
 *
 * Os limiares vieram pra cá e a derivação no cliente FOI EMBORA. Se as duas
 * ficassem de pé, o sino mostraria cada lembrete duas vezes (`useNotifications`
 * concatena `stored` com `derived`) — e o projeto ganharia um terceiro espelho
 * pra manter em dia. Some um, não nasce outro.
 *
 * ── ⚠️ NADA AQUI DECIDE SOZINHO SE JÁ FALOU
 * A régua responde "cabe hoje?". Quem lembra que já falou é a marca gravada no
 * documento alvo (`avisos.{tipo}`), e é ela que faz a varredura diária não
 * repetir o mesmo aviso. `jaAvisado` está aqui só pra ler essa marca do mesmo
 * jeito em todo lugar.
 */

'use strict';

/* ⚠️ RÉGUA REQUERENDO RÉGUA — e isso é permitido. `reguaDoServidor` também
 * não faz `require` nenhum; o que `testar:imports` proíbe é alcançar
 * `firebase-admin` ou `firebase-functions`, não módulo puro. Sem ele eu
 * precisaria de uma TERCEIRA cópia de `precoDoMes` só para escrever um push. */
const REGUA = require('./reguaDoServidor');

const { pushMandaEm } = require('./canalDaCobranca');

const FUSO = 'America/Sao_Paulo';
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Os tipos. Os cinco de mensalidade REUSAM os nomes que o cliente já
 * desenhava — `NotificationsBody` tem ícone e cor pra cada um, e trocar o
 * nome apagaria isso sem ninguém notar.
 */
const TIPO = {
  VENCE_5: 'payment_due_5d',
  VENCE_3: 'payment_due_3d',
  VENCE_HOJE: 'payment_due_0d',
  ATRASO_3: 'payment_overdue_3d',
  ATRASO_7: 'payment_overdue_7d',
  CONVITE_PARADO: 'convite_parado',
  FATURA_VENCE: 'fatura_vence',
  ALVARA_VENCE: 'alvara_vence',
};

/** Quantos dias depois do convite mandado a gente lembra. Uma vez só. */
const DIAS_DO_CONVITE = 4;
/** Antecedência do aviso da fatura da plataforma. */
const DIAS_DA_FATURA = 3;
/** Antecedência do alvará — a mesma que a fila do dono já usa. */
const DIAS_DO_ALVARA = 30;

/**
 * ⚠️ O ESTADO EM QUE O SELO VALE — e ele estava ESCRITO ERRADO.
 *
 * A régua procurava `'aprovada'`, e esse valor não existe: o enum em
 * `src/dominio/identidade/verificacao.js` tem `nao_iniciada`, `enviada`,
 * `verificada` e `recusada`. Nada, em lugar nenhum do projeto, jamais gravou
 * `'aprovada'`.
 *
 * O efeito era total e mudo: a varredura consultava
 * `where('verificacao','==','aprovada')`, voltava ZERO documentos todo dia, e
 * o log dizia "0 avisos". **O aviso de alvará nunca disparou para ninguém** —
 * e ele existe justamente porque `alvaraValidade` faz o selo cair sozinho:
 * sem ele, o motorista perde o selo da tela das famílias sem ninguém ter
 * pedido o papel novo.
 *
 * Pior, o teste semeava `'aprovada'` também, então a bateria confirmava o
 * erro em verde. `testar:avisos-do-dia` agora compara esta constante com o
 * enum do domínio — o literal virou espelho conferido.
 */
const SELO_VALE_EM = 'verificada';

// ── utilitários de data, todos no fuso de Brasília ─────────────────────────

function paraData(valor) {
  if (!valor) return null;
  let d = null;
  if (typeof valor.toDate === 'function') d = valor.toDate();
  else if (valor instanceof Date) d = valor;
  else if (typeof valor === 'number') d = new Date(valor);
  else if (typeof valor.seconds === 'number') d = new Date(valor.seconds * 1000);
  else if (typeof valor === 'string') d = new Date(valor);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
}

/** 'AAAA-MM-DD' em São Paulo. As functions rodam em UTC; a família, não. */
function chaveDoDia(quando) {
  const d = paraData(quando) || new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Dias inteiros entre dois instantes, contados por DIA DE CALENDÁRIO.
 *
 * ⚠️ E não por 24h corridas. "Vence em 3 dias" é uma frase sobre o calendário
 * dela: um vencimento às 23h e um às 01h do mesmo dia são o mesmo dia, e uma
 * conta em milissegundos os separaria — fazendo o aviso de 3 dias cair no de
 * 2 pra metade da base, sem nenhum erro aparecer.
 */
function diasAte(alvo, agora) {
  const a = chaveDoDia(agora);
  const b = chaveDoDia(alvo);
  if (!a || !b) return null;
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ua = Date.UTC(ay, am - 1, ad);
  const ub = Date.UTC(by, bm - 1, bd);
  return Math.round((ub - ua) / MS_POR_DIA);
}

function dataCurta(valor) {
  const d = paraData(valor);
  if (!d) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}

function reais(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function primeiroNome(completo) {
  return String(completo || '').trim().split(/\s+/)[0] || '';
}

/** Já falamos deste aviso neste documento? */
function jaAvisado(doc, tipo) {
  return !!(doc && doc.avisos && doc.avisos[tipo]);
}

// ── os quatro avisos ───────────────────────────────────────────────────────

/**
 * A MENSALIDADE DA FAMÍLIA — cinco degraus, e o nome da criança na frente.
 *
 * O nome vai junto porque um responsável pode ter dois filhos: "sua
 * mensalidade venceu" sem dizer de quem não diz nada.
 */
function avisoDaMensalidade({ pagamento, agora = new Date() } = {}) {
  const p = pagamento || {};
  if (p.status === 'paid') return null;

  const venc = paraData(p.dueDate);
  if (!venc) return null;

  const faltam = diasAte(venc, agora);
  if (faltam === null) return null;

  const quem = p.childName ? `${primeiroNome(p.childName)}: ` : '';
  const valor = reais(p.amount);
  const mes = p.month ? ` (${p.month})` : '';

  const monta = (tipo, titulo, corpo) => ({ tipo, titulo, corpo, destino: '/pai/finance' });

  // ⚠️ O TÍTULO DIZ DE QUEM É A CONTA; O CORPO, QUANTO E O QUE FAZER.
  //
  // Era "Vencimento em 5 dias" — o nome do evento, não o que muda para ela.
  // Numa família com dois filhos em peruas diferentes, "vencimento" sozinho
  // não diz qual conta é, e ela abre o app para descobrir.
  //
  // O nome da criança FICA no começo do corpo, e não sobe para o título: é
  // ali que ele distingue as duas contas sem competir com o valor, e
  // `testar:avisos-do-dia` trava essa posição de propósito.
  //
  // E toda peça fecha com a ação. Sem a última frase o aviso é notícia — e
  // notícia sobre dinheiro que não pede nada soa como aviso de perda.
  if (faltam === 5) {
    return monta(TIPO.VENCE_5, 'Mensalidade vence em 5 dias',
      `${quem}${valor}${mes}. Toque para pagar.`);
  }
  // ⚠️ 3 DIAS ANTES É DO E-MAIL, NÃO DO PUSH — ver `canalDaCobranca.js`.
  //
  // Os dois canais mandavam neste marco, no mesmo minuto, sobre a mesma
  // mensalidade: o push daqui e o `reminder_3d` do `sendPaymentReminders`.
  // A régua do canal decide, e ela recusa este dia para o push.
  if (faltam === 3 && !pushMandaEm(3)) return null;
  if (faltam === 3) {
    return monta(TIPO.VENCE_3, 'Mensalidade vence em 3 dias',
      `${quem}${valor}${mes}. Toque para pagar.`);
  }
  if (faltam === 0) {
    return monta(TIPO.VENCE_HOJE, 'A mensalidade vence hoje',
      `${quem}${valor}${mes}. Toque para pagar.`);
  }
  // ⚠️ O TOM NÃO ENDURECE COM O ATRASO, E ISSO É DECISÃO.
  //
  // A plataforma não é a credora: quem cobra é o motorista, e a mensalidade
  // nem passa por aqui (item 7 dos Termos). Cobrança dura em nome de terceiro
  // estraga a relação dos dois e sobra para ele resolver no portão.
  // Mesma colisão, do outro lado do vencimento: o `overdue_3d` por e-mail.
  if (faltam === -3 && !pushMandaEm(-3)) return null;
  if (faltam === -3) {
    return monta(TIPO.ATRASO_3, 'Mensalidade em aberto',
      `${quem}${valor}${mes}, vencida há 3 dias. Toque para pagar.`);
  }
  if (faltam === -7) {
    return monta(TIPO.ATRASO_7, 'Mensalidade em aberto há uma semana',
      `${quem}${valor}${mes}, vencida há 7 dias. Toque para pagar.`);
  }
  return null;
}

/**
 * O CONVITE QUE NINGUÉM RESGATOU.
 *
 * ⚠️ VAI PRO MOTORISTA, NÃO PRA FAMÍLIA — e é a única leitura possível: a
 * família não tem conta ainda, então não há caixa onde entregar. Quem pode
 * agir é ele, que tem o telefone dela e a vê toda manhã.
 *
 * ⚠️ E UMA VEZ SÓ. Convite parado não piora com o tempo, e cobrar de novo toda
 * semana transforma o sino dele numa lista de pendências que ele não controla.
 */
function avisoDoConvite({ crianca, agora = new Date() } = {}) {
  const c = crianca || {};
  if (c.active === false) return null;
  if (c.inviteStatus !== 'pending') return null;
  if (c.parentUid) return null;

  const nascido = paraData(c.createdAt);
  if (!nascido) return null;

  const dias = -diasAte(nascido, agora);
  if (dias !== DIAS_DO_CONVITE) return null;

  const nome = primeiroNome(c.name) || 'a criança';
  return {
    tipo: TIPO.CONVITE_PARADO,
    titulo: `O convite de ${nome} não foi usado`,
    corpo: `A família recebeu há ${DIAS_DO_CONVITE} dias e não entrou. Toque para reenviar.`,
    destino: '/tio/children',
  };
}

/**
 * A FATURA DA PLATAFORMA — dinheiro que o motorista deve, e que hoje só
 * aparece se ele abrir o app. A suspensão chega sem nada tocar no celular.
 */
function avisoDaFatura({ fatura, agora = new Date() } = {}) {
  const f = fatura || {};
  if (f.status !== 'aberta') return null;

  const venc = paraData(f.vencimento);
  if (!venc) return null;

  const faltam = diasAte(venc, agora);
  if (faltam !== DIAS_DA_FATURA) return null;

  return {
    tipo: TIPO.FATURA_VENCE,
    titulo: `Sua fatura vence em ${DIAS_DA_FATURA} dias`,
    // O mês entra porque "sua fatura" não diz qual, e quem tem uma em aberto
    // do mês passado precisa saber de qual das duas se trata.
    corpo: `${reais(f.total)}${f.mes ? ` de ${f.mes}` : ''}, até ${dataCurta(venc)}. Toque para pagar.`,
    destino: '/tio/taxa',
  };
}

/**
 * O ALVARÁ VENCENDO.
 *
 * ⚠️ ELE PERDE O SELO SOZINHO, e é isso que torna o aviso necessário:
 * `alvaraValidade` é quem decide se o selo vale, não o campo de estado. Sem
 * aviso, o selo some da tela das famílias dele sem ninguém ter dito nada.
 *
 * A antecedência é a mesma que a fila do dono já usa — dois números
 * diferentes fariam o dono e o motorista falarem de prazos distintos.
 */
function avisoDoAlvara({ motorista, agora = new Date() } = {}) {
  const m = motorista || {};
  if (m.verificacao !== SELO_VALE_EM) return null;

  const validade = paraData(m.alvaraValidade);
  if (!validade) return null;

  const faltam = diasAte(validade, agora);
  if (faltam !== DIAS_DO_ALVARA) return null;

  return {
    tipo: TIPO.ALVARA_VENCE,
    titulo: 'Seu alvará vence em 30 dias',
    corpo: `Vale até ${dataCurta(validade)}. Envie o novo para não perder o selo.`,
    destino: '/tio/selo',
  };
}

/**
 * A ROTA ATRASOU — o espelho servidor do `avisoDoMomento`.
 *
 * ⚠️ ESTE É UM ESPELHO, E ESPELHO É DÍVIDA. `src/dominio/rota/avisoDoMomento.js`
 * já decide isto, e decide bem — mas ele mora em `src/`, e o deploy das
 * functions não alcança `src/`. É a terceira vez que o projeto paga esse
 * preço (a régua de preço em `contratacao.js` e a escolha da indicação em
 * `indicacao.js` são as outras duas), e a regra da casa é a mesma: espelho só
 * existe com teste comparando as duas implementações CASO A CASO. O de
 * `testar:avisos-do-dia` bate os dois nos limiares exatos, nos dois lados de
 * cada um.
 *
 * ── ⚠️ POR QUE NÃO DAVA PRA FAZER NO CELULAR DELE
 * Foi a primeira ideia: o app do motorista está aberto durante a rota, com os
 * dados já carregados. E ela falha exatamente no caso que importa — quem dorme
 * demais tem o app FECHADO. O GPS nunca ligou, a tela nunca abriu, e ninguém
 * avalia nada. O único aviso que precisa existir quando o motorista não está
 * usando o app não pode depender do app dele.
 *
 * ── OS DOIS CASOS, NA MESMA ORDEM DO ORIGINAL
 * O grave vem primeiro porque os dois podem valer ao mesmo tempo, e dois
 * avisos sobre a mesma rota viram ruído.
 */

/** Passou disto depois da hora de ENTREGAR, com a criança dentro: grave. */
const ATRASO_NA_ENTREGA = 20;
/** Passou disto depois da hora de PEGAR, sem rota iniciada: atenção. */
const ATRASO_NA_PARTIDA = 10;

/** Minutos entre `HH:MM` de hoje e agora, no fuso de Brasília. */
function minutosDesde(hhmm, agora) {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  // A hora local de `agora` no fuso do produto — as functions rodam em UTC.
  const relogio = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(paraData(agora) || new Date());
  const [ha, ma] = relogio.split(':').map(Number);
  return (ha * 60 + ma) - (h * 60 + m);
}

function avisoDeAtraso({ crianca, rotaAtiva, temFalta, agora = new Date() } = {}) {
  const c = crianca || {};
  if (temFalta) return null;
  if (c.active === false || !c.parentUid) return null;

  // ⚠️ HORÁRIO PRESUMIDO NÃO CONTA, como no original: é chute do app, e a
  // tela do pai o esconde de propósito. Cobrar atraso contra um chute é
  // acusar o motorista de furar um combinado que ninguém fez.
  const pega = normalizaHoraLocal(c.horaPega);
  const entrega = normalizaHoraLocal(c.horaEntrega);
  if (!pega || !entrega) return null;

  const nome = primeiroNome(c.name) || 'Seu filho';

  // ── 1. O PIOR CASO: consta dentro da perua e o tempo passou.
  if (c.status === 'onboard') {
    const atraso = minutosDesde(entrega, agora);
    if (atraso != null && atraso > ATRASO_NA_ENTREGA) {
      return {
        nivel: 'grave',
        tipo: 'rota_atrasada',
        titulo: `Passou da hora de ${nome} chegar`,
        // "Provavelmente foi só a marcação" é a MESMA frase do aviso
        // `nao_embarcou`, e de propósito: os dois descrevem a mesma
        // suspeita, e duas redações fariam a mãe achar que são dois
        // problemas diferentes. O período com travessão saiu — na tela
        // bloqueada ele emenda as duas metades e a segunda, que é a ação,
        // é a que se perde.
        corpo:
          'Provavelmente foi só a marcação. Se quiser, ligue para o motorista.',
        destino: '/pai',
      };
    }
  }

  // ── 2. A rota não foi iniciada, e já passou da hora de pegar.
  if (!rotaAtiva) {
    const atraso = minutosDesde(pega, agora);
    if (atraso != null && atraso > ATRASO_NA_PARTIDA) {
      return {
        nivel: 'atencao',
        tipo: 'rota_atrasada',
        titulo: `A rota não começou às ${pega}`,
        corpo:
          'Pode ser só o app dele fechado. Se ela não chegar, fale com o motorista.',
        destino: '/pai',
      };
    }
  }

  return null;
}

/** `HH:MM` ou null. Igual ao `normalizaHora` do domínio, no essencial. */
function normalizaHoraLocal(valor) {
  const t = String(valor || '').trim().replace('h', ':');
  const m = t.match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Já avisamos ISTO HOJE? Marcador com data, não booleano: atraso repete. */
function jaAvisadoHoje(doc, tipo, hoje) {
  return !!(doc && doc.avisos && doc.avisos[tipo] === hoje);
}

/** Quanto tempo depois da folha o push sai. */
const MINUTOS_ATE_O_PUSH = 40;

/**
 * O PUSH DE 40 MINUTOS — o segundo toque da cadência da primeira rota.
 *
 * ── POR QUE ELE EXISTE
 * A folha aparece no instante em que ele encerra a primeira rota, e é o pior
 * e o melhor momento ao mesmo tempo: ele viu o produto funcionar, e está no
 * meio-fio, com o carro ligado. Muita gente fecha sem ler. Quarenta minutos
 * depois ele está parado, e a mesma notícia cabe.
 *
 * ── ⚠️ SÓ QUEM NÃO RESPONDEU
 * `pendente` é "mostrei e ele não disse nada". Quem tocou em "Agora não" está
 * `recusada` e nunca chega aqui; quem foi ver o plano está `aceita`. Fechar a
 * folha não é responder — e é por isso que este toque existe.
 *
 * ── ⚠️ UMA VEZ, E `ofertaPushEm` É QUEM GARANTE
 * O estado continua `pendente` depois do push, de propósito: é ele que faz a
 * folha reaparecer na próxima abertura (o terceiro toque). Sem um marcador
 * separado, a varredura de 10 em 10 minutos mandaria o mesmo push seis vezes
 * por hora até ele responder.
 *
 * ── ⚠️ E EXPIRA. Passadas 12 horas, o momento passou: o push chegaria no dia
 * seguinte, sobre uma rota que ele não lembra, e o terceiro toque (a folha na
 * abertura) faz esse trabalho melhor. Aviso fora de hora ensina a ignorar
 * aviso.
 */
function avisoDaOferta({ motorista, agora = new Date() } = {}) {
  const m = motorista || {};
  if (m.ofertaEstado !== 'pendente') return null;
  if (m.ofertaPushEm) return null;
  if (m.plano) return null;

  const desde = paraData(m.ofertaEm);
  if (!desde) return null;
  const minutos = (paraData(agora) - desde) / 60000;
  if (minutos < MINUTOS_ATE_O_PUSH) return null;
  if (minutos > 12 * 60) return null;

  const inicio = paraData(m.trialInicio);
  if (!inicio) return null;
  /* ⚠️ POSICIONAL, NÃO OBJETO — e as duas cópias divergem AQUI.
   * `src/dominio/associacao/trial.js` expõe `degrauDaDecisao({ inicio, agora })`
   * e o espelho do servidor expõe `degrauDaDecisao(trialInicio, agora)`. Passar
   * o objeto não dá erro: `paraData` devolve null, a função cai no `return 1`,
   * e o push sai anunciando 30% para quem está no degrau de 20% — a plataforma
   * contradizendo a própria fatura, sem nada acusar. Pego pelo caso do degrau
   * 2, não por leitura. */
  const degrau = REGUA.degrauDaDecisao(inicio, paraData(agora) || new Date());
  const fracao = REGUA.descontoDoDegrau(degrau);
  if (!fracao) return null;

  // ⚠️ O NÚMERO SAI DA RÉGUA, NUNCA ESCRITO À MÃO — a mesma disciplina da
  // folha. Um push dizendo 30% para quem está no degrau de 20% seria a
  // plataforma contradizendo a própria fatura.
  const criancas = Number(m.criancasAtivas) || 1;
  const mes = chaveDoDia(agora).slice(0, 7);
  const cheio = REGUA.precoDoMes({ criancas, plano: REGUA.PLANO.MENSAL, mes });
  const comDesconto = REGUA.precoDoMes({
    criancas,
    plano: REGUA.PLANO.MENSAL,
    mes,
    descontos: [{ origem: 'fechamento', fracao, ate: null }],
  });

  const pct = Math.round(fracao * 100);
  return {
    tipo: 'oferta_primeira_rota',
    titulo: `Você destravou ${pct}% de desconto`,
    corpo:
      `De ${reais(cheio.bruto)} por ${reais(comDesconto.liquido)} por mês — ` +
      `e os ${pct}% ficam enquanto você for cliente.`,
    destino: '/tio/planos',
  };
}

module.exports = {
  MINUTOS_ATE_O_PUSH,
  avisoDaOferta,
  ATRASO_NA_ENTREGA,
  ATRASO_NA_PARTIDA,
  avisoDeAtraso,
  normalizaHoraLocal,
  jaAvisadoHoje,
  minutosDesde,
  FUSO,
  TIPO,
  DIAS_DO_CONVITE,
  DIAS_DA_FATURA,
  DIAS_DO_ALVARA,
  SELO_VALE_EM,
  chaveDoDia,
  diasAte,
  dataCurta,
  reais,
  primeiroNome,
  jaAvisado,
  avisoDaMensalidade,
  avisoDoConvite,
  avisoDaFatura,
  avisoDoAlvara,
};
