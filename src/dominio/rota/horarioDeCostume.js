/**
 * O HORÁRIO DE COSTUME — a que horas a criança costuma ENTRAR NA PERUA em
 * casa e CHEGAR EM CASA na volta (03/10/2026, pedido do dono).
 *
 * A chegada na escola é quase fixa (o portão abre na mesma hora); o que varia
 * são as pontas da casa, e é sobre elas que a família se organiza ("desço às
 * 6h40 ou às 6h50?"). O motorista combinou uma hora, mas o que acontece de
 * verdade é outra — e os dois lados ganham vendo as duas.
 *
 * ⚠️ MEDIANA, NÃO MÉDIA. Um dia fora da curva — a criança que passou mal e foi
 * "levada de volta para casa" às 7h, o dia de prova que saiu mais cedo —
 * puxaria a média e mentiria sobre todos os outros dias. A mediana ignora o
 * dia raro.
 *
 * ⚠️ PISO DE TRÊS VIAGENS. Com uma ou duas, "de costume" seria só "da última
 * vez", e a tela estaria afirmando um hábito que não existe.
 *
 * A fonte são os marcos de `children/{id}/rides/{dia}`, que duram 60 dias
 * (`apagarViagensAntigas`) — então "de costume" é, no máximo, dos últimos dois
 * meses, que é também o que interessa: horário de fevereiro não diz nada
 * sobre outubro. `embarqueEmCasa` existe desde 03/10/2026; viagens mais
 * antigas não têm esse marco e simplesmente não entram na conta.
 *
 * Puro, sem import: testado em `npm run testar:costume`.
 */

export const MINIMO_DE_VIAGENS = 3;

/** Date (ou Timestamp do Firestore, ou ISO) → minutos do dia no relógio do aparelho. */
export function minutoDoDia(valor) {
  if (!valor) return null;
  const d =
    typeof valor?.toDate === 'function'
      ? valor.toDate()
      : valor instanceof Date
        ? valor
        : new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

/** A mediana de uma lista de minutos, ou null abaixo do piso. */
export function medianaDosMinutos(lista, minimo = MINIMO_DE_VIAGENS) {
  const ok = (lista || []).filter((m) => Number.isFinite(m)).sort((a, b) => a - b);
  if (ok.length < minimo) return null;
  const meio = Math.floor(ok.length / 2);
  const m = ok.length % 2 ? ok[meio] : (ok[meio - 1] + ok[meio]) / 2;
  return Math.round(m);
}

/**
 * As viagens do dia (os documentos de `rides`) viram o costume.
 * Devolve { embarque, chegada, viagens } — `embarque`/`chegada` em minutos do
 * dia, ou null quando não há viagens suficientes daquele marco.
 */
export function costumeDaCrianca(viagens) {
  const embarques = [];
  const chegadas = [];
  for (const v of viagens || []) {
    const m = v?.marcos || {};
    const e = minutoDoDia(m.embarqueEmCasa);
    const c = minutoDoDia(m.delivered);
    if (e != null) embarques.push(e);
    if (c != null) chegadas.push(c);
  }
  return {
    embarque: medianaDosMinutos(embarques),
    chegada: medianaDosMinutos(chegadas),
    viagens: Math.max(embarques.length, chegadas.length),
  };
}

/** 403 → "6h43". O formato falado, que é como a família diz a hora. */
export function horaFalada(minutos) {
  if (!Number.isFinite(minutos)) return '';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}
