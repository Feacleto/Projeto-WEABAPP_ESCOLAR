/**
 * O QUE CADA LADO ALCANÇA NUM DOCUMENTO COMPARTILHADO.
 *
 * ── O TIPO DE FALHA QUE ISTO PEGA, E POR QUE NENHUM OUTRO TESTE PEGA
 * Não é ataque. É alguém acrescentando um campo num documento que **os dois
 * lados leem**, sem lembrar de quem lê o quê. O dado sai "corretamente": a
 * regra permite, o teste de regras passa, a tela não mostra. E aparece no
 * console do navegador da outra ponta, seis meses depois.
 *
 * ⚠️ **REGRA DO FIRESTORE NÃO ESCONDE CAMPO.** Quem pode ler o documento lê o
 * documento INTEIRO. Não existe "mostrar só três campos" — ou o dado não está
 * ali, ou ele foi entregue.
 *
 * ⚠️ **E ESCONDER NA TELA NÃO ESCONDE NADA.** `{role === 'admin' && ...}` é
 * decisão de layout, não de segurança. Foi exatamente assim que o aviso de
 * comprovante duplicado ficou legível pela responsável: a tela mostrava só ao
 * motorista, e o campo estava no documento dela.
 *
 * ── A PERGUNTA QUE CLASSIFICA UM CAMPO NOVO
 * Quando a tela esconde algo por PAPEL, é *irrelevância* ou é *segredo*?
 *
 *   irrelevância → pode ficar no documento. O total acumulado que o pai não
 *                  vê é a soma dos pagamentos que ele já lê; esconder é
 *                  editorial, e ele poderia somar na mão.
 *   segredo      → tem que SAIR do documento. Não existe meio-termo.
 *
 * ── A GARANTIA SE DIVIDE EM DUAS, E SABER QUAL É QUAL É O PONTO
 * Para o CLIENTE, quem impede é a RULE — ele fisicamente não grava um campo
 * da lista de proibidos. Varrer os services dele por nome seria pior que
 * inútil: `taxaService` escreve em `users` E em `taxaParceiros`, e um varredor
 * de texto não distingue o destino — reprovaria a gravação CORRETA no lugar
 * certo. (Aconteceu na primeira versão deste arquivo.)
 *
 * Para o SERVIDOR não há rule nenhuma: o Admin SDK passa por cima. Só esses é
 * que precisam ser lidos campo a campo.
 *
 * ── POR QUE LISTA DE PROIBIDOS, E NÃO DE PERMITIDOS
 * `users` é atualizado por lista de PROIBIDOS nas rules, então campo novo
 * entra calado — não há lugar onde o conjunto completo esteja declarado. Uma
 * lista de permitidos aqui envelheceria em silêncio e reprovaria campo
 * legítimo. A de proibidos sustenta a decisão: cada nome tem o motivo
 * escrito, e reintroduzir qualquer um reprova a bateria.
 *
 * COMO RODAR
 *   node scripts/testar-vazamento.mjs   (ou: npm run testar:vazamento)
 */

import { readFileSync } from 'node:fs';

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

const NL = String.fromCharCode(10);

/** O código sem a prosa: os comentários contam a história e citam os nomes. */
function semComentarios(fonte) {
  return fonte
    .split(NL)
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join(NL);
}
const ler = (rel) =>
  semComentarios(readFileSync(new URL(rel, import.meta.url), 'utf8'));

/** Só o apagamento do legado — não conta como gravar. */
const APAGAMENTO = ['FieldValue.delete()', 'deleteField()', 'null', '[]'];

/**
 * O campo é GRAVADO COM VALOR em algum destes arquivos?
 *
 * ⚠️ APAGAR NÃO É GRAVAR. Reprovar `campo: FieldValue.delete()` obrigaria a
 * deixar o campo velho apodrecendo no documento — o oposto do que este teste
 * quer. A primeira versão reprovava exatamente a própria limpeza.
 *
 * Linha a linha, e não expressão regular com lookahead: `\s*(?!...)` casa com
 * zero espaços e o lookahead passa a olhar o ESPAÇO em vez do valor, então
 * ele aprova tudo. É um erro silencioso, e num teste de vazamento isso é o
 * pior tipo.
 */
function gravaComValor(fonte, campo) {
  return fonte.split(NL).some((linha) => {
    const i = linha.indexOf(campo + ':');
    if (i < 0) return false;
    const valor = linha.slice(i + campo.length + 1).trim();
    return !APAGAMENTO.some((a) => valor.startsWith(a));
  });
}

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

// ───────────────────────────────────────────────────────────────────────────
bloco('1. `payments` — a RESPONSÁVEL lê o documento inteiro');

/**
 * A regra autoriza `resource.data.parentUid == request.auth.uid`, e precisa:
 * é a mensalidade dela. Então nada que seja JUÍZO da plataforma sobre ela
 * pode morar aqui.
 */
const PROIBIDO_EM_PAYMENTS = {
  receiptDuplicateOf:
    'o aviso de comprovante duplicado é suspeita sobre ELA, e o desenho ' +
    'decidiu mostrar só ao motorista ("aviso, não bloqueio, e só pro tio"). ' +
    'Ele ainda carrega o childName do OUTRO pagamento — entre famílias ' +
    'diferentes do mesmo motorista, o nome da criança de um terceiro. ' +
    'Mora em alertasDeComprovante desde 11/09/2026.',
};

const servidorDePayments = [
  '../functions/lib/billing.js',
  '../functions/lib/receiptGuard.js',
].map(ler).join(NL);

for (const [campo, porque] of Object.entries(PROIBIDO_EM_PAYMENTS)) {
  checar(`nenhuma function grava ${campo} no pagamento`, false,
    gravaComValor(servidorDePayments, campo));
  checar('  e o motivo está escrito junto', true, porque.length > 40);
}

// A limpeza do legado TEM que existir: sem ela, o campo escrito antes de
// 11/09/2026 fica visível para sempre nos pagamentos que já existem.
checar('e a function apaga o campo antigo do pagamento', true,
  servidorDePayments.includes('receiptDuplicateOf: FieldValue.delete()'));

// O cartão é compartilhado pelas duas telas — ele não pode ler do pagamento.
const cartao = ler('../src/components/payments/PaymentRow.jsx');
checar('o cartão não lê o campo do pagamento', false,
  cartao.includes('payment.receiptDuplicateOf'));
checar('ele recebe o aviso por fora', true, cartao.includes('alertaDeDuplicata'));

// E a coleção nova precisa ser fechada ao cliente — inclusive na ESCRITA:
// um motorista que pudesse escrever apagaria o aviso sobre si mesmo.
checar('a coleção nova existe nas rules', true,
  rules.includes('match /alertasDeComprovante/{paymentId}'));
checar('e nenhum cliente escreve nela', true,
  /match \/alertasDeComprovante\/\{paymentId\} \{[\s\S]*?allow write: if false;/.test(rules));

// Sonda positiva: o detector reconhece a gravação de verdade...
checar('o detector acusa gravação (sonda positiva)', true,
  gravaComValor('  receiptDuplicateOf: { paymentId: x },', 'receiptDuplicateOf'));
// ...e NÃO acusa o apagamento, que é o falso positivo que o derrubaria.
checar('e não acusa apagamento (sonda negativa)', false,
  gravaComValor('  receiptDuplicateOf: FieldValue.delete()', 'receiptDuplicateOf'));

// ───────────────────────────────────────────────────────────────────────────
bloco('2. `users` do motorista — a FAMÍLIA dele lê o documento inteiro');

/**
 * Ela precisa: chave PIX, telefone, marca, e o CPF/CNPJ de quem assina o
 * contrato com ela. Vem tudo junto, porque regra não projeta campo.
 */
const PROIBIDO_EM_USERS = {
  concessoes:
    'o registro da exceção guarda o MOTIVO, texto livre que o DONO escreve ' +
    'sobre o associado. Era a nota privada da plataforma sobre ele na mão ' +
    'dos clientes dele. Mora em taxaParceiros desde 11/09/2026.',
  notaInterna:
    'a nota do dono sobre o motorista. Nunca esteve aqui, e é o precedente ' +
    'que justificou mover a concessão: taxaParceiros existe para isto.',
};

const servidorDeUsers = [
  '../functions/lib/contratacao.js',
  '../functions/lib/fechamento.js',
  '../functions/lib/eventoDeCobranca.js',
  '../functions/lib/relogioDoTeste.js',
].map(ler).join(NL);

for (const campo of Object.keys(PROIBIDO_EM_USERS)) {
  checar(`nenhuma function grava ${campo} em users`, false,
    gravaComValor(servidorDeUsers, campo));
  // ⚠️ E A RULE RECUSA O CLIENTE. Código que não escreve mais não é
  // garantia: campo sem gravador que segue permitido é campo livre.
  checar(`  e a rule de users proíbe ${campo}`, true, rules.includes(`'${campo}'`));
}

// ───────────────────────────────────────────────────────────────────────────
bloco('3. O resíduo conhecido — declarado, não esquecido');

/**
 * ⚠️ ESTES CAMPOS CONTINUAM VISÍVEIS À FAMÍLIA, e isso é DECISÃO com motivo
 * técnico, não descuido. Declarar aqui é o que impede a próxima pessoa de
 * "descobrir" isso como novidade e refazer a análise do zero — ou pior, de
 * tentar consertar sem saber por que não foi consertado.
 *
 * As rules leem os quatro a cada avaliação: `isAdmin()` chama `trialInicio` e
 * `assinaturaAte`, o create de `children` compara `criancasAtivas`, e o
 * contrato confere `plano`. Movê-los exigiria um `get()` extra POR REGRA, e o
 * Firestore corta em 20 acessos por lote — teto que este app já encosta: o
 * "embarquei todos" é dividido de 15 em 15 exatamente por isso.
 *
 * Fechar isso exige o caminho inverso — um documento enxuto para a família e
 * `users` fechado para ela. É espelho, e espelho sem teste é o que este
 * projeto mais evita.
 */
const RESIDUO_EM_USERS = {
  plano: 'a rule de contratosAssociacao confere o plano dentro do contrato',
  trialInicio: 'isAdmin() decide se o teste de 90 dias ainda corre',
  assinaturaAte: 'isAdmin() decide se a assinatura cobre hoje',
  criancasAtivas: 'o create de children exige o contador subindo no mesmo batch',
};

for (const [campo, porque] of Object.entries(RESIDUO_EM_USERS)) {
  // Cada resíduo precisa de um uso REAL nas rules. Se parar de ser usado,
  // deixa de ser resíduo e vira campo que já podia ter saído.
  checar(`${campo} ainda é lido pelas rules`, true, rules.includes(campo));
  checar('  e o motivo está declarado', true, porque.length > 20);
}

// ───────────────────────────────────────────────────────────────────────────
bloco('4. O precedente que vale copiar — o servidor CURA o que sai');

/**
 * A página pública de acompanhar é o melhor exemplo do projeto: ela não faz
 * spread do documento da criança, monta uma LISTA FECHADA de campos. É o
 * único desenho que resiste ao console do navegador, porque o dado sensível
 * nunca chega lá.
 */
const acompanhamento = ler('../functions/lib/reguaDoAcompanhamento.js');
checar('o acompanhamento não faz spread do documento', false,
  /\.\.\.(crianca|child|dados)\b/.test(acompanhamento));

const testeDoAcompanhamento = readFileSync(
  new URL('./testar-acompanhamento.mjs', import.meta.url), 'utf8').toLowerCase();
for (const proibido of ['endereço', 'coordenada', 'telefone', 'saude']) {
  checar(`o teste dele procura ${proibido} dentro do JSON`, true,
    testeDoAcompanhamento.includes(proibido));
}

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
