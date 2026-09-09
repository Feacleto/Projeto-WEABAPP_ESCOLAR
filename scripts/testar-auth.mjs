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

import { readFileSync } from 'node:fs';
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
// O LEGADO `superAdmin` SAIU EM 06/09/2026, e este caso trocou de lado por
// isso. Ele existia como ponte para a conta do dono do projeto ANTIGO, que
// nasceu como motorista com o booleano por cima. O projeto foi excluído e a
// base é zero — a única janela em que a ponte podia cair sem trancar ninguém.
//
// Agora o booleano não abre nada: quem o tiver é o que o `role` disser, e
// aqui isso é MOTORISTA. Conta de dono nasce com `role: 'owner'`.
checar('o legado superAdmin não promove mais ninguém', '/tio', painelDe({ role: 'admin', superAdmin: true }));
checar('e um segundo dono vai pro mesmo painel', '/admin', painelDe({ role: 'owner' }));
checar('role admin significa MOTORISTA', '/tio', painelDe({ role: 'admin' }));
checar('o responsável', '/pai', painelDe({ role: 'parent' }));
// A FILA MORREU EM 06/09/2026, e este caso mudou de lado por isso: o papel
// `aguardando` não existe mais, então ele agora é só um papel inventado — e
// papel inventado cai na bifurcação, nunca num painel.
checar('o papel da fila antiga não abre porta nenhuma', '/comecar', painelDe({ role: 'aguardando' }));

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

// ─────────── 5. PEDIR O LINK — o contexto que faltava ───────────────────
//
// As três telas que pedem o link chamavam `mensagemDeAuth(err, 'entrar')`, e
// `ENTRAR` responde "Email ou senha incorretos." a `user-not-found`. Quem
// pedia o link para um e-mail sem conta lia uma frase sobre SENHA num momento
// em que não digitou senha nenhuma, e voltava ao formulário em laço.
console.log('');
console.log('5. Pedir o link de redefinição tem frases próprias');

const erroDe = (code) => ({ code, message: 'RAW SDK TEXT, IN ENGLISH' });

// ⚠️ A DISCRIÇÃO CONTINUA VALENDO: a frase não confirma se a conta existe.
// Dizer confirmaria ao atacante quem tem conta no app — é a mesma decisão do
// bloco 4, aplicada ao outro fluxo.
checar(
  'e-mail sem conta nao e confirmado como inexistente',
  false,
  /nao (existe|encontrad)|não (existe|encontrad)/i.test(
    mensagemDeAuth(erroDe('auth/user-not-found'), 'reset')
  )
);
checar(
  'e a frase do reset NAO fala de senha errada',
  false,
  /senha (incorreta|errada)|senha incorretos/i.test(
    mensagemDeAuth(erroDe('auth/user-not-found'), 'reset')
  )
);

// A INVARIANTE, e não um caso: nenhum código do fluxo de pedir link pode
// vazar o texto do SDK. Erro de CONFIGURAÇÃO não é culpa dela, e antes saía
// em inglês num toast vermelho, porque estes códigos não estavam em tabela
// nenhuma e o contexto 'entrar' cai em `err.message`.
const CODIGOS_DE_RESET = [
  'auth/invalid-email',
  'auth/user-not-found',
  'auth/too-many-requests',
  'auth/network-request-failed',
  'auth/missing-email',
  'auth/unauthorized-continue-uri',
  'auth/invalid-continue-uri',
  'auth/missing-continue-uri',
];
checar(
  'nenhum codigo do fluxo de reset vaza o texto do SDK',
  true,
  CODIGOS_DE_RESET.every(
    (c) => !mensagemDeAuth(erroDe(c), 'reset').includes('RAW SDK TEXT')
  )
);
checar(
  'nem um codigo desconhecido',
  false,
  mensagemDeAuth(erroDe('auth/algo-que-nao-existe'), 'reset').includes('RAW SDK TEXT')
);

// ─────────── 6. O continueUrl NAO pode exigir oobCode ────────────────────
//
// ⚠️ ESTA É A INVARIANTE QUE PEGA O DEFEITO MAIS CARO DESTE FLUXO.
//
// `actionCodeSettings.url` NÃO é o destino do link — o SDK o converte em
// `continueUrl` (`request.continueUrl = actionCodeSettings.url`), e quem
// decide o destino é o Action URL do CONSOLE. O `url` é só "para onde ir
// depois de concluir".
//
// Ele apontava para `/auth-action`, que sem `mode` e sem `oobCode` cai no ramo
// de erro e imprime "Link inválido. Solicite um novo email." Ou seja: a pessoa
// redefinia a senha com sucesso e a última coisa que o app dizia era que havia
// falhado.
//
// O teste lê o ARQUIVO porque a montagem depende de `window.location.origin`,
// que não existe no Node — e ler o texto é o que permite provar a invariante
// sem subir navegador.
console.log('');
console.log('6. O continueUrl nao aponta para uma rota que exige oobCode');

const fonteAuthService = readFileSync(
  new URL('../src/services/authService.js', import.meta.url),
  'utf8'
);
const urlsDeContinuacao = [
  ...fonteAuthService.matchAll(/url:\s*`\$\{window\.location\.origin\}([^`]*)`/g),
].map((m) => m[1]);

checar('ha pelo menos um continueUrl para medir', true, urlsDeContinuacao.length > 0);
checar(
  'e nenhum deles e /auth-action',
  true,
  urlsDeContinuacao.every((u) => !u.startsWith('/auth-action'))
);
checar('o destino declarado e o login', true, urlsDeContinuacao.includes('/login'));

// `handleCodeInApp` saiu: pela doc do SDK ela só decide Universal Link para
// app NATIVO instalado, e este projeto não tem bundleId nem packageName. O
// comentário antigo lhe atribuía o efeito de "preservar o oobCode na query",
// que ela não tem — e foi por isso que o fluxo passou por pronto.
// A busca é pela PROPRIEDADE (`handleCodeInApp:`), não pelo nome solto — o
// comentário do próprio `authService` explica por que a flag saiu, e medir a
// menção reprovaria a explicação junto com o defeito. Foi o que aconteceu na
// primeira versão deste caso.
checar(
  'handleCodeInApp nao e declarada (e inerte em PWA)',
  false,
  /handleCodeInApp\s*:/.test(fonteAuthService)
);


console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
