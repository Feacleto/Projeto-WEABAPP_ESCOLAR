/**
 * O ERRO DE AUTENTICAÇÃO EM PORTUGUÊS.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * `mapAuthError` estava copiada em quatro telas, com quatro conjuntos
 * diferentes de casos — e a divergência caía em quem está criando conta:
 * o mesmo erro (e-mail já usado) respondia em português numa tela e com a
 * mensagem crua do SDK, em inglês, na outra.
 *
 * O bloco 4 trava a decisão de segurança que a unificação preservou:
 * "usuário não existe" e "senha errada" respondem A MESMA coisa, senão dá
 * pra descobrir quem tem conta no app testando e-mails.
 *
 * COMO RODAR
 *   node scripts/testar-auth.mjs      (ou: npm run testar:auth)
 */

import { mensagemDeAuth } from '../src/dominio/identidade/authErrors.js';
import { painelDe } from '../src/dominio/identidade/papeis.js';
import {
  codigoDoTexto,
  isValidInviteCodeFormat,
} from '../src/dominio/identidade/generateInviteCode.js';

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
const erro = (code, message) => ({ code, message });

bloco('1. Os códigos comuns respondem igual em qualquer contexto');

for (const ctx of ['entrar', 'criar', 'link']) {
  checar(`sem internet (${ctx})`, 'Sem conexão com a internet.',
    mensagemDeAuth(erro('auth/network-request-failed'), ctx));
}
checar('e-mail inválido', 'Email inválido.', mensagemDeAuth(erro('auth/invalid-email'), 'entrar'));
checar('muitas tentativas', 'Muitas tentativas. Aguarde alguns minutos.',
  mensagemDeAuth(erro('auth/too-many-requests'), 'entrar'));
checar('conta desativada', 'Esta conta foi desativada. Entre em contato com o motorista.',
  mensagemDeAuth(erro('auth/user-disabled'), 'link'));

bloco('2. Criar conta — os casos que só existiam numa das quatro cópias');

// Este é o erro que respondia em português numa tela e em inglês na outra.
checar('e-mail já em uso', 'Este email já tem conta. Use "Já tenho conta".',
  mensagemDeAuth(erro('auth/email-already-in-use', 'The email address is already in use'), 'criar'));
checar('senha fraca', 'Senha muito curta. Use ao menos 6 caracteres.',
  mensagemDeAuth(erro('auth/weak-password', 'Password should be at least 6 characters'), 'criar'));
// E o mesmo código pela folha de login da home responde igual agora.
checar('e o mesmo código no contexto de entrar', 'Este email já tem conta. Use "Já tenho conta".',
  mensagemDeAuth(erro('auth/email-already-in-use'), 'entrar'));

bloco('3. O link de redefinição tem modos de falha próprios');

checar('link expirado', 'O link expirou. Solicite um novo email de redefinição.',
  mensagemDeAuth(erro('auth/expired-action-code'), 'link'));
checar('link já usado', 'Link inválido ou já utilizado. Solicite um novo email.',
  mensagemDeAuth(erro('auth/invalid-action-code'), 'link'));
checar('usuário não encontrado no link', 'Usuário não encontrado.',
  mensagemDeAuth(erro('auth/user-not-found'), 'link'));

bloco('4. ENTRAR: credencial errada é UMA resposta só');

// Responder diferente a "não existe" e "senha errada" deixa descobrir quem
// tem conta no app testando e-mails.
const naoExiste = mensagemDeAuth(erro('auth/user-not-found'), 'entrar');
const senhaErrada = mensagemDeAuth(erro('auth/wrong-password'), 'entrar');
const credencial = mensagemDeAuth(erro('auth/invalid-credential'), 'entrar');
checar('usuário inexistente e senha errada dão a MESMA frase', naoExiste, senhaErrada);
checar('e credencial inválida também', naoExiste, credencial);
checar('e a frase não entrega qual dos dois foi', 'Email ou senha incorretos.', naoExiste);

bloco('5. O popup do Google');

checar('popup bloqueado', 'Popup bloqueado pelo navegador. Habilite e tente novamente.',
  mensagemDeAuth(erro('auth/popup-blocked'), 'entrar'));
checar('popup fechado é cancelamento, não erro', 'Login cancelado.',
  mensagemDeAuth(erro('auth/popup-closed-by-user'), 'entrar'));
checar('conta com outro método', 'Já existe conta com outro método de login pra este email.',
  mensagemDeAuth(erro('auth/account-exists-with-different-credential'), 'entrar'));

bloco('6. Código desconhecido');

// Em entrar/criar, a mensagem do SDK ajuda quem depura.
checar('cai na mensagem do SDK', 'Algo bem específico deu errado',
  mensagemDeAuth(erro('auth/algo-novo', 'Algo bem específico deu errado'), 'entrar'));
checar('sem mensagem, cai no genérico', 'Erro. Tente novamente.',
  mensagemDeAuth(erro('auth/algo-novo'), 'entrar'));
// No link, NÃO: a pessoa chegou de um e-mail e não tem o que fazer com o
// texto do SDK.
checar('no link nunca vaza o texto do SDK', 'Não foi possível concluir. Tente novamente.',
  mensagemDeAuth(erro('auth/algo-novo', 'Internal error 500'), 'link'));

checar('erro nulo não estoura', 'Erro. Tente novamente.', mensagemDeAuth(null, 'entrar'));
checar('sem contexto assume entrar', 'Email ou senha incorretos.',
  mensagemDeAuth(erro('auth/wrong-password')));

console.log('');
console.log('7. Para onde cada papel é mandado');

// PARA ONDE MANDAR ESSA PESSOA é a única resposta do sistema a essa
// pergunta, e ela nunca teve teste. Em 06/09/2026 ganhou um destino novo,
// que é o tipo de caso que quebra sem ninguém ver.
checar('o dono vai pro painel dele', '/admin', painelDe({ role: 'owner' }));
checar('o legado superAdmin também', '/admin', painelDe({ role: 'admin', superAdmin: true }));
checar('role admin significa MOTORISTA', '/tio', painelDe({ role: 'admin' }));
checar('o responsável', '/pai', painelDe({ role: 'parent' }));
checar('o inscrito não aprovado tem a tela da fila', '/aguardando', painelDe({ role: 'aguardando' }));

// SESSÃO SEM DOCUMENTO DE USUÁRIO é estado normal desde que o login com
// Google parou de apagar a conta órfã. Antes daqui saía o login, o que
// viraria laço: entra, não tem papel, volta pro login, entra de novo.
checar('sem papel, a sala de espera', '/comecar', painelDe({}));
checar('perfil nulo também', '/comecar', painelDe(null));
checar('papel inventado não abre porta nenhuma', '/comecar', painelDe({ role: 'chefe' }));

// ── O CÓDIGO TIRADO DO QUE A PESSOA COLOU ───────────────────────────
//
// O responsável nunca vê o código separado: ele mora dentro do link. Quem
// perde a mensagem e depois reencontra o link faz a coisa natural — cola o
// link inteiro. A máscara sozinha limpava tudo que não era letra ou número e
// devolvia `HTTPSALOB`, então o app dizia "código inválido" pra quem estava
// com o código certo na mão.
console.log('\n── o código, colado de onde vier ──');

checar(
  'o link inteiro entrega o código',
  'TNAB23CD',
  codigoDoTexto('https://alobuzinou.com/convite/TNAB23CD')
);
checar(
  'a mensagem inteira do WhatsApp também',
  'TNAB23CD',
  codigoDoTexto(
    'Oi! Aqui é do transporte escolar do/da Ana. Abra este link pra ' +
      'acompanhar a rota e as mensalidades pelo app: ' +
      'https://alobuzinou.com/convite/TNAB23CD'
  )
);
checar('minúsculo sobe', 'TNAB23CD', codigoDoTexto('tnab23cd'));
checar(
  'link com parâmetro depois não leva lixo junto',
  'TNAB23CD',
  codigoDoTexto('https://alobuzinou.com/convite/TNAB23CD?utm=zap')
);

// O FORMATO LEGADO (TN + 4 dígitos) É O QUE PEGA O ESCAPE ERRADO.
// Dentro de template literal, `\d` simples vira a letra `d` sem erro nenhum —
// o convite antigo deixaria de casar, calado, e só quem tem um descobriria.
checar(
  'o formato legado no link',
  'TN1234',
  codigoDoTexto('https://alobuzinou.com/convite/TN1234')
);
checar('o formato legado solto na frase', 'TN1234', codigoDoTexto('o codigo e TN1234 viu'));

// DIGITAR LETRA POR LETRA CONTINUA VALENDO — sem isto o campo ficaria vazio
// até o oitavo caractere, e ninguém digita no escuro.
checar('digitando: uma letra', 'T', codigoDoTexto('t'));
checar('digitando: meio código', 'TNA', codigoDoTexto('tna'));
checar('quem começa pelos dígitos ganha o TN', 'TN1234', codigoDoTexto('1234'));
checar('texto vazio devolve vazio', '', codigoDoTexto(''));
checar('nulo não quebra', '', codigoDoTexto(null));

// O QUE SAI DAQUI TEM QUE PASSAR NA VALIDAÇÃO — senão a extração seria
// enfeite: entregaria algo que a tela recusaria no passo seguinte.
checar(
  'o que sai do link é aceito pela validação',
  true,
  isValidInviteCodeFormat(codigoDoTexto('https://alobuzinou.com/convite/TNAB23CD'))
);
checar(
  'e meio código continua sendo recusado',
  false,
  isValidInviteCodeFormat(codigoDoTexto('tna'))
);

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
