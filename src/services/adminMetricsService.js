import {
  collection,
  getAggregateFromServer,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  sum,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { notasPorMotorista, resumirCarteira } from '../dominio/associacao/carteira.js';

/**
 * Métricas da plataforma pro painel do super-admin.
 *
 * POR QUE AGREGAÇÃO NO SERVIDOR
 * `getCountFromServer` e `getAggregateFromServer` contam e somam SEM baixar
 * os documentos: custo de leitura irrisório e nenhum dado de criança
 * trafegando pra montar um número. Quando a base crescer, a conta continua
 * sendo uma chamada — baixar `payments` inteiro pra somar no cliente é o
 * tipo de coisa que funciona com 18 crianças e derruba a tela com 1.800.
 *
 * O QUE ESTE MÓDULO NÃO FAZ
 * Não inventa receita. A receita própria sai de `faturasParceiro` QUITADA —
 * taxa de associação que o motorista já pagou —, no mesmo critério do GMV,
 * que soma `payments` com status `paid`. Os dois números medem dinheiro que
 * entrou, e não dinheiro combinado; misturar os critérios faria uma linha
 * parecer maior que a outra por razão de contabilidade, não de negócio.
 *
 * Fatura ABERTA vem separada (`receitaEmAberto`) e nunca somada na primeira.
 * Ela é a distância entre faturar e receber — o número que diz se a cobrança
 * está funcionando —, e embutir na receita seria antecipar caixa que não
 * caiu. É a mesma linha que separa `claimed` de `paid` do lado do pai.
 *
 * GMV continua sendo outra coisa: o dinheiro que passou entre pai e motorista,
 * que a plataforma não toca. Confundir os dois é o erro clássico de valuation
 * de marketplace.
 *
 * SEGURANÇA
 * As leituras de `users`, `children`, `payments` e `waitlistDrivers` já são
 * permitidas pelas rules a quem tem role `admin`. `faturasParceiro` NÃO é:
 * ela pede `isOwner()`, e um motorista que chegasse aqui teria a agregação
 * negada — `somaCampo` engole e devolve 0, então ele veria receita zerada em
 * vez de erro. Nenhuma porta se abre por causa disso; o módulo continua só
 * organizando o que o chamador já podia ler.
 *
 * O gate de super-admin na tela é de PRODUTO (esconder o negócio de quem não
 * é dono), não de segurança. Segurança de verdade exige custom claim + rules
 * dedicadas: está no brief de arquitetura.
 */

/** Soma um campo numérico da coleção, com fallback se a agregação falhar. */
async function somaCampo(q, campo) {
  try {
    const snap = await getAggregateFromServer(q, { total: sum(campo) });
    return Number(snap.data().total || 0);
  } catch {
    // Fallback: lê os documentos. Só acontece em ambiente sem suporte a
    // agregação (emulador antigo) ou quando falta índice.
    try {
      const snap = await getDocs(q);
      return snap.docs.reduce((acc, d) => acc + (Number(d.data()[campo]) || 0), 0);
    } catch {
      return 0;
    }
  }
}

async function conta(q) {
  try {
    return (await getCountFromServer(q)).data().count || 0;
  } catch {
    return 0;
  }
}


/** YYYY-MM do mês corrente, no mesmo formato do campo `month` de payments. */
export function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Visão geral da plataforma.
 *
 * ── ELA MEDIA O FUNIL ANTIGO ATÉ 06/09/2026
 * Tamanho da base e dinheiro que passou pelo app. Nenhum dos dois diz como o
 * negócio vai: GMV é o dinheiro da família para o motorista, e a plataforma
 * não está no caminho dele. Continua aqui porque é o tamanho da operação que o
 * produto sustenta — mas não é receita, e o painel não deixa confundir.
 *
 * O que entrou junto é a CARTEIRA: em que degrau cada associado está e quanto
 * entra por mês. Ver `dominio/associacao/carteira.js`, que faz a conta e é
 * testado sem Firebase.
 *
 * ⚠️ A CONTAGEM DA FILA SAIU, E ELA ESTAVA QUEBRANDO ESTA TELA INTEIRA.
 * `conta(query(collection(db, 'waitlistDrivers')))` continuou aqui depois de a
 * coleção sair das rules na fase 2 — a consulta passou a ser negada, o
 * `Promise.all` rejeitava, e a Visão geral caía no estado de erro. Um número
 * que ninguém mais olhava derrubando três que todo mundo olha.
 *
 * ── UMA LEITURA DOS PARCEIROS, NÃO CINCO CONTAGENS
 * A carteira precisa dos documentos (faixa, descontos, início do teste), não
 * de contagens. Como são um por associado — dezenas, não milhares —, ler a
 * lista uma vez sai mais barato que as contagens que ela substitui.
 */
export async function getPlatformOverview() {
  const users = collection(db, 'users');
  const children = collection(db, 'children');
  const payments = collection(db, 'payments');
  const faturas = collection(db, 'faturasParceiro');

  const [
    usuarios,
    parceiros,
    responsaveis,
    criancas,
    gmvTotal,
    gmvMes,
    receitaPropria,
    receitaEmAberto,
  ] = await Promise.all([
    conta(query(users)),
    // OS DOCUMENTOS, não a contagem: a carteira precisa da faixa e dos
    // descontos de cada um. O dono, que tem papel próprio (`role: 'owner'`),
    // não entra nesta lista nem precisa ser descontado.
    getDocs(query(users, where('role', '==', 'admin'))).then((snap) =>
      snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
    ),
    conta(query(users, where('role', '==', 'parent'))),
    conta(query(children, where('active', '==', true))),
    somaCampo(query(payments, where('status', '==', 'paid')), 'amount'),
    somaCampo(
      query(
        payments,
        where('status', '==', 'paid'),
        where('month', '==', mesAtual())
      ),
      'amount'
    ),
    // A TAXA DE ASSOCIAÇÃO QUE JÁ ENTROU — a receita de verdade da plataforma.
    // `quitada` é o dono ter dado baixa depois do PIX cair; não há gateway
    // que confirme por conta própria.
    somaCampo(query(faturas, where('status', '==', 'quitada')), 'total'),
    // Faturada e não recebida. Fica SEPARADA — ver o cabeçalho.
    somaCampo(query(faturas, where('status', '==', 'aberta')), 'total'),
  ]);

  const carteira = resumirCarteira({
    parceiros,
    agora: new Date(),
    mes: mesAtual(),
  });

  return {
    usuarios,
    motoristas: parceiros.length,
    responsaveis,
    criancas,
    carteira,
    gmvTotal,
    gmvMes,
    // Mensalidade média por criança ativa no mês — a base de qualquer conta
    // de take rate futura.
    ticketMedio: criancas > 0 ? gmvMes / criancas : 0,
    receitaPropria,
    receitaEmAberto,
  };
}

/**
 * Resultado da pesquisa de satisfação — o que o app faz com as avaliações
 * que NÃO vão pra home (as de responsável) e com as respostas de métrica.
 *
 * Lê até `max` feedbacks e agrega no cliente: são poucas centenas de
 * documentos pequenos, e agregar aqui evita criar índice pra cada corte que a
 * gente vai querer olhar.
 *
 * SÓ O DONO CONSEGUE. O comentário aqui dizia "o admin tem list liberado nas
 * rules" — e `admin`, neste projeto, é o MOTORISTA. A frase estava certa sobre
 * a rule e errada sobre quem: qualquer parceiro varria as avaliações de toda a
 * plataforma, com `uid` e papel de quem escreveu, incluindo as das famílias
 * dos concorrentes.
 *
 * O ramo `isAdmin()` do `allow list` de `feedbacks` saiu em 30/08/2026
 * (decisão 12). Esta função continua funcionando porque o único chamador dela
 * é o `AdminPanel`, e quem abre aquela tela é o dono — que passa por
 * `isOwner()`. Se um dia ela for chamada de uma tela de motorista, vai receber
 * `permission-denied`, e o certo é essa tela não existir.
 */
export async function getSurveyResults(max = 500) {
  const snap = await getDocs(
    query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'), limit(max))
  );

  const base = {
    total: 0,
    porPapel: { admin: { n: 0, soma: 0 }, parent: { n: 0, soma: 0 } },
    estrelas: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    usos: {},
    desejos: {},
    publicados: 0,
    comentarios: [],
  };

  for (const doc of snap.docs) {
    const d = doc.data();
    const nota = Number(d?.answers?.rating || 0);
    const papel = d.role === 'admin' ? 'admin' : 'parent';

    base.total += 1;
    if (nota >= 1 && nota <= 5) {
      base.estrelas[nota] += 1;
      base.porPapel[papel].n += 1;
      base.porPapel[papel].soma += nota;
    }
    for (const u of d?.answers?.uses || []) {
      base.usos[u] = (base.usos[u] || 0) + 1;
    }
    const w = d?.answers?.wish;
    if (w) base.desejos[w] = (base.desejos[w] || 0) + 1;
    if (d.allowTestimonial) base.publicados += 1;

    const texto = (d.comment || '').trim();
    if (texto && base.comentarios.length < 40) {
      base.comentarios.push({
        id: doc.id,
        texto,
        nota,
        papel,
        nome: (d.authorName || '').split(' ')[0] || null,
        publico: !!d.allowTestimonial,
        em: d.createdAt?.toDate?.() || null,
      });
    }
  }

  const media = (p) => (p.n > 0 ? p.soma / p.n : 0);
  const promotores = base.estrelas[4] + base.estrelas[5];
  const respondentes = Object.values(base.estrelas).reduce((a, b) => a + b, 0);

  return {
    ...base,
    mediaGeral: respondentes > 0
      ? (base.estrelas[1] +
          base.estrelas[2] * 2 +
          base.estrelas[3] * 3 +
          base.estrelas[4] * 4 +
          base.estrelas[5] * 5) /
        respondentes
      : 0,
    mediaMotorista: media(base.porPapel.admin),
    mediaResponsavel: media(base.porPapel.parent),
    // % de quem deu 4 ou 5 — o proxy de recomendação mais honesto que dá
    // pra extrair de uma escala de estrelas (não é NPS, e não vamos chamar
    // de NPS: NPS tem outra pergunta e outra escala).
    satisfeitos: respondentes > 0 ? promotores / respondentes : 0,
    respondentes,
  };
}

/**
 * O QUE A ABA MOTORISTAS PRECISA — três listas, uma vez.
 *
 * Parceiros, responsáveis e avaliações. Os responsáveis entram porque
 * `feedbacks` NÃO guarda `adminUid`: quem sabe a que motorista uma família
 * pertence é o documento dela (`users.adminUid`), e a nota por motorista só
 * existe cruzando as duas listas. Ver `notasPorMotorista` em `carteira.js`.
 *
 * TRÊS CONSULTAS NA ABERTURA DA ABA, e não uma por ficha. Com dezenas de
 * associados, carregar tudo de uma vez e filtrar em memória é mais barato — e,
 * mais importante, deixa a lista responder ao toque sem esperar rede.
 *
 * ⚠️ Isto NÃO carrega crianças. O contador `users.criancasAtivas` já responde
 * o tamanho de cada operação, e foi por precisar da soma das mensalidades que
 * a versão antiga desta tela varria `children` inteira — trazendo endereço,
 * escola e telefone de família para o navegador do dono. Não repita.
 */
export async function carregarConsole(max = 500) {
  const users = collection(db, 'users');

  const [parceiros, responsaveis, avaliacoes] = await Promise.all([
    getDocs(query(users, where('role', '==', 'admin'))).then((s) =>
      s.docs.map((d) => ({ uid: d.id, ...d.data() }))
    ),
    getDocs(query(users, where('role', '==', 'parent'))).then((s) =>
      s.docs.map((d) => ({ uid: d.id, ...d.data() }))
    ),
    getDocs(query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'), limit(max)))
      .then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })))
      // A vitrine degrada calada e esta também: sem avaliação, a ficha mostra
      // "sem avaliações" em vez de a aba inteira cair.
      .catch(() => []),
  ]);

  return { parceiros, notas: notasPorMotorista(avaliacoes, responsaveis) };
}

/**
 * O GMV de UM parceiro — o tamanho da operação dele, em dinheiro.
 *
 * Não é receita da plataforma: é o que passou entre as famílias dele e ele. Na
 * ficha ele diz uma coisa útil que nenhum outro número diz — se a operação é
 * grande ou pequena em reais, e não só em crianças.
 *
 * Sob demanda, ao abrir a ficha. Carregar isso para todo mundo na abertura da
 * aba seria somar a base inteira de pagamentos para mostrar um número por vez.
 */
export async function gmvDoParceiro(uid) {
  if (!uid) return null;
  try {
    return await somaCampo(
      query(
        collection(db, 'payments'),
        where('adminUid', '==', uid),
        where('status', '==', 'paid')
      ),
      'amount'
    );
  } catch (err) {
    // Índice faltando ou consulta negada: a ficha mostra "—" em vez de sumir.
    console.error('[admin] GMV do parceiro não carregou:', err);
    return null;
  }
}
