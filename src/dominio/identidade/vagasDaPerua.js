/**
 * A PERUA EM VAGAS (05/10/2026, decisão do dono) — régua pura.
 *
 * O motorista diz quantas VAGAS para crianças a perua tem, e o app desenha a
 * perua como o mapa de assentos de um avião: na frente o volante ("Tio") e a
 * auxiliar ("Aux"), que NÃO contam como vaga; atrás, fileiras de três com o
 * corredor no meio, e a última fileira com o que sobrar.
 *
 * ── ⚠️ A PALAVRA É "VAGA", NUNCA A OUTRA
 * Cadeira com número parece cadeira marcada, e o pai que visse isso cobraria
 * a janela. Por isso as cadeiras não têm número e as crianças preenchem a
 * perua NA ORDEM DO CADASTRO: o desenho CONTA vagas, não diz onde cada uma
 * senta. `npm run testar:vagas-da-perua` reprova a outra palavra nas telas
 * da perua.
 *
 * ── ⚠️ NUNCA TRAVA
 * Passou das vagas, a tela pergunta e deixa (`passaDasVagas`). Nenhuma rule
 * compara vagas com crianças, e o desenho mostra as excedentes numa fileira
 * "acima das vagas" em vez de dar erro: a perua real pode ter ganho um banco,
 * e o número que ele disse é dele, não uma cláusula.
 *
 * ── QUEM VÊ
 * Só o motorista. A família não vê a perua nem as outras crianças, e a
 * auxiliar não vê vagas — o teste reprova o import nas telas das duas.
 *
 * O número mora em `configFinanceiro/{uid}.vagasDaPerua` (nunca em `users`,
 * que as famílias leem inteiro). Puro: sem Firebase, sem React.
 */

export const VAGAS_MINIMO = 1;
export const VAGAS_MAXIMO = 60;
/** O número que o passo do primeiro acesso mostra antes do primeiro toque. */
export const VAGAS_SUGERIDAS = 15;

/** `true` só para inteiro de 1 a 60 — o mesmo que a rule aceita. */
export function vagasValidas(n) {
  return Number.isInteger(n) && n >= VAGAS_MINIMO && n <= VAGAS_MAXIMO;
}

/**
 * O número PRONTO PARA GRAVAR, sempre inteiro, ou erro com a frase da tela.
 *
 * ⚠️ A rule exige `is int`. Texto de campo ("15") ou número quebrado (15.5)
 * chegariam ao Firestore como string ou double e seriam recusados — então a
 * conversão acontece AQUI, uma vez, e o service grava só o que sai daqui.
 * Quebrado não é arredondado: "15,5 vagas" é engano de digitação, não meia
 * criança.
 */
export function vagasParaGravar(valor) {
  const texto = typeof valor === 'string' ? valor.trim() : valor;
  const n = typeof texto === 'string' && /^\d+$/.test(texto) ? Number.parseInt(texto, 10) : texto;
  if (!vagasValidas(n)) {
    throw new Error(`A perua tem de ${VAGAS_MINIMO} a ${VAGAS_MAXIMO} vagas.`);
  }
  return n;
}

/** Prende o número do − e + entre o mínimo e o máximo. */
export function limitarVagas(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return VAGAS_SUGERIDAS;
  return Math.min(VAGAS_MAXIMO, Math.max(VAGAS_MINIMO, v));
}

/**
 * As fileiras da perua, com o ÍNDICE de cada vaga (0, 1, 2…).
 *
 * Fileiras de três (duas à esquerda do corredor, uma à direita) enquanto
 * sobrarem mais de quatro; a última leva o resto, de uma a quatro — é o
 * banco de trás inteiro, sem corredor. Com 15: cinco fileiras de três.
 */
export function fileirasDaPerua(n) {
  const total = Number.isInteger(n) && n > 0 ? n : 0;
  const fileiras = [];
  let i = 0;
  while (total - i > 4) {
    fileiras.push([i, i + 1, i + 2]);
    i += 3;
  }
  const ultima = [];
  while (i < total) ultima.push(i++);
  if (ultima.length) fileiras.push(ultima);
  return fileiras;
}

/** A última fileira é o banco de trás (sem corredor) quando não tem três. */
export function ehBancoDeTras(fileiras, k) {
  return k === fileiras.length - 1 && fileiras[k].length !== 3;
}

function quantas(criancas) {
  if (Array.isArray(criancas)) return criancas.length;
  const n = Number(criancas);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Quantas vagas estão ocupadas, livres e quantas crianças passam delas.
 * `criancas` é a lista das ATIVAS ou só o número.
 */
export function ocupacao({ vagas, criancas }) {
  const v = vagasValidas(vagas) ? vagas : 0;
  const n = quantas(criancas);
  return {
    vagas: v,
    criancas: n,
    ocupadas: Math.min(n, v),
    livres: Math.max(v - n, 0),
    acima: Math.max(n - v, 0),
  };
}

function data(valor) {
  if (!valor) return Infinity;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (typeof valor.seconds === 'number') return valor.seconds * 1000;
  if (valor instanceof Date) return valor.getTime();
  const t = new Date(valor).getTime();
  return Number.isNaN(t) ? Infinity : t;
}

/**
 * As crianças na ordem do cadastro — é assim que elas "entram" na perua.
 * Sem data vai para o fim; empate desempata pelo nome, para o desenho não
 * trocar de lugar entre uma abertura e outra.
 */
export function emOrdemDeCadastro(criancas = []) {
  return [...(criancas || [])].sort(
    (a, b) =>
      data(a?.createdAt) - data(b?.createdAt) ||
      String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR')
  );
}

/**
 * As vagas desenhadas: `{ vagas: [{ indice, crianca|null }], acima: [crianca] }`.
 * As primeiras crianças (na ordem do cadastro) ocupam as vagas; as que
 * sobram vão para `acima`, que a tela mostra numa fileira à parte.
 */
export function vagasDesenhadas({ vagas, criancas = [] }) {
  const v = vagasValidas(vagas) ? vagas : 0;
  const lista = emOrdemDeCadastro(criancas);
  return {
    vagas: Array.from({ length: v }, (_, indice) => ({ indice, crianca: lista[indice] || null })),
    acima: lista.slice(v),
  };
}

/**
 * Cadastrar MAIS UMA criança passa das vagas? (`ativas` já é ≥ vagas.)
 * Sem número de vagas não há o que perguntar.
 */
export function passaDasVagas({ vagas, ativas }) {
  if (!vagasValidas(vagas)) return false;
  return quantas(ativas) >= vagas;
}

const plural = (n, um, varios) => (n === 1 ? um : varios);

/** As frases das telas da perua. */
export function frasesDaPerua({ vagas, criancas }) {
  const o = ocupacao({ vagas, criancas });
  let situacao;
  if (o.acima > 0) situacao = `${o.acima} ${plural(o.acima, 'criança acima das vagas', 'crianças acima das vagas')}`;
  else if (o.livres === 0) situacao = 'Nenhuma vaga livre';
  else situacao = `${o.livres} ${plural(o.livres, 'vaga livre', 'vagas livres')}`;
  return {
    contagem: `${o.criancas} de ${o.vagas} ${plural(o.vagas, 'vaga', 'vagas')}`,
    situacao,
    numero: `${o.vagas} ${plural(o.vagas, 'vaga', 'vagas')}`,
    passouTitulo: 'Passou das vagas que você disse',
    passouPergunta: `Sua perua tem ${o.vagas} ${plural(o.vagas, 'vaga', 'vagas')} e já leva ${o.criancas} ${plural(o.criancas, 'criança', 'crianças')}. Quer continuar?`,
  };
}
