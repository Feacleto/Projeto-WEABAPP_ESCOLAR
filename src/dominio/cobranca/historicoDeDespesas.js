/**
 * O HISTÓRICO QUE A FOLHA DE DESPESA MOSTRA (03/10/2026).
 *
 * Quem abre "Lançar despesa" quer lembrar de uma coisa antes de digitar: quando
 * foi o último abastecimento e quanto a perua rodou desde então, o que foi
 * feito na última manutenção, quanto a auxiliar ganhou nos últimos meses, como
 * ele costuma chamar o gasto avulso. Tudo isso já está nas despesas que ele
 * lançou — esta régua só faz a conta.
 *
 * ⚠️ NUNCA INVENTA NÚMERO. O km sai de duas leituras reais do mesmo contador
 * (o das rotas, somado no celular dele, ou o do painel, digitado por ele). Sem
 * as duas leituras, a resposta é `null` e a tela não mostra número nenhum —
 * "rodou 0 km" sobre um dado que não existe seria a tela mentindo.
 *
 * Puro de propósito: sem Firebase, sem React. A lista de despesas e o contador
 * chegam por parâmetro (`npm run testar:despesas`).
 */

/** As duas respostas a "a perua roda só nas rotas?" — as mesmas do service. */
export const USO_DA_PERUA = {
  SO_ROTA: 'so_rota',
  TAMBEM_FORA: 'tambem_fora',
};

/** As categorias em que o km faz sentido. Salário não roda quilômetro. */
export const CATEGORIAS_COM_KM = ['fuel', 'maintenance'];

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Date, Timestamp do Firestore (`toDate`), `{seconds}` ou ISO. Inválido = null. */
export function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor.toDate === 'function') return paraData(valor.toDate());
  if (typeof valor.seconds === 'number') return new Date(valor.seconds * 1000);
  if (typeof valor === 'string' || typeof valor === 'number') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Número finito e não negativo, ou null. Texto vazio também é null. */
export function leituraDeKm(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 'AAAA-MM' de uma despesa: o campo gravado, ou a data dela. */
export function mesDaDespesa(despesa) {
  if (despesa?.monthKey) return despesa.monthKey;
  const d = paraData(despesa?.date);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Mais recente primeiro. Sem data vai para o fim. Não muda a lista recebida. */
export function maisRecentesPrimeiro(despesas) {
  return [...(despesas || [])].sort((a, b) => {
    const da = paraData(a?.date)?.getTime() ?? -Infinity;
    const db = paraData(b?.date)?.getTime() ?? -Infinity;
    return db - da;
  });
}

/** A última despesa da categoria, ou null. */
export function ultimaDaCategoria(despesas, categoria) {
  return (
    maisRecentesPrimeiro((despesas || []).filter((d) => d?.category === categoria))[0] || null
  );
}

/**
 * Quantos dias de CALENDÁRIO separam a data de hoje — meio-dia contra
 * meia-noite não pode virar "há 0 dias" de um lançamento de ontem.
 */
export function diasDesde(data, hoje = new Date()) {
  const d = paraData(data);
  const h = paraData(hoje);
  if (!d || !h) return null;
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(h.getFullYear(), h.getMonth(), h.getDate());
  return Math.round((b - a) / MS_POR_DIA);
}

/** "hoje", "ontem", "há 5 dias", "há 7 semanas", "há 3 meses". */
export function haQuanto(data, hoje = new Date()) {
  const dias = diasDesde(data, hoje);
  if (dias === null) return '';
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 14) return `há ${dias} dias`;
  if (dias < 60) return `há ${Math.floor(dias / 7)} semanas`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'há 1 mês' : `há ${meses} meses`;
}

/**
 * QUANTO A PERUA RODOU DESDE A ÚLTIMA DESPESA, e de onde veio o número.
 *
 *   'so_rota'      contador das rotas agora − contador gravado no último
 *                  lançamento (`kmContador`)
 *   'tambem_fora'  km do painel digitado agora − km do painel do último
 *                  lançamento (`kmPainel`). O contador das rotas não serve:
 *                  ele não vê a ida ao mercado no domingo.
 *
 * Devolve `{ km, fonte: 'rotas' | 'painel' }` ou `null`. Também `null` quando
 * a diferença é negativa — painel digitado errado ou contador zerado não viram
 * "rodou −300 km".
 */
export function kmDesdeOUltimo({ ultima, uso, kmDasRotas = null, kmPainelAgora = null } = {}) {
  if (!ultima) return null;
  if (uso === USO_DA_PERUA.SO_ROTA) {
    const agora = leituraDeKm(kmDasRotas);
    const antes = leituraDeKm(ultima.kmContador);
    if (agora === null || antes === null || agora < antes) return null;
    return { km: Math.round(agora - antes), fonte: 'rotas' };
  }
  if (uso === USO_DA_PERUA.TAMBEM_FORA) {
    const agora = leituraDeKm(kmPainelAgora);
    const antes = leituraDeKm(ultima.kmPainel);
    if (agora === null || antes === null || agora < antes) return null;
    return { km: Math.round(agora - antes), fonte: 'painel' };
  }
  return null;
}

/** "Desde então a perua rodou 412 km nas rotas" — ou '' sem número. */
export function fraseDoKm(resultado) {
  if (!resultado) return '';
  const km = new Intl.NumberFormat('pt-BR').format(resultado.km);
  return `Desde então a perua rodou ${km} km ${resultado.fonte === 'rotas' ? 'nas rotas' : 'pelo painel'}`;
}

/** Caixa, acento e espaço não fazem dois nomes: "Pedágio" = " pedagio ". */
export function normalizarNome(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * OS NOMES QUE ELE MAIS LANÇA em "Outros" — os atalhos da folha.
 *
 * Conta pela forma normalizada e mostra a grafia do lançamento MAIS RECENTE
 * (é a que ele digitou por último, logo a que ele reconhece). Empate de
 * contagem desempata pelo mais recente. Nome vazio não conta.
 */
export function maisLancados(despesas, { categoria = 'other', limite = 4 } = {}) {
  const grupos = new Map();
  for (const d of maisRecentesPrimeiro(despesas)) {
    if (d?.category !== categoria) continue;
    const chave = normalizarNome(d.description);
    if (!chave) continue;
    const quando = paraData(d.date)?.getTime() ?? -Infinity;
    const g = grupos.get(chave);
    if (g) g.vezes += 1;
    else grupos.set(chave, { nome: String(d.description).trim(), vezes: 1, quando });
  }
  return [...grupos.values()]
    .sort((a, b) => b.vezes - a.vezes || b.quando - a.quando)
    .slice(0, limite)
    .map(({ nome, vezes }) => ({ nome, vezes }));
}

/** O 'AAAA-MM' anterior. */
export function mesAnterior(mes) {
  const [a, m] = String(mes || '').split('-').map(Number);
  if (!a || !m) return null;
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * O SALÁRIO DA AUXILIAR NOS ÚLTIMOS MESES, antes do mês atual.
 *
 * Soma por mês (quem paga em duas vezes lança duas despesas) e devolve só os
 * meses que TÊM lançamento: um mês vazio na lista leria como "pagou zero".
 */
export function salariosRecentes(despesas, mesAtual, { categoria = 'monitor', quantos = 3 } = {}) {
  const porMes = new Map();
  for (const d of despesas || []) {
    if (d?.category !== categoria) continue;
    const mes = mesDaDespesa(d);
    if (!mes || !(mes < mesAtual)) continue;
    porMes.set(mes, (porMes.get(mes) || 0) + (Number(d.amount) || 0));
  }
  return [...porMes.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, quantos)
    .map(([mes, valor]) => ({ mes, valor: Math.round(valor * 100) / 100 }));
}

/**
 * O valor que a folha já traz escrito para a auxiliar: o do MÊS PASSADO, e
 * só ele. Se o mês passado não teve lançamento, não há sugestão — repetir o
 * de três meses atrás seria chutar.
 */
export function sugestaoDeSalario(despesas, mesAtual, opcoes = {}) {
  const anterior = mesAnterior(mesAtual);
  const achado = salariosRecentes(despesas, mesAtual, opcoes).find((s) => s.mes === anterior);
  return achado ? achado.valor : null;
}
