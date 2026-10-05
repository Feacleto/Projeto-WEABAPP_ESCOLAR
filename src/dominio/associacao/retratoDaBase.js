/**
 * O RETRATO DA BASE — o app está sendo usado?
 *
 * ── POR QUE ISTO EXISTE (05/10/2026, pedido do dono)
 * Com a cobrança da plataforma DESLIGADA, metade do painel do dono mostrava
 * zero: MRR, conversão, receita, faturas. Nenhum desses é mentira, mas nenhum
 * responde a pergunta que o dono faz toda manhã — "o app está andando?". Os
 * números que respondem já estão gravados e não tinham tela:
 *
 *   rodaram em 7 dias     `users.ultimaRota`, gravado pelo próprio motorista
 *   crianças com família  `children.inviteStatus == 'used'` (o link, o irmão e
 *                         o pedido de acesso gravam o mesmo valor)
 *   baixas no mês         `payments` com `paid` no mês — QUANTAS, não quanto:
 *                         é sinal de que a Central está em uso, e o valor é
 *                         dinheiro das famílias, não da plataforma
 *   pagaria por mês       a soma de `precoDoMes`, que é o que a "Fatura de
 *                         R$ 0,00" já mostra a cada tio, somado para a base
 *
 * ── ⚠️ "PAGARIA" NÃO É RECEITA, E NUNCA É SOMADO A ELA
 * É o potencial: quanto a base de hoje pagaria se a cobrança ligasse agora.
 * Quem tem plano entra com o preço dele (descontos dentro, `mensalidadeDe`);
 * quem está no teste entra com a TABELA do mensal, sem desconto nenhum — a
 * escada de fechamento é decidida pelo servidor no dia em que ele contratar, e
 * adivinhá-la aqui inflaria ou encolheria o número sem motivo.
 * Só conta quem JÁ RODOU: quem cadastrou e nunca abriu uma rota não é base
 * que pagaria, é lead.
 *
 * ── ONDE O NÚMERO NÃO EXISTE, ELE VEM `null` — NUNCA ZERO
 * Mesma regra da carteira: zero e "não medimos" pedem ações opostas.
 *
 * Puro, sem Firebase: `npm run testar:retrato`. O "agora" entra por parâmetro.
 */

import { degrauDo, mensalidadeDe } from './carteira.js';
import { centavos, FUNDADOR, PLANO, planoValido, precoDaTabela } from './planos.js';

/** Janela do "está usando": uma semana letiva inteira. */
export const DIAS_DE_USO = 7;

const DIA_MS = 24 * 60 * 60 * 1000;

function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor?.toDate === 'function') {
    const d = valor.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
  }
  if (typeof valor === 'number' || typeof valor === 'string') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Já rodou alguma rota? A última rota OU o relógio do teste ligado. */
export function jaRodou(parceiro) {
  return !!(paraData(parceiro?.ultimaRota) || parceiro?.trialInicio);
}

/**
 * Rodou nos últimos `dias`? Data no FUTURO conta como não: relógio de
 * aparelho errado não pode fazer um motorista parado parecer ativo para sempre.
 */
export function rodouNosUltimos(parceiro, agora, dias = DIAS_DE_USO) {
  const ultima = paraData(parceiro?.ultimaRota);
  const hoje = paraData(agora);
  if (!ultima || !hoje) return false;
  const passou = hoje.getTime() - ultima.getTime();
  return passou >= 0 && passou < dias * DIA_MS;
}

/** O plano como o dono lê: vitalício, mensal, anual ou em teste. */
export function planoDoAssinante(parceiro) {
  if (parceiro?.condicaoFundador === FUNDADOR.VITALICIO) return 'vitalicio';
  if (planoValido(parceiro?.plano)) return parceiro.plano;
  return 'teste';
}

/**
 * Quanto ESTE motorista pagaria por mês hoje. `null` para quem nunca rodou
 * e para o vitalício nunca é null: ele paga zero, e zero ali é medição.
 */
export function pagariaPorMes(parceiro, mes) {
  if (!jaRodou(parceiro)) return null;
  if (parceiro?.condicaoFundador === FUNDADOR.VITALICIO) return 0;
  if (planoValido(parceiro?.plano)) {
    const conta = mensalidadeDe(parceiro, mes);
    return conta && conta.liquido !== null ? conta.liquido : null;
  }
  return precoDaTabela({
    criancas: Number(parceiro?.criancasAtivas) || 0,
    plano: PLANO.MENSAL,
  });
}

/** A fração de fechamento travada, se houver (só vale no mensal). */
function descontoTravado(parceiro) {
  const d = (parceiro?.descontos || []).find(
    (x) => x?.origem === 'fechamento' || x?.origem === 'antecipacao'
  );
  return d && Number(d.fracao) > 0 ? Number(d.fracao) : null;
}

/**
 * As linhas da lista de assinantes: um motorista por linha, com o plano de
 * cada um. Quem tem plano primeiro, depois o maior em crianças.
 */
export function linhasDosAssinantes({ parceiros = [], agora = new Date(), mes = null } = {}) {
  const ordemDoPlano = { vitalicio: 0, mensal: 1, anual: 1, teste: 2 };
  return (Array.isArray(parceiros) ? parceiros : [])
    .map((p) => ({
      uid: p.uid,
      nome: p.marcaNome || p.name || 'Sem nome',
      nomeCivil: p.marcaNome && p.name ? p.name : null,
      lugar: p.regiao || p.city || null,
      plano: planoDoAssinante(p),
      desde: paraData(p.contratadoEm),
      criancas: Number(p.criancasAtivas) || 0,
      descontoTravado: descontoTravado(p),
      pagaria: pagariaPorMes(p, mes),
      degrau: p.suspenso === true ? 'suspenso' : degrauDo(p, agora),
      rodouNaSemana: rodouNosUltimos(p, agora),
    }))
    .sort(
      (a, b) =>
        ordemDoPlano[a.plano] - ordemDoPlano[b.plano] ||
        b.criancas - a.criancas ||
        a.nome.localeCompare(b.nome, 'pt-BR')
    );
}

/**
 * O retrato inteiro. As três contagens que não moram em `users` (crianças
 * ativas, crianças com família e baixas do mês) entram prontas: quem conta é
 * o servidor, sem baixar documento nenhum. `null` em qualquer uma delas é
 * "não veio" — e a tela escreve "—".
 */
export function retratoDaBase({
  parceiros = [],
  agora = new Date(),
  mes = null,
  criancasAtivas = null,
  criancasComFamilia = null,
  baixasNoMes = null,
} = {}) {
  const lista = Array.isArray(parceiros) ? parceiros : [];

  let rodaram = 0;
  let rodaramNaSemana = 0;
  let pagaria = 0;
  const planos = { vitalicio: 0, mensal: 0, anual: 0, teste: 0 };

  lista.forEach((p) => {
    if (jaRodou(p)) rodaram += 1;
    if (rodouNosUltimos(p, agora)) rodaramNaSemana += 1;
    planos[planoDoAssinante(p)] += 1;
    // Suspenso não pagaria: a conta dele está parada por decisão do dono.
    if (p.suspenso !== true) {
      const v = pagariaPorMes(p, mes);
      if (v !== null) pagaria += v;
    }
  });

  const comFamilia =
    criancasAtivas > 0 && criancasComFamilia !== null
      ? Math.min(1, criancasComFamilia / criancasAtivas)
      : null;

  return {
    motoristas: lista.length,
    rodaram,
    rodaramNaSemana,
    nuncaRodaram: lista.length - rodaram,
    assinantes: planos.vitalicio + planos.mensal + planos.anual,
    planos,
    criancasAtivas,
    criancasComFamilia,
    fracaoComFamilia: comFamilia,
    baixasNoMes,
    pagariaPorMes: lista.length ? centavos(pagaria) : null,
    /**
     * Do cadastro ao uso: cada degrau é um SUBCONJUNTO do anterior, senão a
     * barra de baixo poderia passar a de cima e o funil viraria desenho.
     */
    funil: [
      { rotulo: 'Cadastrou', n: lista.length },
      { rotulo: 'Rodou a 1ª rota', n: rodaram },
      { rotulo: `Rodou nos últimos ${DIAS_DE_USO} dias`, n: rodaramNaSemana },
      {
        rotulo: 'Rodando e com plano',
        n: lista.filter((p) => rodouNosUltimos(p, agora) && planoDoAssinante(p) !== 'teste').length,
      },
    ],
  };
}

/**
 * A EVOLUÇÃO, UMA BARRA POR SEMANA — a partir das fotos diárias
 * (`fotosDaBase/{AAAA-MM-DD}`, gravadas pelo servidor às 23h50).
 *
 * Cada semana (de segunda a domingo) vale a ÚLTIMA foto dela: "rodaram nos
 * últimos 7 dias" no domingo é a semana inteira, e somar sete fotos contaria
 * o mesmo motorista sete vezes. Semana sem foto não vira zero — ela não
 * aparece, porque zero seria uma medição que não aconteceu.
 *
 * `dia` é 'AAAA-MM-DD' (o dia de Brasília); a conta da semana é feita em UTC
 * sobre a própria string, para não depender do fuso de quem abre a tela.
 */
export function semanasDasFotos(fotos = [], semanas = 16) {
  const porSemana = new Map();
  (Array.isArray(fotos) ? fotos : [])
    .filter((f) => typeof f?.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.dia))
    .sort((a, b) => a.dia.localeCompare(b.dia))
    .forEach((f) => {
      const d = new Date(`${f.dia}T00:00:00Z`);
      const desdeSegunda = (d.getUTCDay() + 6) % 7;
      const segunda = new Date(d.getTime() - desdeSegunda * DIA_MS).toISOString().slice(0, 10);
      porSemana.set(segunda, f);
    });
  return [...porSemana.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-semanas)
    .map(([segunda, f]) => ({
      semana: segunda,
      dia: f.dia,
      rodaramNaSemana: Number(f.rodaramNaSemana) || 0,
      motoristas: Number(f.motoristas) || 0,
    }));
}
