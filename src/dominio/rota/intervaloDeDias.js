// A extensão `.js` é explícita de propósito: este módulo é carregado direto
// pelo Node em `scripts/testar-horarios.mjs`, e o resolvedor de ESM do Node
// não completa extensão como o Vite completa.
import { getDateKey } from './horarios.js';

/**
 * Intervalos de dias — a parte PURA do aviso de "sem aula".
 *
 * Mora fora de `broadcastService` porque aquele arquivo importa o Firestore e
 * esta é a lógica que precisa de teste: um erro aqui gera ausência no dia
 * errado, e o pai descobre isso com a criança esperando na porta.
 */

/** Teto de dias por aviso. Protege contra o dedo escorregando no ano. */
export const MAX_DIAS = 31;

export function parseDia(chave) {
  const partes = String(chave || '').split('-');
  if (partes.length !== 3) return null;
  const [y, m, d] = partes.map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  // Rejeita data que "rolou" — '2026-02-31' vira 3 de março no construtor do
  // Date, e um aviso pra um dia que não existe é pior que um aviso recusado.
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

export function chaveDoDia(date) {
  // MESMA REGRA, UMA IMPLEMENTAÇÃO SÓ.
  //
  // Isto era uma cópia linha a linha do `getDateKey` de horariosService, cada
  // uma com seu comentário explicando a escolha de hora local sobre UTC. As
  // duas concordavam — e são justamente as duas que gravam ausência, então o
  // modo de falha de uma divergência é gravar falta no dia errado, com a
  // criança na porta.
  //
  // Importar não custa a testabilidade que este arquivo protege: nenhum dos
  // dois módulos importa Firebase.
  return getDateKey(date);
}

/**
 * Os dias ÚTEIS entre duas datas, inclusive.
 *
 * Sábado e domingo ficam de fora: a perua não roda, então uma ausência nesses
 * dias é um documento que ninguém lê e um dia a mais no texto do aviso —
 * dizendo ao responsável que não tem aula num dia em que ele já sabia.
 *
 * Devolve lista vazia (nunca lança) pra data inválida ou intervalo invertido:
 * quem chama precisa desabilitar o botão, não tratar exceção.
 */
export function diasUteis(de, ate) {
  const inicio = parseDia(de);
  const fim = parseDia(ate || de);
  if (!inicio || !fim || fim < inicio) return [];

  const dias = [];
  const cursor = new Date(inicio);
  // O teto TRUNCA, e quem chama precisa saber disso.
  //
  // A tela dizia "Esse intervalo não tem dia útil (ou passa de 31 dias)", mas
  // esse ramo só roda quando a lista vem VAZIA — o que nunca acontece num
  // intervalo longo demais. Errando o ano no seletor (01/01 a 31/12), o
  // motorista via "31 dias úteis · de 01/01 a 12/02", com o botão habilitado,
  // e gravava 31 faltas que não pediu. `truncado` deixa a tela dizer a
  // verdade em vez de a lista mentir por omissão.
  while (cursor <= fim && dias.length < MAX_DIAS) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) dias.push(chaveDoDia(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

/**
 * O intervalo pedido não coube inteiro?
 *
 * `diasUteis` para no teto e devolve a lista curta, sem dizer nada. Quem
 * mostra o resultado precisa saber a diferença entre "são 31 dias" e "são os
 * 31 primeiros de um pedido bem maior" — a segunda frase é a que evita o
 * motorista gravar um mês de faltas achando que gravou um ano.
 */
export function truncouIntervalo(dias, fimChave) {
  if (!dias?.length || !fimChave) return false;
  return dias.length >= MAX_DIAS && dias[dias.length - 1] < fimChave;
}

export function rotuloDoDia(chave) {
  const d = parseDia(chave);
  if (!d) return String(chave || '');
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}

/** "24/08", "24/08 e 25/08", "de 24/08 a 28/08". */
export function rotuloDoPeriodo(dias) {
  if (!dias?.length) return '';
  if (dias.length === 1) return rotuloDoDia(dias[0]);
  if (dias.length === 2) return `${rotuloDoDia(dias[0])} e ${rotuloDoDia(dias[1])}`;
  return `de ${rotuloDoDia(dias[0])} a ${rotuloDoDia(dias[dias.length - 1])}`;
}
