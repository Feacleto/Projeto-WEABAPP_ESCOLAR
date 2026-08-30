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

/**
 * Quantos PARCEIROS existem — e agora é uma query só.
 *
 * Aqui havia duas consultas e uma subtração: contava `role == 'admin'` e
 * descontava quem tinha `superAdmin`, porque a conta do dono precisava
 * carregar papel de MOTORISTA pras rules liberarem as leituras deste painel.
 * O dono entrava na própria contagem de parceiros, e com um parceiro real a
 * tela dizia 2.
 *
 * Isso deixou de ser verdade quando o dono ganhou papel próprio (`role:
 * 'owner'`, com `isOwner()` nas rules): ele não tem mais papel de motorista,
 * então não há o que descontar. Manter a subtração custaria uma leitura por
 * abertura do painel pra sempre devolver zero — e, pior, manteria escrito na
 * tela um raciocínio que já não descreve o sistema.
 */
async function contaParceiros(users) {
  return conta(query(users, where('role', '==', 'admin')));
}

/** YYYY-MM do mês corrente, no mesmo formato do campo `month` de payments. */
export function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Visão geral da plataforma — os números que importam pra valuation.
 *
 * Retorna { usuarios, motoristas, responsaveis, criancas, gmvTotal,
 *           gmvMes, ticketMedio, receitaPropria, receitaEmAberto,
 *           filaParceiros }
 */
export async function getPlatformOverview() {
  const users = collection(db, 'users');
  const children = collection(db, 'children');
  const payments = collection(db, 'payments');
  const faturas = collection(db, 'faturasParceiro');

  const [
    usuarios,
    motoristas,
    responsaveis,
    criancas,
    gmvTotal,
    gmvMes,
    receitaPropria,
    receitaEmAberto,
    filaParceiros,
  ] = await Promise.all([
    conta(query(users)),
    // MOTORISTAS SÃO OS PARCEIROS — e o dono, que agora tem papel próprio
    // (`role: 'owner'`), não aparece nesta conta nem precisa ser descontado.
    // Um número de vitrine errado pra mais é o pior tipo: ninguém desconfia.
    contaParceiros(users),
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
    conta(query(collection(db, 'waitlistDrivers'))),
  ]);

  return {
    usuarios,
    motoristas,
    responsaveis,
    criancas,
    gmvTotal,
    gmvMes,
    // Mensalidade média por criança ativa no mês — a base de qualquer conta
    // de take rate futura.
    ticketMedio: criancas > 0 ? gmvMes / criancas : 0,
    receitaPropria,
    receitaEmAberto,
    filaParceiros,
  };
}

/**
 * Resultado da pesquisa de satisfação — o que o app faz com as avaliações
 * que NÃO vão pra home (as de responsável) e com as respostas de métrica.
 *
 * Lê até `max` feedbacks (o admin tem list liberado nas rules) e agrega no
 * cliente: são poucas centenas de documentos pequenos, e agregar aqui evita
 * criar índice pra cada corte que a gente vai querer olhar.
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
