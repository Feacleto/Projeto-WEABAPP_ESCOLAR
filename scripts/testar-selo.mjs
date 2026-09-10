/**
 * OS DOIS SELOS — o adesivo de rua e o certificado.
 *
 * POR QUE ESTE TESTE
 * Um erro aqui não dá tela branca: ele imprime. O adesivo fica na traseira da
 * van, fala com quem nunca abriu o app e **não dá para voltar atrás** — não
 * existe deploy de adesivo.
 *
 * O bloco 1 é o mais importante do arquivo: ele bate cada texto que o produto
 * imprime contra a lista de palavras que a marca não pode dizer. `docs/marca.md`
 * registra que prometer segurança seria "a única mentira grande deste conjunto"
 * — a plataforma não inspeciona van, não confere CNH e não treina ninguém.
 *
 * Um lembrete num documento não sobrevive à quarta pessoa que escreve texto de
 * selo às onze da noite. Este teste, sim.
 *
 * COMO RODAR
 *   node scripts/testar-selo.mjs      (ou: npm run testar:selo)
 */

import { readFileSync } from 'node:fs';
import { PROIBIDAS, podeDizer, promessaProibida } from '../src/marca/promessas.js';
import { TEXTO_DO_PEDIDO, mensagemAoMotorista } from '../src/marca/pedidoAoMotorista.js';
import {
  ESTADO as ADESIVO,
  TEXTO as TEXTO_ADESIVO,
  podePedir,
  podeTransitar as podeTransitarAdesivo,
  situacaoDoPedido,
  validarEndereco,
} from '../src/dominio/associacao/adesivo.js';
import {
  AVISO_DE_VENCIMENTO,
  ESTADO as VERIF,
  TEXTO as TEXTO_SELO,
  diasParaVencer,
  estadoDaVerificacao,
  mesAno,
  podeTransitar,
  seloDaFamilia,
  validarRecusa,
} from '../src/dominio/identidade/verificacao.js';

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
  console.log('');
  console.log(t);
}

const dia = (iso) => new Date(`${iso}T12:00:00`);
const HOJE = dia('2026-09-15');

// ═══════════════════════ 1. O QUE NÃO PODE SER DITO ════════════════════════

bloco('1. Nenhum texto impresso promete segurança');

// ⚠️ ESTE É O BLOCO QUE JUSTIFICA O ARQUIVO. Cada string abaixo é uma coisa que
// o produto IMPRIME — num adesivo que vai na van, ou numa tela que a família
// lê antes de entregar o filho.
Object.entries(TEXTO_ADESIVO).forEach(([chave, texto]) => {
  checar(`adesivo.${chave} está limpo`, true, podeDizer(texto));
});
Object.entries(TEXTO_SELO).forEach(([chave, texto]) => {
  checar(`certificado.${chave} está limpo`, true, podeDizer(texto));
});

// E a lista precisa realmente pegar — um filtro que não barra nada é pior que
// nenhum filtro, porque dá a sensação de que alguém conferiu.
checar('"transporte seguro" é barrado', 'segur', promessaProibida('Transporte seguro'));
checar('acento não escapa', 'segur', promessaProibida('Máxima segurança'));
checar('maiúscula não escapa', 'segur', promessaProibida('SEGURO'));
checar('"motorista vistoriado" é barrado', 'vistoriad', promessaProibida('Motorista vistoriado'));
checar('"garantimos" é barrado', 'garant', promessaProibida('Garantimos a viagem'));
checar('"aprovado pela plataforma" é barrado', 'aprovado pela',
  promessaProibida('Aprovado pela plataforma'));

// ⚠️ "CERTIFICADO" É PROIBIDO PARA A FAMÍLIA E PERMITIDO NO PAINEL. Na tela da
// família a palavra soa como "a plataforma certifica que este motorista é bom",
// que é exatamente a promessa que não se pode fazer.
checar('"certificado" é barrado para a família', 'certificad',
  promessaProibida('Motorista certificado'));
checar('e permitido no painel do dono', null,
  promessaProibida('Certificado emitido', 'painel'));
checar('mas segurança continua barrada mesmo no painel', 'segur',
  promessaProibida('Motorista seguro', 'painel'));

checar('texto vazio passa', true, podeDizer(''));
checar('a lista não está vazia', true, PROIBIDAS.length > 5);

// ⚠️ O ESPELHO — a mesma frase mora em DOIS arquivos.
//
// `functions/lib/invitePreview.js` repete o texto do selo porque o deploy das
// functions NAO alcanca `src/`. O espelho e consciente (e a mesma escolha da
// tabela de faixas em `contratacao.js`), mas espelho sem teste e so uma copia
// esperando divergir — e aqui a divergencia apareceria justamente na tela que a
// familia le antes de entregar o filho.
const fonteDaFunction = readFileSync(
  new URL('../functions/lib/invitePreview.js', import.meta.url),
  'utf8'
);
checar('a function repete o texto do selo, igual', true,
  fonteDaFunction.includes(TEXTO_SELO.familia));

// ═══════════════════════ 2. O CERTIFICADO ══════════════════════════════════

bloco('2. Quem pode mover o certificado, e para onde');

// O MOTORISTA SÓ ENVIA. Se o enviado pudesse se marcar verificado, o selo não
// valeria nada — e valeria menos ainda por parecer que vale.
checar('o motorista envia', true, podeTransitar(VERIF.NAO_INICIADA, VERIF.ENVIADA, 'motorista'));
checar('e reenvia depois de recusado', true,
  podeTransitar(VERIF.RECUSADA, VERIF.ENVIADA, 'motorista'));
checar('mas não se verifica', false,
  podeTransitar(VERIF.ENVIADA, VERIF.VERIFICADA, 'motorista'));
checar('nem reenvia enquanto espera', false,
  podeTransitar(VERIF.ENVIADA, VERIF.ENVIADA, 'motorista'));

checar('o dono verifica o que foi enviado', true,
  podeTransitar(VERIF.ENVIADA, VERIF.VERIFICADA, 'dono'));
checar('e recusa', true, podeTransitar(VERIF.ENVIADA, VERIF.RECUSADA, 'dono'));
// Não dá para verificar quem nunca mandou nada — seria o selo sem documento.
checar('mas não verifica quem não enviou', false,
  podeTransitar(VERIF.NAO_INICIADA, VERIF.VERIFICADA, 'dono'));
// Revogar volta ao começo, não a "recusada": recusada é sobre um documento
// específico que ele mandou.
checar('revogar volta ao começo', true,
  podeTransitar(VERIF.VERIFICADA, VERIF.NAO_INICIADA, 'dono'));
checar('um estranho não move nada', false,
  podeTransitar(VERIF.ENVIADA, VERIF.VERIFICADA, 'responsavel'));

bloco('3. A recusa exige motivo');

// Sem motivo ele reenvia o mesmo documento, e os dois perdem a viagem.
checar('recusa sem motivo é barrada', false, validarRecusa('').ok);
checar('recusa com motivo passa', true, validarRecusa('o alvará está vencido desde março').ok);

bloco('4. Alvará vencido não é "verificado"');

const verificado = {
  verificacao: VERIF.VERIFICADA,
  verificadoEm: dia('2026-03-10'),
  alvaraValidade: dia('2027-01-31'),
};
checar('dentro da validade, verificado', VERIF.VERIFICADA, estadoDaVerificacao(verificado, HOJE));

// ⚠️ SEM ISTO O SELO DIRIA "CONFERIDO" TRÊS ANOS DEPOIS — e aí ele passa a
// afirmar uma coisa falsa, que é pior do que não existir.
checar('vencido volta ao começo', VERIF.NAO_INICIADA,
  estadoDaVerificacao({ ...verificado, alvaraValidade: dia('2026-08-01') }, HOJE));
// Sem validade cadastrada vale o que o dono decidiu: inventar vencimento seria
// a plataforma revogando um selo que ela mesma concedeu.
checar('sem validade, vale a decisão do dono', VERIF.VERIFICADA,
  estadoDaVerificacao({ verificacao: VERIF.VERIFICADA }, HOJE));
checar('quem não enviou continua não iniciada', VERIF.NAO_INICIADA,
  estadoDaVerificacao({}, HOJE));

checar('dias para vencer', 138, diasParaVencer(verificado, HOJE));
checar('vencido dá negativo', -45,
  diasParaVencer({ alvaraValidade: dia('2026-08-01') }, HOJE));
checar('sem validade, null', null, diasParaVencer({}, HOJE));
checar('o aviso é de trinta dias', 30, AVISO_DE_VENCIMENTO);

bloco('5. O que a família vê');

const selo = seloDaFamilia(verificado, HOJE);
checar('o selo aparece', TEXTO_SELO.familia, selo.texto);
// A DATA VAI JUNTO. Sem ela o selo é uma opinião; com ela é um fato que a
// pessoa julga velho ou recente por conta própria.
checar('com a data da conferência', '03/2026', selo.conferidoEm);
checar('mesAno formata direito', '01/2027', mesAno(dia('2027-01-05')));

// ⚠️ A AUSÊNCIA DO SELO NÃO É UM ALERTA. Quem não enviou o alvará não é
// suspeito — o modelo parte de que a família JÁ conhece este motorista offline.
// Um aviso ali cobraria dela uma desconfiança que não é dela, e faria a
// plataforma de avalista de quem ela não conhece.
checar('sem selo, não aparece NADA', null, seloDaFamilia({}, HOJE));
checar('enviado ainda não é selo', null,
  seloDaFamilia({ verificacao: VERIF.ENVIADA }, HOJE));
checar('recusado também não vira alerta', null,
  seloDaFamilia({ verificacao: VERIF.RECUSADA }, HOJE));
checar('vencido some em silêncio', null,
  seloDaFamilia({ ...verificado, alvaraValidade: dia('2026-08-01') }, HOJE));

// ═══════════════════════ 3. O ADESIVO ══════════════════════════════════════

bloco('6. O adesivo é fácil de propósito');

// Não há mérito aqui: ele é MÍDIA DA PLATAFORMA na van dele. Adiar até ele
// contratar é adiar a propaganda até depois da hora em que ela mais renderia.
checar('quem está em teste pede', true, podePedir({ uid: 'a' }));
checar('quem contratou pede', true, podePedir({ uid: 'a', planoId: 'ate25' }));
// Suspenso não: seria pagar frete para pôr a marca numa van que não a usa.
checar('suspenso não pede', false, podePedir({ uid: 'a', suspenso: true }));
checar('sem uid não pede', false, podePedir({}));

bloco('7. O endereço, que o correio não adivinha');

const endereco = {
  cep: '13000-000', logradouro: 'Rua das Peruas', numero: '10',
  bairro: 'Centro', cidade: 'Campinas', uf: 'SP',
};
checar('completo passa', true, validarEndereco(endereco).ok);
checar('faltando um, não', false, validarEndereco({ ...endereco, numero: '' }).ok);
checar('e diz qual falta', ['numero'], validarEndereco({ ...endereco, numero: '' }).faltando);
checar('vazio lista todos', 6, validarEndereco({}).faltando.length);
checar('espaço em branco não conta como preenchido', false,
  validarEndereco({ ...endereco, cidade: '   ' }).ok);

bloco('8. Os três estados do envio');

checar('o motorista pede', true,
  podeTransitarAdesivo(ADESIVO.NAO_PEDIDO, ADESIVO.PEDIDO, 'motorista'));
// ⚠️ SÓ UMA VEZ. Um botão de "pedir de novo" transforma um brinde numa
// assinatura de adesivos.
checar('e não pede duas vezes', false,
  podeTransitarAdesivo(ADESIVO.PEDIDO, ADESIVO.PEDIDO, 'motorista'));
checar('nem se marca postado', false,
  podeTransitarAdesivo(ADESIVO.PEDIDO, ADESIVO.POSTADO, 'motorista'));
checar('o dono posta', true, podeTransitarAdesivo(ADESIVO.PEDIDO, ADESIVO.POSTADO, 'dono'));
checar('e entrega o que postou', true,
  podeTransitarAdesivo(ADESIVO.POSTADO, ADESIVO.ENTREGUE, 'dono'));
// Não dá para entregar o que não saiu: o estado do meio existe justamente
// porque o correio leva dias e o motorista pergunta.
checar('mas não entrega o que não postou', false,
  podeTransitarAdesivo(ADESIVO.PEDIDO, ADESIVO.ENTREGUE, 'dono'));
checar('e consegue desfazer um pedido errado', true,
  podeTransitarAdesivo(ADESIVO.PEDIDO, ADESIVO.NAO_PEDIDO, 'dono'));

bloco('9. E o motorista sabe há quanto tempo');

// "Pedido" sozinho não distingue ontem de três semanas atrás — e é a diferença
// entre esperar e reclamar.
const ha = (n) => new Date(HOJE.getTime() - n * 86400000);
checar('não pedido', true,
  situacaoDoPedido({}, HOJE).texto.includes('ainda não pediu'));
checar('pedido há cinco dias', true,
  situacaoDoPedido({ estado: ADESIVO.PEDIDO, em: ha(5) }, HOJE).texto.includes('5 dias'));
checar('um dia é singular', true,
  situacaoDoPedido({ estado: ADESIVO.PEDIDO, em: ha(1) }, HOJE).texto.includes('1 dia.'));
checar('postado diz postado', true,
  situacaoDoPedido({ estado: ADESIVO.POSTADO, em: ha(3) }, HOJE).texto.includes('Postado há 3'));
checar('entregue encerra', true,
  situacaoDoPedido({ estado: ADESIVO.ENTREGUE }, HOJE).texto.includes('entregue'));
// Sem data não inventa contagem.
checar('sem data, sem contagem', null,
  situacaoDoPedido({ estado: ADESIVO.PEDIDO }, HOJE).dias);

// ── A MENSAGEM QUE A RESPONSAVEL MANDA AO MOTORISTA ──────────────────────
//
// Ela substituiu o campo de codigo do `/first-access` em 09/09/2026, e sai da
// NOSSA mao para a conversa dela com um contato de trabalho. Vale a mesma
// regua de qualquer peca publica — inclusive a proibicao de prometer
// seguranca, que e a unica mentira grande que este produto poderia contar.
console.log('');
console.log('A mensagem de pedido ao motorista');

checar('nao promete seguranca', true, podeDizer(TEXTO_DO_PEDIDO));
checar('e nenhuma raiz proibida aparece', null, promessaProibida(TEXTO_DO_PEDIDO));

// Preco e conversa com o consultor: numero solto vira ancora antes de existir
// proposta. E prazo ("em 2 minutos") e promessa que quem cumpre e ele.
const minusculo = TEXTO_DO_PEDIDO.toLowerCase();
for (const termo of ['r$', 'gratis', 'grátis', 'minutos', 'rapidinho', 'sem burocracia']) {
  checar(`nao fala de "${termo}"`, false, minusculo.includes(termo));
}

// Ela nao promete que a crianca sera cadastrada: quem decide quem entra na
// perua e ele, e o app nao cria vinculo por pedido de fora.
checar('nao promete cadastro da crianca', false, minusculo.includes('cadastre meu filho'));

// O que ela PRECISA dizer: o endereco onde ele se cadastra.
checar('traz o site institucional', true, TEXTO_DO_PEDIDO.includes('https://alobuzinou.com.br'));
checar('e diz que o convite vem DEPOIS, dele', true, minusculo.includes('me manda o convite'));

// A assinatura entra quando ha nome — mensagem de numero desconhecido sem
// assinatura tem a forma de um golpe, e ele vai abrir um link depois de ler.
checar('sem nome, nao inventa assinatura', false, TEXTO_DO_PEDIDO.includes('É a '));
checar('com nome, assina', true, mensagemAoMotorista({ nome: 'Ana' }).includes('É a Ana.'));

// ──────────────────────────────── resumo ───────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
