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
 * Não inventa receita. Hoje o Alô Buzinou não cobra dos parceiros (o
 * gatewayService ainda é stub), então a receita própria é ZERO e o painel
 * diz isso com letra grande em vez de exibir uma projeção disfarçada de
 * fato. O que existe de verdade é o GMV: o dinheiro que passou pelo app
 * entre pai e motorista. Os dois números são diferentes e confundir um com o
 * outro é o erro clássico de valuation de marketplace.
 *
 * SEGURANÇA
 * Toda leitura aqui já é permitida pelas rules a quem tem role `admin` —
 * este módulo não abre porta nenhuma, só organiza o que o admin já podia
 * ler. O gate de super-admin é de PRODUTO (esconder a tela de quem não é
 * dono do negócio), não de segurança. Segurança de verdade exige custom
 * claim + rules dedicadas: está no brief de arquitetura.
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
 * Visão geral da plataforma — os números que importam pra valuation.
 *
 * Retorna { usuarios, motoristas, responsaveis, criancas, gmvTotal,
 *           gmvMes, ticketMedio, receitaPropria, filaParceiros }
 */
export async function getPlatformOverview() {
  const users = collection(db, 'users');
  const children = collection(db, 'children');
  const payments = collection(db, 'payments');

  const [
    usuarios,
    motoristas,
    responsaveis,
    criancas,
    gmvTotal,
    gmvMes,
    filaParceiros,
  ] = await Promise.all([
    conta(query(users)),
    conta(query(users, where('role', '==', 'admin'))),
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
    // Zero, e por um motivo: não existe cobrança de parceiro implementada.
    receitaPropria: 0,
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
