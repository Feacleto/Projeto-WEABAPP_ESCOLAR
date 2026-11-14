/**
 * OS CONTRATOS QUE ACABAM — quantas famílias deixam de ter mensalidade, e
 * quando (RC1.1, 14/11/2026 — docs/analise/13-lotes-de-implementacao.md §2).
 *
 * ── O QUE ESTE ARQUIVO RESPONDE
 * A vigência padrão de um contrato é "de hoje até 31/12" e só pula para o ano
 * seguinte quando faltam menos de 60 dias (`vigenciaPadrao`). Quem foi
 * cadastrado antes de ~1º de novembro tem contrato até 31/12/2026, e FORA da
 * vigência o servidor não gera a mensalidade (`billing.js`,
 * `mesDentroDaVigencia`) — sem erro, sem aviso e sem fluxo de renovação. A
 * mensalidade de janeiro simplesmente não nasce.
 *
 * Aqui mora só a conta: quais famílias, em que dia o contrato acaba e qual é o
 * primeiro mês sem parcela. O texto está em `marca/contratosQueVencem.js` e a
 * tela em `components/tio/AvisoDosContratos.jsx`.
 *
 * ── QUEM CONTA, E POR QUÊ
 * Só entra a criança que PERDERIA parcela de verdade. É o mesmo funil do
 * servidor (`generateForMonth`), na mesma ordem:
 *   - ativa (`active === true`);
 *   - com responsável vinculado (`parentUid`) — sem ele a mensalidade já não
 *     nasce, o contrato não é o motivo;
 *   - com mensalidade de valor positivo — sem valor também não nasce;
 *   - com vigência INTEIRA gravada. `mesDentroDaVigencia` devolve `true` quando
 *     falta início ou fim (criança antiga, sem vigência): essa não perde nada.
 * Contar além disso encheria o aviso de famílias que não têm o problema, e um
 * aviso que erra o número deixa de ser lido.
 *
 * ⚠️ É O MESMO CRITÉRIO DO SERVIDOR, E O TESTE COMPARA. `mesDentroDaVigencia`
 * é copiada de `functions/lib/reguaDoContrato.js` (o deploy das functions não
 * alcança `src/`); `npm run testar:contratos-que-vencem` varre as duas numa
 * matriz de datas e reprova se divergirem.
 *
 * ── A JANELA DE 60 DIAS
 * O aviso só aparece quando faltam 60 dias ou menos para o fim da vigência —
 * antes disso ele seria ruído numa conta que ainda tem tempo. 60 é o mesmo
 * número que `vigenciaPadrao` usa para decidir que o ano "já é o que vem": a
 * partir dali, qualquer contrato novo já nasce para o ano seguinte, então o
 * problema só existe para os que nasceram antes.
 *
 * ⚠️ DEPOIS DO FIM O AVISO NÃO SOME — ele muda de tempo ("já acabaram"). No dia
 * 1º de janeiro o dano começa, e é exatamente quando um aviso que só olhasse
 * para a frente desapareceria.
 *
 * Não importa Firebase nem React (decisão 17). O `hoje` é parâmetro.
 */
import { parcelasDaVigencia } from './contratoDaFamilia.js';

/** Quantos dias antes do fim da vigência o aviso começa. */
export const DIAS_DE_ANTECEDENCIA = 60;

/** Quantos meses à frente se procura o primeiro sem parcela (o contrato máximo é de 24). */
const MESES_DE_BUSCA = 36;

/** 'AAAA-MM-DD' válido → { a, me, d }; senão `null` (31/02 não é data). */
function partes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(a, me - 1, d);
  if (dt.getFullYear() !== a || dt.getMonth() !== me - 1 || dt.getDate() !== d) return null;
  return { a, me, d };
}

/**
 * O mês 'AAAA-MM' tem parcela dentro da vigência? Cópia fiel de
 * `mesDentroDaVigencia` em `functions/lib/reguaDoContrato.js`: sem início ou
 * sem fim válidos, devolve `true` (não há o que cortar).
 */
export function mesDentroDaVigencia(mesAAAAMM, inicio, fim) {
  const i = partes(inicio);
  if (!i || !partes(fim)) return true;
  const [a, me] = String(mesAAAAMM).split('-').map(Number);
  const indice = (a - i.a) * 12 + (me - i.me);
  return indice >= 0 && indice < parcelasDaVigencia(inicio, fim);
}

function chaveDoMes(a, me) {
  return `${a}-${String(me).padStart(2, '0')}`;
}

/** Dias inteiros de `hoje` até a data 'AAAA-MM-DD' (negativo = já passou). */
function diasAte(iso, hoje) {
  const p = partes(iso);
  if (!p) return null;
  const meiaNoiteDeHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((new Date(p.a, p.me - 1, p.d) - meiaNoiteDeHoje) / 86400000);
}

/**
 * O primeiro mês, a partir do mês de `hoje`, que a vigência não cobre. É o mês
 * em que a mensalidade deixa de nascer. `null` se não achar (vigência absurda).
 */
export function primeiroMesSemParcela(inicio, fim, hoje) {
  for (let k = 0; k < MESES_DE_BUSCA; k += 1) {
    const dt = new Date(hoje.getFullYear(), hoje.getMonth() + k, 1);
    const chave = chaveDoMes(dt.getFullYear(), dt.getMonth() + 1);
    if (!mesDentroDaVigencia(chave, inicio, fim)) return chave;
  }
  return null;
}

/** A criança perderia parcela por causa do contrato? (o funil do servidor) */
function candidata(c) {
  if (!c || c.active !== true) return false;
  if (!c.parentUid) return false;
  if (!(Number(c.monthlyFee) > 0)) return false;
  return Boolean(partes(c.vigenciaInicio) && partes(c.vigenciaFim));
}

/** Quantas famílias distintas (uma mãe com dois filhos é uma família). */
function familiasDe(criancas) {
  return new Set(criancas.map((c) => c.parentUid)).size;
}

/**
 * @typedef {Object} ContratosQueVencem
 * @property {{familias:number, criancas:number, primeiroFim:string,
 *   ultimoFim:string, primeiroMesSemParcela:string, ultimoMesSemParcela:string,
 *   dias:number}|null} vencem
 *   Os que ainda acabam (dentro dos 60 dias). `dias` é o do contrato que acaba primeiro.
 * @property {{familias:number, criancas:number}|null} vencidos
 *   Os que já acabaram e continuam ativos, com responsável e valor.
 */

/**
 * O que o aviso precisa saber, ou `{ vencem: null, vencidos: null }` quando não
 * há nada a avisar.
 *
 * @param {Array<object>} criancas  as crianças do motorista (`children`)
 * @param {Date} [hoje]  injetável, para teste
 * @returns {ContratosQueVencem}
 */
export function contratosQueVencem(criancas, hoje = new Date()) {
  const aVencer = [];
  const jaVencidos = [];

  for (const c of Array.isArray(criancas) ? criancas : []) {
    if (!candidata(c)) continue;
    const dias = diasAte(c.vigenciaFim, hoje);
    if (dias == null) continue;
    if (dias < 0) {
      jaVencidos.push(c);
    } else if (dias <= DIAS_DE_ANTECEDENCIA) {
      aVencer.push({ c, dias, fim: c.vigenciaFim });
    }
  }

  let vencem = null;
  if (aVencer.length) {
    aVencer.sort((x, y) => (x.fim < y.fim ? -1 : x.fim > y.fim ? 1 : 0));
    const primeiro = aVencer[0];
    // O primeiro mês sem parcela entre TODOS (não só o do primeiro contrato):
    // é o mês em que a primeira família começa a faltar.
    const meses = aVencer
      .map(({ c }) => primeiroMesSemParcela(c.vigenciaInicio, c.vigenciaFim, hoje))
      .filter(Boolean)
      .sort();
    vencem = {
      familias: familiasDe(aVencer.map((x) => x.c)),
      criancas: aVencer.length,
      primeiroFim: primeiro.fim,
      ultimoFim: aVencer[aVencer.length - 1].fim,
      primeiroMesSemParcela: meses[0] || null,
      ultimoMesSemParcela: meses[meses.length - 1] || null,
      dias: primeiro.dias,
    };
  }

  const vencidos = jaVencidos.length
    ? { familias: familiasDe(jaVencidos), criancas: jaVencidos.length }
    : null;

  return { vencem, vencidos };
}
