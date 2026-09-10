/**
 * OS AVISOS COMERCIAIS — o que a plataforma diz sobre dinheiro, e quando cala.
 *
 * POR QUE ESTE TESTE EXISTE
 * Este é o único canal do produto que fala com quem PAROU de abrir o app — e é
 * também o mais fácil de transformar em spam. Três regras o governam (janela de
 * silêncio, um assunto por semana, nada para quem já contratou), e nenhuma
 * delas tem sintoma visível quando quebra: o motorista simplesmente passa a
 * ignorar tudo o que a plataforma manda, inclusive o aviso que importava.
 *
 * ⚠️ E O BLOCO 5 GUARDA A COISA MAIS CARA: nenhum aviso pode inventar
 * desconto. Todo número sai de `descontoDoDegrau` e `precoDoMes` — se um aviso
 * prometer 30% a quem o servidor vai gravar 10%, o motorista lê a promessa no
 * push e vê outra coisa na fatura, que é exatamente o que a proposta do dono
 * foi corrigida para não fazer.
 *
 * COMO RODAR
 *   node scripts/testar-avisos.mjs      (ou: npm run testar:avisos)
 */

import {
  TIPO,
  DIAS_ENTRE_AVISOS,
  ANTECEDENCIA,
  emSilencio,
  minutosEmBrasilia,
  diaEmBrasilia,
  avisoDoDia,
  avisoParaEnviar,
} from '../functions/lib/avisosComerciais.js';
import { descontoDoFechamento, RETORNO } from '../src/dominio/associacao/planos.js';
import { resumirParaAviso } from '../src/compartilhado/formatters.js';

let ok = 0;
let bad = 0;
const falhas = [];

function checar(nome, esperado, obtido) {
  const passou = JSON.stringify(esperado) === JSON.stringify(obtido);
  console.log(`${passou ? '  ok ' : ' FALHA'} ${nome}`);
  if (passou) ok += 1;
  else {
    bad += 1;
    falhas.push(`${nome} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
  }
}

function bloco(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}

const MS_DIA = 24 * 60 * 60 * 1000;
// ⚠️ MEIA-NOITE, e não meio-dia. Com o início às 12h, `noDia(27)` às 9h dava
// 26 dias inteiros e o caso do degrau não disparava — o teste falharia por
// aritmética de fuso em vez de por regra.
const INICIO = new Date('2026-09-10T00:00:00');

/** `agora` no dia N do teste, às 9h — o horário em que o agendador roda. */
const noDia = (n, hora = 9, minuto = 0) => {
  const d = new Date(INICIO.getTime() + n * MS_DIA);
  d.setHours(hora, minuto, 0, 0);
  return d;
};

const TIO = {
  uid: 't1',
  role: 'admin',
  trialInicio: INICIO,
  criancasAtivas: 20,
};

const aviso = (dia, extra = {}, hora = 9) =>
  avisoDoDia({ motorista: { ...TIO, ...extra }, agora: noDia(dia, hora) });

const tipo = (a) => (a ? a.tipo : null);

// ───────────────────────── 1. a janela de silêncio ─────────────────────────

bloco('1. A janela de silêncio — ele está dirigindo com criança dentro');

checar('6h00 é silêncio', true, emSilencio(6 * 60));
checar('7h30 é silêncio', true, emSilencio(7 * 60 + 30));
checar('8h29 ainda é silêncio', true, emSilencio(8 * 60 + 29));
checar('8h30 já libera', false, emSilencio(8 * 60 + 30));
checar('9h é quando o agendador roda', false, emSilencio(9 * 60));
checar('12h é livre', false, emSilencio(12 * 60));
checar('16h29 é livre', false, emSilencio(16 * 60 + 29));
checar('16h30 é silêncio', true, emSilencio(16 * 60 + 30));
checar('18h59 ainda é silêncio', true, emSilencio(18 * 60 + 59));
checar('19h libera', false, emSilencio(19 * 60));
checar('madrugada é livre pela régua', false, emSilencio(3 * 60));

// ⚠️ A REGRA VIVE NA RÉGUA, E NÃO SÓ NO CRON. Hoje o agendador roda às 9h e a
// janela nunca morde — e é por isso que ela precisa ser testada aqui: no dia em
// que alguém mudar o cron, a garantia continua sendo do código.
checar('no meio da rota da manhã, nada sai', null, tipo(aviso(1, {}, 7)));
checar('no meio da rota da tarde, nada sai', null, tipo(aviso(1, {}, 17)));
checar('mas às 9h o mesmo caso fala', TIPO.TESTE_COMECOU, tipo(aviso(1)));

// ───────────────────── 2. quem não recebe nada, nunca ──────────────────────

bloco('2. Quem não recebe nada');

checar('quem já contratou o mensal', null, tipo(aviso(1, { plano: 'mensal' })));
checar('quem já contratou o anual', null, tipo(aviso(1, { plano: 'anual' })));
checar('quem está suspenso', null, tipo(aviso(1, { suspenso: true })));
// Quem nunca rodou uma rota não tem relógio correndo: falar de preço a quem
// ainda não usou é falar de uma coisa que não existe para ele. É caso de
// ativação, não de conversão.
checar('quem nunca rodou uma rota', null, tipo(aviso(1, { trialInicio: null })));

// ─────────────────────── 3. um assunto por semana ──────────────────────────

bloco('3. Um assunto por semana');

// ⚠️ O GUARDA SEMANAL MORA EM `avisoParaEnviar`, NÃO EM `avisoDoDia`.
// A separação existe porque UMA das peças precisa furar a fila — ver o caso do
// dia 91 no fim deste bloco.
const enviar = (dia, extra = {}, hora = 9) =>
  avisoParaEnviar({ motorista: { ...TIO, ...extra }, agora: noDia(dia, hora) });

checar('avisado ontem, cala hoje', null,
  tipo(enviar(27, { ultimoAvisoComercial: noDia(26) })));
checar('avisado há 6 dias, ainda cala', null,
  tipo(enviar(27, { ultimoAvisoComercial: noDia(21) })));
checar('avisado há 7 dias, volta a falar', TIPO.DEGRAU_VIRA,
  tipo(enviar(27, { ultimoAvisoComercial: noDia(20) })));
checar('a régua é de sete dias', 7, DIAS_ENTRE_AVISOS);

// ⚠️ O AVISO DE CONTA PAUSADA FURA A FILA, E ISTO APARECEU NUM TESTE.
//
// Com o guarda valendo para tudo, a sequência real era 1, 27, 57, 87 — e o dia
// 91 caía fora, porque tinham passado só quatro dias desde o último degrau. O
// aviso mais importante da janela de retorno era engolido pela regra que
// existe para proteger a atenção dele, e ele descobriria a conta parada
// tentando iniciar uma rota.
//
// Um assunto por semana vale para OFERTA; nunca para o app avisar que parou de
// funcionar.
checar('conta pausada fura o guarda semanal', TIPO.RETORNO,
  tipo(enviar(91, { ultimoAvisoComercial: noDia(87) })));
checar('e ela é marcada como urgente', true, enviar(91).urgente === true);
checar('mas os lembretes seguintes esperam a vez', null,
  tipo(enviar(97, { ultimoAvisoComercial: noDia(95) })));
checar('e a oferta do degrau nunca fura', null,
  tipo(enviar(87, { ultimoAvisoComercial: noDia(85) })));

// ────────────────────── 4. os três momentos, nos dias ──────────────────────

bloco('4. Os três momentos');

// ⚠️ NO DIA 1, E NÃO NO 0: no dia 0 ele acabou de ligar o GPS no meio-fio.
checar('dia 0 — ele está na rua, cala', null, tipo(aviso(0)));
checar('dia 1 — na manhã seguinte, fala', TIPO.TESTE_COMECOU, tipo(aviso(1)));
checar('dia 2 — já passou', null, tipo(aviso(2)));

checar('dia 27 — três dias antes do primeiro degrau virar', TIPO.DEGRAU_VIRA, tipo(aviso(27)));
checar('dia 28 — não repete', null, tipo(aviso(28)));
checar('dia 57 — o segundo', TIPO.DEGRAU_VIRA, tipo(aviso(57)));
checar('dia 87 — o último', TIPO.DEGRAU_VIRA, tipo(aviso(87)));
checar('a antecedência é de três dias', 3, ANTECEDENCIA);

checar('dia 90 — o teste acabou, nada ainda', null, tipo(aviso(90)));
checar('dia 91 — a conta pausou', TIPO.RETORNO, tipo(aviso(91)));
checar('dia 97', TIPO.RETORNO, tipo(aviso(97)));
checar('dia 105', TIPO.RETORNO, tipo(aviso(105)));
checar('dia 118 — o último da janela', TIPO.RETORNO, tipo(aviso(118)));
checar('dia 121 — a janela fechou, e ninguém insiste', null, tipo(aviso(121)));
checar('dia 200 — muito depois, silêncio', null, tipo(aviso(200)));

// ⚠️ QUATRO AVISOS NA JANELA, E NÃO MAIS. Insistir depois que ela fecha é
// pedir uma coisa que a régua não vai conceder — e prometer o que não se dá é
// pior que não falar.
let naJanela = 0;
for (let d = 90; d <= 130; d += 1) {
  if (tipo(aviso(d)) === TIPO.RETORNO) naJanela += 1;
}
checar('a janela de retorno fala quatro vezes', 4, naJanela);

// ⚠️ A SEQUÊNCIA REAL DE UM MOTORISTA, dia a dia, com o guarda ligado.
//
// Não basta contar os candidatos: o que ele RECEBE depende de quando recebeu o
// anterior, e é essa simulação que revelou o dia 91 sendo engolido. Sete peças
// em quatro meses — pouco o bastante para cada uma ser lida.
const recebidos = [];
let ultimo = null;
for (let d = 0; d <= 130; d += 1) {
  const a = avisoParaEnviar({
    motorista: { ...TIO, ultimoAvisoComercial: ultimo },
    agora: noDia(d),
  });
  if (a) {
    recebidos.push(d);
    ultimo = noDia(d);
  }
}
// ⚠️ O DIA 97 NÃO ENTRA, E ESTÁ CERTO. Ele cai seis dias depois do aviso de
// conta pausada, e é um LEMBRETE da janela — não uma mudança de estado. O
// guarda semanal o segura, e o próximo que passa é o dia 105.
//
// O efeito é bom: na janela de 30 dias ele recebe três avisos (a pausa, o meio
// e a última chamada) em vez de quatro. A régua de frequência fazendo o
// trabalho dela sobre uma lista que foi desenhada sem contá-la.
checar('a sequência que ele recebe', [1, 27, 57, 87, 91, 105, 118], recebidos);
checar('são sete peças em quatro meses', 7, recebidos.length);
// E a janela de retorno fala três vezes, não quatro.
checar('três avisos na janela de retorno', 3, recebidos.filter((d) => d > 90).length);

// ───────────────── 5. nenhum aviso inventa desconto ────────────────────────

bloco('5. Nenhum aviso inventa desconto');

// ⚠️ A INVARIANTE É "A PEÇA ANUNCIA O DEGRAU DELE", E NÃO UM TEXTO EXATO.
//
// A primeira versão destes casos procurava a porcentagem no TÍTULO, e quebrou
// inteira quando o copy foi reescrito para falar em reais — o título passou a
// ser "Sua condição muda em 10/10". O teste falhou por redação, não por regra,
// que é o jeito mais rápido de alguém aprender a desativar um teste.
//
// A busca agora é na peça inteira. O que importa é que o número seja o do
// degrau DELE: dizer sempre o maior ofereceria, a quem está no terceiro mês,
// uma condição que o servidor não vai gravar.
const tudoDe = (a) => `${a.titulo} ${a.corpo} ${a.texto}`;
const d27 = aviso(27);
const d57 = aviso(57);
const d87 = aviso(87);
const pct = (n) => `${Math.round(descontoDoFechamento(n) * 100)}%`;

checar('o dia 27 anuncia o degrau 1', true, tudoDe(d27).includes(pct(1)));
checar('o dia 57 anuncia o degrau 2', true, tudoDe(d57).includes(pct(2)));
checar('o dia 87 anuncia o degrau 3', true, tudoDe(d87).includes(pct(3)));
checar('e o dia 27 NÃO anuncia o do dia 57', false, d27.titulo.includes(pct(2)));

// ⚠️ CADA PEÇA DIZ PARA QUANTO O VALOR VAI, E EM REAIS.
// Sem isso a data é uma ameaça sem conteúdo: ele sabe que piora, não sabe
// quanto. E em reais, não em porcentagem — "o máximo passa a ser 20%" obriga a
// multiplicar; "Depois, R$ 94,40" não.
// 20 crianças: cheio R$ 118. Degrau 1 = R$ 82,60, degrau 2 = R$ 94,40,
// degrau 3 = R$ 106,20.
checar('o dia 27 mostra o valor de hoje', true, d27.corpo.includes('R$ 82,60'));
checar('e o valor de depois', true, d27.corpo.includes('R$ 94,40'));
checar('o dia 57 mostra os dois', true, d57.corpo.includes('R$ 94,40') && d57.corpo.includes('R$ 106,20'));
checar('e o dia 87 avisa que o teste termina', true, d87.corpo.includes('teste termina'));

// O retorno vale o que a régua diz, e nada além.
checar('o retorno anuncia a fração da régua', true,
  tudoDe(aviso(91)).includes(`${Math.round(RETORNO.fracao * 100)}%`));

// ⚠️ O VALOR EM REAIS É O DELE, calculado com o tamanho da operação. Um número
// genérico faria a peça mentir para toda a base menos uma pessoa.
checar('o texto traz o valor dele, com desconto', true, d27.texto.includes('R$ 82,60'));
checar('e no degrau 2 o valor muda junto', true, d57.texto.includes('R$ 94,40'));
// Operação diferente, número diferente. 10 × R$ 5,90 = R$ 59, com 30% = R$ 41,30.
checar('operação menor, valor menor', true,
  aviso(27, { criancasAtivas: 10 }).texto.includes('R$ 41,30'));

// ─────────────────── 6. o que cada peça precisa dizer ──────────────────────

bloco('6. O que cada peça precisa dizer');

const p0 = aviso(1);

// ⚠️ TODA PEÇA DIZ POR QUE CHEGOU, E O TESTE COBRA ISSO.
//
// A versão anterior era clara e sem contexto: o motorista lia "Sua condição
// muda em 10/10" e não sabia que condição era essa, por que aquilo tinha
// chegado, nem se precisava fazer algo. Mensagem sem gatilho chega como
// interrupção; sem ação, como aviso de que ele perdeu alguma coisa.
checar('o P0 diz o gatilho: a primeira rota', true, p0.corpo.includes('primeira rota'));
checar('e o texto longo explica o que isso iniciou', true, p0.texto.includes('inicia o período de teste'));
checar('o P0 dá a data do fim do teste', true, p0.corpo.includes('dezembro'));
checar('e diz que não há cobrança até lá', true, p0.corpo.includes('Nada é cobrado'));

// ⚠️ E TODA PEÇA TERMINA COM O QUE FAZER. O push é tocável, mas o texto do
// sino é lido numa lista — sem a linha final ele fica sendo uma notícia.
const comAcao = [p0, d27, d57, d87, aviso(91)];
let semAcao = null;
comAcao.forEach((a) => {
  if (!/Toque para/.test(a.texto)) semAcao = a.tipo;
});
checar('todo texto longo diz o que fazer', null, semAcao);

// O gatilho do degrau: ele precisa saber que existe uma regra, não só uma data.
checar('o aviso de degrau explica a regra', true, d27.texto.includes('quanto antes você contratar'));
// O da conta pausada diz por que ela parou.
checar('o de conta pausada diz o motivo', true, aviso(91).texto.includes('período de teste terminou'));

// ⚠️ "NADA FOI APAGADO" VEM ANTES DA OFERTA. O medo dele é perder a turma, não
// perder o desconto — e uma mensagem que abre com desconto confirma o medo.
const p5 = aviso(91);
// ⚠️ "NADA FOI APAGADO" VEM ANTES DO NÚMERO. O medo dele é perder a turma, não
// perder o desconto — e a peça que abre com valor confirma o medo.
checar('o P5 diz primeiro que nada foi apagado', true,
  p5.corpo.indexOf('Nada foi apagado') < p5.corpo.indexOf('R$'));
checar('e o texto longo abre pelos dados', true,
  p5.texto.indexOf('continuam salvos') < p5.texto.indexOf('R$'));

// Todo aviso leva a uma tela, senão ele é notícia sem porta.
checar('o P0 leva aos planos', '/tio/planos', p0.destino);
checar('o P2 leva aos planos', '/tio/planos', d27.destino);
checar('o P5 leva aos planos', '/tio/planos', p5.destino);

// ⚠️ NENHUMA PROMESSA DE SEGURANÇA, e isto é teste e não lembrete: a
// plataforma não inspeciona van, não confere CNH e não treina ninguém.
const PROIBIDAS = ['segur', 'protegid', 'monitorad', 'vigil'];
const todos = [p0, d27, d57, d87, p5];
let promessaProibida = null;
todos.forEach((a) => {
  const texto = `${a.titulo} ${a.corpo} ${a.texto}`.toLowerCase();
  PROIBIDAS.forEach((raiz) => {
    if (texto.includes(raiz)) promessaProibida = `${a.tipo}: ${raiz}`;
  });
});
checar('nenhum aviso promete segurança', null, promessaProibida);

// ⚠️ E NENHUM USA VOCABULÁRIO DE LIQUIDAÇÃO. Cada uma destas palavras
// transforma uma régua pública em promoção — e régua que parece promoção não
// sobrevive à fila do portão, porque o vizinho pergunta por que não recebeu.
const LIQUIDACAO = [
  'última chance', 'imperdível', 'aproveite', 'oferta especial',
  'só hoje', 'corre', 'não perca', 'exclusivo pra você', 'promoção',
];
let liquidacao = null;
todos.forEach((a) => {
  const texto = `${a.titulo} ${a.corpo} ${a.texto}`.toLowerCase();
  LIQUIDACAO.forEach((termo) => {
    if (texto.includes(termo)) liquidacao = `${a.tipo}: ${termo}`;
  });
});
checar('nenhum aviso fala como liquidação', null, liquidacao);

// ───────────── 7. o corpo carrega o recado, não o rótulo ──────────────────

bloco('7. O resumo que faz o corpo carregar o recado');

// ⚠️ ESTA FUNÇÃO EXISTE POR CAUSA DO PIOR DEFEITO DO APP EM NOTIFICAÇÃO.
//
// Os três avisos de agenda mandavam no corpo do push o RÓTULO DO TIPO:
// "Novo aviso sobre Lucas · Recado". A mãe tinha que abrir o app para saber
// se importava — e são os avisos mais frequentes do produto. Depois de três
// "Recado" ela para de abrir, e aí o quarto, que era o importante, também
// não é lido.
const curto = 'Vai atrasar 15 minutos hoje.';
checar('recado curto sai inteiro', curto, resumirParaAviso(curto));
checar('e sem reticência', false, resumirParaAviso(curto).endsWith('…'));

const longo =
  'Hoje vou atrasar um pouco na rota porque a avenida principal está ' +
  'interditada desde cedo e o desvio está bem congestionado nesta altura.';
const resumido = resumirParaAviso(longo);
checar('recado longo é cortado', true, resumido.length <= 91);
checar('e ganha reticência', true, resumido.endsWith('…'));

// ⚠️ CORTA NA PALAVRA, NUNCA NA LETRA. "15 minu…" é pior que uma frase mais
// curta e inteira.
//
// ⚠️ A PRIMEIRA VERSÃO DESTE CASO PASSAVA PELO MOTIVO ERRADO. Era uma
// expressão com dois `&&` que dava `false` por um dos lados sempre ser
// `false`, e não porque o corte estivesse certo — o padrão que o CLAUDE.md
// nomeia como o mais caro do projeto. A forma abaixo é direta: o resumo é um
// prefixo do texto, e o caractere logo depois dele é um espaço.
const semReticencia = resumido.slice(0, -1);
checar('o resumo é um prefixo do texto original', true, longo.startsWith(semReticencia));
checar('e o corte cai num espaço, não no meio da palavra', ' ', longo[semReticencia.length]);

// Texto sem espaço nenhum não tem onde quebrar: corta na letra mesmo, que é
// melhor que devolver 1500 caracteres num push.
const semEspaco = 'a'.repeat(200);
checar('texto sem espaço ainda é cortado', true, resumirParaAviso(semEspaco).length <= 91);

// Espaço em excesso vira um só — recado colado de outro app costuma vir com
// quebras de linha no meio.
checar('quebras de linha viram espaço', 'Linha um. Linha dois.', resumirParaAviso('Linha um.\n\n   Linha dois.'));

// ⚠️ VAZIO DEVOLVE VAZIO, e é o que permite ao chamador cair no rótulo.
// O tipo `other` nasce sem template, então recado vazio existe de verdade —
// e ali o rótulo é melhor que nada.
checar('vazio devolve vazio', '', resumirParaAviso(''));
checar('só espaço devolve vazio', '', resumirParaAviso('   \n  '));
checar('nulo devolve vazio', '', resumirParaAviso(null));

// O limite padrão é o do formato: 90 caracteres no corpo.
checar('o limite padrão são 90 caracteres', true, resumirParaAviso('x '.repeat(200)).length <= 91);

// ═══════════ A JANELA DE SILÊNCIO É DE BRASÍLIA, NÃO DO PROCESSO ═════════
//
// ⚠️ ISTO ERA UM BUG, E O CRON O ESCONDIA.
//
// A régua lia `agora.getHours()`. As Cloud Functions rodam em UTC, onde 10h
// de Brasília é 13h — então a janela da tarde (16h30–19h) estava sendo
// medida contra 19h30–22h UTC. Ninguém via porque o agendado das 10h cai
// fora das duas faixas nas DUAS leituras, por coincidência.
//
// O dia em que alguém mudasse o horário para as 17h, ou chamasse a régua de
// outro lugar, o motorista receberia oferta comercial dirigindo com criança
// dentro — com o comentário logo acima jurando que isso não acontece.
//
// Estes casos medem em UTC de propósito: é o fuso em que o código roda de
// verdade, e é onde o erro aparecia.

bloco('A janela de silêncio, medida no fuso em que as functions rodam');

// 17h em Brasília = 20h UTC. Está DENTRO da faixa da tarde.
const dezessete = new Date('2026-09-15T20:00:00Z');
checar('17h de Brasília cai no silêncio da tarde', true,
  emSilencio(minutosEmBrasilia(dezessete)));
// A leitura ingênua (getHours em UTC) daria 20h = 1200 minutos, que está
// FORA da faixa [990, 1140] — e é exatamente assim que o bug passava.
checar('e a leitura ingênua em UTC diria que não', false,
  emSilencio(dezessete.getUTCHours() * 60 + dezessete.getUTCMinutes()));

// 7h em Brasília = 10h UTC. Dentro da faixa da manhã.
const sete = new Date('2026-09-15T10:00:00Z');
checar('7h de Brasília cai no silêncio da manhã', true,
  emSilencio(minutosEmBrasilia(sete)));

// 10h em Brasília = 13h UTC. Fora das duas — é o horário do agendado.
const dez = new Date('2026-09-15T13:00:00Z');
checar('10h de Brasília fica fora', false, emSilencio(minutosEmBrasilia(dez)));

// E o dia do carimbo também é de Brasília: 23h de Brasília é 02h UTC do dia
// SEGUINTE. Lido como UTC, o carimbo mudaria de dia às 21h.
checar('o dia vira à meia-noite de Brasília, não de UTC', '2026-09-15',
  diaEmBrasilia(new Date('2026-09-16T02:00:00Z')));
checar('e o dia seguinte é o seguinte', '2026-09-16',
  diaEmBrasilia(new Date('2026-09-16T04:00:00Z')));


// ═══════════ A PEÇA DE INDICAÇÃO — A ÚNICA PARA QUEM JÁ É CLIENTE ════════
//
// Ela precisou de uma EXCEÇÃO NOMEADA à regra "quem já decidiu não recebe
// oferta": é a única peça comercial dirigida a quem já contratou, e a régua
// — escrita para conversão — barrava exatamente o público dela. Sem a
// exceção ela nunca sairia, e ninguém perceberia: a peça simplesmente não
// apareceria em lugar nenhum, sem erro e sem log.

bloco('A indicação — a exceção nomeada, e os dois guardas que ela quase perdeu');

const INICIO_IND = new Date(2026, 0, 1, 7, 0, 0);
const noDiaInd = (n, hora = 9) => new Date(2026, 0, 1 + n, hora, 0, 0);
const clienteInd = (extra = {}) => ({
  trialInicio: INICIO_IND,
  plano: 'mensal',
  criancasAtivas: 20,
  ...extra,
});
const pecaInd = (motorista, agora) => avisoDoDia({ motorista, agora });

// Contratou no dia 91 (logo depois do teste); a peça sai 30 dias depois.
const TARDE = { contratadoEm: noDiaInd(91) };

checar('sai 30 dias depois de contratar', 'comercial_indicacao',
  pecaInd(clienteInd(TARDE), noDiaInd(121))?.tipo);
checar('e só nesse dia — não no 29', null,
  pecaInd(clienteInd(TARDE), noDiaInd(120)));
checar('nem no 31', null, pecaInd(clienteInd(TARDE), noDiaInd(122)));

// ⚠️ O PRIMEIRO GUARDA QUE ELA QUASE PERDEU: A JANELA DE SILÊNCIO.
//
// Na primeira versão o ramo da exceção ficava colado na regra que ele
// excetua, LOGO ACIMA da checagem de silêncio — bom de ler e errado de
// executar. Era a única peça do arquivo que tocaria o celular dele às 7h da
// manhã, com criança embarcando, num arquivo cujo próprio comentário diz que
// a janela precisa estar na régua e não no cron.
checar('cala às 7h — ele está dirigindo com criança dentro', null,
  pecaInd(clienteInd(TARDE), noDiaInd(121, 7)));
checar('cala às 17h também', null, pecaInd(clienteInd(TARDE), noDiaInd(121, 17)));

// ⚠️ O SEGUNDO: NÃO PROMETER REAIS SOBRE FATURA ISENTA.
//
// Contratar cedo é o que a escada premia, então contratar no dia 10 do teste
// é o caso COMUM. Trinta dias depois ele está no dia 40, ainda isento, e a
// peça diria "tira R$ 5,90 da sua conta" de uma fatura que é R$ 0,00. É o
// mesmo erro que `valorDaIndicacao` guarda no cliente devolvendo `null` sem
// plano, voltando pela outra porta: aqui ele TEM plano, e `precoDoMes`
// devolve o preço de vitrine, que ninguém está pagando ainda.
checar('não sai enquanto a fatura do teste é isenta', null,
  pecaInd(clienteInd({ contratadoEm: noDiaInd(10) }), noDiaInd(40)));

// E a isenção que o dono concede à mão zera a fatura do mesmo jeito.
checar('nem com isenção concedida pelo dono', null,
  pecaInd(clienteInd({ ...TARDE, isencaoAte: '2026-12' }), noDiaInd(121)));

// ⚠️ E NÃO SAI SE O PISO JÁ COMEU O DESCONTO. Convidar alguém a gastar um
// favor por um desconto que não vai descer nada é o pedido mais caro que a
// plataforma pode fazer: ele gasta o favor e a conta não muda.
checar('não sai quando a próxima indicação não desce nada', null,
  pecaInd(
    clienteInd({
      ...TARDE,
      criancasAtivas: 8,
      indicacoesAtivas: 9,
      descontos: [{ origem: 'fechamento', fracao: 0.3, ate: null }],
    }),
    noDiaInd(121)
  ));

// Sonda positiva: com a operação maior, a MESMA data produz a peça — então
// os casos acima não estão passando por a régua estar sempre calada.
checar('mas sai para quem ainda tem margem até o piso', 'comercial_indicacao',
  pecaInd(clienteInd({ ...TARDE, criancasAtivas: 40, indicacoesAtivas: 1 }), noDiaInd(121))?.tipo);

// O corpo traz o valor em REAIS, não a porcentagem: perto do piso a
// porcentagem mente, e é por isso que a peça calcula a diferença real.
const pecaOk = pecaInd(clienteInd(TARDE), noDiaInd(121));
checar('o corpo diz reais', true, pecaOk.corpo.includes('R$'));
checar('e não diz porcentagem', false, pecaOk.corpo.includes('%'));
checar('o toque leva à tela de indicar', '/tio/indicar', pecaOk.destino);

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
