/**
 * UM CPF/CNPJ, UMA CONTA — o que a assinatura exige (decisão do dono,
 * 05/10/2026).
 *
 * Assinar o plano passou a exigir CPF/CNPJ VÁLIDO, e o servidor registra cada
 * documento em `documentosDeAssinante/{hash}` para uma conta só. É isso que
 * impede alguém de indicar a si mesmo com outra conta ou de repetir o desconto
 * de fechamento abrindo outra.
 *
 * Três metades, e as três são medidas aqui:
 *   1. A RÉGUA (`functions/lib/reguaDoAssinante.js`), pura: qual documento
 *      vale, e de quem é o registro.
 *   2. O ESPELHO: a tela decide se abre o passo do CPF com
 *      `documentoValido` de `src/compartilhado/masks.js`; o servidor recusa
 *      com o de `cobrancaDaTaxa.js`. Se discordarem, a tela deixa passar um
 *      número que o servidor recusa (ou o contrário) — comparados caso a caso.
 *   3. A FIAÇÃO, por leitura de arquivo: a callable grava o registro e a
 *      cláusula na MESMA transação, as rules fecham a coleção e amarram o
 *      contrato ao documento registrado. `contratacao.js` requer o SDK e
 *      nenhum script da bateria pode importá-lo (`testar:imports`).
 *
 * As rules em si são medidas no emulador por `npm run testar:regras`.
 */

import { readFileSync } from 'node:fs';
import {
  documentoValido as noServidor,
  formatarDocumento,
  documentoDoAssinante,
  donoDoDocumento,
  FRASE_DA_RECUSA,
} from '../functions/lib/reguaDoAssinante.js';
import { documentoValido as naTela, maskCpfCnpj } from '../src/compartilhado/masks.js';

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

// As quebras de linha viram "\n": num clone no Windows o arquivo chega com
// "\r\n", e a busca pela linha da rule passava direto (QA, 05/10/2026).
const ler = (caminho) => readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const CPF = '52998224725';
const CPF_FORMATADO = '529.982.247-25';
const CNPJ = '11222333000181';
const CNPJ_FORMATADO = '11.222.333/0001-81';

// ───────────────────────── 1. o espelho da validade ─────────────────────────

bloco('1. A tela e o servidor concordam sobre o que é um CPF/CNPJ válido');

const CASOS = [
  CPF, CPF_FORMATADO, CNPJ, CNPJ_FORMATADO,
  '52998224726', '11222333000182', '11111111111', '00000000000000',
  '5299822472', '', null, undefined, 'abc', '123.456.789-09', '12.345.678/0001-95',
  '529.982.247-2', '  529.982.247-25  ',
];
let divergiu = null;
for (const c of CASOS) {
  if (Boolean(noServidor(c)) !== Boolean(naTela(c))) divergiu = c;
}
checar('nenhum caso diverge entre tela e servidor', null, divergiu);
checar('sonda: um válido passa nos dois', [true, true], [Boolean(noServidor(CPF)), naTela(CPF)]);
checar('sonda: um inválido cai nos dois', [false, false],
  [Boolean(noServidor('52998224726')), naTela('52998224726')]);

checar('o servidor formata o CPF como a máscara da tela', maskCpfCnpj(CPF), formatarDocumento(CPF));
checar('e o CNPJ também', maskCpfCnpj(CNPJ), formatarDocumento(CNPJ));

// ──────────────────────── 2. qual documento vale ────────────────────────────

bloco('2. A fonte é o perfil; a tela só completa o que falta');

const doPerfil = documentoDoAssinante({ doPerfil: CPF_FORMATADO });
checar('perfil válido: vale o do perfil', true, doPerfil.ok);
checar('com o texto do perfil, como está', CPF_FORMATADO, doPerfil.documento);
checar('e nada é regravado no perfil', false, doPerfil.gravarNoPerfil);
checar('enviar o MESMO número que o perfil passa', true,
  documentoDoAssinante({ doPerfil: CPF_FORMATADO, enviado: CPF }).ok);
// ⚠️ TROCAR O CPF AQUI MUDARIA EM SILÊNCIO A PARTE DO CONTRATO COM AS FAMÍLIAS.
checar('perfil válido e enviado diferente: recusa', 'diferente-do-perfil',
  documentoDoAssinante({ doPerfil: CPF_FORMATADO, enviado: CNPJ }).erro);
checar('perfil válido e enviado inválido: recusa', 'invalido',
  documentoDoAssinante({ doPerfil: CPF_FORMATADO, enviado: '123' }).erro);

const daTela = documentoDoAssinante({ doPerfil: '', enviado: CNPJ });
checar('perfil sem documento: vale o enviado', true, daTela.ok);
checar('formatado pelo servidor', CNPJ_FORMATADO, daTela.documento);
checar('e o servidor grava no perfil', true, daTela.gravarNoPerfil);
checar('perfil com documento INVÁLIDO conta como sem', true,
  documentoDoAssinante({ doPerfil: '111.111.111-11', enviado: CPF }).gravarNoPerfil);

checar('sem nada: falta', 'falta', documentoDoAssinante({}).erro);
checar('sem nada e perfil inválido: falta', 'falta',
  documentoDoAssinante({ doPerfil: '123.456.789-00' }).erro);
checar('enviado inválido: recusa', 'invalido', documentoDoAssinante({ enviado: '52998224726' }).erro);
checar('dígitos iguais não passam', 'invalido', documentoDoAssinante({ enviado: '00000000000' }).erro);

// ───────────────────────── 3. de quem é o registro ──────────────────────────

bloco('3. Um documento, uma conta');

checar('sem registro: livre', 'livre', donoDoDocumento(null, 'tio1'));
checar('registro sem uid: livre', 'livre', donoDoDocumento({}, 'tio1'));
checar('o meu: segue (troca de plano, renovação)', 'meu', donoDoDocumento({ uid: 'tio1' }, 'tio1'));
checar('de outra conta: recusa', 'outro', donoDoDocumento({ uid: 'tio2' }, 'tio1'));

// ⚠️ A FRASE NÃO PODE SER UM ORÁCULO: dizer de quem é o CPF entregaria a
// qualquer um uma consulta de cadastro.
checar('a recusa manda falar com o suporte', true, /suporte/i.test(FRASE_DA_RECUSA.outro));
checar('e não cita e-mail, nome nem uid', false,
  /@|\$\{|uid|nome/i.test(FRASE_DA_RECUSA.outro));
checar('a falta diz o porquê na frase da tela', 'O contrato precisa do seu CPF ou CNPJ.',
  FRASE_DA_RECUSA.falta);
checar('toda recusa tem frase', true,
  ['falta', 'invalido', 'diferente-do-perfil', 'outro'].every((k) => FRASE_DA_RECUSA[k]));

// ──────────────────────── 4. a fiação, por leitura ──────────────────────────

bloco('4. A callable, as rules e a tela');

const callable = ler('functions/lib/contratacao.js');
checar('a callable aplica a régua', true, callable.includes('documentoDoAssinante('));
checar('o registro e a cláusula vão numa transação', true,
  /runTransaction[\s\S]*documentosDeAssinante|documentosDeAssinante[\s\S]*runTransaction/.test(callable)
  && /tx\.get\(refDoDocumento\)/.test(callable));
checar('o id do registro é um hash, não o número', true,
  /createHash\('sha256'\)[\s\S]{0,120}doc\.digitos/.test(callable));
checar('documento de outra conta é already-exists', true,
  callable.includes("'already-exists', FRASE_DA_RECUSA.outro"));
checar('companyDocument só é gravado quando o perfil não tinha', true,
  callable.includes('doc.gravarNoPerfil ? { companyDocument: doc.documento }'));
checar('e o documento registrado volta para a tela', true, callable.includes('documento: doc.documento'));

const rules = ler('firestore.rules');
checar('a coleção é fechada a todo cliente', true,
  /match \/documentosDeAssinante\/\{hash\} \{\s*allow read, write: if false;\s*\}/.test(rules));
checar('o cliente não escreve o documento da assinatura', true,
  /hasAny\(\[[\s\S]*'documentoDaAssinatura'/.test(rules));
checar('o contrato só nasce com o documento registrado', true,
  rules.includes("request.resource.data.conteudo.assinante.documento\n             == userDoc().get('documentoDaAssinatura', '')"));

const tela = ler('src/pages/tio/TioPlanos.jsx');
const passo = tela.slice(tela.indexOf('title="Seu CPF ou CNPJ"'), tela.indexOf('title="Seu CPF ou CNPJ"') + 900);
checar('a tela tem o passo do CPF/CNPJ', true, passo.length > 0 && passo.includes('O contrato precisa do seu CPF ou CNPJ.'));
checar('o campo do documento não tem ditado por voz', false, /falar=/.test(passo));
checar('e usa a máscara de CPF/CNPJ', true, passo.includes('maskCpfCnpj('));
checar('o passo só abre sem documento válido no perfil', true,
  tela.includes('if (!documentoValido(profile?.companyDocument))'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
