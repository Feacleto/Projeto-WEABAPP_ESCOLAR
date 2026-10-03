import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  checkActionCode,
  sendEmailVerification,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/config';
import { LEGAL_VERSION } from '../pages/legal/legalContent';
import { exigirCloud } from './callableError';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function login(email, password) {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
  return credential.user;
}

export async function logout() {
  return signOut(auth);
}

/**
 * ⚠️ ESTE `url` NÃO É O DESTINO DO LINK — É O `continueUrl`.
 *
 * O comentário anterior afirmava que ele "aponta de volta pra nossa rota
 * /auth-action (em vez da página hospedada do Firebase em inglês)". Falso, e
 * foi o que fez este fluxo passar por pronto:
 *
 *   node_modules/@firebase/auth/.../index-*.js →
 *     request.continueUrl = actionCodeSettings.url;
 *
 * e a doc do próprio SDK diz que este campo é "the deep link in the
 * `continueUrl` query parameter". Quem decide o destino do link é o **Action
 * URL do console** (Authentication → Templates), cujo padrão é
 * `<projeto>.firebaseapp.com/__/auth/action`.
 *
 * ── O QUE ISSO CUSTAVA
 * Com o Action URL no padrão, a pessoa redefine a senha num domínio sem marca
 * — que parece phishing — e o botão "Continuar" do widget a manda para o
 * `continueUrl`. Como este apontava para `/auth-action` SEM `mode` nem
 * `oobCode`, `AuthAction` caía no ramo de erro e imprimia
 * "Link inválido. Solicite um novo email."
 *
 * Ou seja: ela fazia tudo certo, a senha nova ficava ativa, e a última coisa
 * que o app dizia era que havia falhado.
 *
 * ── POR QUE `/login` É O DESTINO CERTO AQUI
 * `continueUrl` é "para onde ir DEPOIS de concluir", e depois de trocar a
 * senha o lugar é a tela de entrar. `/auth-action` só faz sentido recebendo
 * `oobCode`, e quem entrega isso é o console.
 *
 * Isto continua valendo depois de o Action URL ser corrigido: link antigo já
 * enviado, ou um template que ficou fora do ajuste, seguem passando pelo
 * widget — e agora terminam no lugar certo.
 *
 * `handleCodeInApp` SAIU: pela doc do SDK ela só decide se o link vira
 * Universal Link / App Link para um app NATIVO instalado, e não há
 * `iOS.bundleId` nem `android.packageName` neste projeto. Para PWA é inerte, e
 * o comentário antigo lhe atribuía um efeito que ela não tem.
 */
export async function resetPassword(email) {
  const actionCodeSettings = {
    url: `${window.location.origin}/login`,
  };
  return sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
}

// Valida o oobCode recebido na URL. Retorna o email associado ao código
// (útil pra mostrar "Redefinindo senha de fulano@...") ou lança se inválido/expirado.
export async function verifyResetCode(oobCode) {
  return verifyPasswordResetCode(auth, oobCode);
}

// Conclui o reset: salva a nova senha. Após isso, o oobCode fica inválido.
export async function confirmReset(oobCode, newPassword) {
  return confirmPasswordReset(auth, oobCode, newPassword);
}

// Verifica e aplica códigos de outras ações (verificação de email, etc.).
export async function inspectActionCode(oobCode) {
  return checkActionCode(auth, oobCode);
}

export async function applyAuthActionCode(oobCode) {
  return applyActionCode(auth, oobCode);
}

/**
 * A CONFIRMAÇÃO DO E-MAIL — PEDIDA, NUNCA EXIGIDA (decisão do dono, 03/10/2026).
 *
 * Conta de e-mail e senha nasce sem prova de que o endereço é de quem a
 * criou. Sem a prova, um e-mail digitado errado só aparece no dia em que a
 * pessoa esquece a senha — e o link de redefinir vai para outra pessoa.
 *
 * ⚠️ NÃO BLOQUEIA NADA, e é o ponto inteiro. O motorista se cadastra no
 * meio-fio e a mãe abre o convite no WhatsApp: travar o app até alguém abrir
 * o e-mail seria trocar uma conta mal digitada por uma conta abandonada. Por
 * isso o envio é "dispara e esquece": nenhum `await` de quem cadastra espera
 * por ele, e uma falha (cota, rede) nunca vira erro de cadastro. O lembrete
 * fica num cartão no Início, com "Reenviar".
 *
 * O `url` é o `continueUrl` (ver `resetPassword` abaixo): depois de confirmar,
 * a pessoa volta para a tela de entrar.
 *
 * Conta do Google já chega verificada pelo próprio Google — nunca recebe.
 */
export function enviarVerificacaoDoEmail(user) {
  if (!user || user.emailVerified) return;
  try {
    sendEmailVerification(user, { url: `${window.location.origin}/login` }).catch(
      (err) => console.warn('[verificacao] e-mail de confirmação não saiu:', err?.code || err)
    );
  } catch (err) {
    console.warn('[verificacao] e-mail de confirmação não saiu:', err?.code || err);
  }
}

/** O "Reenviar" do cartão — aqui sim espera, para a tela dizer se foi. */
export async function reenviarVerificacaoDoEmail() {
  const user = auth.currentUser;
  if (!user) throw new Error('Sem sessão.');
  await sendEmailVerification(user, { url: `${window.location.origin}/login` });
}

/**
 * Falta confirmar o e-mail desta sessão? Só vale para conta de SENHA: quem
 * entrou pelo Google tem o endereço confirmado por ele. Relê a sessão antes
 * de responder, porque `emailVerified` só muda no aparelho depois de um
 * `reload()` — sem isso, quem acabou de confirmar continuaria vendo o cartão.
 *
 * Devolve `{ pendente, email }`.
 */
export async function estadoDaConfirmacaoDoEmail() {
  const user = auth.currentUser;
  if (!user) return { pendente: false, email: null };
  const temSenha = (user.providerData || []).some((p) => p?.providerId === 'password');
  if (!temSenha) return { pendente: false, email: user.email };
  try {
    await user.reload();
  } catch {
    // Sem rede, responde com o que a sessão já sabe.
  }
  const atual = auth.currentUser || user;
  return { pendente: !atual.emailVerified, email: atual.email };
}

// Lê o documento users/{uid}. Retorna null se ainda não existe (caso normal
// no instante seguinte ao createUserWithEmailAndPassword).
export async function getUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * Login com Google via popup. Apenas autentica — NÃO cria users/{uid}.
 * Usado em /login: caller verifica se profile existe; se não, faz logout
 * e orienta o usuário a usar /first-access com invite code.
 */
export async function loginWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

/**
 * NOTA: `signupWithInvite` e `signupWithGoogleInvite` foram removidas.
 *
 * Elas criavam conta E vinculavam a criança, duplicando o que
 * `authenticateAndRedeem` e `googleAndRedeem` fazem agora — e a versão
 * antiga do Google derrubava a sessão com erro quando a conta já existia,
 * o que quebrava justamente o pai adicionando o segundo filho.
 */

/**
 * Resgata um convite pra conta JÁ autenticada.
 *
 * Serve pros dois casos:
 *   - primeiro acesso (chamado por authenticateAndRedeem / googleAndRedeem)
 *   - pai já cadastrado adicionando um segundo filho
 *
 * Toda a validação e o vínculo acontecem no servidor.
 */
/**
 * "NÃO É MEU FILHO" — desfaz o vínculo automático de irmão (02/10/2026).
 *
 * O servidor vincula sozinho a criança cadastrada com o WhatsApp de quem já
 * usa o app (`functions/lib/vincularIrmao.js`). Número digitado errado pelo
 * motorista põe a criança na conta de outra família — esta é a saída dela, e
 * o motorista é avisado para conferir o número. Só desfaz vínculo de irmão.
 */
export async function recusarIrmao(childId) {
  exigirCloud('desfazer');
  const fn = httpsCallable(functions, 'recusarIrmao');
  try {
    await fn({ childId });
  } catch (err) {
    throw new Error(friendlyCallableError(err), { cause: err });
  }
}

export async function redeemInvite({ inviteCode, name = '' }) {
  exigirCloud('criar sua conta');
  const fn = httpsCallable(functions, 'redeemInvite');
  try {
    const res = await fn({
      code: inviteCode,
      name,
      legalVersion: LEGAL_VERSION,
    });
    return res.data;
  } catch (err) {
    throw new Error(friendlyCallableError(err), { cause: err });
  }
}

/**
 * Traduz erro de callable pra mensagem que o usuário entende.
 * O Firebase entrega `functions/<code>` em err.code e a mensagem que a
 * função lançou em err.message — que já escrevemos em português.
 */
function friendlyCallableError(err) {
  const code = String(err?.code || '');
  if (code.includes('unauthenticated')) {
    return 'Sua sessão expirou. Entre novamente e tente de novo.';
  }
  if (code.includes('invalid-argument')) {
    return 'Código em formato inválido. Confira com o motorista.';
  }
  if (code.includes('not-found')) {
    return 'Convite não encontrado ou já usado. Peça um novo ao motorista.';
  }
  if (code.includes('unavailable') || code.includes('deadline')) {
    return 'Sem conexão com o servidor. Tente novamente em alguns segundos.';
  }
  return err?.message || 'Não foi possível usar este convite.';
}

/**
 * Entra OU cria conta com email/senha e resgata o convite — sem perguntar
 * ao usuário qual dos dois ele quer.
 *
 * POR QUE ASSIM
 * Obrigar o pai a escolher entre "criar conta" e "já tenho conta" é uma
 * decisão que ELE não tem como tomar com segurança: metade não lembra se
 * já cadastrou. Então tentamos criar; se o email já existe, entramos com a
 * mesma senha. Um par de campos cobre os dois caminhos.
 *
 * Retorna { user, created } — `created` diz se a conta nasceu agora.
 */
export async function authenticateAndRedeem({ inviteCode, email, password, name = '' }) {
  const cleanEmail = String(email || '').trim();
  let user;
  let created = false;

  // ⚠️ A SESSÃO ABERTA VALE, E IGNORÁ-LA CRIAVA UM BECO SEM SAÍDA.
  //
  // Cenário real, e comum: a mãe abre o link do convite, toca em "Continuar
  // com Google", cai na sala de espera, volta ao convite e escolhe "não uso
  // Google — entrar com email". Ela digita o MESMO endereço e inventa uma
  // senha.
  //
  // Sem esta checagem: `createUserWithEmailAndPassword` devolve
  // `email-already-in-use` (a conta do Google existe), o código cai no
  // `signInWithEmailAndPassword` com uma senha que aquela conta NUNCA teve, e
  // o Firebase responde `invalid-credential`. A tela então informa que "essa
  // senha não confere" — de uma senha que ela acabou de inventar.
  //
  // E pior: conta que nasceu no Google não tem provedor de senha, então
  // "esqueci minha senha" também não a salva. Beco fechado, na primeira tela.
  //
  // `inscreverAssociado` já resolve isto do lado do motorista, com o mesmo
  // argumento — a correção não tinha sido trazida para cá.
  const sessaoAberta = auth.currentUser;
  const mesmaPessoa =
    sessaoAberta &&
    String(sessaoAberta.email || '').trim().toLowerCase() === cleanEmail.toLowerCase();

  if (mesmaPessoa) {
    // Aproveita a sessão: ela já provou quem é pelo Google. A senha digitada
    // é descartada de propósito — associá-la exigiria `linkWithCredential`, e
    // criar um segundo jeito de entrar sem ela pedir seria decidir por ela.
    user = sessaoAberta;
  } else {
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      user = cred.user;
      created = true;
      // Dispara e esquece — ver `enviarVerificacaoDoEmail`.
      enviarVerificacaoDoEmail(user);
    } catch (err) {
      if (err?.code === 'auth/email-already-in-use') {
        // Já tem conta: a mesma senha resolve. Se estiver errada, o erro que
        // sobe é de credencial inválida, e a tela oferece redefinir senha
        // (`AuthSheet` e `/first-access` — os dois passaram a oferecer).
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        user = cred.user;
      } else {
        throw err;
      }
    }
  }

  try {
    await redeemInvite({ inviteCode, name });
  } catch (err) {
    // Conta recém-criada que não conseguiu vincular fica em limbo:
    // autenticada, sem doc em users, travada no PrivateRoute sem
    // explicação. Melhor desfazer.
    if (created) {
      try {
        await user.delete();
      } catch (cleanupErr) {
        console.error('Falha ao limpar conta órfã:', cleanupErr);
      }
    }
    throw err;
  }

  return { user, created };
}

/**
 * Google + resgate do convite, tolerante a quem já tem conta.
 *
 * A versão antiga derrubava a sessão e mandava um erro quando a conta
 * Google já existia. Agora não: se já existe, apenas vinculamos a criança
 * — é o caso do pai adicionando o segundo filho.
 */
export async function googleAndRedeem({ inviteCode }) {
  const credential = await signInWithPopup(auth, googleProvider);
  const user = credential.user;
  const existing = await getUserDoc(user.uid);

  try {
    await redeemInvite({ inviteCode, name: user.displayName || '' });
  } catch (err) {
    // Só apaga se a conta nasceu neste fluxo — nunca a conta Google de
    // alguém que já usava o app.
    if (!existing) {
      try {
        await user.delete();
      } catch (cleanupErr) {
        console.error('Falha ao limpar conta órfã:', cleanupErr);
      }
    }
    throw err;
  }

  return { user, created: !existing };
}

/**
 * Login com Google — para quem já tem conta E para quem está chegando.
 *
 * ELE APAGAVA A CONTA ÓRFÃ, E DEIXOU DE APAGAR EM 06/09/2026.
 *
 * O motivo antigo estava certo para o mundo antigo: signInWithPopup cria o
 * usuário no Firebase Auth ANTES de qualquer verificação nossa, então
 * qualquer visitante criava uma conta no projeto tocando no botão, e elas
 * acumulavam. Enquanto a única forma legítima de entrar era JÁ TER conta,
 * apagar era limpeza.
 *
 * Deixou de ser: o Google virou também o caminho de quem chega. Apagar a
 * conta de quem acabou de entrar é desfazer o que a pessoa acabou de fazer,
 * e devolver um erro no lugar de um caminho.
 *
 * O QUE SUBSTITUI A LIMPEZA é o fato de a conta pendurada ser INERTE. Sessão
 * sem documento em `users` não lê nada: toda regra do app passa por
 * `isAppUser()`, que exige o documento. O custo que sobra é um registro de
 * autenticação vazio por visitante que desistiu — que não custa dinheiro e
 * não abre porta.
 *
 * Devolve `{ user, profile }`. Com `profile` nulo, quem chamou manda para a
 * sala de espera (`/comecar`) — que é o que `painelDe` já responde.
 */
export async function loginComGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  const user = credential.user;
  const profile = await getUserDoc(user.uid);
  return { user, profile };
}

/**
 * COMO ESTA CONTA PROVA QUE É ELA DE NOVO — para o "Esqueci a senha" e o
 * "Trocar a senha" do Financeiro (03/10/2026).
 *
 * A senha de 4 números do Financeiro não tem e-mail de recuperação: quem a
 * esqueceu prova que é o dono da CONTA, e o servidor só aceita trocar a senha
 * do Financeiro com login recente (até 5 minutos). Por isso a troca passa por
 * uma reautenticação de verdade, e não por um "tem certeza?".
 *
 * 'senha'   conta de e-mail e senha — pede a senha da conta
 * 'google'  conta do Google — abre a janela do Google de novo
 * Conta com os dois provedores usa a senha: é a que a tela consegue pedir sem
 * abrir janela nenhuma.
 */
export function metodoDeReautenticacao() {
  const provedores = (auth.currentUser?.providerData || []).map((p) => p.providerId);
  if (provedores.includes('password')) return 'senha';
  if (provedores.includes('google.com')) return 'google';
  return 'senha';
}

/**
 * Reautentica a sessão atual. `senhaDaConta` só é usada no método 'senha'.
 * Lança o erro do Firebase (quem chama traduz com `mensagemDeAuth`).
 */
export async function reautenticarConta(senhaDaConta = '') {
  const user = auth.currentUser;
  if (!user) {
    throw Object.assign(new Error('Sem sessão.'), { code: 'auth/no-current-user' });
  }
  if (metodoDeReautenticacao() === 'google') {
    await reauthenticateWithPopup(user, googleProvider);
  } else {
    const credencial = EmailAuthProvider.credential(user.email || '', senhaDaConta);
    await reauthenticateWithCredential(user, credencial);
  }
  // ⚠️ O TOKEN TEM QUE SER RENOVADO AQUI. O servidor lê `auth_time` do token
  // que a callable leva, e o token em cache ainda carrega o login antigo:
  // sem forçar a renovação, a troca seria recusada logo depois de a pessoa
  // ter provado quem é.
  await user.getIdToken(true);
}
