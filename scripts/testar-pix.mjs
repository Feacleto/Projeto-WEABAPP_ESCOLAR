/**
 * A CHAVE PIX — o campo que decide para onde vai o dinheiro.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * Havia DUAS `normalizePixKey` no projeto, com a ORDEM DOS ARGUMENTOS
 * INVERTIDA — `(type, value)` numa, `(key, type)` na outra — e com
 * comportamentos diferentes. Trocar um import pelo outro compilava, passava no
 * lint e produzia uma chave inválida em silêncio: o QR sairia apontando para o
 * nada e ninguém descobriria até um pai tentar pagar.
 *
 * O bloco 3 trava a regressão que motivou a unificação: a chave no formato
 * internacional (`+5511973185800`) era RECUSADA pela validação, que contava
 * dígitos crus, enquanto o cadastro de telefone aceitava o mesmo número e a
 * normalização sabia lidar com o 55.
 *
 * COMO RODAR
 *   node scripts/testar-pix.mjs      (ou: npm run testar:pix)
 */

import { validatePixKey, normalizePixKey, PIX_KEY_TYPES } from '../src/dominio/cobranca/pix.js';

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
const valida = (t, v) => validatePixKey(t, v) === null;
function bloco(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`);
}

bloco('1. Os tipos que o app oferece');
checar('três tipos no cadastro', ['phone', 'email', 'random'], Object.keys(PIX_KEY_TYPES));

bloco('2. Celular — o formato do cadastro');
checar('com máscara', true, valida('phone', '(11) 97318-5800'));
checar('só dígitos', true, valida('phone', '11973185800'));
checar('fixo de 10 dígitos', true, valida('phone', '1132145678'));
checar('curto demais recusa', false, valida('phone', '9731858'));
checar('longo demais recusa', false, valida('phone', '119731858001234'));
checar('vazio recusa', false, valida('phone', ''));

bloco('3. Celular no formato INTERNACIONAL — a recusa que existia');
// A validação contava dígitos crus: 13 com o 55 na frente, e recusava. Mas é
// exatamente o formato que `normalizePixKey` produz e que o banco devolve
// quando o motorista copia a própria chave.
checar('+55 com 13 dígitos é válido', true, valida('phone', '+5511973185800'));
checar('55 sem o + também', true, valida('phone', '5511973185800'));
checar('e continua recusando lixo com 55 na frente', false, valida('phone', '55123'));

bloco('4. Celular normalizado sai no formato do PIX');
checar('máscara vira +55…', '+5511973185800', normalizePixKey('phone', '(11) 97318-5800'));
checar('já com 55 não duplica', '+5511973185800', normalizePixKey('phone', '5511973185800'));
checar('já com +55 não duplica', '+5511973185800', normalizePixKey('phone', '+5511973185800'));

bloco('5. E-mail');
checar('e-mail comum', true, valida('email', 'tio@email.com'));
checar('sem arroba recusa', false, valida('email', 'tioemail.com'));
checar('sem domínio recusa', false, valida('email', 'tio@'));
// As duas cópias discordavam sobre este: uma aceitava, a outra não.
checar('TLD de uma letra recusa (a@b.c)', false, valida('email', 'a@b.c'));
// Só uma das duas minusculava — e chave PIX é sensível a isso na comparação.
checar('normalizado vira minúsculo', 'tio@email.com', normalizePixKey('email', 'TIO@Email.COM'));
checar('e apara espaço', 'tio@email.com', normalizePixKey('email', '  tio@email.com  '));

bloco('6. Chave aleatória (UUID)');
const uuid = '123e4567-e89b-12d3-a456-426614174000';
checar('UUID válido', true, valida('random', uuid));
checar('sem hífen recusa', false, valida('random', uuid.replace(/-/g, '')));
checar('curto recusa', false, valida('random', '123e4567'));
checar('normalizada vai como está', uuid, normalizePixKey('random', uuid));

bloco('7. CPF/CNPJ — aceitos por compatibilidade com cadastro feito no console');
checar('CPF com 11 dígitos', true, valida('cpf', '123.456.789-01'));
checar('CPF curto recusa', false, valida('cpf', '12345'));
checar('CNPJ com 14 dígitos', true, valida('cnpj', '12.345.678/0001-90'));
checar('CPF normalizado perde a pontuação', '12345678901', normalizePixKey('cpf', '123.456.789-01'));
checar('CNPJ idem', '12345678000190', normalizePixKey('cnpj', '12.345.678/0001-90'));

bloco('8. Bordas');
checar('tipo desconhecido recusa', false, valida('bitcoin', 'x'));
checar('valor nulo recusa', false, valida('phone', null));
checar('normalizar vazio devolve vazio', '', normalizePixKey('phone', ''));
checar('normalizar nulo devolve vazio', '', normalizePixKey('email', null));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
