/**
 * A RENOVAÇÃO DO CONTRATO DA FAMÍLIA — a régua pura da fila "Renovar
 * contratos" (14/11/2026, tela N1b). Sem Firebase e sem React
 * (`npm run testar:renovacao`).
 *
 * ── O PROBLEMA
 * A vigência padrão vai "de hoje até 31/12" (`vigenciaPadrao`), e fora da
 * vigência a mensalidade NÃO nasce (`functions/lib/billing.js`, com
 * `mesDentroDaVigencia`). Quem fechou antes de novembro tem contrato até
 * 31/12/2026, e a mensalidade de janeiro/2027 simplesmente não aparecia — sem
 * aviso e sem caminho para renovar.
 *
 * ── O QUE RENOVAR É
 * Um ADITIVO que a família assina, pelo caminho que já existe
 * (`salvarCombinado` → `emitir` → `aceitarContrato`). A vigência que a
 * cobrança lê só muda no aceite, no servidor. Esta régua decide QUEM entra na
 * fila e QUAL vigência o aditivo propõe; não escreve nada.
 *
 * ── ⚠️ A VIGÊNCIA NOVA MANTÉM O INÍCIO (é PRORROGAÇÃO, não contrato que começa
 * em 1º/01). Se o aditivo trocasse o início para 01/01/2027, a família que
 * assina em NOVEMBRO passaria a ter `vigenciaInicio = 2027-01-01` já em
 * novembro — e a mensalidade de DEZEMBRO, gerada no dia 1º, não nasceria
 * (dezembro ficaria antes do início). A cobrança só lê os dois campos da
 * criança, então o buraco trocaria de mês, não sumiria. Mantendo o início, o
 * contrato que vale cobre do começo até o fim novo, sem buraco nenhum, e a
 * lista de mudanças que a família lê mostra uma linha só: o fim.
 *
 * Duas exceções, e as duas também não deixam buraco:
 *   - o contrato já ACABOU antes deste mês: o novo começa hoje (como o
 *     primeiro). Manter o início antigo poria no papel parcelas de meses que
 *     ninguém cobrou;
 *   - a prorrogação passaria de `MESES_MAXIMOS` (a segunda renovação de quem
 *     entrou cedo): o novo começa no dia 1º deste mês, que ainda está coberto.
 *
 * ── QUEM ENTRA NA FILA
 * A criança ativa cujo contrato termina antes do mês-alvo — o mesmo critério
 * de `mesDentroDaVigencia`, conferido contra o servidor no teste. O mês-alvo
 * é o mês de hoje mais `MESES_DE_ANTECEDENCIA` (2): o contrato que acaba em
 * 31/12 aparece a partir de 1º/11. Só "o mês que vem" o faria aparecer em
 * 1º/12, com um mês para colher todas as assinaturas — e o aviso do Início já
 * fala do vencimento em novembro.
 */
import {
  dataISO,
  estadoDoContrato,
  MESES_MAXIMOS,
  parcelasDaVigencia,
  vigenciaPadrao,
} from './contratoDaFamilia.js';

export const MESES_DE_ANTECEDENCIA = 2;

function partes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(a, me - 1, d);
  if (dt.getFullYear() !== a || dt.getMonth() !== me - 1 || dt.getDate() !== d) return null;
  return { a, me, d };
}

/** 'AAAA-MM' do mês de `hoje` mais `n`. */
export function mesDaqui(hoje, n) {
  return dataISO(new Date(hoje.getFullYear(), hoje.getMonth() + n, 1)).slice(0, 7);
}

/**
 * O contrato JÁ TERMINOU quando chega `mes`? Mesma conta de
 * `mesDentroDaVigencia` (`functions/lib/reguaDoContrato.js`), só que olhando
 * para depois do fim: um mês ANTES do início não é "terminou", é "ainda não
 * começou". Sem vigência gravada (criança anterior ao campo), a cobrança não
 * para nunca — então nunca termina.
 */
export function terminaAntesDoMes(mes, inicio, fim) {
  const i = partes(inicio);
  if (!i || !partes(fim)) return false;
  const [a, me] = String(mes).split('-').map(Number);
  const indice = (a - i.a) * 12 + (me - i.me);
  return indice >= 0 && indice >= parcelasDaVigencia(inicio, fim);
}

/** O primeiro mês sem mensalidade depois do fim, em 'AAAA-MM'. */
export function primeiroMesSemMensalidade(fim) {
  const f = partes(fim);
  if (!f) return null;
  return dataISO(new Date(f.a, f.me - 1, f.d + 1)).slice(0, 7);
}

/**
 * A VIGÊNCIA QUE O ADITIVO PROPÕE — ver o cabeçalho. O fim é o critério de
 * `vigenciaPadrao` aplicado ao dia seguinte ao fim atual (ou a hoje, se ele
 * já passou): 31/12 do ano, e do ano seguinte quando faltam menos de 60 dias.
 */
export function vigenciaDaRenovacao(child, hoje = new Date()) {
  const inicio = child?.vigenciaInicio;
  const fim = child?.vigenciaFim;
  const f = partes(fim);
  if (!partes(inicio) || !f) return null;
  const hojeISO = dataISO(hoje);
  const primeiroDoMes = dataISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const diaSeguinte = dataISO(new Date(f.a, f.me - 1, f.d + 1));
  const base = diaSeguinte > hojeISO ? diaSeguinte : hojeISO;
  const b = partes(base);
  const novoFim = vigenciaPadrao(new Date(b.a, b.me - 1, b.d)).fim;
  let novoInicio;
  if (fim < primeiroDoMes) novoInicio = hojeISO;
  else if (parcelasDaVigencia(inicio, novoFim) <= MESES_MAXIMOS) novoInicio = inicio;
  else novoInicio = primeiroDoMes;
  return { inicio: novoInicio, fim: novoFim };
}

/**
 * EM QUE PÉ ESTÁ ESTA CRIANÇA NA FILA:
 *
 *   null           não precisa renovar (ou não está na turma)
 *   'renovar'      contrato aceito acabando — a linha tem o botão
 *   'esperando'    já há um contrato novo esperando a família
 *   'sem-aceite'   o PRIMEIRO contrato nunca foi assinado: não há o que
 *                  prorrogar, e mudar a vigência ali grava direto na criança
 *   'sem-familia'  a família não está no app: ninguém para assinar
 *
 * ⚠️ 'esperando' vale para QUALQUER contrato novo pendente, inclusive uma
 * mudança de valor que não mexe no prazo. Renovar por cima retiraria a mudança
 * que ele mandou; a linha volta a ser 'renovar' quando ela assinar, ou quando
 * ele retirar a mudança na tela do contrato.
 */
export function situacaoDaRenovacao(child, hoje = new Date(), antecedencia = MESES_DE_ANTECEDENCIA) {
  if (!child || child.active !== true || child.transferidaPara) return null;
  const alvo = mesDaqui(hoje, antecedencia);
  if (!terminaAntesDoMes(alvo, child.vigenciaInicio, child.vigenciaFim)) return null;
  if (!child.parentUid) return 'sem-familia';
  const estado = estadoDoContrato(child);
  if (estado === 'mudanca') return 'esperando';
  if (estado === 'aceito') return 'renovar';
  return 'sem-aceite';
}

const porFimENome = (a, b) =>
  String(a.child.vigenciaFim).localeCompare(String(b.child.vigenciaFim)) ||
  String(a.child.name || '').localeCompare(String(b.child.name || ''), 'pt-BR');

/**
 * A FILA, pronta para a tela: as linhas por situação e quantas crianças sem a
 * família no app ficaram de fora (só a contagem — sem família não há quem
 * assine, e a cobrança dessas já não nasce).
 */
export function filaDeRenovacao(criancas, hoje = new Date()) {
  const fila = { renovar: [], esperando: [], semAceite: [], semFamilia: 0 };
  for (const child of criancas || []) {
    const situacao = situacaoDaRenovacao(child, hoje);
    if (!situacao) continue;
    if (situacao === 'sem-familia') {
      fila.semFamilia += 1;
      continue;
    }
    const linha = {
      child,
      situacao,
      fimAtual: child.vigenciaFim,
      nova: situacao === 'renovar' ? vigenciaDaRenovacao(child, hoje) : null,
    };
    if (situacao === 'renovar') fila.renovar.push(linha);
    else if (situacao === 'esperando') fila.esperando.push(linha);
    else fila.semAceite.push(linha);
  }
  fila.renovar.sort(porFimENome);
  fila.esperando.sort(porFimENome);
  fila.semAceite.sort(porFimENome);
  fila.total = fila.renovar.length + fila.esperando.length + fila.semAceite.length;
  return fila;
}

/**
 * O QUE O SERVICE MANDA PARA `salvarCombinado` — só a vigência. Valor e
 * vencimento não vão: o aditivo herda os da criança, e `valoresDoAditivo` só
 * aplica no aceite o que veio aqui. `null` para quem não está em 'renovar'.
 */
export function pedidoDeRenovacao(child, hoje = new Date()) {
  if (situacaoDaRenovacao(child, hoje) !== 'renovar') return null;
  const nova = vigenciaDaRenovacao(child, hoje);
  if (!nova) return null;
  return { novos: { vigenciaInicio: nova.inicio, vigenciaFim: nova.fim } };
}
