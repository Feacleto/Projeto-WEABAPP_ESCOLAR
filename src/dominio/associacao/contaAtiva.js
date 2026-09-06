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
  temContrato = false,
  fatura = null,
  agora = null,
  tolerancia = TOLERANCIA_DE_ATRASO,
} = {}) {
  if (suspenso === true) return { ativa: false, motivo: 'suspenso', dias: null };

  const atraso = diasDeAtraso(fatura, agora);
  if (atraso !== null && atraso > tolerancia) {
    return { ativa: false, motivo: 'atraso', dias: atraso };
  }

  // Quem tem contrato nunca está em trial — `estadoDoTrial` já responde
  // 'contratado' nesse caso, e é por isso que `temContrato` atravessa até
  // aqui em vez de virar um `if` neste arquivo.
  const trial = estadoDoTrial({ inicio: trialInicio, agora, temContrato });
  if (trial === 'expirado') return { ativa: false, motivo: 'trial', dias: null };

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
