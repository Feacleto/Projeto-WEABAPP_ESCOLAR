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
import { mascararEmail } from '../src/compartilhado/formatters.js';
import { COMPANY_INFO } from '../src/pages/legal/legalContent.js';
import {
  codigoDoTexto,
  isValidInviteCodeFormat,
} from '../src/dominio/identidade/generateInviteCode.js';

/**
 * O CODIGO SEM OS COMENTARIOS — e por que isto e uma funcao.
 *
 * ⚠️ A PROSA NAO PODE REPROVAR A DECISAO QUE ELA EXPLICA. Aconteceu tres
 * vezes neste arquivo: o comentario que conta por que o campo de codigo saiu
 * cita "digite o codigo" e `isValidInviteCodeFormat`, e o comentario da
 * bifurcacao do login cita a frase antiga "um link ou um codigo". Medir o
 * arquivo inteiro reprova a explicacao junto com o defeito — e a saida nunca
 * e apagar a explicacao.
 */
const NL = String.fromCharCode(10);
function semComentarios(fonte) {
  return fonte
    .split(NL)
    .filter((linha) => {
      const t = linha.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join(NL);
}

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

// -- 7. A MASCARA DO E-MAIL, E O QUE ELA NAO PODE VAZAR ------------------
//
// A tela de redefinir senha mostra o endereco que pediu o link, para a pessoa
// RECONHECER a conta. Mascarar e o que separa "reconhecer" de "expor": o link
// chega por e-mail (canal que ja vaza) e a tela e vista numa fila de escola.
//
// O CASO QUE SE ERRA POR DESCUIDO E O COMPRIMENTO. Um ponto por caractere
// escondido devolve o tamanho do endereco de graca para quem adivinha. Os
// tres ultimos casos deste bloco existem so para travar isso: enderecos de
// tamanhos muito diferentes tem que produzir a MESMA quantidade de pontos.
console.log('');
console.log('7. A mascara do e-mail reconhece sem expor');

checar('endereco comum mostra 4 e esconde o resto', 'mari••••@gmail.com',
  mascararEmail('maria.silva@gmail.com'));
checar('nunca mostra mais que a metade da parte local', 'a••••@escola.com',
  mascararEmail('ana@escola.com'));
checar('parte local de 2 mostra 1', 'a••••@x.com', mascararEmail('ab@x.com'));
checar('parte local de 1 nao mostra nada', '••••@x.com', mascararEmail('a@x.com'));
checar('o dominio nunca e mascarado', true,
  mascararEmail('maria.silva@gmail.com').endsWith('@gmail.com'));

// Entrada que nao e e-mail volta intacta: inventar mascara esconderia o
// defeito de quem passou o valor errado.
checar('texto sem arroba volta intacto', 'nao-e-email', mascararEmail('nao-e-email'));
checar('arroba na primeira posicao volta intacta', '@x.com', mascararEmail('@x.com'));
checar('vazio volta vazio', '', mascararEmail(''));
checar('nulo nao explode', '', mascararEmail(null));

const pontosDe = (e) => (mascararEmail(e).match(/•/g) || []).length;
checar('o numero de pontos NAO revela o tamanho (curto)', 4, pontosDe('ana@x.com'));
checar('nem no longo', 4, pontosDe('maria.aparecida.da.silva@x.com'));
checar('e os dois produzem a mesma contagem', true,
  pontosDe('ana@x.com') === pontosDe('maria.aparecida.da.silva@x.com'));

// -- 8. A TELA DE REDEFINIR GUARDA AS DUAS DECISOES ----------------------
//
// Dois recuos possiveis, os dois plausiveis numa "simplificacao":
//
//   1. trocar `mascararEmail(email)` por `{email}`, porque e mais direto --
//      e ai a tela volta a expor o endereco inteiro;
//   2. escrever razao social e CNPJ como texto na tela, porque "nao vai
//      mudar" -- e ai existem dois lugares dizendo quem e o controlador, que
//      e como as tres versoes deste produto passaram a existir.
//
// O terceiro caso e o mais importante: o dominio do selo tem que ser LIDO do
// navegador. Escrito a mao, ele continuaria dizendo "alobuzinou.com" numa
// copia hospedada noutro dominio -- ajudando o golpe em vez de denuncia-lo.
console.log('');
console.log('8. A tela de redefinir senha guarda as decisoes de confianca');

const fonteAuthAction = readFileSync(
  new URL('../src/pages/AuthAction.jsx', import.meta.url),
  'utf8'
);

checar('a tela mascara o e-mail', true,
  fonteAuthAction.includes('mascararEmail(email)'));
checar('a identidade do controlador sai de COMPANY_INFO', true,
  fonteAuthAction.includes('COMPANY_INFO.razaoSocial')
  && fonteAuthAction.includes('COMPANY_INFO.cnpj'));
checar('e o CNPJ nao esta escrito na tela', false,
  fonteAuthAction.includes(COMPANY_INFO.cnpj));
checar('nem o e-mail do Encarregado', false,
  fonteAuthAction.includes(COMPANY_INFO.email));
checar('o dominio do selo e lido do navegador', true,
  fonteAuthAction.includes('window.location.host'));
// A PROSA NAO PODE REPROVAR A DECISAO QUE ELA EXPLICA.
//
// A primeira versao deste caso falhou contra o COMENTARIO do
// `SeloDoDominio`, que cita 'alobuzinou.com' justamente para dizer por que
// escrever o dominio a mao seria errado. Medir o arquivo inteiro reprova a
// explicacao junto com o defeito -- e a saida nao e apagar a explicacao.
const codigoDaTela = semComentarios(fonteAuthAction);

checar('o descomentador descomenta', false, codigoDaTela.includes('some no celular'));
checar('e nao ha dominio da marca escrito a mao no codigo', false,
  codigoDaTela.includes("'alobuzinou.com"));


// -- 9. A ENTRADA DO RESPONSAVEL E O LINK, E SO ELE ----------------------
//
// Decidido em 09/09/2026. O `/first-access` nunca conseguiu criar conta para
// quem chega nele: a entrada e o link, e ela e inteira do `Invite.jsx`
// (`/convite/:codigo` -> redeemInvite -> /pai). Quem cai no first-access e,
// por definicao, quem NAO tem o link — e a unica coisa que a tela oferecia a
// essa pessoa era digitar um codigo de 8 caracteres que ela quase sempre
// tambem nao tem, porque link e codigo viajam na mesma mensagem.
//
// O campo saiu e no lugar entrou o pedido ao motorista. Este bloco guarda as
// tres metades da decisao: a tela nao cria mais conta, o LINK continua
// criando, e o MECANISMO continua inteiro para o dia em que alguem quiser o
// campo de volta.
console.log('');
console.log('9. A entrada do responsavel e o link');

const fonteFirst = readFileSync(
  new URL('../src/pages/FirstAccess.jsx', import.meta.url), 'utf8');
const fonteInvite = readFileSync(
  new URL('../src/pages/Invite.jsx', import.meta.url), 'utf8');
const fonteAuthSvc = readFileSync(
  new URL('../src/services/authService.js', import.meta.url), 'utf8');
const fonteComecar = readFileSync(
  new URL('../src/pages/Comecar.jsx', import.meta.url), 'utf8');
const fonteLoginTela = readFileSync(
  new URL('../src/pages/Login.jsx', import.meta.url), 'utf8');

// (a) A tela nao cria mais conta.
for (const proibido of ['authenticateAndRedeem', 'googleAndRedeem', 'LegalAcceptCheckbox']) {
  checar(`o first-access nao usa ${proibido}`, false, fonteFirst.includes(proibido));
}
const firstSemProsa = semComentarios(fonteFirst);
checar('o descomentador do first-access descomenta', false,
  firstSemProsa.includes('perdeu o chaveiro'));
checar('nem tem campo de codigo', false,
  firstSemProsa.includes('isValidInviteCodeFormat'));
checar('nem convida a digitar', false,
  firstSemProsa.toLowerCase().includes('digite o código'));

// (b) O LINK continua criando — se isto quebrar, ninguem mais entra.
checar('o Invite.jsx resgata o convite', true, fonteInvite.includes('redeemInvite'));
checar('e leva pro painel do responsavel', true, fonteInvite.includes("'/pai'"));

// (c) O MECANISMO continua inteiro: o que saiu foi a tela, nao a porta.
checar('redeemInvite ainda aceita inviteCode', true,
  fonteAuthSvc.includes('inviteCode'));

// (d) NENHUMA TELA PROMETE A ENTRADA QUE O DESTINO NAO OFERECE.
//
// Este e o caso que da o defeito mais barato de criar: a bifurcacao do login
// dizia "um link ou um codigo", e quem chegasse com o codigo na mao
// procuraria um campo que nao existe mais e concluiria que errou de tela.
for (const [nome, fonte] of [['o login', fonteLoginTela], ['o comecar', fonteComecar]]) {
  const limpa = semComentarios(fonte);
  checar(`${nome} nao promete entrada por codigo`, false,
    limpa.includes('ou um código') || limpa.includes('ou código'));
}

// A sonda positiva do (d): o detector tem que reconhecer a frase antiga.
checar('o detector reconhece a frase antiga (sonda positiva)', true,
  'Você recebeu um link ou um código do motorista.'.includes('ou um código'));

// (e) E o pedido ao motorista esta LA, com a mensagem a vista.
checar('a tela oferece o pedido ao motorista', true,
  fonteFirst.includes('linkDoPedido') && fonteFirst.includes('mensagemAoMotorista'));

// ─────────── 10. LEITURA FALHA NAO E CONTA INEXISTENTE ──────────────────
//
// O bug: `AuthContext` fazia `catch → setProfile(null)`, e null e tambem o
// valor de quem acabou de criar sessao. Os guardas do App leem esse nulo como
// conclusivo e mandam pra /comecar, que diz "Falta ligar sua conta" e "Nada
// foi criado ainda" — as duas falsas para um motorista de meses cuja rede
// caiu. Nada no app relia, entao ele ficava ali.
//
// O que este bloco tranca: o terceiro estado existe, ele nasce SO de excecao,
// ele e limpo quando a leitura da certo, e TODO caminho que manda pra sala de
// espera passa por ele antes.
console.log('');
console.log('10. Leitura que falha nao vira "essa pessoa nao tem conta"');

const fonteCtx = readFileSync(
  new URL('../src/context/AuthContext.jsx', import.meta.url), 'utf8');
const fonteApp = readFileSync(
  new URL('../src/App.jsx', import.meta.url), 'utf8');
const fonteFalha = readFileSync(
  new URL('../src/components/common/FalhaAoLerConta.jsx', import.meta.url), 'utf8');

// O catch da leitura do perfil, isolado — e o unico lugar onde o app aprende
// que a leitura falhou.
function catchDoPerfil(fonte) {
  const m = fonte.match(/catch \(err\) \{([\s\S]*?)\n {8}\}/);
  return m ? m[1] : '';
}
const oCatch = catchDoPerfil(fonteCtx);

checar('o catch da leitura existe', true, oCatch.length > 0);
checar('e ele marca o estado de falha', true,
  oCatch.includes('setPerfilIndisponivel(true)'));

// Sonda positiva: o detector precisa REPROVAR o codigo antigo, senao ele
// aprova qualquer coisa e o bloco inteiro vira enfeite.
const catchAntigo = `      onAuthStateChanged(auth, async (u) => {
        try {
          setProfile(await getUserDoc(u.uid));
        } catch (err) {
          console.error('Falha ao carregar perfil:', err);
          setProfile(null);
        }
      });`;
checar('o detector reprova o catch antigo (sonda positiva)', false,
  catchDoPerfil(catchAntigo).includes('setPerfilIndisponivel(true)'));

// A falha e transitoria: a leitura seguinte que der certo tem que apaga-la,
// senao o app fica preso na tela de erro ate recarregar.
checar('leitura que da certo limpa a falha', true,
  fonteCtx.includes('setProfile(userProfile);\n          setPerfilIndisponivel(false);'));
checar('e sair da conta tambem limpa', true,
  fonteCtx.includes('setProfile(null);\n    setPerfilIndisponivel(false);'));
checar('o contexto expoe o estado', true,
  /\n {4}perfilIndisponivel,/.test(fonteCtx));

// ⚠️ A INVARIANTE QUE IMPORTA: nenhum caminho manda pra sala de espera sem
// antes perguntar se a leitura falhou. Se alguem criar um terceiro guarda no
// App copiando o segundo, esta conta desempata.
const mandamPraComecar = (fonteApp.match(/to="\/comecar"/g) || []).length;
const desviosAntes = (fonteApp.match(/if \(perfilIndisponivel\) return <FalhaAoLerConta \/>;/g) || []).length;
checar('todo guarda que manda pra /comecar checa a falha antes',
  mandamPraComecar, desviosAntes);
checar('e sao os dois guardas conhecidos', 2, mandamPraComecar);

// A sala de espera e destino do Login tambem, entao ela precisa do desvio.
checar('a sala de espera desvia quando a leitura falhou', true,
  fonteComecar.includes('if (perfilIndisponivel) return <FalhaAoLerConta />;'));

// A tela nova nao pode repetir as duas frases falsas.
const falhaSemProsa = semComentarios(fonteFalha);
for (const frase of ['Falta ligar sua conta', 'Nada foi criado ainda']) {
  checar(`a tela de falha nao diz "${frase}"`, false, falhaSemProsa.includes(frase));
}
// Nem inventa de quem e a culpa: o app nao sabe.
for (const chute of ['instabilidade', 'nossos servidores', 'fora do ar']) {
  checar(`a tela de falha nao chuta "${chute}"`, false,
    falhaSemProsa.toLowerCase().includes(chute));
}
checar('ela oferece tentar de novo', true, falhaSemProsa.includes('refreshProfile'));
checar('e uma saida', true, falhaSemProsa.includes('logout'));

console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${ok} passaram, ${bad} falharam`);
if (falhas.length) {
  console.log('─'.repeat(64));
  falhas.forEach((f) => console.log('  ✗ ' + f));
}
console.log(`${'═'.repeat(64)}\n`);
process.exit(bad > 0 ? 1 : 0);
