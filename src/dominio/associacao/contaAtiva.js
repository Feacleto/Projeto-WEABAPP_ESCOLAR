/**
 * A CONTA ESTÁ ATIVA? — uma pergunta, três respostas, dois caminhos até elas.
 *
 * POR QUE UMA TELA SÓ PARA DOIS ESTADOS
 * Fim do teste sem contrato e fatura vencida há dias parecem coisas
 * diferentes e são a mesma: **existe conta, existe dado, falta acordo**. O
 * `negocio.md` chegou nessa conclusão antes deste arquivo existir, e é por
 * isso que os dois motivos saem daqui pelo mesmo campo — quem desenha a tela
 * não precisa saber qual dos dois aconteceu para decidir o que mostrar, só
 * para escrever a frase.
 *
 * O QUE ESTE MÓDULO NÃO DECIDE, E É DE PROPÓSITO
 * Ele não bloqueia nada. Bloqueio que só existe na interface é enfeite — o
 * `firestore.rules` já registra essa lição em `isAdmin()`, onde `suspenso`
 * nega para TODAS as coleções de uma vez: *"o parceiro suspenso continuaria
 * com token válido e continuaria escrevendo por qualquer outro caminho —
 * outro aparelho, uma aba antiga, um script"*.
 *
 * Então a mesma conta que sai daqui precisa sair também da rule, e as duas
 * precisam concordar. Aqui é a tela; lá é a tranca.
 *
 * A TOLERÂNCIA NÃO É GENEROSIDADE, É CALENDÁRIO
 * PIX não é recorrente: todo mês o motorista precisa lembrar e agir, e ele
 * trabalha das 6h às 19h. Esquecer três dias é normal; esquecer dez é
 * decisão. O bloqueio precisa cair depois da fronteira entre as duas, senão o
 * primeiro bloqueio injusto vira reclamação — e o `negocio.md` avisa que numa
 * rede de indicação a reclamação viaja mais rápido que a indicação.
 *
 * ESTE ARQUIVO NÃO IMPORTA NADA, e é o que o mantém testável sem Firebase
 * (`npm run testar:conta`). O "agora" entra por parâmetro pelo mesmo motivo de
 * `trial.js`: regra de data que lê o relógio da máquina passa em setembro e
 * falha em março.
 */

import { estadoDoTrial } from './trial.js';

/** Dias de atraso tolerados antes de a conta inativar. */
export const TOLERANCIA_DE_ATRASO = 10;

/** Os avisos de PIX antes do bloqueio: no vencimento e no meio do caminho. */
export const AVISO_DE_ATRASO = [0, 5];

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Normaliza Date, número, texto ou Timestamp do Firestore.
 *
 * O Timestamp chega como objeto com `toDate()`, e este módulo não pode
 * importar o SDK para reconhecê-lo por tipo. Reconhece pelo formato, que é o
 * que sobra quando não se pode importar.
 */
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

/**
 * Há quantos dias a fatura venceu. Negativo = ainda não venceu.
 * `null` quando não há fatura em aberto — que é o caso comum.
 */
export function diasDeAtraso(fatura, agora) {
  if (!fatura || fatura.status === 'quitada') return null;
  const venc = paraData(fatura.vencimento);
  const hoje = paraData(agora);
  if (!venc || !hoje) return null;
  return Math.floor((hoje.getTime() - venc.getTime()) / MS_POR_DIA);
}

/**
 * A assinatura cobre o dia de hoje?
 *
 * `assinaturaAte` é o campo que responde "até quando esta conta está paga", e
 * ele existe porque nenhuma regra do Firestore alcança o contrato: o id dele é
 * `${tioUid}_${Date.now()}`, que não se calcula. Sem um campo em `users`, a
 * tranca por fim de trial não teria como poupar quem já assinou — e o primeiro
 * cliente pagante seria bloqueado no dia 90.
 *
 * Quem escreve é quem cobra, nunca o motorista. É a mesma forma de
 * `limiteCriancas`, e pelo mesmo motivo: cláusula que o devedor edita não é
 * cláusula.
 */
export function assinaturaValida(assinaturaAte, agora) {
  const ate = paraData(assinaturaAte);
  const hoje = paraData(agora);
  if (!ate || !hoje) return false;
  return hoje.getTime() < ate.getTime();
}

/**
 * Até quando uma fatura paga deixa a conta em dia.
 *
 * Pagar a fatura de maio cobre até o FIM DE JUNHO. Parece generoso e não é: a
 * fatura de junho vence dentro de junho, e quem não a pagar é bloqueado pelo
 * caminho do atraso — que é mais curto. Este campo é o PISO ("ele é cliente"),
 * e a fatura em aberto é a lâmina.
 *
 * O mês entra como 'AAAA-MM', que é o formato que `faturasParceiro` já usa.
 */
export function assinaturaAteDoMes(mes) {
  const m = String(mes || '').trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  const ano = Number(m.slice(0, 4));
  const numero = Number(m.slice(5, 7));
  // Dia 0 do mês seguinte ao seguinte = último dia do mês seguinte.
  // Meio-dia, e não meia-noite: fuso de uma hora não pode roubar um dia.
  return new Date(ano, numero + 1, 0, 12, 0, 0);
}

/**
 * ⚠️ ESTA FATURA DE R$ 0 DEVE ESTENDER `assinaturaAte`?
 *
 * Fatura zerada tambem e fatura paga: o fundador vitalicio, o desconto somado
 * em 100% e a isencao concedida produzem `total: 0`, e nenhum deles passa por
 * `marcarFaturaPaga` (o botao de baixa so aparece em fatura aberta) nem pelo
 * webhook. Sem alguem escrever `assinaturaAte`, o primeiro motorista da
 * plataforma — o que nao paga por decisao — era bloqueado no dia 90 com a
 * fatura marcada como quitada.
 *
 * ⚠️ MAS A ISENCAO DO TESTE E DIFERENTE EM ESPECIE, e confundir as duas destroi
 * o paywall. O teste JA TEM relogio proprio (`trialInicio`), e `estadoDaConta`
 * devolve `ativa` no instante em que ve `assinaturaAte` no futuro — ANTES de
 * chegar na checagem do trial. Estender a assinatura por causa de uma fatura de
 * teste sobrescreve o relogio do teste por um mais longo:
 *
 *   - a conta continua destravada depois do dia 90, nas rules inclusive
 *     (`isAdmin()` le `assinaturaAte`);
 *   - `avisoDoTrial` emudece, porque `temContrato` vira true e os tres avisos
 *     nunca disparam;
 *   - e quando a data enfim vence, `jaFoiCliente` e true e a pessoa recebe a
 *     frase do ATRASO — "sua fatura venceu" para quem nunca teve fatura.
 *
 * Uma isencao que a plataforma CONCEDEU e um acordo; um mes de teste e o
 * relogio correndo. So o primeiro compra tempo de assinatura.
 *
 * Regra pura porque quem a executa (`fecharFatura`) mora atras do Firestore e
 * nao e testavel — e esta decisao vale meses de acesso gratuito.
 */
export function faturaZeradaEstendeAssinatura({ total, isencaoDeTeste = false } = {}) {
  if (Number(total) !== 0) return false;
  return !isencaoDeTeste;
}

/**
 * O estado da conta do motorista.
 *
 *   { ativa: true,  motivo: null }         opera normalmente
 *   { ativa: false, motivo: 'trial' }      o teste acabou e não há contrato
 *   { ativa: false, motivo: 'atraso' }     a fatura passou da tolerância
 *
 * A ORDEM DA CHECAGEM É PARTE DA REGRA. Suspensão vem primeiro porque é
 * decisão de uma pessoa e não pode ser desfeita por um pagamento; depois o
 * atraso, que é o caso de quem já foi cliente; e o trial por último, porque
 * quem tem contrato nunca está em trial.
 *
 * `suspenso` continua sendo o que ele sempre foi: a única via em que alguém
 * decide. Aqui ele só entra na conta para a tela não mostrar dois cartões
 * dizendo coisas diferentes sobre a mesma conta bloqueada.
 */
export function estadoDaConta({
  suspenso = false,
  trialInicio = null,
  assinaturaAte = null,
  fatura = null,
  agora = null,
  tolerancia = TOLERANCIA_DE_ATRASO,
} = {}) {
  if (suspenso === true) return { ativa: false, motivo: 'suspenso', dias: null };

  const atraso = diasDeAtraso(fatura, agora);
  if (atraso !== null && atraso > tolerancia) {
    return { ativa: false, motivo: 'atraso', dias: atraso };
  }

  const paga = assinaturaValida(assinaturaAte, agora);
  if (paga) return { ativa: true, motivo: null, dias: atraso };

  // JÁ FOI CLIENTE E DEIXOU DE SER recebe a frase do atraso, não a do teste.
  // Dizer "seu teste acabou" a quem pagou meses é uma mentira que ele
  // reconhece na hora — e quem desconfia da cobrança para de pagar.
  const jaFoiCliente = paraData(assinaturaAte) !== null;

  // `estadoDoTrial` já responde 'contratado' quando há assinatura, e é por
  // isso que o sinal atravessa até ele em vez de virar um `if` daqui.
  const trial = estadoDoTrial({ inicio: trialInicio, agora, temContrato: paga });
  if (trial === 'expirado') {
    // ⚠️ TRÊS MOTIVOS, E NÃO DOIS — `renovar` NÃO É `atraso`.
    //
    // Quem já foi cliente recebia `motivo: 'atraso'`, e a tela do atraso diz
    // "está em aberto há mais de dez dias". Mas este ramo dispara no DIA
    // SEGUINTE ao fim da cobertura, e `dias` vem `null` porque o guarda não
    // passa fatura (de propósito, para não abrir uma segunda assinatura).
    //
    // O resultado era um pagante em dia com o mês, que só não renovou, sendo
    // acusado de dez dias de inadimplência às seis da manhã. Cobrança que
    // erra o fato é o jeito mais rápido de perder quem estava pagando.
    //
    // `atraso` continua existindo e continua vindo da fatura vencida, no
    // ramo de cima — lá o número é real.
    return { ativa: false, motivo: jaFoiCliente ? 'renovar' : 'trial', dias: atraso };
  }

  return { ativa: true, motivo: null, dias: atraso };
}

/**
 * O lembrete de PIX do dia — ou `null`, que é a resposta na maioria dos dias.
 *
 * Dois momentos, e não uma contagem diária: no vencimento e no quinto dia. É
 * a mesma lição de `avisoDoMomento` e de `trial.js` — lembrete diário ensina a
 * pular lembrete, e o único que precisa ser lido é o último.
 *
 * Devolve o NÍVEL e quantos dias faltam para o bloqueio, porque é isso que a
 * frase precisa dizer. "Em atraso" sem prazo não informa nada acionável.
 */
export function lembreteDeAtraso({ fatura, agora, tolerancia = TOLERANCIA_DE_ATRASO } = {}) {
  const atraso = diasDeAtraso(fatura, agora);
  if (atraso === null || atraso < 0) return null;
  if (atraso > tolerancia) return null; // Passou: já não é lembrete, é bloqueio.

  const faltam = tolerancia - atraso + 1;
  if (atraso >= AVISO_DE_ATRASO[1]) return { nivel: 'atrasada', dias: atraso, faltam };
  if (atraso >= AVISO_DE_ATRASO[0]) return { nivel: 'vence-hoje', dias: atraso, faltam };
  return null;
}
