/**
 * O PIX COPIA E COLA — o BR Code que o banco aceita ou recusa.
 *
 * ── POR QUE ESTE ARQUIVO EXISTE
 * `dominio/cobranca/pixPayload.js` gera o BR Code estático (padrão EMV do
 * Banco Central) e, até 09/09/2026, **não tinha um único teste** — descoberto
 * por um mapa de cobertura que seguiu os imports da bateria, não por leitura.
 *
 * Ele está nos DOIS lados do dinheiro:
 *   - `components/payments/PixBlock.jsx` — a família pagando o motorista;
 *   - `pages/tio/TioTaxa.jsx` — o motorista pagando a plataforma.
 *
 * E o modo de falha dele é total, não parcial: **CRC errado é código
 * recusado**. O app do banco não diz "faltou um dígito" — ele diz que o código
 * é inválido, e a pessoa conclui que o problema é o PIX do motorista. Um erro
 * de um caractere aqui derruba a cobrança dos dois lados ao mesmo tempo, e
 * nenhuma tela consegue perceber.
 *
 * ── POR QUE ELE É TESTÁVEL DE VERDADE
 * É função determinística de string para string, sem Firebase e sem relógio —
 * exatamente o que o diretório `dominio/` existe para permitir. Não havia
 * obstáculo técnico: só ninguém tinha escrito.
 *
 * ── O QUE DÁ CONFIANÇA AQUI, E NÃO É O NOSSO PRÓPRIO CÓDIGO
 * O CRC16/CCITT-FALSE tem VETOR DE TESTE PÚBLICO: a string '123456789'
 * produz 0x29B1. Se a nossa implementação passar nele, ela é a função certa —
 * e não apenas "consistente consigo mesma", que é o que um teste de
 * regressão puro provaria.
 *
 * COMO RODAR
 *   node scripts/testar-brcode.mjs
 */

import { buildPixPayload, crc16 } from '../src/dominio/cobranca/pixPayload.js';

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

function bloco(titulo) {
  console.log(`\n\x1b[1m${titulo}\x1b[0m`);
}

/** Lê um campo EMV do payload: `id` + tamanho(2) + valor. */
function campo(payload, id) {
  let i = 0;
  while (i < payload.length - 4) {
    const tag = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    const valor = payload.slice(i + 4, i + 4 + len);
    if (tag === id) return valor;
    i += 4 + len;
  }
  return null;
}

// ─────────────────────────── o CRC ────────────────────────────────────────

bloco('1. O CRC16 é o do padrão, não o nosso');

// ⚠️ O VETOR PÚBLICO. `123456789` → 0x29B1 no CRC16/CCITT-FALSE (polinômio
// 0x1021, inicial 0xFFFF, sem reflexão, sem XOR final). É este caso que
// distingue "a função certa" de "uma função consistente consigo mesma" — e é
// por isso que ele vem primeiro.
checar('o vetor de teste do CRC16/CCITT-FALSE', '29B1', crc16('123456789'));

// Quatro dígitos SEMPRE, com zero à esquerda. O BCB lê posição fixa: um CRC
// de três caracteres desloca a leitura e invalida o código inteiro.
checar('o CRC tem sempre 4 caracteres', 4, crc16('A').length);
checar('e é hexadecimal maiúsculo', true, /^[0-9A-F]{4}$/.test(crc16('qualquer coisa')));
// A string vazia produz o valor inicial do registrador — se algum dia isso
// mudar, a implementação deixou de ser CCITT-FALSE.
checar('string vazia devolve o valor inicial', 'FFFF', crc16(''));

// ────────────────────── a forma do BR Code ────────────────────────────────

bloco('2. A forma do payload — os campos que o banco procura');

const BASE = {
  key: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  keyType: 'random',
  merchantName: 'Tio Nino Transporte',
  city: 'Sao Paulo',
  amount: 320,
  txid: 'SET2026',
};

const p = buildPixPayload(BASE);

checar('começa com a versão do payload (00 = 01)', '01', campo(p, '00'));
checar('moeda é 986 (real)', '986', campo(p, '53'));
checar('país é BR', 'BR', campo(p, '58'));
// O GUI do arranjo é fixo e o banco casa por ele. Errar aqui é o código não
// ser reconhecido como PIX.
checar('o arranjo é br.gov.bcb.pix', 'br.gov.bcb.pix', campo(campo(p, '26'), '00'));
checar('e a chave vai dentro do 26', BASE.key, campo(campo(p, '26'), '01'));

// ⚠️ O CRC É CALCULADO SOBRE O PAYLOAD JÁ COM '6304' NO FIM.
//
// É a pegadinha do padrão, e a fonte mais comum de código recusado: quem
// calcula antes de acrescentar o `6304` produz um checksum de outra string.
// Este caso recalcula do zero e compara com o que saiu.
const corpo = p.slice(0, -4);
checar('o payload termina com o id do CRC', '6304', corpo.slice(-4));
checar('e o CRC fecha sobre o corpo COM o 6304', crc16(corpo), p.slice(-4));

// ────────────────────────── o valor ───────────────────────────────────────

bloco('3. O valor — dois decimais, ou ausente');

// ⚠️ DOIS DECIMAIS SEMPRE. O comentário do código diz que é "o que evita o pai
// digitar 32,00 no lugar de 320,00" — e é o campo em que um formato errado
// cobra outro valor, sem ninguém perceber até a conciliação.
checar('320 vira 320.00', '320.00', campo(p, '54'));
checar('valor quebrado mantém os centavos', '99.90',
  campo(buildPixPayload({ ...BASE, amount: 99.9 }), '54'));
checar('valor com mais casas é arredondado a 2', '10.13',
  campo(buildPixPayload({ ...BASE, amount: 10.126 }), '54'));

// SEM VALOR o campo 54 NÃO EXISTE — e é diferente de existir com zero. O
// padrão trata ausência como "o pagador digita"; um `54` com '0.00' é uma
// cobrança de zero real, que o banco pode recusar.
checar('sem valor, o campo 54 não existe',
  null, campo(buildPixPayload({ ...BASE, amount: null }), '54'));
checar('valor zero também não gera o campo',
  null, campo(buildPixPayload({ ...BASE, amount: 0 }), '54'));
checar('nem valor negativo',
  null, campo(buildPixPayload({ ...BASE, amount: -5 }), '54'));

// ──────────────────── nome, cidade e txid ─────────────────────────────────

bloco('4. Texto: ASCII maiúsculo, e os tetos do padrão');

// Acento no nome faz banco exibir lixo ou recusar. O padrão pede ASCII.
const comAcento = buildPixPayload({
  ...BASE, merchantName: 'José Antônio Ação', city: 'São Paulo',
});
checar('nome perde o acento e sobe para maiúsculo', 'JOSE ANTONIO ACAO', campo(comAcento, '59'));
checar('cidade também', 'SAO PAULO', campo(comAcento, '60'));

// OS TETOS SÃO DO PADRÃO: 25 para o nome, 15 para a cidade. Passar do teto
// não é "texto cortado na tela" — é campo com tamanho declarado errado, e o
// banco lê o payload por posição.
const nomeLongo = buildPixPayload({
  ...BASE,
  merchantName: 'Transportes Escolares Muito Longo Nome Ltda',
  city: 'Cidade Com Nome Absurdamente Longo',
});
checar('nome é cortado em 25', 25, campo(nomeLongo, '59').length);
checar('cidade é cortada em 15', 15, campo(nomeLongo, '60').length);

// Sem nome ou sem cidade, o padrão exige ALGO — campo vazio invalida.
const semTexto = buildPixPayload({ ...BASE, merchantName: '', city: '' });
checar('sem nome, cai num padrão não vazio', true, (campo(semTexto, '59') || '').length > 0);
checar('sem cidade, idem', true, (campo(semTexto, '60') || '').length > 0);

// O txid aceita só alfanumérico, e '***' é o valor neutro do padrão.
checar('txid limpa o que não é alfanumérico', 'SET2026',
  campo(campo(buildPixPayload({ ...BASE, txid: 'SET/2026' }), '62'), '05'));
checar('sem txid, usa o neutro do padrão', '***',
  campo(campo(buildPixPayload({ ...BASE, txid: '' }), '62'), '05'));
checar('txid é cortado em 25', 25,
  campo(campo(buildPixPayload({ ...BASE, txid: 'A'.repeat(40) }), '62'), '05').length);

// ─────────────────────── a chave, e a recusa ──────────────────────────────

bloco('5. Sem chave válida não há código — e null é a resposta certa');

// ⚠️ `null`, E NÃO UM CÓDIGO QUEBRADO. A tela sabe esconder o bloco de PIX
// quando recebe `null`; um payload malformado ela exibiria como se servisse, e
// a pessoa levaria um "código inválido" no app do banco.
checar('sem chave devolve null', null, buildPixPayload({ ...BASE, key: '' }));
checar('chave nula devolve null', null, buildPixPayload({ ...BASE, key: null }));
checar('telefone inválido devolve null', null,
  buildPixPayload({ ...BASE, key: '119', keyType: 'phone' }));

// ⚠️ A ORDEM DOS ARGUMENTOS DE `normalizePixKey` É (type, value), E A CÓPIA
// ANTIGA A INVERTIA. O cabeçalho de `pix.js` registra esse bug. Este caso
// prova que a chamada daqui está na ordem certa: invertida, um telefone válido
// viraria `null` e o bloco de PIX desapareceria da tela.
const comTelefone = buildPixPayload({
  ...BASE, key: '(11) 96917-0709', keyType: 'phone',
});
checar('telefone válido gera código', true, typeof comTelefone === 'string');
checar('e a chave vai normalizada, com +55',
  '+5511969170709', campo(campo(comTelefone, '26'), '01'));

const comEmail = buildPixPayload({
  ...BASE, key: '  Contato@Alobuzinou.com.br ', keyType: 'email',
});
checar('e-mail é normalizado', 'contato@alobuzinou.com.br',
  campo(campo(comEmail, '26'), '01'));

// ─────────────────── a invariante que vale por todos ──────────────────────

bloco('6. A invariante: todo código que sai fecha o próprio CRC');

// ⚠️ ESTE BLOCO É O QUE PEGA O PRÓXIMO CAMPO QUE ALGUÉM ACRESCENTAR.
//
// Os casos acima verificam campos que existem hoje. Este afirma a propriedade
// que precisa valer sempre: qualquer combinação de entrada produz um payload
// cujo checksum fecha. Campo novo mal formado (tamanho errado, id repetido)
// quebra aqui sem ninguém precisar lembrar de escrever um caso para ele.
const COMBINACOES = [
  { ...BASE },
  { ...BASE, amount: null },
  { ...BASE, txid: '' },
  { ...BASE, merchantName: '', city: '' },
  { ...BASE, key: '(11) 96917-0709', keyType: 'phone' },
  { ...BASE, key: 'contato@alobuzinou.com.br', keyType: 'email' },
  { ...BASE, amount: 0.01 },
  { ...BASE, amount: 99999.99 },
  { ...BASE, merchantName: 'Ção Ãé Íõ Ûà', city: 'Açaí', txid: 'a-b_c 1' },
];

let todosFecham = true;
for (const entrada of COMBINACOES) {
  const saida = buildPixPayload(entrada);
  if (typeof saida !== 'string') { todosFecham = false; break; }
  if (crc16(saida.slice(0, -4)) !== saida.slice(-4)) { todosFecham = false; break; }
}
checar(`todas as ${COMBINACOES.length} combinações fecham o CRC`, true, todosFecham);

// E todo campo declara o tamanho que realmente tem: um `len` errado desloca a
// leitura de tudo que vem depois, e o banco recusa sem dizer por quê.
function tamanhosCoerentes(payload) {
  let i = 0;
  const corpoSemCrc = payload.slice(0, -8); // tira '6304' + os 4 do CRC
  while (i < corpoSemCrc.length) {
    if (i + 4 > corpoSemCrc.length) return false;
    const len = Number(corpoSemCrc.slice(i + 2, i + 4));
    if (!Number.isInteger(len)) return false;
    if (i + 4 + len > corpoSemCrc.length) return false;
    i += 4 + len;
  }
  return i === corpoSemCrc.length;
}
checar('todo campo declara o tamanho que tem', true,
  COMBINACOES.every((e) => tamanhosCoerentes(buildPixPayload(e))));

// ─────────────────────────── resumo ───────────────────────────────────────

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
