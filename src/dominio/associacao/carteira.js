/**
 * A CARTEIRA DE ASSOCIADOS — em que ponto do caminho cada motorista está.
 *
 * ── POR QUE ISTO PRECISOU EXISTIR
 * O painel do dono media o funil ANTIGO: tamanho da base (quantos usuários,
 * quantas crianças) e dinheiro que passou pelo app (GMV). Nenhum dos dois diz
 * como o negócio vai, porque nenhum dos dois é receita da plataforma — GMV é o
 * dinheiro da família para o motorista, e a plataforma não está no caminho
 * dele.
 *
 * O caminho que passou a existir tem quatro degraus, e cada um é um campo:
 *
 *   cadastrou  →  rodou a 1ª rota  →  contratou  →  pagou
 *   (users)       (trialInicio)       (planoId)     (assinaturaAte)
 *
 * ── O NÚMERO QUE FALTAVA É O MRR
 * O painel mostrava `receitaPropria`: soma das faturas quitadas. Ela olha para
 * TRÁS — é o que já entrou. O MRR olha para a frente: é quanto entra por mês
 * enquanto ninguém sair, e é a primeira coisa que alguém pergunta.
 *
 * Ele não sai de fatura nenhuma. Sai da soma de `precoDoMes` de quem tem
 * contrato — com os descontos de cada um dentro, que é o ponto: a diferença
 * entre a tabela e o MRR é exatamente quanto a plataforma está abrindo mão, e
 * esse número não existia em lugar nenhum.
 *
 * ── ESTE ARQUIVO NÃO IMPORTA FIREBASE, e é o que o mantém testável
 * (`npm run testar:carteira`). Quem busca os documentos é o service; aqui
 * chega uma lista e uma hora, e sai a conta. O "agora" entra por parâmetro
 * pelo mesmo motivo de `trial.js`: regra de data que lê o relógio da máquina
 * passa em setembro e falha em março.
 */

import { estadoDaConta } from './contaAtiva.js';
import { centavos, planoPorId, precoDoMes } from './planos.js';
import { diasRestantes } from './trial.js';

/**
 * Em que degrau este motorista está.
 *
 *   'bloqueado'   a conta parou: teste vencido sem contrato, ou atraso
 *   'contratado'  tem faixa e está operando
 *   'em_teste'    rodou a primeira rota e o relógio está correndo
 *   'nao_comecou' criou a conta e ainda não rodou rota nenhuma
 *
 * A ORDEM É PARTE DA REGRA. `bloqueado` vem primeiro porque quem contratou e
 * parou de pagar continua com `planoId` — classificá-lo como "contratado"
 * inflaria o MRR com dinheiro que não entra mais, que é o jeito mais comum de
 * um painel mentir para o próprio dono.
 */
export function degrauDo(parceiro, agora) {
  const { ativa } = estadoDaConta({
    suspenso: parceiro?.suspenso === true,
    trialInicio: parceiro?.trialInicio || null,
    assinaturaAte: parceiro?.assinaturaAte || null,
    fatura: null,
    agora,
  });

  if (!ativa) return 'bloqueado';
  if (parceiro?.planoId) return 'contratado';
  if (parceiro?.trialInicio) return 'em_teste';
  return 'nao_comecou';
}

/**
 * Quanto ESTE parceiro paga por mês, já com os descontos dele.
 *
 * `null` quando não há faixa — e `null` não é zero. Somar zero por "ainda não
 * escolheu" mistura quem não paga com quem paga nada, e as duas coisas pedem
 * ações opostas: uma é uma conversa, a outra é um fundador.
 */
export function mensalidadeDe(parceiro, mes) {
  const plano = planoPorId(parceiro?.planoId);
  if (!plano) return null;
  return precoDoMes({
    plano,
    fundador: parceiro?.condicaoFundador || null,
    indicacoesAtivas: Number(parceiro?.indicacoesAtivas) || 0,
    descontos: parceiro?.descontos,
    mes,
  });
}

/**
 * A carteira inteira, resumida.
 *
 * `mes` é 'AAAA-MM' e decide quais descontos com prazo ainda valem — sem ele,
 * um desconto que acabou continuaria sendo descontado do MRR para sempre.
 *
 * ⚠️ ONDE O NÚMERO NÃO EXISTE, ELE VEM `null` — NUNCA ZERO. Num painel que
 * alguém abre para decidir, zero e "não medimos" são coisas opostas: uma diz
 * que ninguém converteu, a outra diz que ninguém terminou o teste ainda.
 * Confundir as duas é o erro que não se desfaz numa conversa.
 */
export function resumirCarteira({ parceiros = [], agora = new Date(), mes = null } = {}) {
  const lista = Array.isArray(parceiros) ? parceiros : [];

  const degraus = { bloqueado: 0, contratado: 0, em_teste: 0, nao_comecou: 0 };
  let mrr = 0;
  let tabela = 0;
  let semFaixa = 0;
  let antecipados = 0;
  let acabandoEm7 = 0;

  lista.forEach((p) => {
    const degrau = degrauDo(p, agora);
    degraus[degrau] += 1;

    if (degrau === 'em_teste') {
      const faltam = diasRestantes(p.trialInicio, agora);
      if (faltam !== null && faltam <= 7) acabandoEm7 += 1;
    }

    if (degrau === 'contratado') {
      const conta = mensalidadeDe(p, mes);
      // Acima da tabela entra na carteira e NÃO no MRR: o valor dele é
      // conversa, e chutar um número aqui seria inventar receita.
      if (!conta || conta.liquido === null) {
        semFaixa += 1;
      } else {
        mrr += conta.liquido;
        tabela += conta.bruto;
      }
      if ((p.descontos || []).some((d) => d?.origem === 'antecipacao')) {
        antecipados += 1;
      }
    }
  });

  const pagantes = degraus.contratado - semFaixa;

  return {
    total: lista.length,
    naoComecou: degraus.nao_comecou,
    emTeste: degraus.em_teste,
    acabandoEm7,
    contratados: degraus.contratado,
    bloqueados: degraus.bloqueado,
    semFaixa,

    mrr: centavos(mrr),
    /** O que entraria sem desconto nenhum. A diferença é o que se abre mão. */
    mrrDeTabela: centavos(tabela),
    /** Fração média abdicada. `null` quando não há ninguém pagando ainda. */
    descontoMedio: tabela > 0 ? 1 - mrr / tabela : null,
    /** Quanto vale, em média, um associado pagante. `null` sem pagantes. */
    ticketPorAssociado: pagantes > 0 ? centavos(mrr / pagantes) : null,

    antecipados,

    /**
     * Dos que SAÍRAM do teste, quantos contrataram.
     *
     * `null` enquanto ninguém saiu — e é aqui que a diferença entre zero e
     * "não medimos" aparece na prática: no primeiro mês de operação, 0%
     * pareceria fracasso onde não houve nem tentativa.
     */
    conversao:
      degraus.contratado + degraus.bloqueado > 0
        ? degraus.contratado / (degraus.contratado + degraus.bloqueado)
        : null,
  };
}

/**
 * A NOTA QUE AS FAMÍLIAS DERAM A CADA MOTORISTA.
 *
 * ── POR QUE ISTO PRECISA DE UMA JUNÇÃO
 * O documento de `feedbacks` guarda `uid` e `role` de quem escreveu, e **não
 * guarda `adminUid`**. Quem sabe a que motorista uma família pertence é o
 * documento do responsável, em `users.adminUid`.
 *
 * Então a nota por motorista só existe cruzando as duas listas — que é
 * exatamente o que o dono já carrega para o painel. Nenhuma consulta nova.
 *
 * ── SÓ FAMÍLIA CONTA
 * Feedback de motorista é ele avaliando o APP; feedback de responsável é ele
 * avaliando o transporte. Misturar os dois faria a nota do motorista subir
 * porque ele gostou do aplicativo, que é o oposto do sinal procurado.
 *
 * ── A ATRIBUIÇÃO USA `adminUid`, O SINGULAR, E ISSO TEM LIMITE
 * `users.adminUid` guarda o PRIMEIRO motorista da família; a lista completa é
 * `adminUids`. Uma mãe com filhos em peruas diferentes tem a nota atribuída ao
 * primeiro — e é o certo aqui: somar a nota nos dois contaria a mesma opinião
 * duas vezes, e não há como saber sobre qual dos dois ela escreveu.
 *
 * Vale saber que existe: com muitas famílias de perua dupla, o segundo
 * motorista fica com menos avaliações do que recebeu de fato.
 */
export function notasPorMotorista(feedbacks = [], usuarios = []) {
  const motoristaDoResponsavel = new Map();
  (Array.isArray(usuarios) ? usuarios : []).forEach((u) => {
    if (u?.role === 'parent' && u?.adminUid) {
      motoristaDoResponsavel.set(u.uid || u.id, u.adminUid);
    }
  });

  const soma = new Map();
  (Array.isArray(feedbacks) ? feedbacks : []).forEach((f) => {
    if (f?.role !== 'parent') return;
    const nota = Number(f?.answers?.rating);
    if (!(nota >= 1 && nota <= 5)) return;
    const uid = motoristaDoResponsavel.get(f.uid);
    if (!uid) return;
    const atual = soma.get(uid) || { n: 0, total: 0 };
    atual.n += 1;
    atual.total += nota;
    soma.set(uid, atual);
  });

  const saida = {};
  soma.forEach((v, uid) => {
    // Arredonda a UMA casa: "4.8" é o que se lê; "4.833333" é ruído que faz a
    // tela parecer precisa sobre uma média de nove opiniões.
    saida[uid] = { media: Math.round((v.total / v.n) * 10) / 10, n: v.n };
  });
  return saida;
}
