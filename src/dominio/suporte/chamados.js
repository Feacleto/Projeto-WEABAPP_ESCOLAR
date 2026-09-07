/**
 * OS CHAMADOS DE SUPORTE — quem pediu ajuda, e há quanto tempo espera.
 *
 * ── POR QUE ISTO PRECISOU EXISTIR
 * `supportTickets` recebia desde sempre. O motorista E o responsável abrem
 * chamado pelo menu de perfil, a coleção grava, as rules liberam o dono — e
 * **nenhuma tela do dono lia**. Os chamados caíam num buraco.
 *
 * Isso não é falta de recurso, é uma promessa quebrada em silêncio: quem pede
 * ajuda e não recebe resposta cancela, e não diz por quê.
 *
 * ── CHAMADO DE RESPONSÁVEL NÃO É CHAMADO DE MOTORISTA
 * O responsável é cliente do MOTORISTA, não da plataforma. Responder direto a
 * ele passa por cima de quem presta o serviço — e, pior, dá a ele um canal com
 * a plataforma que o motorista não sabe que existe.
 *
 * Os dois entram na mesma caixa (ignorar um deles seria o problema de novo),
 * mas separados: o de responsável normalmente vira "avisar o motorista dele",
 * e é a tela que precisa dizer isso.
 *
 * ── O QUE ORDENA A CAIXA É A ESPERA, NÃO A DATA
 * Mais antigo primeiro entre os que aguardam. Ordenar por recente é o padrão de
 * caixa de e-mail e é o oposto do que uma fila de suporte precisa: quem espera
 * há três dias é exatamente quem some sem avisar.
 *
 * ── ESTE ARQUIVO NÃO IMPORTA NADA, e é o que o mantém testável
 * (`npm run testar:chamados`). O "agora" entra por parâmetro pelo mesmo motivo
 * dos outros módulos de data: regra que lê o relógio da máquina passa hoje e
 * falha em março.
 */

/**
 * Os três estados, e o que cada um significa para quem abre a caixa.
 *
 *   aberto      ninguém respondeu ainda — é o que a fila conta
 *   respondido  a plataforma falou; o assunto pode continuar
 *   fechado     acabou
 *
 * `respondido` existe separado de `fechado` de propósito. Fundi-los faria
 * "respondi" e "resolvi" virarem a mesma coisa — e a maior parte dos chamados
 * de suporte precisa de uma segunda mensagem antes de acabar. Sem o estado do
 * meio, ou a caixa nunca esvazia, ou fecha o que não terminou.
 */
export const ABERTO = 'open';
export const RESPONDIDO = 'respondido';
export const FECHADO = 'fechado';

/** Só estes contam como "precisa de você". */
const AGUARDANDO = [ABERTO];

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Normaliza Date, número, texto ou Timestamp do Firestore. */
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

/** Está esperando resposta? Chamado sem status é ABERTO — nunca o contrário. */
export function aguardando(chamado) {
  return AGUARDANDO.includes(chamado?.status || ABERTO);
}

/**
 * Há quantos dias este chamado está esperando. `null` quando já foi tratado
 * ou quando não há data — e `null` não é zero: zero é "chegou hoje".
 */
export function diasEsperando(chamado, agora = new Date()) {
  if (!aguardando(chamado)) return null;
  const criado = paraData(chamado?.createdAt);
  const hoje = paraData(agora);
  if (!criado || !hoje) return null;
  return Math.max(0, Math.floor((hoje.getTime() - criado.getTime()) / MS_POR_DIA));
}

/**
 * A caixa, na ordem em que se trabalha nela.
 *
 * Quem espera vem primeiro, e entre eles o MAIS ANTIGO na frente — o oposto de
 * uma caixa de e-mail. Depois vêm respondidos e fechados, esses sim do mais
 * recente para o mais velho, porque ali a pergunta é "o que aconteceu por
 * último".
 */
// Ela NÃO recebe "agora", e a ausência é o ponto: a ordem depende só de status
// e data de criação. Se dependesse do relógio, a lista se reordenaria debaixo do
// dedo de quem está lendo — a cada render, sem nada ter mudado.
export function ordenarChamados(chamados = []) {
  const lista = Array.isArray(chamados) ? [...chamados] : [];
  return lista.sort((a, b) => {
    const ea = aguardando(a);
    const eb = aguardando(b);
    if (ea !== eb) return ea ? -1 : 1;

    const da = paraData(a?.createdAt)?.getTime() ?? 0;
    const db = paraData(b?.createdAt)?.getTime() ?? 0;
    // Esperando: mais antigo primeiro. Tratado: mais recente primeiro.
    return ea ? da - db : db - da;
  });
}

/**
 * O resumo que a fila do dia consome.
 *
 * `esperandoHaMais` é o que decide a urgência: um chamado de três dias e dez de
 * hoje não são a mesma situação, e a contagem sozinha não distingue os dois.
 *
 * `null` quando não há ninguém esperando — e de novo, não é zero. Zero dias
 * significa "chegou hoje e ainda não respondi", que é uma frase diferente de
 * "não há nada na fila".
 */
export function resumirChamados(chamados = [], agora = new Date()) {
  const lista = Array.isArray(chamados) ? chamados : [];
  const abertos = lista.filter(aguardando);

  let maisAntigo = null;
  abertos.forEach((c) => {
    const dias = diasEsperando(c, agora);
    if (dias !== null && (maisAntigo === null || dias > maisAntigo)) maisAntigo = dias;
  });

  return {
    total: lista.length,
    esperando: abertos.length,
    deMotorista: abertos.filter((c) => c?.role === 'admin').length,
    deResponsavel: abertos.filter((c) => c?.role !== 'admin').length,
    esperandoHaMais: maisAntigo,
  };
}

/**
 * O texto da resposta, já com o contexto do chamado dentro.
 *
 * Ele repete o que a pessoa escreveu — e isso não é enfeite: entre abrir o
 * chamado e receber a resposta passaram dias, e ela já não lembra qual dos
 * problemas dela é este. Uma resposta que começa em "sobre o que você me
 * escreveu" obriga a pessoa a adivinhar.
 *
 * O texto sai pronto e EDITÁVEL: quem responde lê antes de mandar. É a mesma
 * regra da proposta ao motorista.
 */
export function mensagemDeResposta(chamado, rotuloDaCategoria) {
  const nome = String(chamado?.nome || '').trim().split(/\s+/)[0];
  const trecho = String(chamado?.description || '').trim().slice(0, 180);

  return (
    `Oi${nome ? ` ${nome}` : ''}! Aqui é do Alô Buzinou.\n\n` +
    `Sobre o que você nos escreveu` +
    (rotuloDaCategoria ? ` (${rotuloDaCategoria.toLowerCase()})` : '') +
    `:\n"${trecho}${trecho.length >= 180 ? '…' : ''}"\n\n`
  );
}
