/**
 * "ECONOMIA DO MÊS" — o que mexe no custo da perua (05/10/2026, versão B
 * aprovada pelo dono).
 *
 * A tela junta quatro números de fora (inflação, juros, dólar) e de dentro
 * (o preço do litro que ELE pagou), e ao lado o que isso fez no custo dele
 * por criança. Esta régua decide o que cada cartão diz, com e sem dado.
 *
 * ⚠️ INFORMAR, NÃO INDUZIR — a mesma regra do "Preciso aumentar?". A tela
 * mostra quanto o CUSTO subiu e quanto foi a inflação, lado a lado, e para
 * aí: nenhuma frase sugere valor nem percentual de reajuste da mensalidade.
 * Um número sugerido viraria o número cobrado, e a responsabilidade por ele
 * seria do app. `npm run testar:economia` varre todo texto daqui e da tela
 * atrás de "aumente", "sugerimos", "%" junto de "mensalidade" e afins.
 *
 * ⚠️ NÃO É IA E NÃO É CONSELHO. As frases são fixas, uma por índice, e
 * dizem o que o número costuma fazer na perua. Nenhuma fala em investir,
 * aplicar ou guardar dinheiro em lugar nenhum.
 *
 * ⚠️ "SUBIU" E "DESCEU" NÃO SÃO ÂMBAR. Âmbar é aviso (design system, regra
 * 1), e o dólar descer não pede nada a ninguém. A seta é neutra.
 *
 * O COMBUSTÍVEL É O DELE. A média da ANP ficou de fora: o levantamento
 * semanal sai em planilha .xlsx num endereço que muda a cada publicação (não
 * há API estável), e ler isso no servidor seria uma agendada que quebra
 * calada a cada troca de arquivo. O preço que ele pagou é mais verdadeiro
 * para a conta dele de qualquer forma — é o posto dele.
 *
 * O CUSTO NÃO É CONTA NOVA: é `precisoAumentar.js` (`custoMensal`,
 * `custoPorCrianca`, `altaEm12Meses`), lido por outro ângulo. "Custava" é o
 * custo médio por criança menos a alta — a mesma leitura que o "Preciso
 * aumentar?" faz ao dizer "cada criança te custa X" e "passou a custar Y a
 * mais"; as duas telas nunca podem discordar.
 *
 * Puro de propósito: sem Firebase, sem React.
 */

import { abastecimentosDe, chaveDoMes, precoEm12Meses, rotuloDoTipo, TIPOS_DE_COMBUSTIVEL } from './combustivel.js';
import {
  MESES_PARA_ALTA,
  altaEm12Meses,
  custoMensal,
  custoPorCrianca,
} from './precisoAumentar.js';
import { despesasNaJanela } from './reservaDaPerua.js';
import { mesDaDespesa } from './historicoDeDespesas.js';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export const MOVIMENTO = { SUBIU: 'subiu', DESCEU: 'desceu', IGUAL: 'igual' };

/** Onde se lança o abastecimento (fora da senha: a auxiliar também lança). */
export const ROTA_DE_ABASTECER = '/tio/abastecer';

/**
 * As três perguntas do "Entenda". A terceira é texto do DONO, palavra por
 * palavra, com UMA troca conferida no código: o botão da ficha se chama
 * "Editar" (bloco Dinheiro, ChildDetail) desde 03/10/2026 — o "Mudar" do
 * texto original não existe mais na tela, e mandar tocar num botão que não
 * existe é a promessa sem caminho que este projeto já pagou caro.
 */
export const PERGUNTAS_DO_ENTENDA = [
  {
    chave: 'selic',
    pergunta: 'O que é a Selic e por que me importa?',
    resposta:
      'É o juro básico do país, decidido pelo Banco Central. Quando sobe, financiar a perua e parcelar peça fica mais caro.',
  },
  {
    chave: 'dolar',
    pergunta: 'Por que o dólar mexe no diesel?',
    resposta:
      'O petróleo é vendido em dólar, e parte do diesel é importada. Com o dólar alto, o preço no posto tende a subir depois de algumas semanas.',
  },
  {
    chave: 'contrato',
    pergunta: 'Posso aumentar a mensalidade no meio do contrato?',
    resposta:
      'Sozinho, não. O valor combinado com a família vale até o fim do contrato. Você pode propor um valor novo: na ficha da criança, toque em "Editar". A família recebe um contrato novo e o valor só passa a valer quando ela aceitar. Na renovação, o valor novo entra no contrato seguinte.',
  },
];

/** Os textos fixos da tela, num lugar só — o teste varre todos. */
export const TEXTOS_DA_TELA = {
  titulo: 'Economia do mês',
  subtitulo: 'O que mexe no custo da sua perua.',
  tituloDoCusto: 'O que isso faz no seu custo',
  linhaDoCusto: 'Conta feita com o que você lançou no app.',
  decisao: 'O app mostra o custo. Quanto cobrar é decisão sua.',
  notaDoCombustivel: 'O combustível conta só o preço do litro, não quanto você rodou a mais.',
  tituloDoEntenda: 'Entenda',
  botao: 'Lançar despesa',
  rodape: 'A conta fica melhor quanto mais você lança.',
  semIndice: 'O número ainda não chegou. Tente mais tarde.',
};

// ─────────────────────────────── formatação ────────────────────────────────

function decimal(n, casas = 2) {
  return Number(n).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** '2026-08' → 'agosto'; com `comAno`, 'agosto de 2026'. */
export function nomeDoMes(chave, { comAno = false } = {}) {
  const [a, m] = String(chave || '').split('-').map(Number);
  if (!a || !m || m < 1 || m > 12) return '';
  return comAno ? `${MESES[m - 1]} de ${a}` : MESES[m - 1];
}

/** '2026-09-17' → '17/09' */
export function diaEMes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}` : '';
}

const numero = (v) => typeof v === 'number' && Number.isFinite(v);

// ──────────────────────────────── a seta ────────────────────────────────────

/**
 * Subiu, desceu ou ficou igual. Sem o valor de antes, `null` — e a tela não
 * mostra seta nenhuma, em vez de inventar "ficou igual".
 */
export function movimento(agora, antes) {
  if (!numero(agora) || !numero(antes)) return null;
  // Comparação em centésimos: 5.2238 contra 5.22381 não é "subiu".
  const a = Math.round(agora * 100);
  const b = Math.round(antes * 100);
  if (a > b) return MOVIMENTO.SUBIU;
  if (a < b) return MOVIMENTO.DESCEU;
  return MOVIMENTO.IGUAL;
}

/** A frase da seta. `desde` troca "em 12 meses" pelo mês de verdade. */
export function textoDoMovimento(mov, { desde = null } = {}) {
  if (!mov) return null;
  const quando = desde ? `desde ${desde}` : 'em 12 meses';
  if (mov === MOVIMENTO.SUBIU) return `Subiu ${quando}`;
  if (mov === MOVIMENTO.DESCEU) return `Desceu ${quando}`;
  return desde ? `Igual desde ${desde}` : 'Igual a 12 meses atrás';
}

// ─────────────────────────────── os cartões ─────────────────────────────────

function cartao({ chave, nome, numero: num, prefixo = null, sufixo = null, mov, desde, frase, fonte, semDado = null }) {
  return {
    chave,
    nome,
    numero: num,
    prefixo,
    sufixo,
    movimento: mov,
    textoDoMovimento: textoDoMovimento(mov, { desde }),
    frase,
    fonte,
    semDado,
  };
}

function cartaoSemIndice(chave, nome, frase, fonte) {
  return cartao({ chave, nome, numero: null, mov: null, frase, fonte, semDado: { texto: TEXTOS_DA_TELA.semIndice } });
}

/** Inflação: o IPCA acumulado em 12 meses, contra o do mesmo mês um ano antes. */
export function cartaoDaInflacao(ipca) {
  const frase = 'Quanto as coisas em geral ficaram mais caras num ano.';
  if (!ipca || !numero(ipca.ipca12m)) return cartaoSemIndice('inflacao', 'Inflação', frase, 'IPCA 12 meses · IBGE');
  return cartao({
    chave: 'inflacao',
    nome: 'Inflação',
    numero: decimal(ipca.ipca12m),
    sufixo: '%',
    mov: movimento(ipca.ipca12m, ipca.ipca12mAntes),
    frase,
    fonte: `IPCA 12 meses · IBGE · ${nomeDoMes(ipca.mes)}`,
  });
}

/** Juros: a Selic meta, com o dia em que passou a valer quando se sabe. */
export function cartaoDosJuros(selic) {
  const frase = 'Juros altos encarecem o financiamento da perua nova.';
  if (!selic || !numero(selic.valor)) return cartaoSemIndice('juros', 'Juros', frase, 'Selic · Banco Central');
  const quando = selic.desde ? `desde ${diaEMes(selic.desde)}` : diaEMes(selic.data);
  return cartao({
    chave: 'juros',
    nome: 'Juros',
    numero: decimal(selic.valor),
    sufixo: '%',
    mov: movimento(selic.valor, selic.valorAntes),
    frase,
    fonte: `Selic · Banco Central · ${quando}`,
  });
}

/** Dólar: a PTAX de venda do último dia útil. */
export function cartaoDoDolar(dolar) {
  const frase = 'Dólar alto costuma encarecer o diesel semanas depois.';
  if (!dolar || !numero(dolar.valor)) return cartaoSemIndice('dolar', 'Dólar', frase, 'PTAX · Banco Central');
  return cartao({
    chave: 'dolar',
    nome: 'Dólar',
    numero: decimal(dolar.valor),
    prefixo: 'R$ ',
    mov: movimento(dolar.valor, dolar.valorAntes),
    frase,
    fonte: `PTAX · Banco Central · ${diaEMes(dolar.data)}`,
  });
}

/**
 * Combustível: o preço médio do litro que ELE pagou. Com dois meses
 * diferentes na janela, compara o mais recente com o mais antigo — e diz
 * DESDE QUANDO, porque o mais antigo com lançamento nem sempre é de doze
 * meses atrás. Com um mês só, o número sem seta. Sem nada, onde lançar.
 */
export function cartaoDoCombustivel({ despesas, tipo = null, hoje = new Date() } = {}) {
  const nome = tipo ? rotuloDoTipo(tipo) : 'Combustível';
  const m3 = TIPOS_DE_COMBUSTIVEL.find((t) => t.chave === tipo)?.unidade === 'm³';
  const unidade = m3 ? 'm³' : 'litro';
  const abast = abastecimentosDe(despesas);
  if (abast.length === 0) {
    return cartao({
      chave: 'combustivel',
      nome,
      numero: null,
      mov: null,
      frase: `Lance o abastecimento com os ${m3 ? 'm³' : 'litros'} para ver quanto você paga no ${unidade}.`,
      fonte: 'Seus abastecimentos',
      semDado: { texto: 'Nenhum abastecimento lançado ainda.', rota: ROTA_DE_ABASTECER, rotulo: 'Abastecer' },
    });
  }
  const frase = `O que você pagou no ${unidade}, em média.`;
  const preco = precoEm12Meses(abast, hoje);
  if (preco) {
    return cartao({
      chave: 'combustivel',
      nome,
      numero: decimal(preco.agora),
      prefixo: 'R$ ',
      mov: movimento(preco.agora, preco.antes),
      desde: nomeDoMes(preco.mesAntes, { comAno: true }),
      frase,
      fonte: `Seus abastecimentos · ${nomeDoMes(preco.mesAgora)}`,
    });
  }
  // Um mês só (ou o último fora da janela): a média do mês mais recente.
  const mes = chaveDoMes(abast[0].data);
  const doMes = abast.filter((a) => chaveDoMes(a.data) === mes && a.valor > 0);
  const litros = doMes.reduce((s, a) => s + a.litros, 0);
  const valor = doMes.reduce((s, a) => s + a.valor, 0);
  return cartao({
    chave: 'combustivel',
    nome,
    numero: litros > 0 && valor > 0 ? decimal(valor / litros) : null,
    prefixo: 'R$ ',
    mov: null,
    frase,
    fonte: `Seus abastecimentos · ${nomeDoMes(mes)}`,
    semDado: litros > 0 && valor > 0 ? null : { texto: 'Lance o valor pago junto com os litros.', rota: ROTA_DE_ABASTECER, rotulo: 'Abastecer' },
  });
}

/** Os quatro, na ordem da tela. */
export function cartoesDaEconomia({ indices = {}, despesas = [], tipo = null, hoje = new Date() } = {}) {
  return [
    cartaoDaInflacao(indices.ipca),
    cartaoDosJuros(indices.selic),
    cartaoDoDolar(indices.dolar),
    cartaoDoCombustivel({ despesas, tipo, hoje }),
  ];
}

// ─────────────────────────── o que isso faz no custo ─────────────────────────

/** Arredonda a uma casa (8,33 → 8,3), sem −0. */
function umaCasa(n) {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * O custo por criança hoje e há 12 meses, e de onde veio a diferença.
 *
 *   { estado: 'sem-turma' | 'sem-despesa' | 'sem-alta' | 'pronto', texto, … }
 *
 * - 'sem-turma' / 'sem-despesa': nenhum número, só o que falta.
 * - 'sem-alta': há custo, mas menos de 10 meses lançados — o custo de hoje
 *   não aparece sozinho aqui (ele é do "Preciso aumentar?"); o texto diz
 *   quantos meses faltam.
 * - 'pronto': `hoje`, `antes`, `variacao` (% do CUSTO, uma casa; `null` se
 *   o de antes não for positivo), `partes` (combustível, manutenção, o
 *   resto) com `largura` 0–100 para a barra, `total`, e `inflacao` (o IPCA,
 *   ou `null`).
 */
export function custoNaEconomia({ despesas = [], planoDaTroca = null, criancas = [], ipca = null, hoje = new Date() } = {}) {
  const ativas = (criancas || []).filter((c) => c && c.active !== false);
  if (ativas.length === 0) {
    return { estado: 'sem-turma', texto: 'Cadastre a turma para ver o custo por criança.' };
  }
  const custo = custoMensal({ despesas, planoDaTroca, hoje });
  const porCrianca = custoPorCrianca({ custo, criancas: ativas });
  if (porCrianca === null) {
    return { estado: 'sem-despesa', texto: 'Lance as despesas da perua para ver o custo por criança.' };
  }
  const alta = altaEm12Meses({ despesas, criancas: ativas, hoje });
  if (!alta) {
    const meses = new Set(despesasNaJanela(despesas, hoje).map(mesDaDespesa).filter(Boolean)).size;
    const faltam = Math.max(1, MESES_PARA_ALTA - meses);
    return {
      estado: 'sem-alta',
      texto: `Você tem ${meses} ${meses === 1 ? 'mês' : 'meses'} com despesa lançada. Faltam ${faltam} ${faltam === 1 ? 'mês' : 'meses'} para comparar com 12 meses atrás.`,
    };
  }

  const antes = porCrianca - alta.total;
  const porChave = Object.fromEntries(alta.partes.map((p) => [p.chave, p.valor]));
  const partes = [
    { chave: 'combustivel', rotulo: 'Combustível', valor: porChave.combustivel || 0 },
    { chave: 'manutencao', rotulo: 'Manutenção', valor: porChave.maintenance || 0 },
    // O resto da alta é o que a régua mede além dos dois: o monitor /
    // auxiliar. Seguro, parcela e imposto não têm "alta" lá (não mudam de
    // preço no mês), e o rótulo diz o que entra em vez de prometer "tudo".
    { chave: 'resto', rotulo: 'O resto (auxiliar)', valor: porChave.monitor || 0 },
  ];
  const positivos = partes.reduce((s, p) => s + Math.max(0, p.valor), 0);
  for (const p of partes) {
    p.largura = positivos > 0 ? Math.round((Math.max(0, p.valor) / positivos) * 100) : 0;
  }
  return {
    estado: 'pronto',
    hoje: porCrianca,
    antes,
    total: alta.total,
    variacao: antes > 0 ? umaCasa((alta.total / antes) * 100) : null,
    partes,
    inflacao: ipca && numero(ipca.ipca12m) ? ipca.ipca12m : null,
  };
}

/** "+8,3%", "−2,0%", "0,0%" */
export function percentualComSinal(n) {
  if (!numero(n)) return '—';
  const texto = `${decimal(Math.abs(n), 1)}%`;
  if (n > 0) return `+${texto}`;
  if (n < 0) return `−${texto}`;
  return texto;
}

/** A frase de uma linha sob a comparação. */
export function fraseDoCusto(c, reais) {
  if (!c || c.estado !== 'pronto') return c?.texto || '';
  if (c.total === 0) return `Cada criança custa ${reais(c.hoje)} por mês, o mesmo de 12 meses atrás.`;
  return `Cada criança custava ${reais(c.antes)} por mês. Hoje custa ${reais(c.hoje)}.`;
}
