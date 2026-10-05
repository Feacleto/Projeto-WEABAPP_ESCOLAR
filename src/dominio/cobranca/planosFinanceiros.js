/**
 * OS PLANOS FINANCEIROS DO MOTORISTA — régua pura (05/10/2026, simulação
 * "Rota e Central" aprovada pelo dono).
 *
 * Um plano financeiro é uma META que ele anota: para quê, quanto e até quando.
 * O app faz a conta de quanto separar por mês e mostra a barra do que ele DISSE
 * ter separado. O nome é "plano" de propósito (decisão do dono): é a mesma
 * palavra do plano do app, e ele aprende que os dois são dinheiro.
 *
 * ⚠️ O APP NÃO GUARDA NEM MOVIMENTA DINHEIRO. O valor "separado" é uma
 * anotação, substituída a cada vez que ele olha o banco e diz o número — nunca
 * somada pelo app. Por isso o vocabulário é "separei", "anotado", e nunca
 * saldo, depositar, sacar, transferir ou rendimento (`testar:perua` reprova
 * essas palavras nas telas dos planos, como já fazia na reserva).
 *
 * Os dois planos da perua (troca e manutenção) continuam na Reserva da perua,
 * com a conta própria deles; aqui moram os que ele cria.
 */

export const MAX_PLANOS = 12;
export const MAX_NOME = 40;

/** As ideias prontas do "Para quê?" — a última é digitar. */
export const IDEIAS_DE_PLANO = ['IPVA e seguro', 'Emergência', 'Férias', 'Pneus', '13º da auxiliar'];

/** Os prazos do "Até quando?", em meses a partir de hoje. */
export const PRAZOS = [3, 6, 12];

const pad = (n) => String(n).padStart(2, '0');

/** 'AAAA-MM' daqui a `meses` meses (o mês do fim, inclusive). */
export function mesDoFim(meses, hoje = new Date()) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + Math.max(1, Math.floor(meses)) - 1, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Quantos meses faltam até o mês do fim, contando o atual (mínimo 1). */
export function mesesQueFaltam(ate, hoje = new Date()) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ate || ''));
  if (!m) return 1;
  const fim = Number(m[1]) * 12 + Number(m[2]) - 1;
  const agora = hoje.getFullYear() * 12 + hoje.getMonth();
  return Math.max(1, fim - agora + 1);
}

/** O plano é um que a tela sabe mostrar? Nome, meta e mês do fim. */
export function planoValido(p) {
  return !!p
    && typeof p.nome === 'string' && p.nome.trim().length > 0 && p.nome.length <= MAX_NOME
    && Number.isFinite(Number(p.meta)) && Number(p.meta) > 0
    && /^\d{4}-\d{2}$/.test(String(p.ate || ''));
}

/**
 * A conta de um plano: quanto falta, quanto separar por mês e a fração já
 * anotada (0 a 1). Separado acima da meta não passa de 1, e "falta" não fica
 * negativo.
 */
export function contaDoPlano(p, hoje = new Date()) {
  const meta = Math.max(0, Number(p?.meta) || 0);
  const separado = Math.max(0, Number(p?.separado) || 0);
  const falta = Math.max(0, Math.round((meta - separado) * 100) / 100);
  const meses = mesesQueFaltam(p?.ate, hoje);
  const porMes = falta === 0 ? 0 : Math.ceil((falta / meses) * 100) / 100;
  const fracao = meta > 0 ? Math.min(1, separado / meta) : 0;
  return { meta, separado, falta, meses, porMes, fracao, chegou: falta === 0 };
}

/**
 * A linha fechada do assunto "Planos financeiros" na Central: quantos planos e
 * quanto separar por mês somando todos. Sem plano, `null` — a linha não
 * inventa um número.
 */
export function resumoDePlanos(planos, hoje = new Date()) {
  const validos = (Array.isArray(planos) ? planos : []).filter(planoValido);
  if (validos.length === 0) return null;
  const porMes = validos.reduce((acc, p) => acc + contaDoPlano(p, hoje).porMes, 0);
  return { numero: validos.length, porMes: Math.round(porMes * 100) / 100 };
}

/** Um plano novo, pronto para gravar. Lança com a frase que a tela mostra. */
export function novoPlano({ nome, meta, meses }, hoje = new Date(), id = null) {
  const n = String(nome || '').trim().slice(0, MAX_NOME);
  const valor = Math.round(Number(String(meta).replace(',', '.')) * 100) / 100;
  if (!n) throw new Error('Para quê é o plano?');
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Quanto você vai precisar?');
  const prazo = Math.floor(Number(meses));
  if (!Number.isFinite(prazo) || prazo < 1 || prazo > 120) throw new Error('Até quando? De 1 mês a 10 anos.');
  return {
    id: id || `p${hoje.getTime().toString(36)}`,
    nome: n,
    meta: valor,
    ate: mesDoFim(prazo, hoje),
    separado: 0,
  };
}
