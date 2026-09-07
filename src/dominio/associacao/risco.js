/**
 * O TERMÔMETRO DE RISCO — por que este associado pode estar de saída.
 *
 * ── ELE NÃO É UM SCORE, É UMA LISTA DE MOTIVOS
 * Score sem explicação ninguém usa duas vezes: o número aparece, a pessoa não
 * sabe o que fazer com ele, e na terceira vez para de olhar. Aqui o número
 * existe só para ORDENAR a lista; o que decide é a frase que diz por quê.
 *
 * ── QUATRO SINAIS, E TODOS JÁ EXISTIAM NO BANCO
 * Nenhum deles precisou de coleta nova. Três saem de dado que a operação já
 * gera, e o quarto — a série de crianças — estava escondido à vista: cada
 * fatura guarda `criancasAtivas` do mês em que foi fechada, então o histórico
 * de faturas JÁ É uma série temporal por motorista.
 *
 *   parou de rodar        `users.ultimaRota`
 *   está encolhendo       série de `criancasAtivas` nas faturas
 *   atrasou               `faturasParceiro` vencida e aberta
 *   famílias reclamando   média das avaliações dele
 *
 * ── "NUNCA RODOU" NÃO É "PAROU DE RODAR"
 * Quem nunca iniciou uma rota não está em risco de sair: ele ainda não entrou.
 * Esse caso é um DEGRAU (`carteira.js`), não um sinal — e confundir os dois
 * encheria a fila de gente que acabou de se cadastrar.
 *
 * ── A DATA É O SINAL PRINCIPAL, O CONTADOR É O COMPLEMENTO
 * `ultimaRota` é uma data e não desanda. `rotasNoMes` é um contador, e contador
 * desanda — `criancasAtivas` já ensinou isso aqui. Por isso o risco se decide
 * pela data, e o contador só aparece na ficha como contexto.
 *
 * ESTE ARQUIVO NÃO IMPORTA NADA (`npm run testar:risco`). O "agora" entra por
 * parâmetro pelo mesmo motivo dos outros: regra de data que lê o relógio da
 * máquina passa hoje e falha em março.
 */

/** Dias sem rodar que acendem o sinal — e depois, o vermelho. */
export const DIAS_SEM_RODAR = 7;
export const DIAS_SEM_RODAR_GRAVE = 14;

/** Queda de crianças que conta como encolhimento. */
export const QUEDA_MINIMA = 3;

/** Nota média abaixo disso, com opiniões suficientes, é reclamação. */
export const NOTA_BAIXA = 3.5;
export const AVALIACOES_MINIMAS = 3;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

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

/** Há quantos dias ele não roda. `null` se nunca rodou — ver o cabeçalho. */
export function diasSemRodar(motorista, agora = new Date()) {
  const ultima = paraData(motorista?.ultimaRota);
  const hoje = paraData(agora);
  if (!ultima || !hoje) return null;
  return Math.max(0, Math.floor((hoje.getTime() - ultima.getTime()) / MS_POR_DIA));
}

/**
 * Quantas crianças ele perdeu desde a fatura mais antiga que temos.
 *
 * A SÉRIE SAI DAS FATURAS, e isso é de graça: `fecharFatura` grava
 * `criancasAtivas` dentro de cada uma. Sem elas não há histórico nenhum — o
 * documento do usuário só guarda o número de HOJE.
 *
 * `null` com menos de duas faturas: uma medição não é uma tendência, e chamar
 * de queda o que é só o primeiro ponto seria inventar um sinal.
 */
export function criancasPerdidas(faturas = []) {
  const serie = (Array.isArray(faturas) ? faturas : [])
    .filter((f) => f && typeof f.criancasAtivas === 'number' && f.mes)
    .sort((a, b) => String(a.mes).localeCompare(String(b.mes)));

  if (serie.length < 2) return null;
  const pico = Math.max(...serie.map((f) => f.criancasAtivas));
  const agora = serie[serie.length - 1].criancasAtivas;
  return Math.max(0, pico - agora);
}

/**
 * O risco deste associado, e os motivos.
 *
 * Devolve `{ nivel, sinais }`, com `nivel` em 'alto' | 'atencao' | 'nenhum' e
 * `sinais` sendo a lista de frases que a ficha mostra.
 *
 * ⚠️ SÓ QUEM ESTÁ DENTRO É AVALIADO. Quem nunca rodou, quem está bloqueado e
 * quem foi suspenso já têm um degrau próprio na carteira — medir risco de saída
 * de quem já saiu, ou de quem ainda não entrou, enche a fila de ruído e faz o
 * dono parar de olhar para ela.
 */
export function riscoDo({
  motorista,
  faturas = [],
  nota = null,
  degrau = null,
  agora = new Date(),
} = {}) {
  const sinais = [];
  if (degrau === 'nao_comecou' || degrau === 'bloqueado') {
    return { nivel: 'nenhum', sinais };
  }

  let grave = false;

  // 1. PAROU DE RODAR. É o sinal mais forte porque é o mais precoce: ele
  // abandona semanas antes de deixar de pagar.
  const parado = diasSemRodar(motorista, agora);
  if (parado !== null && parado >= DIAS_SEM_RODAR) {
    if (parado >= DIAS_SEM_RODAR_GRAVE) grave = true;
    sinais.push({
      id: 'parou',
      texto: `não roda há ${parado} ${parado === 1 ? 'dia' : 'dias'}`,
    });
  }

  // 2. ESTÁ ENCOLHENDO. Perder criança é perder receita antes de perder o
  // cliente — e é o único sinal que aparece enquanto ele ainda paga em dia.
  const perdidas = criancasPerdidas(faturas);
  if (perdidas !== null && perdidas >= QUEDA_MINIMA) {
    sinais.push({
      id: 'encolhendo',
      texto: `perdeu ${perdidas} ${perdidas === 1 ? 'criança' : 'crianças'} desde o pico`,
    });
  }

  // 3. ATRASOU. Vem por último entre os objetivos porque é o mais tardio: a
  // essa altura os outros três já deveriam ter avisado.
  const vencida = (Array.isArray(faturas) ? faturas : []).find((f) => {
    if (!f || f.status !== 'aberta') return false;
    const venc = paraData(f.vencimento);
    const hoje = paraData(agora);
    return venc && hoje && hoje.getTime() > venc.getTime();
  });
  if (vencida) {
    grave = true;
    sinais.push({ id: 'atrasado', texto: `fatura de ${vencida.mes} vencida` });
  }

  // 4. FAMÍLIAS RECLAMANDO. Com poucas opiniões a média é ruído — uma nota 1
  // isolada não diz nada sobre o serviço, diz sobre um dia ruim.
  if (nota && nota.n >= AVALIACOES_MINIMAS && nota.media < NOTA_BAIXA) {
    sinais.push({
      id: 'nota',
      texto: `nota ${nota.media.toFixed(1)} em ${nota.n} avaliações`,
    });
  }

  if (!sinais.length) return { nivel: 'nenhum', sinais };
  return { nivel: grave ? 'alto' : 'atencao', sinais };
}

/** Para ordenar a lista: quanto maior, mais em cima. */
export function pesoDoRisco(nivel) {
  if (nivel === 'alto') return 2;
  if (nivel === 'atencao') return 1;
  return 0;
}
