import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth, db } from '../firebase/config';

/**
 * O CADASTRO DO MOTORISTA — ele preenche, entra, e começa a operar.
 *
 * ── NÃO HÁ MAIS APROVAÇÃO, E ISSO MUDOU O DESENHO INTEIRO (06/09/2026)
 * Até aqui a conta nascia `role: 'aguardando'` e alguém precisava aprovar. O
 * motorista se inscrevia, via a própria posição numa fila, e esperava uma
 * conversa acontecer fora do sistema.
 *
 * O canvas do negócio já nomeava o custo disso: *"o canal é escalável e a
 * conversão não é — o consultor fecha um por vez"*. A fila não protegia o
 * produto, protegia a agenda de uma pessoa. E era ela o teto de crescimento.
 *
 * Agora a conta nasce `role: 'admin'` — MOTORISTA, no vocabulário histórico
 * deste projeto. Ele entra, cadastra a turma e roda. O que ele ainda não tem é
 * contrato, e quem cuida disso é o TESTE DE TRÊS MESES: o relógio começa na
 * primeira rota (`trialService`), e quando ele acaba a conta para
 * (`contaAtiva.js`). O portão saiu da entrada e foi para o fim do teste, onde
 * ele custa uma decisão de compra em vez de custar uma espera.
 *
 * ── O QUE PRECISOU SER FECHADO ANTES, E NÃO PODE SER REABERTO
 * Com aprovação, quem tinha `role: 'admin'` era um conjunto escolhido a dedo.
 * Agora é qualquer pessoa com um e-mail. Toda regra que parava num `isAdmin()`
 * solto virou, no mesmo dia, uma porta pública — foi por isso que o `allow get`
 * de `users` e a leitura de `taxaConfig` foram escopados antes desta mudança.
 *
 * A lição para quem escrever regra nova: **`isAdmin()` não é mais um filtro
 * social, é só "tem uma conta"**. Quem escopa é o vínculo.
 *
 * ── A CONTA NASCE MAGRA
 * Nem `limiteCriancas`, nem `trialInicio`, nem `assinaturaAte`, nem
 * `criancasAtivas`. Os três primeiros são cláusula de contrato e o quarto é
 * contador — todos escritos por outro caminho, e todos proibidos ao cliente
 * nas rules. Cadastro que nasce podendo escrever a própria cláusula não é
 * cadastro, é formulário de autoatendimento em cima do preço.
 *
 * ── SEM TETO DURANTE O TESTE
 * `limiteCriancas` ausente significa "sem limite" (ver `childrenService`), e é
 * isso que se quer aqui: ele cadastra a operação INTEIRA e o app prova o valor
 * no tamanho real. Testar com metade da perua mostra um produto menor do que
 * ele é. O teto aparece quando ele escolhe o plano, no fim do teste.
 */

/**
 * Cria a conta do motorista, ou entra na que já existe.
 *
 * Devolve `{ uid, jaExistia }`.
 *
 * A senha é escolhida por ele no formulário. Google fica de fora aqui de
 * propósito: dentro da webview do WhatsApp o OAuth do Google é recusado, e
 * este formulário é justamente o que costuma ser aberto a partir de um link
 * compartilhado. Um caminho que falha na metade dos aparelhos é pior que um
 * campo de senha a mais.
 */
export async function inscreverAssociado({ email, senha, nome, telefone, cidade, criancas }) {
  const emailLimpo = String(email || '').trim().toLowerCase();

  let uid;
  let jaExistia = false;

  // ⚠️ QUEM JÁ ENTROU COM O GOOGLE NÃO CRIA CONTA DE NOVO — ELE SÓ COMPLETA.
  //
  // Este era um beco fechado, e no caminho que o próprio plano recomenda:
  // "sem conta, entra com o Google" → `/comecar` → "tenho uma van" → aqui.
  // A tela ignorava a sessão ativa e chamava `createUserWithEmailAndPassword`
  // com o e-mail do Google, que já existe → `auth/email-already-in-use` → o
  // `catch` tentava entrar com uma senha que NUNCA existiu para aquela conta
  // → `auth/invalid-credential` → "use a senha que você criou", que ele nunca
  // criou. Voltar ao login e entrar com Google devolvia para `/comecar`, que
  // devolvia para cá. Loop, sem saída.
  //
  // Com sessão de pé, o documento é escrito no uid que já existe. A senha
  // digitada é ignorada de propósito: vincular provedor de credencial exige
  // reautenticação e é outro fluxo — e ele já tem como entrar, que é o que
  // importa agora.
  const sessao = auth.currentUser;
  const mesmaPessoa =
    sessao && String(sessao.email || '').toLowerCase() === emailLimpo;

  if (mesmaPessoa) {
    uid = sessao.uid;
    jaExistia = true;
  } else {
    try {
      const cred = await createUserWithEmailAndPassword(auth, emailLimpo, senha);
      uid = cred.user.uid;
    } catch (err) {
      // Já se cadastrou antes e voltou. Entrar com a mesma senha é o caminho
      // certo — mandar ele "recuperar a senha" de uma conta que ele acabou de
      // tentar criar é o tipo de beco que faz a pessoa desistir.
      if (err?.code === 'auth/email-already-in-use') {
        const cred = await signInWithEmailAndPassword(auth, emailLimpo, senha);
        uid = cred.user.uid;
        jaExistia = true;
      } else {
        throw err;
      }
    }
  }

  // `merge: true` porque quem já tinha conta pode estar voltando pra corrigir
  // um dado, e sobrescrever apagaria o que já foi construído — inclusive
  // `trialInicio`, que é gravável UMA vez e nunca mais. As rules recusariam
  // de qualquer forma, mas depender da rede pra não estragar dado é confiar
  // no lugar errado.
  await setDoc(
    doc(db, 'users', uid),
    {
      role: 'admin',
      name: String(nome || '').trim(),
      email: emailLimpo,
      phone: String(telefone || '').trim(),
      city: String(cidade || '').trim(),
      // Quantas crianças ele DIZ que transporta. É estimativa de cadastro, não
      // limite: serve pra tela de planos já abrir na faixa provável dele, e
      // nada mais depende disso. O limite de verdade nasce da escolha do
      // plano, e só o servidor escreve.
      criancasEstimadas: Math.max(0, Number(criancas) || 0),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { uid, jaExistia };
}
