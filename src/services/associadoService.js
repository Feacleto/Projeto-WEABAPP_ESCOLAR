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
export async function inscreverAssociado({ email, senha, nome, telefone, cidade, criancas, origem }) {
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
      ...(String(nome || '').trim() ? { name: String(nome).trim() } : {}),
      email: emailLimpo,
      phone: String(telefone || '').trim(),
      // ⚠️ CIDADE E NOME SÓ ENTRAM SE VIEREM, e desde 11/09/2026 a inscrição
      // não os manda: ela pede três campos (e-mail, WhatsApp, senha) e o
      // resto é pedido no primeiro acesso, do lado de dentro.
      //
      // A distinção entre AUSENTE e VAZIO é o que faz o guarda funcionar:
      // campo ausente significa "ainda não perguntei", string vazia
      // significaria "perguntei e ele deixou em branco". Gravar `''` aqui
      // faria o primeiro acesso parecer já respondido.
      ...(String(cidade || '').trim() ? { city: String(cidade).trim() } : {}),
      // Quantas crianças ele DIZ que transporta. É estimativa de cadastro,
      // nunca cláusula: nenhuma conta a usa, e não existe teto para ela
      // comparar — `limiteCriancas` saiu do modelo em 10/09/2026.
      //
      // ⚠️ ESTE COMENTÁRIO DIZIA que ela servia "pra tela de planos abrir na
      // faixa provável dele". As FAIXAS não existem mais, o preço é por
      // criança, e o campo ficou meses gravado sem um único leitor. Quem o lê
      // hoje é a FICHA do dono, e o que ele responde é de venda: declarou 30
      // e cadastrou 4 significa que a turma não migrou.
      ...(Number(criancas) > 0
        ? { criancasEstimadas: Math.max(0, Number(criancas)) }
        : {}),
      createdAt: serverTimestamp(),
      // DE ONDE ELE VEIO — resolvido na tela a partir da URL
      // (`dominio/identidade/origem.js`), nunca perguntado num formulário.
      //
      // NÃO precisou de rule nova: a política de `users` é lista de PROIBIDOS
      // (trialInicio, assinaturaAte, plano), não de
      // permitidos. E este campo fica fora dela pelo mesmo critério que deixa
      // `ultimaRota` fora — mentir aqui não vira desconto, prazo nem
      // permissão: suja a contagem do dono e nada mais. No dia em que a
      // origem valer prêmio, ela vira cláusula e sobe para a lista.
      //
      // A data é o `createdAt` acima: a origem é a do cadastro, e guardar um
      // segundo timestamp para o mesmo instante só criaria duas verdades.
      ...(origem?.canal
        ? { origem: { canal: origem.canal, detalhe: origem.detalhe || '' } }
        : {}),
    },
    { merge: true }
  );

  return { uid, jaExistia };
}

/**
 * O RESTO DO CADASTRO, gravado no primeiro acesso.
 *
 * ⚠️ É `update` DO PRÓPRIO DOCUMENTO, e por isso não precisou de rule nova:
 * a política de `users` para o próprio dono é lista de PROIBIDOS
 * (`role`, `trialInicio`, `assinaturaAte`, `plano`, `suspenso`…), e nenhum
 * campo daqui está nela. O critério é o mesmo que deixa `ultimaRota` de
 * fora: mentir aqui não vira desconto, prazo nem permissão — suja a
 * contagem do dono e nada mais.
 *
 * ⚠️ `name` E `city` SÃO CONTRATO. Eles viram a PARTE em
 * `contratoAssociacao.js`; `regiao` não entra em documento nenhum, é
 * operacional. Juntar os dois num campo só faria o contrato identificar o
 * associado por bairro.
 *
 * Os dois opcionais só são gravados quando vieram: string vazia por cima de
 * um valor que ele já tinha apagaria o que ele escreveu antes.
 */
export async function completarCadastro(uid, dados) {
  if (!uid) throw new Error('Sem sessão.');
  const nome = String(dados?.name || '').trim();
  const cidade = String(dados?.city || '').trim();
  const regiao = String(dados?.regiao || '').trim();
  if (!nome || !cidade || !regiao) {
    throw new Error('Nome, cidade e região são obrigatórios.');
  }

  const marca = String(dados?.marcaNome || '').trim();
  const criancas = Number(dados?.criancas);

  await setDoc(
    doc(db, 'users', uid),
    {
      name: nome,
      city: cidade,
      regiao,
      ...(marca ? { marcaNome: marca } : {}),
      ...(Number.isFinite(criancas) && criancas > 0
        ? { criancasEstimadas: Math.max(0, criancas) }
        : {}),
      cadastroCompletoEm: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * O ESTADO DA OFERTA DA PRIMEIRA ROTA.
 *
 * Três escritas curtas no próprio documento — `update` de `users`, cuja
 * política para o próprio dono é lista de PROIBIDOS, e nenhuma delas está
 * nela. Mesmo critério de `ultimaRota`: mentir aqui não vira desconto nem
 * prazo, só apaga uma oferta que era dele.
 *
 * ⚠️ `ofertaEstado` É PLANO, e não um objeto aninhado, porque a varredura do
 * push consulta por ele: `where('ofertaEstado','==','pendente')` usa índice
 * de campo único, que o Firestore cria sozinho. Aninhado exigiria índice
 * composto declarado à mão — e índice que alguém precisa lembrar de criar é
 * a consulta que falha em produção e em lugar nenhum antes.
 */
export async function ofertarPelaPrimeiraRota(uid) {
  if (!uid) return false;
  try {
    await setDoc(
      doc(db, 'users', uid),
      { ofertaEstado: 'pendente', ofertaEm: serverTimestamp() },
      { merge: true }
    );
    return true;
  } catch (err) {
    // Engole, como o relógio do teste ao lado: isto roda no meio-fio, no
    // gesto de encerrar a rota, e uma oferta é a última coisa que pode
    // impedir alguém de terminar o dia.
    console.error('[oferta] não deu pra registrar:', err);
    return false;
  }
}

/** O "não" explícito — e ele mata os três toques de uma vez. */
export async function recusarOferta(uid) {
  if (!uid) return;
  await setDoc(
    doc(db, 'users', uid),
    { ofertaEstado: 'recusada', ofertaRespondidaEm: serverTimestamp() },
    { merge: true }
  );
}

/** Ele foi ver o plano. Não é contrato — é só parar de oferecer. */
export async function aceitarOferta(uid) {
  if (!uid) return;
  await setDoc(
    doc(db, 'users', uid),
    { ofertaEstado: 'aceita', ofertaRespondidaEm: serverTimestamp() },
    { merge: true }
  );
}
