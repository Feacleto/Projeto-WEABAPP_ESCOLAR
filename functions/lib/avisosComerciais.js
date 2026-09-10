/**
 * OS AVISOS COMERCIAIS — o que a plataforma diz ao motorista sobre dinheiro.
 *
 * ── POR QUE ISTO PRECISOU EXISTIR
 * Até 10/09/2026 tudo o que o app falava sobre preço era FAIXA NA TELA: os três
 * avisos do trial em `AvisoDoTrial`, o cartão de fatura, a tela de planos. Quem
 * parava de abrir o app no dia 40 nunca mais era alcançado — e é justamente
 * quem para de abrir que está saindo.
 *
 * O canal já existia e ninguém usava para isto: um documento em `notifications`
 * escrito pelo Admin SDK aciona `sendPushOnNotification` e chega como push no
 * celular. Não foi preciso construir e-mail para a primeira versão.
 *
 * ── ESTE ARQUIVO NÃO ENVIA NADA
 * Ele responde uma pergunta pura: *dado este motorista, hoje, qual aviso cabe?*
 * Quem varre a base e escreve em `notifications` é `enviarAvisos.js`, que
 * requer o SDK. A separação é a mesma do resto do projeto, e é o que torna
 * `npm run testar:avisos` possível sem Firebase.
 *
 * ── AS TRÊS REGRAS QUE GOVERNAM O QUE SAI
 *
 * 1. **JANELA DE SILÊNCIO.** Nada entre 6h e 8h30, nem entre 16h30 e 19h. Ele
 *    está dirigindo com criança dentro. As peças de dinheiro saem às 9h, que é
 *    quando ele está parado entre um turno e outro.
 *
 * 2. **UM ASSUNTO POR SEMANA.** Se o degrau vira na mesma semana em que a
 *    fatura fecha, sai só o degrau. Cinco avisos em vinte dias ensinam a pular
 *    aviso — é a mesma lição de `avisoDoMomento`, que existe para a tarja só
 *    aparecer quando o app está MENTINDO.
 *
 * 3. **QUEM JÁ CONTRATOU NÃO RECEBE NADA DISTO.** Nenhum destes avisos fala com
 *    quem já decidiu. Oferecer desconto a quem já pagou é o começo da conversa
 *    em que o preço vira teatro.
 *
 * ── ⚠️ TODA PEÇA RESPONDE TRÊS PERGUNTAS, NESSA ORDEM
 * Por que estou recebendo isto, o que muda para mim, e o que eu faço.
 *
 * A primeira versão respondia só a segunda. "Sua condição muda em 10/10" é uma
 * frase clara e inútil para quem nunca ouviu falar em degrau: ele não sabe que
 * condição é essa, não sabe por que ela existe, e não sabe se precisa fazer
 * alguma coisa. Mensagem sem gatilho chega como interrupção, e mensagem sem
 * ação chega como aviso de que ele perdeu algo.
 *
 * O texto longo abre pelo GATILHO ("você rodou sua primeira rota", "seu teste
 * termina em 3 dias") e fecha pela AÇÃO ("toque para ver os planos"). O push
 * é a versão curta disso, e nunca o contrário.
 *
 * ── E NENHUM DELES É UMA SEGUNDA OFERTA
 * O preço nunca sobe quando ele recusa, e nunca desce porque ele demorou. Todo
 * número aqui sai da régua: `descontoDoDegrau` e `precoDoMes`. Um aviso que
 * invente desconto é a mesma falha da proposta que inventava preço.
 */

const {
  PLANO,
  RETORNO,
  DIAS_DE_TRIAL,
  DIAS_POR_DEGRAU,
  paraData,
  planoValido,
  precoDoMes,
  degrauDaDecisao,
  descontoDoDegrau,
} = require('./reguaDoServidor');

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Os tipos que `notifications` recebe. `push.js` mapeia cada um a uma rota. */
const TIPO = {
  TESTE_COMECOU: 'comercial_teste_comecou',
  DEGRAU_VIRA: 'comercial_degrau_vira',
  RETORNO: 'comercial_retorno',
};

/**
 * A JANELA DE SILÊNCIO, em horas do fuso de Brasília.
 *
 * Manhã: 6h00–8h30, a rota de ida. Tarde: 16h30–19h00, a de volta. Fora disso
 * ele está parado — e às 9h, especificamente, está entre os dois turnos.
 */
const SILENCIO = [
  { de: 6 * 60, ate: 8 * 60 + 30 },
  { de: 16 * 60 + 30, ate: 19 * 60 },
];

/** Um assunto a cada sete dias, por motorista. */
const DIAS_ENTRE_AVISOS = 7;

/**
 * Três dias antes de cada virada de degrau. Dias 27, 57 e 87 do teste.
 *
 * ⚠️ TRÊS DIAS, E UMA VEZ POR DEGRAU. Avisar todo dia da última semana seria
 * transformar o único mecanismo de urgência do desenho em ruído — e ele é
 * factual justamente para poder ser levado a sério: uma data e um número, sem
 * adjetivo nenhum.
 */
const ANTECEDENCIA = 3;

/**
 * Os dias DEPOIS do fim do teste em que a janela de retorno fala.
 *
 * A janela toda tem 30 dias (`RETORNO.prazoDias`), e o último aviso sai no 28º
 * para ainda haver dois dias de margem — avisar no dia 30 é avisar quando já
 * não dá tempo de decidir.
 */
const DIAS_DE_RETORNO = [1, 7, 15, 28];

/** Está dentro de uma faixa de silêncio? `minutos` é a hora do dia em minutos. */
function emSilencio(minutos) {
  return SILENCIO.some((f) => minutos >= f.de && minutos < f.ate);
}

/** Quantos dias inteiros se passaram desde `inicio` até `agora`. */
function diasDesde(inicio, agora) {
  const d = paraData(inicio);
  if (!d) return null;
  return Math.floor((agora.getTime() - d.getTime()) / MS_POR_DIA);
}

/** 'DD/MM' — o formato curto que as peças usam. */
function dataCurta(d) {
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 'DD de mês' — o formato longo, para a frase que fecha uma promessa. */
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
function dataLonga(d) {
  if (!d) return '';
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** R$ 1.234,50 — sem depender de Intl, que varia por runtime. */
function reais(v) {
  if (v == null) return '—';
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
}

/**
 * QUAL AVISO CABE PARA ESTE MOTORISTA, HOJE. `null` quando nenhum.
 *
 * `motorista` é o doc de `users`. `agora` entra por parâmetro — este arquivo
 * não tem relógio, como o resto do domínio deste projeto.
 */
function avisoDoDia({ motorista, agora = new Date() } = {}) {
  if (!motorista) return null;

  // Quem já decidiu não recebe oferta. Ver a regra 3 do cabeçalho.
  if (planoValido(motorista.plano)) return null;
  if (motorista.suspenso === true) return null;

  // ⚠️ A JANELA DE SILÊNCIO É CHECADA AQUI, E NÃO SÓ NO AGENDADOR.
  // O agendador roda às 9h, então na prática ela nunca morde — e é exatamente
  // por isso que ela precisa estar na régua: no dia em que alguém mudar o cron
  // ou chamar isto de outro lugar, a garantia continua sendo do código e não
  // do horário.
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  if (emSilencio(minutos)) return null;

  const inicio = paraData(motorista.trialInicio);
  // Quem nunca rodou uma rota não tem relógio correndo, e não há o que dizer:
  // falar de preço a quem ainda não usou é falar de uma coisa que não existe
  // para ele. Esse é caso de ativação, não de conversão.
  if (!inicio) return null;

  const dia = diasDesde(inicio, agora);
  if (dia === null || dia < 0) return null;

  const criancas = Number(motorista.criancasAtivas) || 0;
  const conta = (plano, fracao) =>
    precoDoMes({
      criancas,
      plano,
      fundador: motorista.condicaoFundador || null,
      indicacoesAtivas: Number(motorista.indicacoesAtivas) || 0,
      descontos: fracao
        ? [{ origem: 'fechamento', fracao, ate: null }]
        : motorista.descontos,
      mes: `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`,
    });

  const fimDoTeste = new Date(inicio.getTime() + DIAS_DE_TRIAL * MS_POR_DIA);

  // ── P0 · O teste começou ────────────────────────────────────────────────
  //
  // ⚠️ NO DIA 1, E NÃO NO 0. Disparar no instante em que o GPS liga seria falar
  // com ele no meio-fio, com a perua andando; e aceitar os dois dias faria a
  // mesma peça sair duas vezes seguidas para quem ainda não tem
  // `ultimoAvisoComercial` gravado.
  if (dia === 1) {
    const degrau = degrauDaDecisao(inicio, agora);
    const fracao = descontoDoDegrau(degrau);
    const comDesconto = conta(PLANO.MENSAL, fracao);
    return {
      tipo: TIPO.TESTE_COMECOU,
      titulo: 'Seu teste começou',
      corpo: `Você rodou a primeira rota. Nada é cobrado até ${dataLonga(fimDoTeste)}.`,
      texto:
        `Você rodou sua primeira rota, e é ela que inicia o período de teste. ` +
        `Ele vai até ${dataLonga(fimDoTeste)} e nada é cobrado até lá.\n\n` +
        `Quanto antes você contratar, menor fica sua mensalidade — e o desconto ` +
        `que você garantir não tem prazo para acabar. Contratando ainda este ` +
        `mês: ${reais(comDesconto.liquido)} por mês, em vez de ` +
        `${reais(conta(PLANO.MENSAL, 0).liquido)}.\n\n` +
        `Toque para ver os planos.`,
      destino: '/tio/planos',
    };
  }

  // ── P2 · O degrau vai virar ─────────────────────────────────────────────
  //
  // Dias 27, 57 e 87. A única urgência do desenho, e ela é factual: uma data e
  // um número. "Decida logo" não é um prazo.
  for (let n = 1; n <= DIAS_DE_TRIAL / DIAS_POR_DEGRAU; n += 1) {
    const viraNoDia = n * DIAS_POR_DEGRAU;
    if (dia !== viraNoDia - ANTECEDENCIA) continue;

    const fracao = descontoDoDegrau(n);
    if (!fracao) continue;
    const seguinte = descontoDoDegrau(n + 1);
    const viraEm = new Date(inicio.getTime() + viraNoDia * MS_POR_DIA);
    // ⚠️ UM DIA ANTES DA VIRADA, e essa diferença de 24 horas já foi um bug.
    // `viraEm` é o limite EXCLUSIVO: quem contrata NESSE dia já cai no degrau
    // seguinte. O texto dizia "contratando até 10/10 você garante 30%" e o
    // servidor gravava 20%.
    const ultimoDia = new Date(viraEm.getTime() - MS_POR_DIA);
    const comDesconto = conta(PLANO.MENSAL, fracao);

    return {
      tipo: TIPO.DEGRAU_VIRA,
      // ⚠️ O TÍTULO DIZ O QUE ACONTECE COM ELE, NÃO O NOME DA REGRA.
      //
      // "Sua condição muda em 10/10" era claro e inútil: ele não sabe que
      // condição é essa. "Seu desconto cai em 09/10" nomeia a coisa e o
      // sentido — e o corpo traz os dois valores em reais, porque
      // porcentagem obriga a multiplicar.
      titulo: `Seu desconto cai em ${dataCurta(ultimoDia)}`,
      corpo: seguinte
        ? `Contratando até lá, ${reais(comDesconto.liquido)} por mês. Depois, ` +
          `${reais(conta(PLANO.MENSAL, seguinte).liquido)}. Toque para ver.`
        : `Contratando até lá, ${reais(comDesconto.liquido)} por mês. ` +
          `Depois disso o teste termina. Toque para ver.`,
      texto:
        // O GATILHO PRIMEIRO. Ele precisa saber por que isto chegou HOJE.
        `Você está no período de teste, e ele tem uma regra simples: quanto ` +
        `antes você contratar, menor fica sua mensalidade. O desconto que você ` +
        `garantir não tem prazo para acabar.\n\n` +
        `Contratando o plano mensal até ${dataCurta(ultimoDia)}: ` +
        `${reais(comDesconto.liquido)} por mês (${Math.round(fracao * 100)}% de desconto).\n` +
        (seguinte
          ? `A partir de ${dataCurta(viraEm)}: ` +
            `${reais(conta(PLANO.MENSAL, seguinte).liquido)} por mês ` +
            `(${Math.round(seguinte * 100)}%).\n\n`
          : `A partir de ${dataCurta(viraEm)} o teste termina e não há mais ` +
            `desconto de contratação.\n\n`) +
        `Toque para ver os planos.`,
      destino: '/tio/planos',
    };
  }

  // ── P5 · A janela de retorno ────────────────────────────────────────────
  //
  // Dias 91, 97, 105 e 118. ⚠️ "NADA FOI APAGADO" VEM ANTES DA OFERTA: o medo
  // dele é perder a turma, não perder o desconto.
  const depois = dia - DIAS_DE_TRIAL;
  if (depois > 0 && DIAS_DE_RETORNO.includes(depois)) {
    const fim = new Date(fimDoTeste.getTime() + RETORNO.prazoDias * MS_POR_DIA);
    const faltam = RETORNO.prazoDias - depois;
    const comDesconto = conta(PLANO.MENSAL, RETORNO.fracao);

    return {
      tipo: TIPO.RETORNO,
      // ⚠️ O PRIMEIRO É MUDANÇA DE ESTADO, e por isso escapa do guarda
      // semanal — ver `avisoParaEnviar`. Os outros três são lembrete da
      // janela, e esses esperam a vez como qualquer oferta.
      urgente: depois === 1,
      titulo: 'Sua conta está pausada',
      // Curto: o gatilho e a saída. O detalhe fica no sino, e a ação é o toque.
      corpo:
        `Seu teste terminou. Voltando até ${dataLonga(fim)}: ` +
        `${reais(comDesconto.liquido)} por mês.`,
      texto:
        `Seu período de teste terminou em ${dataLonga(fimDoTeste)}, e por isso ` +
        `sua conta está pausada. Suas crianças, horários e histórico continuam ` +
        `salvos.\n\n` +
        `Escolhendo um plano até ${dataLonga(fim)}, você garante ` +
        `${Math.round(RETORNO.fracao * 100)}% de desconto sem prazo para acabar: ` +
        `${reais(comDesconto.liquido)} por mês. Faltam ${faltam} ` +
        `${faltam === 1 ? 'dia' : 'dias'}.\n\n` +
        `Toque para escolher um plano.`,
      destino: '/tio/planos',
    };
  }

  return null;
}

/**
 * O AVISO QUE SAI HOJE, já passado pelo filtro de frequência.
 *
 * ⚠️ O GUARDA SEMANAL NÃO VALE PARA MUDANÇA DE ESTADO, e essa distinção
 * apareceu num teste, não numa leitura.
 *
 * Com o guarda aplicado a tudo, a sequência real de um motorista era: dia 0, 27,
 * 57, 87… e o dia 91 — *"sua conta está pausada"* — caía fora, porque tinham se
 * passado só quatro dias desde o aviso do último degrau. O aviso mais
 * importante da janela de retorno era engolido pela regra que existe para
 * proteger a atenção dele, e ele descobriria a conta parada tentando iniciar
 * uma rota.
 *
 * A regra que fica: **um assunto por semana vale para OFERTA; nunca para o app
 * avisar que parou de funcionar.** Uma é conversa comercial, a outra é o
 * produto contando o que aconteceu — e calar a segunda por causa da primeira é
 * deixar a venda atrapalhar o serviço.
 */
function avisoParaEnviar({ motorista, agora = new Date() } = {}) {
  const candidato = avisoDoDia({ motorista, agora });
  if (!candidato) return null;
  if (candidato.urgente) return candidato;

  const desdeOUltimo = diasDesde(motorista?.ultimoAvisoComercial, agora);
  if (desdeOUltimo !== null && desdeOUltimo < DIAS_ENTRE_AVISOS) return null;
  return candidato;
}

module.exports = {
  TIPO,
  SILENCIO,
  DIAS_ENTRE_AVISOS,
  ANTECEDENCIA,
  DIAS_DE_RETORNO,
  emSilencio,
  diasDesde,
  avisoDoDia,
  avisoParaEnviar,
};
